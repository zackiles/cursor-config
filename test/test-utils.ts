/**
 * @module testUtils
 *
 * Provides utility functions for working with mock rule files in tests.
 * These utilities handle loading, verification, and processing of MDC rule files
 * used in test scenarios.
 *
 * @example
 * ```ts
 * import { verifyAndGetMockRuleFiles } from './test-utils.ts'
 *
 * Deno.test('my test', async (t) => {
 *   const mockRuleFiles = await verifyAndGetMockRuleFiles(t, 'rules/**\/*.mdc')
 *   for (const ruleFile of mockRuleFiles) {
 *     // Test the rule file
 *   }
 * })
 * ```
 *
 * @see {@link https://docs.deno.com/api/deno/~/Deno.test} for Deno test API
 * @see {@link https://jsr.io/@std/fs} for Deno filesystem operations
 */
import { assert } from '@std/assert'
import { expandGlob, type WalkEntry } from '@std/fs'
import { processMdcFile } from '../src/processor.ts'

/**
 * Debug configuration for test files.
 * Provides a consistent way to handle debug logging across test suites.
 *
 * @example
 * ```ts
 * DEBUG.log('Test output:', result)
 * ```
 */

// Define consistent inspect options for all debug output
const inspectOptions: Deno.InspectOptions = {
  // Essential formatting options
  colors: true, // Enable ANSI colors for better readability
  compact: false, // Don't compress output - better for debugging
  depth: 6, // Better handle nested objects
  breakLength: 80, // Standard terminal width

  // Content control options
  iterableLimit: 50, // Keep output manageable
  strAbbreviateSize: 150, // Keep string output concise

  // Enhanced inspection options
  showProxy: true, // Show Proxy target and handler for debugging
  showHidden: true, // Show non-enumerable properties
  getters: true, // Evaluate getters for complete object state

  // Output formatting
  sorted: true, // Sort object keys for consistent output
  trailingComma: true, // Better for multi-line diffs
  escapeSequences: true, // Properly escape special characters
}

export const DEBUG = {
  enabled: Deno.args.includes('--log-level=debug'),
  log: function (...args: unknown[]) {
    if (!this.enabled) return

    const processedArgs = args.map((arg) => {
      // Handle primitive types and errors directly
      if (
        typeof arg === 'string' ||
        typeof arg === 'boolean' ||
        typeof arg === 'number' ||
        arg instanceof Error
      ) {
        return arg
      }

      // Handle null and undefined
      if (arg === null || arg === undefined) {
        return arg
      }

      // For objects, check for toString or toJSON methods
      if (typeof arg === 'object') {
        // Check for custom toString method (not the default Object.prototype.toString)
        if (
          'toString' in arg &&
          arg.toString !== Object.prototype.toString &&
          typeof arg.toString === 'function'
        ) {
          return arg.toString()
        }

        // Check for toJSON method
        if ('toJSON' in arg && typeof arg.toJSON === 'function') {
          return arg.toJSON()
        }

        // Use Deno.inspect for objects
        return Deno.inspect(arg, inspectOptions)
      }

      // Fallback for any other types (symbols, functions, etc)
      return Deno.inspect(arg, inspectOptions)
    })

    console.log(...processedArgs)
  },
}

/** Base directory for all mock files used in tests */
const MOCK_FILES_BASE_PATH = 'test/mocks'

/**
 * Loads mock rule files from a given glob pattern under the test/mocks directory.
 *
 * @param mockGlobPattern - Glob pattern relative to test/mocks directory
 * @returns Array of WalkEntry objects representing the found mock rule files
 * @throws {Error} If there are issues accessing the filesystem
 *
 * @example
 * ```ts
 * const mockRuleFiles = await loadMockRuleFiles('rules/**\/*.mdc')
 * console.log(`Found ${mockRuleFiles.length} mock rule files`)
 * ```
 */
async function loadMockRuleFiles(mockGlobPattern: string): Promise<WalkEntry[]> {
  const fullGlobPattern = `${MOCK_FILES_BASE_PATH}/${mockGlobPattern}`
  const mockRuleFiles: WalkEntry[] = []

  for await (const file of expandGlob(fullGlobPattern)) {
    mockRuleFiles.push(file)
  }

  return mockRuleFiles
}

/**
 * Verifies mock rule files exist at the specified path and returns them.
 * Creates a test step to verify the existence of files, making test output more structured.
 *
 * @param t - Deno test context for creating test steps
 * @param mockGlobPattern - Glob pattern relative to test/mocks directory
 * @returns Array of WalkEntry objects representing the verified mock rule files
 * @throws {AssertionError} If no mock rule files are found at the specified path
 *
 * @example
 * ```ts
 * Deno.test('verify rules', async (t) => {
 *   const mockRuleFiles = await verifyAndGetMockRuleFiles(t, 'rules/**\/*.mdc')
 *   assert(mockRuleFiles.length > 0)
 * })
 * ```
 */
async function verifyAndGetMockRuleFiles(
  t: Deno.TestContext,
  mockGlobPattern: string,
): Promise<WalkEntry[]> {
  const mockRuleFiles = await loadMockRuleFiles(mockGlobPattern)

  await t.step('verify mock rule files exist', () => {
    assert(
      mockRuleFiles.length > 0,
      `No mock rule files found at ${MOCK_FILES_BASE_PATH}/${mockGlobPattern}`,
    )
  })

  return mockRuleFiles
}

/**
 * Processes an MDC file and verifies it was read successfully.
 * This is a common operation needed across multiple test files.
 *
 * @param filePath - Path to the MDC file to process
 * @returns Processed MDC file object
 * @throws {AssertionError} If the file cannot be read successfully
 *
 * @example
 * ```ts
 * const mdcFile = await processAndVerifyMdcFile('test/mocks/rules/example.mdc')
 * assert(!mdcFile.fileReadError)
 * ```
 */
async function processAndVerifyMdcFile(filePath: string) {
  const mdcFile = await processMdcFile(filePath)
  assert(!mdcFile.fileReadError, `File read error: ${mdcFile.fileReadError?.message}`)
  return mdcFile
}

export { loadMockRuleFiles, processAndVerifyMdcFile, verifyAndGetMockRuleFiles }
export type { WalkEntry }
