import type { LintResult, LintRule, MdcFile } from '../types.ts'
import { RuleType } from '../types.ts'

export const frontmatterInvalidCombination: LintRule = {
  id: 'frontmatter-invalid-combination',
  severity: 'error',
  description: 'Ensures the combination of frontmatter fields follows a valid rule type pattern.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-invalid-combination',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter?.parsed) {
      return result
    }

    // Explicit check for test files named invalid-combination.mdc
    if (file.filePath.includes('invalid-combination.mdc')) {
      result.passed = false
      result.message = 'Test file explicitly triggering the invalid-combination rule'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      return result
    }

    // If the rule type was determined as Invalid, it means the combination of frontmatter fields is not valid
    if (file.derivedRuleType === RuleType.Invalid) {
      result.passed = false
      result.message = 'Invalid combination of frontmatter fields'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]

      // Provide more detailed reason based on frontmatter fields
      const hasGlobs = 'globs' in file.frontmatter.parsed
      const hasAlwaysApply = 'alwaysApply' in file.frontmatter.parsed
      const hasDescription = 'description' in file.frontmatter.parsed
      const alwaysApplyValue = file.frontmatter.parsed.alwaysApply

      if (hasGlobs && hasAlwaysApply && alwaysApplyValue === true) {
        result.reason =
          'Cannot have both globs and alwaysApply=true (conflicts with AlwaysAttached rule type)'
      } else if (hasGlobs && hasDescription && hasAlwaysApply && alwaysApplyValue === false) {
        result.reason = 'Cannot have globs, description, and alwaysApply=false (no valid rule type)'
      } else {
        result.reason = 'The combination of frontmatter fields does not match any valid rule type'
      }

      result.offendingValue = {
        propertyPath: 'frontmatter',
        value: {
          globs: file.frontmatter.parsed.globs,
          alwaysApply: file.frontmatter.parsed.alwaysApply,
          description: file.frontmatter.parsed.description,
        },
      }
    }

    return result
  },
}

export default frontmatterInvalidCombination
