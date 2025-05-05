/**
 * Test suite for install-cursor-to-path.ts script
 * Tests symlink creation and PATH checking functionality using temporary directories
 * and mocked environment variables.
 *
 * @module installCursorToPathTest
 * @see ../scripts/install-cursor-to-path.ts
 */

import { assert, assertEquals, assertRejects } from '@std/assert'
import { join } from '@std/path'
import { ensureDir } from '@std/fs'

const TEST_CONFIG = {
  TEST_NAME: 'scripts/install-cursor-to-path',
  MOCK_APP_NAME: 'Cursor.app',
  MOCK_BIN_NAME: 'code',
  MOCK_SYMLINK_NAME: 'cursor',
} as const

/**
 * Creates a mock Cursor.app structure in a temporary directory
 */
async function setupMockCursorApp(tempDir: string): Promise<string> {
  const mockAppPath = join(tempDir, 'Applications', TEST_CONFIG.MOCK_APP_NAME)
  const mockBinPath = join(mockAppPath, 'Contents', 'Resources', 'app', 'bin')
  await ensureDir(mockBinPath)

  // Create mock code binary
  const mockBinFile = join(mockBinPath, TEST_CONFIG.MOCK_BIN_NAME)
  await Deno.writeTextFile(mockBinFile, '#!/bin/sh\necho "Mock Cursor binary"')
  await Deno.chmod(mockBinFile, 0o755)

  return mockBinFile
}

/**
 * Creates a mock PATH directory structure
 */
async function setupMockPath(tempDir: string): Promise<string> {
  const mockBinDir = join(tempDir, 'usr', 'local', 'bin')
  await ensureDir(mockBinDir)
  return mockBinDir
}

/**
 * Imports the install script dynamically with mocked environment
 */
async function importInstallScript(tempDir: string) {
  const moduleUrl = new URL('../../scripts/install-cursor-to-path.ts', import.meta.url)
  const module = await import(moduleUrl.href)

  // Override constants in the module
  Object.defineProperties(module, {
    SYMLINK_PATH: {
      value: join(tempDir, 'usr', 'local', 'bin', TEST_CONFIG.MOCK_SYMLINK_NAME),
    },
    TARGET_PATH: {
      value: join(
        tempDir,
        'Applications',
        TEST_CONFIG.MOCK_APP_NAME,
        'Contents',
        'Resources',
        'app',
        'bin',
        TEST_CONFIG.MOCK_BIN_NAME,
      ),
    },
  })

  return module
}

Deno.test(`[${TEST_CONFIG.TEST_NAME}]: symlink creation and PATH verification`, async (t) => {
  // Create temporary test directory
  const tempDir = await Deno.makeTempDir()

  try {
    // Setup test environment
    await setupMockCursorApp(tempDir)
    await setupMockPath(tempDir)

    await t.step('should detect cursor command in PATH', async () => {
      const module = await importInstallScript(tempDir)

      // Create mock cursor binary in PATH
      const mockPathBin = join(tempDir, 'usr', 'local', 'bin', TEST_CONFIG.MOCK_SYMLINK_NAME)
      await Deno.writeTextFile(mockPathBin, '#!/bin/sh\necho "Mock cursor in PATH"')
      await Deno.chmod(mockPathBin, 0o755)

      // Mock PATH environment
      const originalPath = Deno.env.get('PATH')
      Deno.env.set('PATH', join(tempDir, 'usr', 'local', 'bin'))

      try {
        const exists = await module.checkExists(TEST_CONFIG.MOCK_SYMLINK_NAME)
        assert(exists, 'Should detect cursor command in PATH')
      } finally {
        // Restore original PATH
        if (originalPath) {
          Deno.env.set('PATH', originalPath)
        } else {
          Deno.env.delete('PATH')
        }
      }
    })

    await t.step('should create symlink when cursor not in PATH', async () => {
      const module = await importInstallScript(tempDir)
      const symlinkPath = join(tempDir, 'usr', 'local', 'bin', TEST_CONFIG.MOCK_SYMLINK_NAME)

      // Ensure symlink doesn't exist
      try {
        await Deno.remove(symlinkPath)
      } catch {
        // Ignore if doesn't exist
      }

      // Mock PATH environment
      const originalPath = Deno.env.get('PATH')
      Deno.env.set('PATH', join(tempDir, 'usr', 'local', 'bin'))

      try {
        await module.createSymlink()

        // Verify symlink was created and points to correct target
        const linkTarget = await Deno.readLink(symlinkPath)
        assertEquals(
          linkTarget,
          join(
            tempDir,
            'Applications',
            TEST_CONFIG.MOCK_APP_NAME,
            'Contents',
            'Resources',
            'app',
            'bin',
            TEST_CONFIG.MOCK_BIN_NAME,
          ),
          'Symlink should point to mock cursor binary',
        )
      } finally {
        // Restore original PATH
        if (originalPath) {
          Deno.env.set('PATH', originalPath)
        } else {
          Deno.env.delete('PATH')
        }
      }
    })

    await t.step("should fail when target binary doesn't exist", async () => {
      const module = await importInstallScript(tempDir)
      const mockBinPath = join(
        tempDir,
        'Applications',
        TEST_CONFIG.MOCK_APP_NAME,
        'Contents',
        'Resources',
        'app',
        'bin',
        TEST_CONFIG.MOCK_BIN_NAME,
      )

      // Remove mock binary
      try {
        await Deno.remove(mockBinPath)
      } catch {
        // Ignore if doesn't exist
      }

      // Attempt to create symlink should fail
      await assertRejects(
        async () => {
          await module.createSymlink()
        },
        Error,
        'Target binary not found',
      )
    })
  } finally {
    // Cleanup test directory
    await Deno.remove(tempDir, { recursive: true })
  }
})
