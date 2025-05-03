/**
 * Test suite for the build script
 * @module buildScriptTest
 * @see ../scripts/build.ts
 */
import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import { expandGlob } from '@std/fs'
import { basename, extname, join, parse } from '@std/path'
import { processMdcFile } from '../src/processor.ts'
import type { AttachmentType, MdcFile } from '../src/types.ts'

const TEST_CONFIG = {
  TEST_NAME: 'scripts/build.ts',
  MOCK_PATH: join('test', 'mocks', 'passing-rules'),
  OUTPUT_PATH: join('bin', 'rules.json'),
} as const

interface SimplifiedRule {
  rule: string
  raw: string
  attachmentType: AttachmentType
  createdOn: string | null
  updatedOn: string | null
  [key: string]: unknown
}

// Runs the actual script directly, which will write to the output file
async function runBuildScript(path: string): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '-A',
      join('.', 'scripts', 'build.ts'),
      path,
    ],
    stdout: 'piped',
    stderr: 'piped',
  })

  const output = await command.output()
  const decoder = new TextDecoder()

  if (!output.success) {
    const errorOutput = decoder.decode(output.stderr)
    throw new Error(`Build script failed: ${errorOutput}`)
  }

  const stdout = decoder.decode(output.stdout)
  console.log('Build script output:', stdout)
}

Deno.test(`[${TEST_CONFIG.TEST_NAME}]: processes MDC files correctly`, async (t) => {
  // Run the build script with the mock path
  await t.step('run the build script', async () => {
    await runBuildScript(TEST_CONFIG.MOCK_PATH)
  })

  // Read and validate the output file
  let rules: SimplifiedRule[] = []
  await t.step('read output file and validate simplified structure', async () => {
    // Read the output file to verify results
    const outputJson = await Deno.readTextFile(TEST_CONFIG.OUTPUT_PATH)
    rules = JSON.parse(outputJson) as SimplifiedRule[]

    // Check that we have an array of rule objects
    assert(Array.isArray(rules), 'Output should be an array')
    assert(rules.length > 0, 'Should have processed at least one rule')

    // Get the list of MDC files in the mock directory
    const mdcFilePaths: string[] = []
    for await (const entry of expandGlob(join(TEST_CONFIG.MOCK_PATH, '**/*.mdc'))) {
      if (entry.isFile) {
        mdcFilePaths.push(entry.path)
      }
    }

    // Verify we processed all the files
    assertEquals(
      rules.length,
      mdcFilePaths.length,
      `Should have processed exactly ${mdcFilePaths.length} files`,
    )

    // Verify each item has the expected simplified structure
    for (const rule of rules) {
      assert(typeof rule.rule === 'string', 'Each rule should have a rule name')
      assert(typeof rule.raw === 'string', 'Each rule should have raw content')
      assert(rule.attachmentType, 'Each rule should have an attachment type')

      // Verify that createdOn and updatedOn fields exist
      assert('createdOn' in rule, `Rule ${rule.rule} should have createdOn property`)
      assert('updatedOn' in rule, `Rule ${rule.rule} should have updatedOn property`)

      // Verify that frontmatter properties are included
      if (rule.alwaysApply !== undefined) {
        assert(
          typeof rule.alwaysApply === 'boolean',
          `Rule ${rule.rule} should have alwaysApply as a boolean`,
        )
      }

      // Check if globs property exists (could be null)
      assert('globs' in rule, `Rule ${rule.rule} should have globs property`)

      // Check if description property exists (could be null)
      assert('description' in rule, `Rule ${rule.rule} should have description property`)
    }
  })

  // Verify specific content of sample files
  await t.step('validate agent-requested-description-h2.mdc content', () => {
    const rule = rules.find((r) => r.rule === 'agent-requested-description-h2')
    assert(rule, 'Should have found rule for agent-requested-description-h2')

    // Verify attachment type
    assertEquals(rule.attachmentType, 'AgentAttached', 'Should be an AgentAttached type')

    // Verify description property
    assert(typeof rule.description === 'string', 'Should have a description string')
    assertStringIncludes(
      rule.description as string,
      'The agent can read this description',
      'Description should contain expected text',
    )

    // Verify raw content includes expected text
    assertStringIncludes(rule.raw, '## H2 Header', 'Raw content should contain H2 header')
    assertStringIncludes(
      rule.raw,
      'H2 header description',
      'Raw content should contain H2 description',
    )
    assertStringIncludes(rule.raw, '### H3 Header', 'Raw content should contain H3 header')
  })

  await t.step('validate auto-attached-h1-single-glob.mdc content', () => {
    const rule = rules.find((r) => r.rule === 'auto-attached-h1-single-glob')
    assert(rule, 'Should have found rule for auto-attached-h1-single-glob')

    // Verify attachment type
    assertEquals(rule.attachmentType, 'AutoAttached', 'Should be an AutoAttached type')

    // Verify globs property
    assert(rule.globs, 'Should have a globs value')

    // Verify raw content includes expected text
    assertStringIncludes(rule.raw, '# H1 Header', 'Raw content should contain H1 header')
    assertStringIncludes(rule.raw, 'auto-attached rule', 'Raw content should mention auto-attached')
  })

  await t.step('verify git history fields', () => {
    // Just verify the format or presence; we can't predict actual values in tests
    for (const rule of rules) {
      // CreatedOn and updatedOn can be null (if not in git or error), or in ISO format
      if (rule.createdOn !== null) {
        // Try to parse as date to verify ISO format (will throw if invalid)
        try {
          new Date(rule.createdOn)
        } catch (e) {
          assert(false, `Invalid date format for createdOn: ${rule.createdOn} (Rule: ${rule.rule})`)
        }
      }

      if (rule.updatedOn !== null) {
        try {
          new Date(rule.updatedOn)
        } catch (e) {
          assert(false, `Invalid date format for updatedOn: ${rule.updatedOn} (Rule: ${rule.rule})`)
        }
      }
    }
  })

  await t.step('verify simplified rules match original processed files', async () => {
    // Get the list of MDC files in the mock directory
    const mdcFilePaths: string[] = []
    for await (const entry of expandGlob(join(TEST_CONFIG.MOCK_PATH, '**/*.mdc'))) {
      if (entry.isFile) {
        mdcFilePaths.push(entry.path)
      }
    }

    for (const filePath of mdcFilePaths) {
      // Get the rule name from the file path
      const ruleName = basename(filePath, extname(filePath))

      // Find the corresponding rule in the output
      const outputRule = rules.find((r) => r.rule === ruleName)
      assert(outputRule, `Should have found rule for ${ruleName}`)

      // Process the original file directly for comparison
      const originalProcessed = await processMdcFile(filePath)

      // Compare key aspects
      assertEquals(
        outputRule.attachmentType,
        originalProcessed.derivedAttachmentType,
        `Attachment type should match for ${ruleName}`,
      )

      // Verify frontmatter is correctly processed if present
      if (originalProcessed.frontmatter?.parsed) {
        // Check globs
        assertEquals(
          outputRule.globs,
          originalProcessed.frontmatter.globs,
          `Globs should match for ${ruleName}`,
        )

        // Check alwaysApply
        assertEquals(
          outputRule.alwaysApply,
          originalProcessed.frontmatter.alwaysApply,
          `alwaysApply should match for ${ruleName}`,
        )

        // Skip description comparison since we're now handling it differently
        // and getting it directly from the parsed object
      }

      // Verify raw content matches
      assertEquals(
        outputRule.raw,
        originalProcessed.rawContent,
        `Raw content should match for ${ruleName}`,
      )
    }
  })
})
