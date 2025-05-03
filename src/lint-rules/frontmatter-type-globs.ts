import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const frontmatterTypeGlobs: LintRule = {
  id: 'frontmatter-type-globs',
  severity: 'error',
  description:
    "Type checking for the 'globs' field: validates the data types are correct (string or array, with array elements all being strings).",
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-type-globs',
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

    // Handle null values - these are valid empty globs
    if (globsValue === null) {
      return result
    }

    const isString = typeof globsValue === 'string'
    const isArray = Array.isArray(globsValue)

    // If it's not a string or array, it's invalid
    if (!isString && !isArray) {
      result.passed = false
      result.message =
        `Type error: 'globs' must be either a string or an array (found ${typeof globsValue})`
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: globsValue,
      }
      result.reason = `Found ${typeof globsValue} instead of string or array`
      return result
    }

    // If it's an array, ensure all items are strings
    if (isArray) {
      const allStrings = globsValue.every((item) => typeof item === 'string')
      if (!allStrings) {
        result.passed = false
        result.message =
          "Type error: Array 'globs' contains non-string elements (all elements must be strings)"
        result.offendingLines = [
          { line: file.frontmatter.startLine, content: '---' },
        ]
        result.offendingValue = {
          propertyPath: 'frontmatter.globs',
          value: globsValue,
        }
        result.reason = 'Found non-string values in the globs array'
      }
    }

    return result
  },
}

export default frontmatterTypeGlobs
