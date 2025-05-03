import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterMissingCategory: LintRule = {
  id: 'frontmatter-missing-category',
  severity: 'warning',
  description:
    "Recommends adding an optional user specified 'category' field that describes the general use of this rule such as 'Code Generation', 'Tool Usage', or 'Testing and Debugging'.",
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-missing-category',
      severity: 'warning',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter) {
      return result
    }

    // Check if the category field exists and is not null/undefined
    const hasCategory = 'category' in file.frontmatter &&
      file.frontmatter.category !== null &&
      file.frontmatter.category !== undefined

    if (!hasCategory) {
      result.passed = false
      result.message =
        "Consider adding a 'category' field to better organize and discover your rules."

      // Point to the frontmatter block lines
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]

      result.offendingValue = {
        propertyPath: 'frontmatter',
        value: file.frontmatter.raw,
      }

      result.reason =
        "Adding a 'category' value helps organize rules by purpose (e.g., 'Code Generation', 'Tool Usage', 'Testing and Debugging')."
    }

    return result
  },
}

export default frontmatterMissingCategory
