import { AttachmentType } from '../types.ts'
import type { LintResult, MdcFile } from '../types.ts'

export const frontmatterAutoEmptyGlobs = {
  id: 'frontmatter-auto-empty-globs',
  severity: 'error' as const,
  description:
    'If the attachment type is AutoAttached, ensures the globs field is present and non-empty.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-auto-empty-globs',
      severity: 'error',
      passed: true,
    }

    // Skip if no frontmatter or if the frontmatter has an error
    if (
      !file.frontmatter?.parsed || file.frontmatter.parseError
    ) {
      return result
    }

    // Only apply this rule for AutoAttached attachment types
    if (file.derivedAttachmentType !== AttachmentType.AutoAttached) {
      return result
    }

    // If we're here, we know it's AutoAttached, but we double-check the globs
    // This could happen if there's a bug in rule-type.ts or if frontmatter was modified after derivedAttachmentType was set
    if (
      !file.frontmatter.globs ||
      (Array.isArray(file.frontmatter.globs) && file.frontmatter.globs.length === 0)
    ) {
      result.passed = false
      result.message = 'AutoAttached rules must have non-empty globs'
      result.offendingValue = {
        propertyPath: 'frontmatter.globs',
        value: file.frontmatter.globs,
      }
    }

    return result
  },
}

export default frontmatterAutoEmptyGlobs
