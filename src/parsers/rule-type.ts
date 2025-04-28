import { RuleType } from '../types.ts'

/**
 * Determines the rule type based on frontmatter content
 *
 * @param frontmatter - The parsed frontmatter object
 * @returns The detected rule type
 */
export function determineRuleType(frontmatter: Record<string, unknown> | null): RuleType {
  if (!frontmatter) {
    return RuleType.Unknown
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
    return RuleType.AlwaysAttached
  }

  // AgentAttached: non-empty description, and either no globs or empty globs
  if (hasDescription && !isDescriptionEmpty) {
    return RuleType.AgentAttached
  }

  // AutoAttached: alwaysApply: false, non-empty globs
  if (hasAlwaysApply && alwaysApplyValue === false && hasGlobs && !isGlobsEmpty) {
    return RuleType.AutoAttached
  }

  // ManuallyAttached: alwaysApply: false, empty or no globs, empty or no description
  if (
    hasAlwaysApply && alwaysApplyValue === false &&
    (!hasGlobs || isGlobsEmpty) &&
    (!hasDescription || isDescriptionEmpty)
  ) {
    return RuleType.ManuallyAttached
  }

  // Invalid combinations
  return RuleType.Invalid
}
