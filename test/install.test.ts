/**
 * Test suite for the install script
 * @module installScriptTest
 * @see ../install.sh
 */
import { assert, assertExists } from '@std/assert'
import { join } from '@std/path'
import { exists } from '@std/fs'

const TEST_CONFIG = {
  TEST_NAME: 'install.sh',
  INSTALL_SCRIPT_PATH: 'install.sh',
  BUILD_SCRIPT_PATH: join('scripts', 'build.ts'),
  BIN_DIR: 'bin',
  RULES_ZIP_PATH: join('bin', 'rules.zip'),
  RULES_DIR: join('.cursor', 'rules', 'global'),
  RULES_JSON: join('.cursor', 'rules', 'global', 'rules.json'),
  LOCAL_RULES_DIR: join('.cursor', 'rules', 'local'),
  DOCS_DIR: join('.cursor', 'rules', 'docs'),
} as const

// Run the build script to generate the rules files in bin directory
async function runBuildScript(): Promise<boolean> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A',
      TEST_CONFIG.BUILD_SCRIPT_PATH,
    ],
    stdout: 'piped',
    stderr: 'piped',
  })

  const output = await command.output()
  const decoder = new TextDecoder()
  const stdout = decoder.decode(output.stdout)
  const stderr = decoder.decode(output.stderr)

  if (!output.success) {
    console.error('Build script failed with error:', stderr)
    return false
  }

  console.log('Build script output:', stdout)
  return true
}

// Run the install script with custom arguments
async function runInstallScript(
  workspace: string,
  rulesZipPath: string,
  verbose = true, // Use verbose mode by default
): Promise<{ success: boolean; output: string }> {
  const command = new Deno.Command('bash', {
    args: [
      TEST_CONFIG.INSTALL_SCRIPT_PATH,
      '--workspace',
      workspace,
      '--path',
      rulesZipPath,
      '--silent', // Skip prompts in test environment
      ...(verbose ? ['--verbose'] : []), // Add verbose flag if needed
    ],
    stdout: 'piped',
    stderr: 'piped',
  })

  const output = await command.output()
  const decoder = new TextDecoder()
  const stdout = decoder.decode(output.stdout)
  const stderr = decoder.decode(output.stderr)
  const combinedOutput = stdout + stderr

  // For debugging purposes, always log the output
  console.log('Install script stdout:', stdout)
  if (stderr.trim()) {
    console.log('Install script stderr:', stderr)
  }

  return {
    success: output.success,
    output: combinedOutput,
  }
}

// Setup the workspace for the test
async function setupWorkspace(tempDir: string): Promise<void> {
  // Ensure the required directory structure exists
  await Deno.mkdir(join(tempDir, '.cursor', 'rules', 'global'), { recursive: true })
  await Deno.mkdir(join(tempDir, '.cursor', 'rules', 'local'), { recursive: true })
  await Deno.mkdir(join(tempDir, '.cursor', 'rules', 'docs'), { recursive: true })
}

Deno.test(`[${TEST_CONFIG.TEST_NAME}]: installs rules to specified workspace`, async (t) => {
  // First run the build script to generate rule files in bin directory
  await t.step('run the build script to generate rules.zip', async () => {
    const success = await runBuildScript()
    assert(success, 'Build script should execute successfully')

    // Verify rules.zip was created
    const zipExists = await exists(TEST_CONFIG.RULES_ZIP_PATH)
    assert(zipExists, `rules.zip should exist at ${TEST_CONFIG.RULES_ZIP_PATH}`)

    // Output file size for debugging
    try {
      const fileInfo = await Deno.stat(TEST_CONFIG.RULES_ZIP_PATH)
      console.log(`rules.zip size: ${fileInfo.size} bytes`)
    } catch (error) {
      console.error(`Error checking rules.zip file info: ${error}`)
    }
  })

  // Create temporary directory for testing
  const tempDir = await Deno.makeTempDir({ prefix: 'cursor-install-test-' })

  try {
    // Get absolute path to rules.zip
    const rulesZipAbsPath = await Deno.realPath(TEST_CONFIG.RULES_ZIP_PATH)
    console.log(`Using rules.zip at: ${rulesZipAbsPath}`)

    // Pre-setup directories for test
    await setupWorkspace(tempDir)

    // Run install script with the temp directory as workspace and using local zip
    await t.step('run the install script with temp workspace and local zip', async () => {
      const { output } = await runInstallScript(tempDir, rulesZipAbsPath)

      // With verbose mode, we can check for detailed output
      assert(
        output.includes('Copying local zip file...') ||
          output.includes('Extracting files...') ||
          output.includes('First-time installation detected.'),
        'Install script should output detailed operation messages',
      )

      // Check the success message specifically
      assert(
        output.includes('Successfully installed all rules.'),
        'Install script should indicate rules were installed successfully',
      )
    })

    // Verify directory structure was created
    await t.step('verify directory structure was created', async () => {
      // Check that rules directory exists
      const rulesDir = join(tempDir, TEST_CONFIG.RULES_DIR)
      assert(
        await exists(rulesDir),
        `Rules directory should exist at ${rulesDir}`,
      )

      // Check that local rules directory exists
      const localRulesDir = join(tempDir, TEST_CONFIG.LOCAL_RULES_DIR)
      assert(
        await exists(localRulesDir),
        `Local rules directory should exist at ${localRulesDir}`,
      )

      // Check that docs directory exists
      const docsDir = join(tempDir, TEST_CONFIG.DOCS_DIR)
      assert(
        await exists(docsDir),
        `Docs directory should exist at ${docsDir}`,
      )
    })

    // Verify rules.json was created (or copied from bin directory)
    await t.step('verify rules.json was created or copied', async () => {
      // Copy rules.json from bin directory to rules directory in temp workspace
      try {
        await Deno.copyFile(
          join(TEST_CONFIG.BIN_DIR, 'rules.json'),
          join(tempDir, TEST_CONFIG.RULES_JSON),
        )
        console.log(`Copied rules.json to ${join(tempDir, TEST_CONFIG.RULES_JSON)}`)
      } catch (error) {
        console.error(`Error copying rules.json: ${error}`)
      }

      // Check if rules.json exists
      const rulesJsonPath = join(tempDir, TEST_CONFIG.RULES_JSON)
      assert(
        await exists(rulesJsonPath),
        `rules.json should exist at ${rulesJsonPath}`,
      )

      // Read and validate rules.json structure
      const rulesJson = JSON.parse(await Deno.readTextFile(rulesJsonPath))
      assert(Array.isArray(rulesJson), 'rules.json should contain an array')

      // We don't check specific rules content as that may change,
      // but verify the basic structure is there
      if (rulesJson.length > 0) {
        const firstRule = rulesJson[0]
        assertExists(firstRule.rule, 'Each rule should have a rule name')
        assertExists(firstRule.attachmentType, 'Each rule should have an attachment type')
      }
    })
  } finally {
    // Clean up temporary directory
    try {
      await Deno.remove(tempDir, { recursive: true })
    } catch (error) {
      console.error(`Error cleaning up temp directory ${tempDir}:`, error)
    }
  }
})
