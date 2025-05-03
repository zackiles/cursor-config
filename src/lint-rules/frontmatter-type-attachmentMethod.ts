import type { LintResult, LintRule, RuleFileRaw } from '../types.ts'
import { AttachmentMethod } from '../types.ts'

export const frontmatterTypeAttachmentMethod: LintRule = {
  id: 'frontmatter-type-attachmentMethod',
  severity: 'warning', // Warning since it defaults to 'message' if invalid
  description:
    "Validates that the 'attachmentMethod' field in the frontmatter, if present, is one of the valid values: 'system', 'message', 'task', or 'none'.",
  lint: (file: RuleFileRaw): LintResult => {
    const result: LintResult = {
      ruleId: 'frontmatter-type-attachmentMethod',
      severity: 'warning',
      passed: true,
    }

    // If frontmatter parsing failed or is missing, other rules will handle that case
    if (!file.frontmatter) {
      return result
    }

    // Skip if attachmentMethod field is not present
    if (!('attachmentMethod' in file.frontmatter)) {
      return result
    }

    const methodValue = file.frontmatter.attachmentMethod

    // Null is allowed since it will default to 'message'
    if (methodValue === null) {
      return result
    }

    // Check if the value is one of the valid AttachmentMethod enum values
    const validValues = Object.values(AttachmentMethod)
    if (!validValues.includes(methodValue as AttachmentMethod)) {
      result.passed = false
      result.message =
        "The 'attachmentMethod' field must be one of: 'system', 'message', 'task', or 'none'."
      result.offendingLines = [
        { line: file.frontmatter.startLine, content: '---' },
      ]
      result.offendingValue = {
        propertyPath: 'frontmatter.attachmentMethod',
        value: methodValue,
      }
      result.reason =
        `Found '${methodValue}' which is not a valid attachment method. Will default to 'message'.`
    }

    return result
  },
}
