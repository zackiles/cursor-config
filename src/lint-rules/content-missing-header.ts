import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const contentMissingHeader: LintRule = {
  id: 'content-missing-header',
  severity: 'error',
  description:
    'Ensures the markdown body of the rule contains at least one header (e.g., # Header, ## Header).',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'content-missing-header',
      severity: 'error',
      passed: true,
    }

    // Skip if markdown content is missing or failed to parse
    if (!file.markdownContent) {
      return result
    }

    // Check if headers array is empty
    if (file.markdownContent.headers.length === 0) {
      result.passed = false
      result.message = 'Markdown content must contain at least one header'
      result.offendingLines = [
        {
          line: file.markdownContent.startLine,
          content: file.rawLines[file.markdownContent.startLine - 1] || '',
        },
      ]
      result.reason = 'No headers found in markdown content'
    }

    return result
  },
}

export default contentMissingHeader
