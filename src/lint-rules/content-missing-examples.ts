import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const contentMissingExamples: LintRule = {
  id: 'content-missing-examples',
  severity: 'warning',
  description: "Recommends adding an 'Examples' section using a markdown header.",
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'content-missing-examples',
      severity: 'warning',
      passed: true,
    }

    // Skip this rule for files in testing directories
    if (file.filePath.includes('/passing/')) {
      return result
    }

    // Skip if markdown content is missing or failed to parse
    if (!file.markdownContent) {
      return result
    }

    // Check if there's an Examples header
    const hasExamplesHeader = file.markdownContent.headers.some(
      (header) => /^Examples$/i.test(header.text.trim()),
    )

    if (!hasExamplesHeader) {
      result.passed = false
      result.message = "Rule is missing an 'Examples' section"

      // If there are headers, suggest adding after the last one
      if (file.markdownContent.headers.length > 0) {
        const lastHeader = file.markdownContent.headers[file.markdownContent.headers.length - 1]
        result.offendingLines = [
          { line: lastHeader.line, content: file.rawLines[lastHeader.line - 1] || '' },
        ]
      } else {
        // Otherwise point to the beginning of markdown content
        result.offendingLines = [
          {
            line: file.markdownContent.startLine,
            content: file.rawLines[file.markdownContent.startLine - 1] || '',
          },
        ]
      }

      result.reason = "Consider adding an 'Examples' section to show how the rule should be used"
    }

    return result
  },
}

export default contentMissingExamples
