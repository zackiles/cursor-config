import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const frontmatterTypeAlwaysApply: LintRule = {
  id: 'frontmatter-type-alwaysApply',
  severity: 'error',
  description:
    "Validates that the 'alwaysApply' field in the frontmatter, if present, is a boolean (true or false).",
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-type-alwaysApply',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter) {
      return result
    }

    // Skip if alwaysApply field is not present
    if (!('alwaysApply' in file.frontmatter)) {
      return result
    }

    const alwaysApplyValue = file.frontmatter.alwaysApply
    if (typeof alwaysApplyValue !== 'boolean') {
      result.passed = false
      result.message = "The 'alwaysApply' field must be a boolean (true or false)."
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.alwaysApply',
        value: alwaysApplyValue,
      }
      result.reason = `Found ${typeof alwaysApplyValue} instead of boolean.`
    }

    return result
  },
}

export default frontmatterTypeAlwaysApply
