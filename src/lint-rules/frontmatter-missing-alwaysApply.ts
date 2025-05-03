import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterMissingAlwaysApply: LintRule = {
  id: 'frontmatter-missing-alwaysApply',
  severity: 'error',
  description: "Ensures the required 'alwaysApply' field is present in the frontmatter.",
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-missing-alwaysApply',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter) {
      return result
    }

    // Check if the key exists on the frontmatter object
    const hasKey = 'alwaysApply' in file.frontmatter

    if (!hasKey) {
      result.passed = false
      result.message = "Frontmatter is missing the required 'alwaysApply' property."

      // Point to the frontmatter block lines
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]

      result.offendingValue = {
        propertyPath: 'frontmatter',
        value: file.frontmatter.raw,
      }
    }

    return result
  },
}

export default frontmatterMissingAlwaysApply
