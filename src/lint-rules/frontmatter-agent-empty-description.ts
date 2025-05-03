import { AttachmentType } from '../types.ts'
import type { LintResult, MdcFile } from '../types.ts'

export const frontmatterAgentEmptyDescription = {
  id: 'frontmatter-agent-empty-description',
  severity: 'error' as const,
  description:
    'If the attachment type is AgentAttached, ensures the description field is present and non-empty.',
  lint: (file: MdcFile): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-agent-empty-description',
      severity: 'error',
      passed: true,
    }

    // Skip if no frontmatter or if the frontmatter has an error
    if (
      !file.frontmatter || file.frontmatter.parseError
    ) {
      return result
    }

    // Only apply this rule for AgentAttached attachment types
    if (file.derivedAttachmentType !== AttachmentType.AgentAttached) {
      return result
    }

    // Since this is AgentAttached, verify it has a non-empty description
    // This helps catch if the attachment-type.ts has a bug or if frontmatter was modified after derivedAttachmentType was set
    if (!file.frontmatter.description) {
      result.passed = false
      result.message = 'AgentAttached rules must have a non-empty description'
      result.offendingValue = {
        propertyPath: 'frontmatter.description',
        value: file.frontmatter.description,
      }
    }

    return result
  },
}

export default frontmatterAgentEmptyDescription
