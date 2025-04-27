import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterInvalidGlobs: LintRule = {
  id: 'frontmatter-invalid-globs',
  severity: 'error',
  description: "Ensures the 'globs' field, if present, is valid (string or array of strings).",
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-invalid-globs',
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
    const isStringArray = Array.isArray(globsValue) &&
      globsValue.every((item) => typeof item === 'string')

    // Globs must be either a string or array of strings
    if (!isString && !isStringArray) {
      result.passed = false
      result.message = "The 'globs' field must be a string or array of strings."

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
