#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-symlink

/**
 * @module install-cursor-to-path
 * @description Automates symlink creation for Cursor's CLI command using native Deno 2 capabilities.
 * Checks if 'cursor' is available in $PATH and if missing, creates a symlink to Cursor's internal code binary.
 *
 * Requirements:
 * - Deno 2
 * - macOS only (/Applications assumption)
 * - User must have permissions to write to /usr/local/bin
 */

const CURSOR_CMD = 'cursor'
const SYMLINK_PATH = '/usr/local/bin/cursor'
const TARGET_PATH = '/Applications/Cursor.app/Contents/Resources/app/bin/code'

/**
 * Checks if a command exists in PATH using native Deno.Command
 */
async function checkExists(command: string): Promise<boolean> {
  try {
    const which = new Deno.Command('which', {
      args: [command],
      stdout: 'null',
      stderr: 'null',
    })
    const { success } = await which.output()
    return success
  } catch {
    return false
  }
}

/**
 * Creates a symlink if it doesn't already exist
 */
async function createSymlink(): Promise<void> {
  try {
    await Deno.lstat(SYMLINK_PATH)
    console.log('Symlink already exists.')
  } catch {
    try {
      await Deno.symlink(TARGET_PATH, SYMLINK_PATH)
      console.log(`Symlink created: ${SYMLINK_PATH} → ${TARGET_PATH}`)
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        console.error('❌ Permission denied. Try running with sudo.')
        Deno.exit(1)
      }
      throw error
    }
  }
}

/**
 * Main script execution
 */
async function main() {
  // Check operating system
  if (Deno.build.os !== 'darwin') {
    console.error('❌ This script currently only supports macOS.')
    Deno.exit(1)
  }

  if (await checkExists(CURSOR_CMD)) {
    console.log("✅ 'cursor' command already available.")
    Deno.exit(0)
  }

  console.log("🔧 'cursor' command missing. Installing...")

  // Check if target exists
  try {
    await Deno.stat(TARGET_PATH)
  } catch {
    console.error(`❌ Target binary not found at ${TARGET_PATH}`)
    console.error('Is Cursor.app installed in /Applications?')
    Deno.exit(1)
  }

  await createSymlink()
}

// Execute main function
if (import.meta.main) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error)
    Deno.exit(1)
  })
}
