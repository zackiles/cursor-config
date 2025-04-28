import type { LintResult, LintRule, MdcFile } from '../types.ts'
import { join, normalize } from '@std/path'
import { exists } from '@std/fs'

export const contentBadRuleReference: LintRule = {
  id: 'content-bad-rule-reference',
  severity: 'error',
  description:
    'Ensures that any references to Cursor rules in markdown links with the format [*](mdc:.cursor/rules/*) point to existing files.',
  lint: async (file: MdcFile): Promise<LintResult> => {
    const result: LintResult = {
      ruleId: 'content-bad-rule-reference',
      severity: 'error',
      passed: true,
    }

    // Skip if markdown content is missing or failed to parse
    if (!file.markdownContent || !file.rawContent) {
      return result
    }

    // Extract the project root from the file path
    const cursorRulesIndex = file.filePath.indexOf('.cursor/rules')
    if (cursorRulesIndex === -1) {
      // If .cursor/rules is not in the file path, skip this file
      return result
    }

    // Project root is the part of the path before .cursor/rules
    const projectRoot = file.filePath.substring(0, cursorRulesIndex)

    // Regular expression to match markdown links in the form [*](mdc:path)
    const linkRegex = /\[([^\]]*)\]\(mdc:([^)]+)\)/g

    // Find all matches in the content
    const mdcContent = file.rawContent
    const badReferences: { line: number; reference: string; content: string }[] = []

    // Find all markdown links that start with mdc:
    let match = linkRegex.exec(mdcContent)
    while (match !== null) {
      const linkPath = match[2]

      // Only process paths containing .cursor/rules
      if (linkPath.includes('.cursor/rules')) {
        // Determine the line number by counting newlines before this match
        const contentBeforeMatch = mdcContent.substring(0, match.index)
        const lineNumber = (contentBeforeMatch.match(/\n/g) || []).length + 1

        // Construct the absolute path based on the reference
        let absolutePath: string

        if (linkPath.startsWith('.cursor/rules/')) {
          absolutePath = join(projectRoot, linkPath)
        } else {
          const relativeIndex = linkPath.indexOf('.cursor/rules/')
          if (relativeIndex !== -1) {
            absolutePath = join(projectRoot, linkPath.substring(relativeIndex))
          } else {
            match = linkRegex.exec(mdcContent)
            continue
          }
        }

        // Normalize the path to handle ./ and ../
        absolutePath = normalize(absolutePath)

        // Check if the file exists and add to badReferences if not
        const fileExists = await exists(absolutePath)
        if (!fileExists) {
          badReferences.push({
            line: lineNumber,
            reference: linkPath,
            content: file.rawLines[lineNumber - 1] || '',
          })
        }
      }

      match = linkRegex.exec(mdcContent)
    }

    // If we found bad references, mark the rule as failed
    if (badReferences.length > 0) {
      result.passed = false
      result.message =
        `Found ${badReferences.length} reference(s) to non-existent Cursor rule file(s).`
      result.offendingLines = badReferences.map((ref) => ({
        line: ref.line,
        content: ref.content,
      }))
      result.reason =
        'References to Cursor rules using markdown links with the format [*](mdc:.cursor/rules/*) must point to existing files.'
    }

    return result
  },
}

export default contentBadRuleReference
