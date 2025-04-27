import { parse as parseYaml } from '@std/yaml'
import type { ParsedFrontmatter } from '../types.ts'

/**
 * Parses the YAML frontmatter from an MDC file
 *
 * @param fileContent - The raw file content
 * @returns Object containing parsed frontmatter information or undefined if no frontmatter delimiters found
 */
export function parseFrontmatter(fileContent: string): {
  frontmatter: ParsedFrontmatter | null
  contentStartIndex: number
} | undefined {
  // A valid frontmatter block must start at the beginning of the file with '---'
  if (!fileContent.startsWith('---')) {
    return undefined
  }

  // Find the closing delimiter, starting from position 4 (after the opening '---' and newline)
  const endDelimiterIndex = fileContent.indexOf('\n---', 4)
  if (endDelimiterIndex === -1) {
    // No closing delimiter found
    return undefined
  }

  // Extract the raw YAML content between delimiters
  const rawFrontmatter = fileContent.substring(4, endDelimiterIndex).trim()

  // Calculate content start index (after the closing '---' and newline)
  const contentStartIndex = endDelimiterIndex + 4 // 4 = '\n---'.length

  // Count the number of lines before frontmatter
  const frontmatterStartLine = 1 // Always starts at line 1

  // Count lines in the frontmatter
  const frontmatterLines = rawFrontmatter.split('\n')
  const frontmatterEndLine = frontmatterStartLine + frontmatterLines.length + 1 // +1 for closing delimiter

  let parsedContent: Record<string, unknown> | null = null
  let parseError: Error | undefined = undefined

  try {
    parsedContent = parseYaml(rawFrontmatter) as Record<string, unknown>
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error))
  }

  const frontmatter: ParsedFrontmatter = {
    raw: rawFrontmatter,
    parsed: parsedContent,
    parseError,
    startLine: frontmatterStartLine,
    endLine: frontmatterEndLine,
  }

  // Extract known frontmatter fields if parsing succeeded
  if (parsedContent) {
    if ('globs' in parsedContent) {
      frontmatter.globs = parsedContent.globs as string | string[]
    }
    if ('alwaysApply' in parsedContent) {
      frontmatter.alwaysApply = parsedContent.alwaysApply as boolean
    }
    if ('description' in parsedContent) {
      frontmatter.description = parsedContent.description as string
    }
  }

  return {
    frontmatter,
    contentStartIndex,
  }
}
