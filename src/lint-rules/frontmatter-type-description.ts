import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterTypeDescription: LintRule = {
  id: 'frontmatter-type-description',
  severity: 'error',
  description:
    "Validates that the 'description' field in the frontmatter, if present, is a string, null, or undefined.",
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-type-description',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter?.parsed) {
      return result
    }

    // Skip if description field is not present
    if (!('description' in file.frontmatter.parsed)) {
      return result
    }

    const descriptionValue = file.frontmatter.parsed.description

    // Null is explicitly allowed as a valid value for description
    if (descriptionValue === null) {
      return result
    }

    // Allow string, null, or undefined values for description
    if (typeof descriptionValue !== 'string') {
      result.passed = false
      result.message = "The 'description' field must be a string or null."
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.description',
        value: descriptionValue,
      }
      result.reason = `Found ${typeof descriptionValue} instead of string or null.`
    }

    return result
  },
}

export default frontmatterTypeDescription
