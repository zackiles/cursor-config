import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const contentMissingParagraph: LintRule = {
  id: 'content-missing-paragraph',
  severity: 'error',
  description:
    'Ensures there is at least one paragraph of text immediately following the first header in the markdown body.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'content-missing-paragraph',
      severity: 'error',
      passed: true,
    }

    // Skip if markdown content is missing or failed to parse
    if (!file.markdownContent) {
      return result
    }

    // Skip if there are no headers (this will be caught by content-missing-header rule)
    if (file.markdownContent.headers.length === 0) {
      return result
    }

    // Get the first header
    const firstHeader = file.markdownContent.headers[0]

    // Check if there's at least one paragraph that follows the first header
    const hasFollowingParagraph = file.markdownContent.paragraphs.some(
      (p) => p.afterHeader && p.afterHeader.line === firstHeader.line,
    )

    if (!hasFollowingParagraph) {
      result.passed = false
      result.message = 'No paragraph text found after the first header'
      result.offendingLines = [
        { line: firstHeader.line, content: file.rawLines[firstHeader.line - 1] || '' },
      ]
      result.reason = 'The first header must be followed by at least one paragraph of text'
    }

    return result
  },
}

export default contentMissingParagraph
