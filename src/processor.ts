import { parseFrontmatter } from './parsers/frontmatter.ts'
import { parseMarkdownContent } from './parsers/markdown.ts'
import { determineAttachmentType } from './parsers/attachment-type.ts'
import type { AttachmentType, LintResult, ParsedFrontmatter, RuleFileRaw } from './types.ts'

/**
 * Processes an MDC file by parsing its content and structure
 *
 * @param filePath - Path to the MDC file
 * @returns Processed RuleFileRaw object
 */
export async function processMdcFile(filePath: string): Promise<RuleFileRaw> {
  const mdcFile: RuleFileRaw = {
    filePath,
    rawContent: '',
    rawLines: [],
  }

  try {
    // Read the file
    const content = await Deno.readTextFile(filePath)
    mdcFile.rawContent = content
    mdcFile.rawLines = content.split('\n')

    // Parse frontmatter
    const frontmatterResult = parseFrontmatter(content)

    if (frontmatterResult?.frontmatter) {
      const frontmatter = frontmatterResult.frontmatter as ParsedFrontmatter
      mdcFile.frontmatter = frontmatter

      // Parse markdown content (everything after frontmatter)
      const markdownContent = content.substring(frontmatterResult.contentStartIndex)
      const startLine = frontmatter.endLine + 1
      mdcFile.markdownContent = parseMarkdownContent(markdownContent, startLine)

      // Determine attachment type based on frontmatter
      const attachmentType: AttachmentType = determineAttachmentType(frontmatter)
      mdcFile.derivedAttachmentType = attachmentType
    } else {
      // If no frontmatter found, treat the entire file as markdown
      mdcFile.markdownContent = parseMarkdownContent(content, 1)
    }
  } catch (error) {
    mdcFile.fileReadError = error instanceof Error ? error : new Error(String(error))
  }

  return mdcFile
}

/**
 * Group lint results by file for better reporting
 *
 * @param results - Array of lint results with file paths
 * @returns Map of file paths to their lint results
 */
export function groupResultsByFile(
  results: Array<{ filePath: string; result: LintResult }>,
): Map<string, LintResult[]> {
  const groupedResults = new Map<string, LintResult[]>()

  for (const { filePath, result } of results) {
    if (!groupedResults.has(filePath)) {
      groupedResults.set(filePath, [])
    }

    groupedResults.get(filePath)?.push(result)
  }

  return groupedResults
}
