import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterMissing: LintRule = {
  id: 'frontmatter-missing',
  severity: 'error',
  description:
    'Ensures the file contains a valid YAML frontmatter section enclosed by --- delimiters at the beginning.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-missing',
      severity: 'error',
      passed: true,
    }

    // Check if frontmatter is missing completely or couldn't be parsed
    if (!file.frontmatter) {
      result.passed = false
      result.message = 'Missing or invalid frontmatter section'
      result.offendingLines = [{ line: 1, content: file.rawLines[0] || '' }]
      return result
    }

    // Check if frontmatter was found but parsing failed
    if (file.frontmatter && file.frontmatter.parsed === null) {
      result.passed = false
      result.message = 'Frontmatter section found but could not be parsed as valid YAML'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
    }

    return result
  },
}

export default frontmatterMissing
