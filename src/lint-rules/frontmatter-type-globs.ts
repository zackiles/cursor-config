import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterTypeGlobs: LintRule = {
  id: 'frontmatter-type-globs',
  severity: 'error',
  description:
    "Validates that the 'globs' field in the frontmatter, if present, is either a string or an array of strings.",
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-type-globs',
      severity: 'error',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter?.parsed) {
      return result
    }

    // Skip if globs field is not present
    if (!('globs' in file.frontmatter.parsed)) {
      return result
    }

    const globsValue = file.frontmatter.parsed.globs
    const isString = typeof globsValue === 'string'
    const isArray = Array.isArray(globsValue)

    // If it's not a string or array, it's invalid
    if (!isString && !isArray) {
      result.passed = false
      result.message = "The 'globs' field must be a string or an array"
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
        result.message = "All items in the 'globs' array must be strings"
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
