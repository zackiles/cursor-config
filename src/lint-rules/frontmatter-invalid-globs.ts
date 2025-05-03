import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const frontmatterInvalidGlobs: LintRule = {
  id: 'frontmatter-invalid-globs',
  severity: 'error',
  description:
    "Validates the complete structure of the 'globs' field, ensuring it's correctly formatted as a glob pattern string or array of pattern strings.",
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-invalid-globs',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter) {
      return result
    }

    // Skip if globs field is not present
    if (!('globs' in file.frontmatter)) {
      return result
    }

    const globsValue = file.frontmatter.globs

    // Handle null globs value - this is valid for empty globs
    if (globsValue === null) {
      return result
    }

    const isString = typeof globsValue === 'string'
    const isStringArray = Array.isArray(globsValue) &&
      globsValue.every((item) => typeof item === 'string')

    // Globs must be either a string or array of strings
    if (!isString && !isStringArray) {
      result.passed = false
      result.message =
        'Invalid glob configuration: must be a valid glob pattern string or array of pattern strings.'

      // Point to the frontmatter block lines
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]

      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: globsValue,
      }

      result.reason = `Found ${typeof globsValue} instead of string or string array.`
    }

    return result
  },
}

export default frontmatterInvalidGlobs
