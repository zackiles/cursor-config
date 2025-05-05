#!/usr/bin/env -S deno run -A

/**
 * @module dev
 * @description Development script that watches for changes and rebuilds rules.
 *
 * This script provides a development workflow by:
 * 1. Running the build.ts script initially
 * 2. Watching for changes to build.ts
 * 3. Using debounce to prevent multiple rebuilds for rapid successive changes
 *
 * @example
 * ```bash
 * deno run -A scripts/dev.ts
 * ```
 *
 * @see https://docs.deno.com/api/deno/~/Deno.watchFs
 * @see https://jsr.io/@std/async/doc/debounce/~/debounce
 */

import { debounce } from '@std/async/debounce'
import logger from '../src/utils/logger.ts'

const BUILD_SCRIPT = 'scripts/build.ts'
const DEBOUNCE_TIME = 3000 // milliseconds

/**
 * Runs the build script using Deno.command
 */
async function runBuild() {
  logger.log('Running build script...')

  const command = new Deno.Command('deno', {
    args: ['run', '-A', BUILD_SCRIPT],
    stdout: 'piped',
    stderr: 'piped',
  })

  const { code, stdout, stderr } = await command.output()

  // Decode and log output
  const textDecoder = new TextDecoder()
  const output = textDecoder.decode(stdout)
  const errors = textDecoder.decode(stderr)

  if (output) {
    logger.log(output)
  }

  if (code !== 0) {
    logger.error(`Build failed with exit code ${code}`)
    if (errors) {
      logger.error(errors)
    }
  } else {
    logger.log('Build completed successfully')
  }
}

/**
 * Main function that runs the initial build and sets up the file watcher
 */
async function main() {
  // Run build initially
  await runBuild()

  // Create debounced version of runBuild to prevent multiple runs for rapid changes
  const debouncedBuild = debounce(runBuild, DEBOUNCE_TIME)

  logger.log(`Watching for changes to ${BUILD_SCRIPT}...`)

  try {
    // Start watching for file changes
    const watcher = Deno.watchFs(BUILD_SCRIPT)

    for await (const event of watcher) {
      if (event.kind === 'modify') {
        logger.log(`Change detected in ${BUILD_SCRIPT}, rebuilding...`)
        debouncedBuild()
      }
    }
  } catch (error: unknown) {
    logger.error(
      `Error watching for file changes: ${error instanceof Error ? error.message : String(error)}`,
    )
    Deno.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    logger.error(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`)
    Deno.exit(1)
  })
}
