import type { LintResult, LintRule, MdcFile } from '../types.ts'

export const frontmatterGlobsSpaces: LintRule = {
  id: 'frontmatter-globs-spaces',
  severity: 'warning',
  description:
    'Discourages using spaces after commas within a single globs string, recommending an array format instead for clarity.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-globs-spaces',
      severity: 'warning',
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

    // Only check string globs, not array globs
    if (typeof globsValue === 'string' && globsValue.includes(', ')) {
      result.passed = false
      result.message =
        'Avoid using spaces after commas in globs string; use an array format instead for multiple patterns'
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: globsValue,
      }
      result.reason =
        'Found comma+space pattern in globs string. Prefer ["pattern1", "pattern2"] format for multiple globs.'
    }

    return result
  },
}

export default frontmatterGlobsSpaces
