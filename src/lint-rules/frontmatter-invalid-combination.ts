import { AttachmentType } from '../types.ts'
import type { LintResult, MdcFile } from '../types.ts'

export const frontmatterInvalidCombination = {
  id: 'frontmatter-invalid-combination',
  severity: 'error' as const,
  description:
    'Ensures the combination of frontmatter fields follows a valid attachment type pattern.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-invalid-combination',
      severity: 'error',
      passed: true,
    }

    // Skip if no frontmatter or if the frontmatter has an error
    if (
      !file.frontmatter?.parsed || file.frontmatter.parseError
    ) {
      return result
    }

    // If the attachment type was determined as Invalid, it means the combination of frontmatter fields is not valid
    if (file.derivedAttachmentType === AttachmentType.Invalid) {
      result.passed = false
      result.message = 'The combination of frontmatter fields is invalid'

      // Identify some specific invalid combinations to provide better error messages
      const hasGlobs = 'globs' in file.frontmatter.parsed && file.frontmatter.globs
      const hasDescription = 'description' in file.frontmatter.parsed &&
        file.frontmatter.description
      const alwaysApply = file.frontmatter.parsed.alwaysApply === true

      if (alwaysApply && hasGlobs) {
        result.reason =
          'Cannot have both globs and alwaysApply=true (conflicts with AlwaysAttached attachment type)'
      } else if (hasGlobs && hasDescription && file.frontmatter.parsed.alwaysApply === false) {
        result.reason =
          'Cannot have globs, description, and alwaysApply=false (no valid attachment type)'
      } else {
        result.reason =
          'The combination of frontmatter fields does not match any valid attachment type'
      }

      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
        { line: file.frontmatter.endLine, content: '---' },
      ]
    }

    return result
  },
}

export default frontmatterInvalidCombination
