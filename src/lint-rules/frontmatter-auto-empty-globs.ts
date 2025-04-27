import type { LintResult, LintRule, MdcFile } from '../types.ts'
import { RuleType } from '../types.ts'

export const frontmatterAutoEmptyGlobs: LintRule = {
  id: 'frontmatter-auto-empty-globs',
  severity: 'error',
  description:
    'If the rule type is AutoAttached, ensures the globs field is present and non-empty.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-auto-empty-globs',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter?.parsed) {
      return result
    }

    // Only apply this rule for AutoAttached rule types
    if (file.derivedRuleType !== RuleType.AutoAttached) {
      return result
    }

    // At this point, we know it's an AutoAttached rule, so globs should exist
    // But let's check if it exists and is non-empty
    if (!('globs' in file.frontmatter.parsed)) {
      result.passed = false
      result.message = 'AutoAttached rule is missing the required globs field'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.reason = 'AutoAttached rules must specify file patterns to match via the globs field'
      return result
    }

    const globsValue = file.frontmatter.parsed.globs

    // Check if globs is empty string
    if (typeof globsValue === 'string' && globsValue.trim() === '') {
      result.passed = false
      result.message = 'AutoAttached rule has empty globs string'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: globsValue,
      }
      result.reason = 'The globs field must contain at least one valid glob pattern'
    }

    // Check if globs is empty array
    if (Array.isArray(globsValue) && globsValue.length === 0) {
      result.passed = false
      result.message = 'AutoAttached rule has empty globs array'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: globsValue,
      }
      result.reason = 'The globs array must contain at least one valid glob pattern'
    }

    return result
  },
}

export default frontmatterAutoEmptyGlobs
