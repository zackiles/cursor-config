import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const mdcParseError: LintRule = {
  id: 'mdc-parse-error',
  severity: 'error',
  description:
    'Checks if the overall parsing of the .mdc file completes without throwing unexpected errors.',
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'mdc-parse-error',
      severity: 'error',
      passed: true,
    }

    // Check for general parse errors (not file read errors)
    if (file.parseError) {
      result.passed = false
      result.message = 'Failed to parse MDC file'
      result.reason = file.parseError.message
    }

    // Check for frontmatter parse errors
    if (file.frontmatter?.parseError) {
      result.passed = false
      result.message = 'Failed to parse frontmatter section'
      result.reason = file.frontmatter.parseError.message
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
    }

    // Check for markdown content parse errors
    if (file.markdownContent?.parseError) {
      result.passed = false
      result.message = 'Failed to parse markdown content'
      result.reason = file.markdownContent.parseError.message
      result.offendingLines = [
        {
          line: file.markdownContent.startLine,
          content: file.rawLines[file.markdownContent.startLine - 1] || '',
        },
      ]
    }

    return result
  },
}

export default mdcParseError
