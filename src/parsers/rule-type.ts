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
  const alwaysApplyValue = frontmatter.alwaysApply

  // Invalid combination check
  if (!hasGlobs && !hasAlwaysApply) {
    return RuleType.Invalid
  }

  // Rule categorization based on frontmatter fields
  if (hasAlwaysApply) {
    if (alwaysApplyValue === true) {
      return RuleType.AlwaysAttached
    }

    if (hasGlobs) {
      return RuleType.AutoAttached
    }

    return RuleType.ManuallyAttached
  }

  if (hasGlobs) {
    return RuleType.AgentAttached
  }

  // Default fallback
  return RuleType.Unknown
}
