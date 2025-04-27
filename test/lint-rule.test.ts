/**
 * @module lint-rule.test
 * Tests for the `scripts/lint-rule.ts` script.
 *
 * These tests execute the lint script as a subprocess against a set of mock
 * rule files located in `test/mocks/rules/` and verify the exit code,
 * stdout, and stderr for correctness based on expected linting results.
 *
 * @see {@link ../scripts/lint-rule.ts}
 */

import { assert, assertEquals, assertStringIncludes } from '@std/assert'
import * as path from '@std/path'

const SCRIPT_PATH = path.resolve('scripts', 'lint-rule.ts')
const MOCK_RULES_DIR = path.resolve('test', 'mocks', 'rules')
const MOCK_PASSING_RULES_DIR = path.join(MOCK_RULES_DIR, 'passing') // Path to passing rules

// Helper function to run the lint script and capture output
async function runLinter(targetDir: string) { // Accept targetDir
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--allow-read',
      '--allow-env', // For NO_COLOR check
      '--config=deno.json', // Use --config flag for the full config file
      SCRIPT_PATH,
      '--dir', // Pass the directory argument
      targetDir,
    ],
    stdout: 'piped',
    stderr: 'piped',
  })

  const { code, stdout, stderr } = await command.output()
  const stdoutText = new TextDecoder().decode(stdout)
  const stderrText = new TextDecoder().decode(stderr)

  return { code, stdout: stdoutText, stderr: stderrText }
}

Deno.test('lint-rule.ts - Valid Rules Pass', async () => {
  // Lint the directory containing only valid rules
  const { code, stdout, stderr } = await runLinter(MOCK_PASSING_RULES_DIR)

  assertEquals(code, 0, `Linter exited with code ${code}. Stderr: ${stderr}`)
  assertStringIncludes(stdout, '✔ No issues found')
  assertEquals(stderr, '')
})

Deno.test('lint-rule.ts - Detects Various Errors and Warnings', async () => {
  // Lint the directory containing invalid files (excluding the 'passing' subdir)
  const { code, stdout, stderr } = await runLinter(MOCK_RULES_DIR)

  // --- Assertions --- //
  assert(code !== 0, 'Linter should exit with a non-zero code for errors')
  assertStringIncludes(stdout, '✖ Found') // Summary message
  assertEquals(stderr, '', 'Linter script errors should not be reported to stderr')

  // Check for specific errors from files KNOWN to be in MOCK_RULES_DIR

  // Missing alwaysApply
  assertStringIncludes(
    stdout,
    'missing-alwaysapply.mdc',
    'Missing alwaysApply file not mentioned',
  )
  assertStringIncludes(
    stdout,
    'frontmatter-missing-alwaysApply',
    'Missing alwaysApply rule ID not found',
  )

  // Invalid Combination
  assertStringIncludes(
    stdout,
    'invalid-combination.mdc',
    'Invalid combination file not mentioned',
  )
  assertStringIncludes(
    stdout,
    'frontmatter-invalid-combination',
    'Invalid combination rule ID not found',
  )

  // Generic checks for other potential errors from rule_*.mdc files
  // These might catch frontmatter or body issues depending on the rule file content.
  // We expect *some* errors from these files, but won't assert every specific one.
  assertStringIncludes(stdout, 'rule_a.mdc')
  assertStringIncludes(stdout, 'rule_b.mdc')
  assertStringIncludes(stdout, 'rule_c.mdc')
  assertStringIncludes(stdout, 'rule_d.mdc')
  assertStringIncludes(stdout, 'rule_e.mdc')
  assertStringIncludes(stdout, 'rule_f.mdc')

  // Check if common warnings/errors are present in the output (might come from rule_* files)
  // This is less precise but confirms the linter identifies various issue types.
  const hasSomeErrorOrWarning = stdout.includes('frontmatter-') ||
    stdout.includes('content-') || stdout.includes('warning')
  assert(
    hasSomeErrorOrWarning,
    'Expected some frontmatter or content errors/warnings from rule_* files',
  )

  // Specifically check for the missing examples warning, as it's common
  assertStringIncludes(
    stdout,
    'content-missing-examples',
    'Missing examples rule ID not found (expected from some rule_* files)',
  )
})

// TODO: Add more tests:
// - Test for frontmatter type errors (e.g., alwaysApply not a boolean) - might be covered by rule_* files
// - Test for AutoAttached with empty globs error
// - Test for AgentAttached with empty description error
// - Test handling of parse errors (e.g., invalid YAML in frontmatter)
// - Test handling of file read errors (needs mocking or specific setup)
// - Test script behavior when the rules directory doesn't exist
// - Test script behavior when run with no args (defaults to .cursor/rules)
