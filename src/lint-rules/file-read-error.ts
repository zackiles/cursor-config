import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'

export const fileReadError: LintRule = {
  id: 'file-read-error',
  severity: 'error',
  description: 'Checks if the .mdc file can be successfully read from the filesystem.',
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'file-read-error',
      severity: 'error',
      passed: true,
    }

    if (file.fileReadError) {
      result.passed = false
      result.message = `Failed to read file: ${file.filePath}`
      result.reason = file.fileReadError.message
    }

    return result
  },
}

export default fileReadError
