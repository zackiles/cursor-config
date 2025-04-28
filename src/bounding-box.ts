/**
 * @module bounding_box
 *
 * Provides utilities for wrapping text within defined boundaries in a terminal.
 * Handles text wrapping with configurable margins, line limits, and word preservation.
 */

// Imports
import Characters from './characters.ts'

/**
 * Configuration options for text bounding box.
 */
interface BoundingBoxOptions {
  /**
   * Left margin - can be specified as:
   * - A percentage string (e.g. "20%")
   * - A number >= 1 (treated as character count)
   * - A decimal < 1 (treated as percentage in decimal form)
   */
  leftMargin?: string | number

  /**
   * Right margin - can be specified as:
   * - A percentage string (e.g. "20%")
   * - A number >= 1 (treated as character count)
   * - A decimal < 1 (treated as percentage in decimal form)
   */
  rightMargin?: string | number

  /**
   * Maximum number of lines. Text exceeding this will be truncated with ellipsis.
   */
  maxLines?: number

  /**
   * Character(s) to use for truncation ellipsis.
   * Defaults to Characters.ELLIPSIS.HORIZONTAL.
   */
  ellipsis?: string

  /**
   * Minimum width to ensure for content, even in narrow terminals.
   * Defaults to 15 characters.
   */
  minContentWidth?: number

  /**
   * Whether to strictly avoid splitting words. If false, extremely long words might be split.
   * Defaults to true.
   */
  preserveWholeWords?: boolean
}

// Helper functions
/**
 * Parses a margin value according to these rules:
 * - String ending with "%" → converted to decimal percent (0-1)
 * - String without "%" → parsed as character count
 * - Number ≥ 1 → used as character count
 * - Number < 1 → used as decimal percent (0-1)
 *
 * @param value - The margin value to parse
 * @param consoleWidth - Current console width for percentage calculations
 * @returns The calculated margin in characters
 *
 * @example
 * ```ts
 * // Convert "20%" to character count for a console width of 100
 * const charCount = parseMargin("20%", 100); // 20 characters
 *
 * // Use 0.2 as decimal percentage for a console width of 100
 * const charCount2 = parseMargin(0.2, 100); // 20 characters
 *
 * // Use absolute character count
 * const charCount3 = parseMargin(30, 100); // 30 characters
 * ```
 */
function parseMargin(value: string | number | undefined, consoleWidth: number): number {
  if (value === undefined) return 0

  // Handle string values
  if (typeof value === 'string') {
    // Percentage string (e.g. "20%")
    if (value.endsWith('%')) {
      const percent = Number.parseFloat(value) / 100
      return Math.floor(consoleWidth * percent)
    }
    // Regular number as string
    return Number.parseFloat(value)
  }

  // Handle number values
  if (value < 1) {
    // Decimal percent
    return Math.floor(consoleWidth * value)
  }
  // Character count
  return value
}

/**
 * Splits text into words and whitespace segments for more precise handling.
 *
 * @param text - The text to split
 * @returns An array of objects, each containing the text segment and a flag indicating if it's whitespace
 *
 * @example
 * ```ts
 * const parts = splitIntoWordsAndSpaces("Hello world");
 * // Returns: [
 * //   { text: "Hello", isWhitespace: false },
 * //   { text: " ", isWhitespace: true },
 * //   { text: "world", isWhitespace: false }
 * // ]
 * ```
 */
function splitIntoWordsAndSpaces(text: string): Array<{ text: string; isWhitespace: boolean }> {
  // This regex captures whitespace and non-whitespace separately
  const parts = text.split(/(\s+)/)

  return parts
    .map((part) => ({
      text: part,
      isWhitespace: /^\s+$/.test(part),
    }))
    .filter((part) => part.text.length > 0)
}

/**
 * Applies max lines limit with ellipsis handling.
 * If the number of lines exceeds maxLines, truncates the array and adds an ellipsis
 * to the last line in a way that respects the available width.
 *
 * @param lines - Array of text lines
 * @param maxLines - Maximum number of lines to keep
 * @param ellipsis - Ellipsis string to append when truncating
 * @param availableWidth - Available width for the text
 * @returns Truncated array of lines, potentially with ellipsis on the last line
 *
 * @example
 * ```ts
 * const truncated = applyMaxLinesLimit(
 *   ["Line 1", "Line 2", "Line 3", "Line 4"],
 *   2,
 *   "...",
 *   10
 * );
 * // Returns: ["Line 1", "Line 2..."]
 * ```
 */
function applyMaxLinesLimit(
  lines: string[],
  maxLines: number | undefined,
  ellipsis: string,
  availableWidth: number,
): string[] {
  if (!maxLines || lines.length <= maxLines) {
    return lines
  }

  const truncatedLines = lines.slice(0, maxLines)
  const lastLineIndex = maxLines - 1
  const lastLine = truncatedLines[lastLineIndex]

  // Check if we can fit the ellipsis
  if (lastLine.length + ellipsis.length <= availableWidth) {
    // We can append the ellipsis to the last line
    truncatedLines[lastLineIndex] = lastLine + ellipsis
  } else {
    // Not enough space - either truncate or use ellipsis as the last line
    if (availableWidth > ellipsis.length) {
      truncatedLines[lastLineIndex] = lastLine.slice(0, availableWidth - ellipsis.length) + ellipsis
    } else {
      truncatedLines[lastLineIndex] = ellipsis.slice(0, availableWidth)
    }
  }

  return truncatedLines
}

/**
 * Wraps text while preserving whole words and maintaining consistent right alignment.
 * This is the core wrapping function used by wrapTextInBoundingBox.
 *
 * @param text - Text to wrap
 * @param availableWidth - Available width for wrapping
 * @param maxLines - Optional maximum number of lines
 * @param ellipsis - Ellipsis string to use when truncating (defaults to Characters.ELLIPSIS.HORIZONTAL)
 * @param preserveWholeWords - Whether to preserve whole words (defaults to true)
 * @returns Array of wrapped text lines
 * @throws {Error} If availableWidth is negative
 *
 * @example
 * ```ts
 * const lines = wrapTextPreservingAlignment(
 *   "This is a long text that needs to be wrapped",
 *   20,
 *   2,
 *   "..."
 * );
 * // Returns something like:
 * // ["This is a long text", "that needs to be..."]
 * ```
 */
function wrapTextPreservingAlignment(
  text: string,
  availableWidth: number,
  maxLines?: number,
  ellipsis: string = Characters.ELLIPSIS.HORIZONTAL,
  preserveWholeWords = true,
): string[] {
  const lines: string[] = []
  const words = splitIntoWordsAndSpaces(text)
  let currentLine = ''

  // Process words
  for (let i = 0; i < words.length; i++) {
    const wordObj = words[i]
    const { text: word, isWhitespace } = wordObj

    // Skip empty elements
    if (!word) continue

    // If this is a space at the start of a line, skip it
    if (isWhitespace && currentLine === '') continue

    // Check if the word fits on the current line
    const wouldExceedWidth = currentLine.length + word.length > availableWidth

    // Special handling for very long words
    if (!isWhitespace && word.length > availableWidth) {
      // If there's already content on the current line, add it first
      if (currentLine.trim()) {
        lines.push(currentLine.trimEnd())
        currentLine = ''
      }

      if (preserveWholeWords) {
        // If preserveWholeWords is true, put the entire long word on its own line
        // even if it exceeds the available width
        lines.push(word)
      } else {
        // Break the long word into chunks if we don't need to preserve whole words
        let remaining = word
        while (remaining) {
          const chunk = remaining.slice(0, availableWidth)
          lines.push(chunk)
          remaining = remaining.slice(availableWidth)
        }
      }
      continue
    }

    // Normal word wrapping
    if (wouldExceedWidth && !isWhitespace && currentLine.trim()) {
      // Word doesn't fit, start a new line
      lines.push(currentLine.trimEnd())
      currentLine = word
    } else {
      // Word fits, add it to the current line
      currentLine += word
    }
  }

  // Add the last line if it has content
  if (currentLine.trim()) {
    lines.push(currentLine.trimEnd())
  } else if (lines.length === 0) {
    // If we have no lines but had text input, ensure at least an empty line
    lines.push('')
  }

  // Apply maxLines limit with ellipsis if needed
  return applyMaxLinesLimit(lines, maxLines, ellipsis, availableWidth)
}

/**
 * Handles the special case of extremely narrow terminals by forcing wrapping
 * at the minimum content width.
 *
 * @param text - Text to wrap
 * @param minWidth - Minimum width to enforce
 * @param maxLines - Optional maximum number of lines
 * @param ellipsis - Ellipsis string to use when truncating (defaults to Characters.ELLIPSIS.HORIZONTAL)
 * @param preserveWholeWords - Whether to preserve whole words (defaults to true)
 * @returns Array of wrapped text lines
 *
 * @example
 * ```ts
 * // Force wrap in extremely narrow terminal
 * const lines = forceWrappingWithMinWidth(
 *   "Long text for narrow display",
 *   10,
 *   undefined,
 *   "...",
 *   false
 * );
 * // Returns character-by-character wrapping if preserveWholeWords is false
 * ```
 */
function forceWrappingWithMinWidth(
  text: string,
  minWidth: number,
  maxLines?: number,
  ellipsis: string = Characters.ELLIPSIS.HORIZONTAL,
  preserveWholeWords = true,
): string[] {
  if (preserveWholeWords) {
    // If preserving whole words, use the standard wrapping with min width
    return wrapTextPreservingAlignment(text, minWidth, maxLines, ellipsis, true)
  }

  // Otherwise, do character-by-character wrapping for extremely narrow terminals
  const lines: string[] = []
  let remaining = text

  while (remaining) {
    const chunk = remaining.slice(0, minWidth)
    lines.push(chunk)
    remaining = remaining.slice(minWidth)
  }

  return applyMaxLinesLimit(lines, maxLines, ellipsis, minWidth)
}

/**
 * Calculates text wrapping within defined boundaries in a terminal.
 * Handles word wrapping, respects left/right margins, and optional line limits.
 * Ensures consistent alignment even in narrow terminals.
 *
 * @param text - The text content to wrap
 * @param consoleWidth - Current width of the terminal console
 * @param options - Configuration for bounding box margins and limits
 * @returns An array of strings, where each string is a wrapped line.
 *          Lines do *not* include leading indentation; the caller should add it.
 *          If maxLines is exceeded, the last line ends with the ellipsis string.
 * @throws {Error} If options contains invalid values
 *
 * @example Basic Usage
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This is some text that needs to be wrapped within terminal boundaries.",
 *   80,
 *   { leftMargin: 5, rightMargin: 5 }
 * );
 * // Returns an array of lines that fit within the specified boundaries
 * ```
 *
 * @example With Percentage Margins
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "Text with percentage-based margins.",
 *   100,
 *   { leftMargin: "10%", rightMargin: "10%", maxLines: 3 }
 * );
 * // Uses 10% of console width for each margin
 * ```
 */
function wrapTextInBoundingBox(
  text: string,
  consoleWidth: number,
  options: BoundingBoxOptions = {},
): string[] {
  const {
    leftMargin,
    rightMargin,
    maxLines,
    ellipsis = Characters.ELLIPSIS.HORIZONTAL,
    minContentWidth = 15,
    preserveWholeWords = true,
  } = options

  // Ensure a reasonable minimum console width (40 chars)
  const safeConsoleWidth = Math.max(consoleWidth, 40)

  // Parse margins into character counts
  const leftMarginChars = parseMargin(leftMargin, safeConsoleWidth)
  const rightMarginChars = parseMargin(rightMargin, safeConsoleWidth)

  // Calculate the right boundary (position where text must wrap)
  const rightBoundary = Math.max(
    leftMarginChars + minContentWidth, // Ensure minimum content width
    safeConsoleWidth - rightMarginChars, // Standard right boundary calculation
  )

  // Calculate available width for text content
  const availableWidth = rightBoundary - leftMarginChars

  // Handle empty text
  if (!text || availableWidth <= 0) {
    return ['']
  }

  // Normalize whitespace at the beginning to prevent it affecting alignment
  const normalizedText = text.trimStart()

  // Handle special case of very narrow terminal where we need to force wrapping
  if (availableWidth < minContentWidth) {
    // Force a minimum content width by setting the right boundary appropriately
    return forceWrappingWithMinWidth(
      normalizedText,
      minContentWidth,
      maxLines,
      ellipsis,
      preserveWholeWords,
    )
  }

  return wrapTextPreservingAlignment(
    normalizedText,
    availableWidth,
    maxLines,
    ellipsis,
    preserveWholeWords,
  )
}

// Exports
export { wrapTextInBoundingBox }
