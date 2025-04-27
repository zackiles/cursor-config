import { Marked } from 'npm:marked@11.2.0'
import type {
  MarkdownCodeBlock,
  MarkdownHeader,
  MarkdownParagraph,
  ParsedMarkdownContent,
} from '../types.ts'

/**
 * Parses markdown content from an MDC file
 *
 * @param markdownContent - The raw markdown content string
 * @param startLine - The 1-based line number where the markdown content starts
 * @returns Structured representation of the parsed markdown
 */
export function parseMarkdownContent(
  markdownContent: string,
  startLine: number,
): ParsedMarkdownContent {
  const headers: MarkdownHeader[] = []
  const paragraphs: MarkdownParagraph[] = []
  const codeBlocks: MarkdownCodeBlock[] = []

  let parseError: Error | undefined

  const marked = new Marked({
    async: false,
    gfm: true,
  })

  try {
    // Calculate line numbers for parsed elements
    const lines = markdownContent.split('\n')
    const lineIndices: number[] = []

    // Create a map of character indices to line numbers
    let currentIndex = 0
    for (const line of lines) {
      lineIndices.push(currentIndex)
      // +1 for the newline character
      currentIndex += line.length + 1
    }

    // Function to convert character index to line number
    const getLineNumber = (charIndex: number): number => {
      const lineIndex = lineIndices.findIndex((index) => index > charIndex)
      return startLine + (lineIndex === -1 ? lines.length - 1 : lineIndex - 1)
    }

    // Parse the markdown
    const tokens = marked.lexer(markdownContent)

    // Track the last header for paragraph association
    let lastHeader: MarkdownHeader | undefined

    // Extract elements from tokens
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      const tokenIndex = markdownContent.indexOf(token.raw)
      const lineNumber = getLineNumber(tokenIndex)

      if (token.type === 'heading') {
        const header: MarkdownHeader = {
          text: token.text,
          level: token.depth,
          line: lineNumber,
        }
        headers.push(header)
        lastHeader = header
      } else if (token.type === 'paragraph') {
        const paragraph: MarkdownParagraph = {
          text: token.text,
          line: lineNumber,
        }

        if (lastHeader) {
          paragraph.afterHeader = lastHeader
        }

        paragraphs.push(paragraph)
      } else if (token.type === 'code') {
        const codeBlock: MarkdownCodeBlock = {
          text: token.text,
          lang: token.lang || undefined,
          line: lineNumber,
        }

        codeBlocks.push(codeBlock)
      }
    }
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error))
  }

  return {
    raw: markdownContent,
    headers,
    paragraphs,
    codeBlocks,
    startLine,
    parseError,
  }
}
