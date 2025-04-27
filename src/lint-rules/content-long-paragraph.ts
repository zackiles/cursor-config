import type { LintResult, LintRule, MdcFile } from '../types.ts'

// Maximum allowed length for the first paragraph after the first header
const MAX_BODY_SNIPPET_LENGTH = 1000

export const contentLongParagraph: LintRule = {
  id: 'content-long-paragraph',
  severity: 'warning',
  description:
    'Checks if the paragraph immediately following the first header exceeds a defined maximum length.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'content-long-paragraph',
      severity: 'warning',
      passed: true,
    }

    // Skip if markdown content is missing or failed to parse
    if (!file.markdownContent) {
      return result
    }

    // Skip if there are no headers
    if (file.markdownContent.headers.length === 0) {
      return result
    }

    // Get the first header
    const firstHeader = file.markdownContent.headers[0]

    // Find the first paragraph that follows the first header
    const firstParagraph = file.markdownContent.paragraphs.find(
      (p) => p.afterHeader && p.afterHeader.line === firstHeader.line,
    )

    // Skip if there's no following paragraph
    if (!firstParagraph) {
      return result
    }

    // Check if the paragraph exceeds the maximum length
    if (firstParagraph.text.length > MAX_BODY_SNIPPET_LENGTH) {
      result.passed = false
      result.message =
        `First paragraph is too long (${firstParagraph.text.length} > ${MAX_BODY_SNIPPET_LENGTH} characters)`
      result.offendingLines = [
        { line: firstParagraph.line, content: file.rawLines[firstParagraph.line - 1] || '' },
      ]
      result.reason =
        `Consider keeping the first paragraph concise (under ${MAX_BODY_SNIPPET_LENGTH} characters) to improve readability`
      result.offendingValue = {
        propertyPath: 'markdownContent.paragraphs[0].text',
        value: `${firstParagraph.text.substring(0, 100)}...`,
      }
    }

    return result
  },
}

export default contentLongParagraph
