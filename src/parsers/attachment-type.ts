import { AttachmentType } from '../types.ts'

/**
 * Determines the attachment type based on frontmatter content
 *
 * @param frontmatter - Parsed frontmatter object
 * @returns The detected attachment type
 */
export function determineAttachmentType(
  frontmatter: Record<string, unknown> | null,
): AttachmentType {
  if (!frontmatter) {
    // No frontmatter typically implies ManuallyAttached if the file contains content
    // Linter rules should handle empty files separately if needed.
    // Assuming content exists, default to ManuallyAttached or rely on caller context.
    // Let's return Unknown for now, processor might refine this.
    return AttachmentType.Unknown
  }

  const hasGlobs = 'globs' in frontmatter
  const hasAlwaysApply = 'alwaysApply' in frontmatter
  const hasDescription = 'description' in frontmatter

  const globsValue = frontmatter.globs
  const alwaysApplyValue = frontmatter.alwaysApply
  const descriptionValue = frontmatter.description

  // Check for empty values
  const isGlobsEmpty = !globsValue ||
    (typeof globsValue === 'string' && globsValue.trim() === '') ||
    (Array.isArray(globsValue) && globsValue.length === 0)

  const isDescriptionEmpty = !descriptionValue ||
    (typeof descriptionValue === 'string' && descriptionValue.trim() === '')

  // Rule categorization based on frontmatter fields and values

  // AlwaysAttached: alwaysApply: true
  if (hasAlwaysApply && alwaysApplyValue === true) {
    return AttachmentType.AlwaysAttached
  }

  // AgentAttached: non-empty description, and either no globs or empty globs
  if (hasDescription && !isDescriptionEmpty) {
    return AttachmentType.AgentAttached
  }

  // AutoAttached: alwaysApply: false, non-empty globs
  if (hasAlwaysApply && alwaysApplyValue === false && hasGlobs && !isGlobsEmpty) {
    return AttachmentType.AutoAttached
  }

  // ManuallyAttached: alwaysApply: false, empty or no globs, empty or no description
  if (
    hasAlwaysApply && alwaysApplyValue === false &&
    (!hasGlobs || isGlobsEmpty) &&
    (!hasDescription || isDescriptionEmpty)
  ) {
    return AttachmentType.ManuallyAttached
  }

  // Invalid combinations
  return AttachmentType.Invalid
}
