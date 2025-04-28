import type { LintRule } from '../types.ts'
import { frontmatterMissingAlwaysApply } from './frontmatter-missing-alwaysApply.ts'
import { frontmatterInvalidGlobs } from './frontmatter-invalid-globs.ts'
import { fileReadError } from './file-read-error.ts'
import { mdcParseError } from './mdc-parse-error.ts'
import { frontmatterMissing } from './frontmatter-missing.ts'
import { frontmatterTypeGlobs } from './frontmatter-type-globs.ts'
import { frontmatterTypeAlwaysApply } from './frontmatter-type-alwaysApply.ts'
import { frontmatterTypeDescription } from './frontmatter-type-description.ts'
import { frontmatterInvalidCombination } from './frontmatter-invalid-combination.ts'
import { frontmatterAutoEmptyGlobs } from './frontmatter-auto-empty-globs.ts'
import { frontmatterAgentEmptyDescription } from './frontmatter-agent-empty-description.ts'
import { contentMissingHeader } from './content-missing-header.ts'
import { contentMissingParagraph } from './content-missing-paragraph.ts'
import { frontmatterGlobsSpaces } from './frontmatter-globs-spaces.ts'
import { contentLongParagraph } from './content-long-paragraph.ts'
import { contentMissingExamples } from './content-missing-examples.ts'
import { frontmatterMissingCategory } from './frontmatter-missing-category.ts'
import { contentBadRuleReference } from './content-bad-rule-reference.ts'
import { join } from '@std/path'

// Registry of all lint rules
const lintRules: LintRule[] = [
  // Error rules
  fileReadError,
  mdcParseError,
  frontmatterMissing,
  frontmatterInvalidGlobs,
  frontmatterTypeGlobs,
  frontmatterMissingAlwaysApply,
  frontmatterTypeAlwaysApply,
  frontmatterTypeDescription,
  frontmatterInvalidCombination,
  frontmatterAutoEmptyGlobs,
  frontmatterAgentEmptyDescription,
  contentMissingHeader,
  contentMissingParagraph,
  contentBadRuleReference,

  // Warning rules
  frontmatterGlobsSpaces,
  contentLongParagraph,
  contentMissingExamples,
  frontmatterMissingCategory,
]

/**
 * Loads all lint rules
 *
 * @param extraRulesPath Optional absolute path to a directory containing additional lint rule modules
 * @returns Promise that resolves to an array of all loaded lint rules
 */
export async function loadAllRules(extraRulesPath?: string): Promise<LintRule[]> {
  const rules: LintRule[] = []

  try {
    // This is the statically registered list of rules
    rules.push(...lintRules)

    // If an extraRulesPath is provided, dynamically load rules from that directory
    if (extraRulesPath) {
      for await (const entry of Deno.readDir(extraRulesPath)) {
        if (entry.isFile && entry.name.endsWith('.ts')) {
          try {
            const modulePath = Deno.realPath(join(extraRulesPath, entry.name))
            const module = await import(`file://${modulePath}`)
            if (module.default && typeof module.default === 'object' && 'lint' in module.default) {
              rules.push(module.default as LintRule)
            }
          } catch (error) {
            console.error(`Failed to load external rule from ${entry.name}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error loading lint rules:', error)
  }

  return rules
}
