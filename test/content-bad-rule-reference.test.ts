/**
 * Test suite for the content-bad-rule-reference lint rule.
 *
 * This test suite validates the behavior of the content-bad-rule-reference lint rule
 * by testing against mock MDC rule files with both valid and invalid rule references.
 *
 * @module contentBadRuleReferenceTest
 * @see {@link contentBadRuleReference} for the rule implementation
 */
import { assert } from '@std/assert'
import { contentBadRuleReference } from '../src/lint-rules/content-bad-rule-reference.ts'
import { processAndVerifyMdcFile, verifyAndGetMockRuleFiles } from './test-utils.ts'

const TEST_CONFIG = {
  TEST_NAME: 'lint-rules/content-bad-rule-reference',
  PASSING_MOCK_PATH: 'passing-rules/.cursor/rules/**/*.mdc',
  FAILING_MOCK_PATH: 'failing-rules/.cursor/rules/**/*.mdc',
  DENO_ENV: 'test' as const,
} as const

/**
 * Tests that the lint rule correctly passes for valid rule references.
 * Validates against a set of mock rule files that contain properly formatted
 * references to other Cursor rules.
 */
Deno.test(`[${TEST_CONFIG.TEST_NAME}]: PASS for rules in ${TEST_CONFIG.PASSING_MOCK_PATH}`, async (t) => {
  const mockRuleFiles = await verifyAndGetMockRuleFiles(t, TEST_CONFIG.PASSING_MOCK_PATH)

  // Test each mock rule file in sequence
  for (const mockRuleFile of mockRuleFiles) {
    await t.step(`mock rule file: ${mockRuleFile.name}`, async () => {
      const mdcFile = await processAndVerifyMdcFile(mockRuleFile.path)
      const result = await contentBadRuleReference.lint(mdcFile)

      // Assert that the rule passes
      assert(
        result.passed,
        `Expected rule to pass, but got: ${result.message}`,
      )
    })
  }
})

/**
 * Tests that the lint rule correctly fails for invalid rule references.
 * Validates against a set of mock rule files that contain improperly formatted
 * or non-existent references to other Cursor rules.
 */
Deno.test(`[${TEST_CONFIG.TEST_NAME}]: FAIL for rules in ${TEST_CONFIG.FAILING_MOCK_PATH}`, async (t) => {
  const mockRuleFiles = await verifyAndGetMockRuleFiles(t, TEST_CONFIG.FAILING_MOCK_PATH)

  // Test each mock rule file in sequence
  for (const mockRuleFile of mockRuleFiles) {
    await t.step(`mock rule file: ${mockRuleFile.name}`, async () => {
      const mdcFile = await processAndVerifyMdcFile(mockRuleFile.path)
      const result = await contentBadRuleReference.lint(mdcFile)

      // Run all validations inside this step
      // 1. Verify rule failure
      assert(!result.passed, 'Expected rule to fail, but it passed')

      // 2. Verify offending lines reported
      assert(
        result.offendingLines && result.offendingLines.length > 0,
        'Expected offending lines to be reported',
      )

      // 3. Verify error message
      assert(
        result.message?.includes('reference'),
        `Expected error message to contain 'reference', but got: ${result.message}`,
      )
    })
  }
})
