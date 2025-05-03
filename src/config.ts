/**
 * @module config
 *
 * Configuration management module that provides a flexible way to load and access configuration values
 *
 * CONFIGURATION SOURCES: Configuration values can come from multiple optional sources, loaded in this order
 * (highest to lowest precedence):
 * 1. Values passed to the `overrides` parameter (optional)
 * 2. Values from the env file specified by --config flag (optional)
 * 3. Values from .env file in the package directory (optional)
 * 4. Default values (always included) and Deno.env environment variables
 *
 * MERGING VALUES: Values from available sources are merged together - lower priority values are preserved
 * if they aren't overridden by a higher priority source. For example, if your .env
 * file has `API_KEY=123` and `DEBUG=true`, then loading with `loadConfig({ API_KEY: '456' })`
 * will result in a config with `API_KEY=456` and `DEBUG=true`
 *
 * DEFAULT VALUES: If no sources are provided on load (no overrides, no --config flag, no .env file),
 * the configuration will only contain the default values. Each optional source
 * adds or overrides values when present
 *
 * @example
 * ```ts
 * // Run your application with a specific config file
 * deno run -A --config '/path/to/config.env' your_app.ts
 *
 * // Or place a .env file in the same directory as your executable
 * deno run -A your_app.ts
 * ```
 */

import { load as loadEnv } from '@std/dotenv'
import { parseArgs } from '@std/cli'
import { exists } from '@std/fs'
import { dirname, fromFileUrl, join } from '@std/path'

/**
 * Interface for a logger object compatible with the standard Console API.
 */
interface Logger {
  log(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  debug(...args: unknown[]): void
}

/**
 * Represents a possible configuration value which can be:
 * - A direct string value
 * - A function that returns a string or Promise<string>
 * - A Promise that resolves to a string
 */
type KeyValueConfig = string | (() => string | Promise<string>) | Promise<string>

/**
 * Represents an object of configuration key-value pairs
 */
type ConfigRecord = Record<string, KeyValueConfig>

// Default values - functions/promises will be resolved during initialization
const DEFAULT_VALUES: ConfigRecord = {
  DENO_ENV: 'development',
  PACKAGE_NAME: getPackageName, // Uncalled async function will be resolved during initialization
  PACKAGE_PATH: getPackagePath, // Uncalled async function will be resolved during initialization
  workspace: Deno.cwd(),
}

let values: Record<string, string> = {}
let configProxy: Record<string, string> | null = null
let initPromise: Promise<Record<string, string>> | null = null
let _internalLogger: Logger = console // Module-level logger instance

// Validate a config key (must be a string)
function validateKey(key: PropertyKey): string {
  if (typeof key !== 'string') {
    throw new TypeError(`Property name must be a string, got: ${typeof key}`)
  }
  if (key.length === 0) throw new RangeError('Property name cannot be empty')
  return key
}

/**
 * Internal logger function for the config module
 */
function logger(method: keyof Logger, ...args: unknown[]): void {
  // Use the module-level logger instance
  if (typeof _internalLogger[method] === 'function') {
    _internalLogger[method]('[CONFIG]', ...args)
  } else {
    // Fallback or error if method doesn't exist on custom logger
    console.warn(
      `[CONFIG] Logger method '${method}' not found on provided logger instance. Falling back to console.log.`,
    )
    console.log('[CONFIG]', ...args)
  }
}

/**
 * Gets a default package name derived from the main module path
 * Uses the resolved package path to determine the name. Falls back to import.meta.url
 * @returns {Promise<string>} The derived package name or a fallback
 */
async function getPackageName(): Promise<string> {
  // Inner helper to extract base name from a path or pathname string
  const extractBaseNameFromString = (inputString: string | undefined | null): string => {
    if (!inputString) return ''
    try {
      // Use URL parsing if it contains '://', otherwise treat as simple path
      const pathSegment = inputString.includes('://') ? new URL(inputString).pathname : inputString
      const lastSlash = pathSegment.lastIndexOf('/')
      const filename = lastSlash >= 0 ? pathSegment.substring(lastSlash + 1) : pathSegment
      // Remove extension only if a dot exists and it's not the first character
      const lastDot = filename.lastIndexOf('.')
      const baseName = (lastDot > 0) ? filename.substring(0, lastDot) : filename
      return baseName.trim() // Trim whitespace just in case
    } catch (err: unknown) {
      // Log specific error for debugging if URL parsing failed
      if (inputString.includes('://')) {
        logger(
          'warn',
          `Failed to parse URL string [${inputString}] during base name extraction: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
      }
      return '' // Return empty on any error during extraction
    }
  }

  let name = ''

  try {
    // Attempt 1: Get name from package path
    const packagePath = await getPackagePath().catch((err: unknown) => {
      logger(
        'warn',
        `Error getting package path: ${
          err instanceof Error ? err.message : String(err)
        }. Proceeding to fallbacks.`,
      )
      return null // Allow fallback if getPackagePath rejects
    })
    name = extractBaseNameFromString(packagePath)

    // Attempt 2: If no name yet, try import.meta.url
    if (!name) {
      const urlString = import.meta.url
      if (urlString) {
        logger(
          'warn',
          'Could not determine valid package name from package path. Trying import.meta.url.',
        )
        name = extractBaseNameFromString(urlString)
        if (!name) {
          logger('warn', 'Failed to extract name from import.meta.url.')
        }
      } else {
        logger('warn', 'import.meta.url is not available for fallback name.')
      }
    }
  } catch (err: unknown) {
    // Catch unexpected errors during the main logic flow
    logger(
      'error',
      `Unexpected error resolving package name: ${
        err instanceof Error ? err.message : String(err)
      }.`,
    )
    // Attempt fallback from import.meta.url one last time in case of unexpected error
    if (!name && import.meta.url) {
      name = extractBaseNameFromString(import.meta.url)
    }
  }

  // Final fallback if all attempts fail or result in an empty string
  return name || 'main_script'
}

async function getPackagePath(): Promise<string> {
  try {
    if (!Deno.mainModule) return Deno.cwd()

    const path = Deno.mainModule.startsWith('file:')
      ? dirname(fromFileUrl(Deno.mainModule))
      : dirname(Deno.mainModule)

    // Verify the path exists
    if (await exists(path)) {
      return path
    }
    return Deno.cwd()
  } catch (err: unknown) {
    logger(
      'warn',
      `Failed to resolve package path: ${
        err instanceof Error ? err.message : String(err)
      }. Using current directory instead.`,
    )
    return Deno.cwd()
  }
}

/**
 * Resolves an object by evaluating any function or promise values
 * If a value is a function, it will be called and its result used
 * If the function returns a promise, it will be awaited
 *
 * @param obj The object with potential function/promise values to resolve
 * @returns A new object with all values resolved to strings
 */
async function resolveObjectValues(
  obj: ConfigRecord,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    try {
      let resolvedValue: string

      if (typeof value === 'function') {
        // Call the function and await if it returns a promise
        resolvedValue = await value()
      } else if (value instanceof Promise) {
        // Await the promise
        resolvedValue = await value
      } else {
        // Use the value as is (should be string)
        resolvedValue = value
      }

      // Ensure final value is a string
      if (typeof resolvedValue !== 'string') {
        throw new Error(
          `Resolved value for key '${key}' is not a string (type: ${typeof resolvedValue})`,
        )
      }

      result[key] = resolvedValue
    } catch (err: unknown) {
      throw new Error(
        `Failed to resolve value for key '${key}': ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
    }
  }

  return result
}

/**
 * Creates a proxy that provides direct property access to config values
 * with direct modification of Deno.env
 */
function createConfigProxy(): Record<string, string> {
  if (configProxy) return configProxy

  // Create a handler
  const handler = {
    get: (target: Record<string, string>, prop: PropertyKey): string | undefined => {
      try {
        validateKey(prop)
        return target[prop as string] ?? Deno.env.get(prop as string)
      } catch (err: unknown) {
        logger(
          'error',
          `Error accessing configuration value for ${String(prop)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        return undefined // Return undefined on error
      }
    },
    set: (target: Record<string, string>, prop: PropertyKey, value: unknown): boolean => {
      try {
        const key = validateKey(prop)

        // Ensure value is a string before setting
        if (typeof value !== 'string') {
          logger(
            'warn',
            `Cannot set environment variable ${key} to non-string value: ${typeof value}`,
          )
          return false // Indicate failure for non-string types
        }

        target[key] = value
        Deno.env.set(key, value)
        return true // Return true on success
      } catch (err: unknown) {
        logger(
          'error',
          `Failed to set configuration value for ${String(prop)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        return false // Indicate failure on error
      }
    },
    // Optional: Add other traps like has, deleteProperty if needed, ensuring they update Deno.env
    deleteProperty: (target: Record<string, string>, prop: PropertyKey): boolean => {
      try {
        const key = validateKey(prop)
        if (key in target) {
          delete target[key]
          Deno.env.delete(key)
          return true
        }
        return false // Property didn't exist
      } catch (err: unknown) {
        logger(
          'error',
          `Failed to delete configuration value for ${String(prop)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        )
        return false
      }
    },
    has: (target: Record<string, string>, prop: PropertyKey): boolean => {
      try {
        const key = validateKey(prop)
        return key in target || Deno.env.has(key)
      } catch {
        return false // Invalid key type
      }
    },
    ownKeys: (target: Record<string, string>): string[] => {
      // Combine keys from the target object and Deno.env
      const targetKeys = Object.keys(target)
      const envKeys = Object.keys(Deno.env.toObject())
      return [...new Set([...targetKeys, ...envKeys])]
    },
    getOwnPropertyDescriptor: (
      target: Record<string, string>,
      prop: PropertyKey,
    ): PropertyDescriptor | undefined => {
      try {
        const key = validateKey(prop)
        if (key in target) {
          return {
            value: target[key],
            writable: true,
            enumerable: true,
            configurable: true,
          }
        }
        // Check Deno.env as fallback
        const envValue = Deno.env.get(key)
        if (envValue !== undefined) {
          return {
            value: envValue,
            writable: true, // Treat env vars as writable through the proxy
            enumerable: true,
            configurable: true,
          }
        }
        return undefined // Property not found
      } catch {
        return undefined // Invalid key type
      }
    },
  }

  // Create proxy around the final, resolved values
  configProxy = new Proxy(values, handler)
  return configProxy
}

/**
 * Initializes the configuration by loading values from environment file
 * and applying any overrides
 */
async function initializeConfig(overrides?: ConfigRecord): Promise<Record<string, string>> {
  logger('debug', 'Starting configuration initialization...')
  // 1. Start with defaults
  let combinedConfig: ConfigRecord = { ...DEFAULT_VALUES }
  logger('debug', 'Applied default values.')

  // 2. Merge environment variables (lower priority than defaults for matching keys)
  // Env vars should have lower precedence than defaults if keys match
  combinedConfig = { ...Deno.env.toObject(), ...combinedConfig }
  logger('debug', 'Merged environment variables.')

  // Helper to load env file and filter empty strings
  const loadAndFilterEnv = async (path: string): Promise<Record<string, string>> => {
    const rawConfig = await loadEnv({ envPath: path, export: false })
    const filteredConfig: Record<string, string> = {}
    for (const [key, value] of Object.entries(rawConfig)) {
      if (value !== '') { // Only include non-empty strings
        filteredConfig[key] = value
      }
    }
    return filteredConfig
  }

  // 3. Load .env file if it exists
  try {
    const packagePath = await combinedConfig.PACKAGE_PATH // Resolve package path
    const defaultEnvPath = typeof packagePath === 'string'
      ? join(packagePath, '.env')
      : join(Deno.cwd(), '.env')
    logger('debug', `Checking for default .env file at: ${defaultEnvPath}`)
    if (await exists(defaultEnvPath)) {
      logger('debug', 'Loading and filtering default .env file...')
      const defaultEnvConfig = await loadAndFilterEnv(defaultEnvPath) // Use helper
      // .env overrides env vars/defaults
      combinedConfig = { ...combinedConfig, ...defaultEnvConfig }
      logger('debug', 'Merged default .env file values.')
    }
  } catch (err: unknown) {
    logger(
      'warn',
      `Failed to check/load default .env file: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  // 4. Load custom config file if specified via --config
  let customConfigPath: string | undefined
  try {
    const args = parseArgs(Deno.args, {
      string: ['config'],
      alias: { c: 'config' },
    })
    customConfigPath = args.config

    if (customConfigPath) {
      logger('debug', `Checking for custom config file at: ${customConfigPath}`)
      if (await exists(customConfigPath)) {
        logger('debug', 'Loading and filtering custom config file...')
        const customEnvConfig = await loadAndFilterEnv(customConfigPath) // Use helper
        // custom overrides .env/env vars/defaults
        combinedConfig = { ...combinedConfig, ...customEnvConfig }
        logger('debug', 'Merged custom config file values.')
      } else {
        logger('warn', `Custom config file specified but not found: ${customConfigPath}`)
        // We don't throw an error here, just warn
      }
    }
  } catch (err: unknown) {
    logger(
      'warn',
      `Failed to parse args or load custom config file: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
  }

  // 5. Apply overrides (highest priority)
  if (overrides) {
    combinedConfig = { ...combinedConfig, ...overrides }
    logger('debug', 'Applied overrides.')
  }

  // 6. Resolve any dynamic values (functions/promises)
  logger('debug', 'Resolving dynamic values...')
  const resolvedConfig = await resolveObjectValues(combinedConfig)
  logger('debug', 'Dynamic values resolved.')

  // 7. Handle workspace specifically (use --workspace arg if present, otherwise default)
  try {
    const args = parseArgs(Deno.args, {
      string: ['workspace'],
      alias: { w: 'workspace' },
    })
    if (args.workspace) {
      resolvedConfig.workspace = args.workspace
      logger('debug', `Workspace set from --workspace arg: ${args.workspace}`)
    } else if (!resolvedConfig.workspace) {
      // Fallback if default wasn't set or resolved correctly
      resolvedConfig.workspace = Deno.cwd()
      logger('debug', `Workspace set to CWD fallback: ${resolvedConfig.workspace}`)
    }
  } catch (err: unknown) {
    logger(
      'warn',
      `Failed to parse --workspace arg: ${err instanceof Error ? err.message : String(err)}`,
    )
    if (!resolvedConfig.workspace) resolvedConfig.workspace = Deno.cwd() // Ensure workspace is set
  }

  // 8. Set the final resolved values and update Deno.env
  values = resolvedConfig
  for (const [key, value] of Object.entries(values)) {
    // Ensure Deno.env reflects the final resolved state
    // This might overwrite existing env vars if they were overridden
    Deno.env.set(key, value)
  }
  logger('debug', 'Final configuration values set internally and in Deno.env.')

  // 9. Create and return the proxy
  logger('debug', 'Creating configuration proxy.')
  return createConfigProxy()
}

/**
 * Loads and caches configuration values from various sources. Subsequent calls return the cached configuration
 *
 * @example
 * ```ts
 * // Basic usage - returns default values if no env files exist
 * const config = await loadConfig()
 *
 * // Load from custom env file if it exists
 * // deno run --config=prod.env script.ts
 * const config = await loadConfig()
 *
 * // With overrides - highest precedence but preserves other values
 * const config = await loadConfig({
 *   API_KEY: 'override-key',    // Overrides any API_KEY from env files
 *   DATABASE_HOST: 'override-host'  // Other env values are preserved
 * })
 * ```
 *
 * @param overrides - Optional key-value pairs to override configuration values
 * @param customLogger - Optional logger instance conforming to the Logger interface (log, info, warn, error, debug)
 * @returns A single proxy object containing all configuration values that can be read and written to
 * @throws {Error} If initialization fails critically (e.g., dynamic value resolution fails)
 */
async function loadConfig(
  overrides?: ConfigRecord,
  customLogger?: Logger,
): Promise<Record<string, string>> {
  // Update the internal logger if a custom one is provided
  // Do this early so subsequent logs in this function use the custom logger
  if (customLogger) {
    // Basic validation: Check if essential methods exist
    const requiredMethods: (keyof Logger)[] = ['log', 'info', 'warn', 'error', 'debug']
    const missingMethods = requiredMethods.filter((m) => typeof customLogger[m] !== 'function')

    if (missingMethods.length > 0) {
      // Use the default logger to warn about the issue
      logger(
        'warn',
        `Provided custom logger is missing required methods: ${
          missingMethods.join(', ')
        }. Using default console logger.`,
      )
      // Keep _internalLogger as console
    } else {
      _internalLogger = customLogger
      // Use the *new* logger for the confirmation message
      logger('debug', 'Custom logger provided and validated.')
    }
  }

  // Simple promise-based lock to ensure initializeConfig runs only once
  if (!initPromise) {
    logger('debug', 'No initialization promise found, starting initialization...')
    initPromise = initializeConfig(overrides)
  } else {
    logger('debug', 'Initialization promise already exists, waiting...')
    // If called again with overrides *after* initialization has started/completed,
    // we need to handle applying them potentially
    // For simplicity now, we assume overrides are only relevant on the *first* call
    // A more robust implementation might merge overrides into the existing config here
    if (overrides && configProxy) {
      logger('debug', 'Applying subsequent overrides to existing config...')
      for (const [key, value] of Object.entries(overrides)) {
        // Use the proxy's set method to ensure Deno.env is updated
        // We assume 'value' here is KeyValueConfig, proxy handles resolution/validation
        configProxy[key] = value as string // Cast needed as proxy expects string setter
      }
      logger('debug', 'Subsequent overrides applied.')
    } else if (overrides) {
      logger(
        'warn',
        'Overrides provided on subsequent call before initialization complete. These might not be applied as expected.',
      )
    }
  }

  try {
    // Wait for the initialization promise to complete
    const finalConfig = await initPromise
    logger('debug', 'Initialization complete, returning config proxy.')
    return finalConfig
  } catch (err: unknown) {
    throw new Error(
      `Configuration failed to load: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

export default loadConfig
export { loadConfig }
export type { ConfigRecord, KeyValueConfig, Logger }
