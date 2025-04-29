/**
 * @module boundingBox
 *
 * Provides utilities for wrapping text within defined boundaries in a terminal.
 * Handles text wrapping with configurable margins, line limits, and word preservation.
 * Properly handles ANSI escape sequences for terminal colors and formatting.
 *
 * @see {@link https://jsr.io/@tui/strings/doc/~/loopAnsi | loopAnsi} from @tui/strings for ANSI-aware iteration.
 * @see {@link https://jsr.io/@tui/strings/doc/~/slice | slice} from @tui/strings for width-aware string slicing.
 * @see {@link https://jsr.io/@tui/strings/doc/~/stripStyles | stripStyles} from @tui/strings for removing ANSI styles.
 * @see {@link https://jsr.io/@tui/strings/doc/~/textWidth | textWidth} from @tui/strings for accurate visual width calculation.
 */

// Use graphemeSplit like this: 'graphemeSplit(text)' returns an array of grapheme clusters
// TODO: investigate why we're not using the method `split()` from the graphemesplit module. Are we implementing out own split instead of properly leveraging this library instead?
import {} from 'graphemesplit' // Type-only import, removed unused variable
// Use these to replace the existing functions used to implement TODO 7
import { loopAnsi, slice, stripStyles, textWidth } from '@tui/strings'
import Characters from './characters.ts'

/**
 * Tracks ANSI formatting state for maintaining styles across line breaks
 */
interface AnsiState {
  /** Active color and style codes */
  activeCodes: string[]
  /** Reset sequence for terminal formatting */
  resetCode: string
}

/**
 * Extracts the current ANSI state from a string, tracking active codes
 *
 * @param text - String containing ANSI escape sequences
 * @returns Object with active ANSI codes and reset sequence
 */
function getAnsiState(text: string): AnsiState {
  const state: AnsiState = {
    activeCodes: [],
    resetCode: '\u001B[0m',
  }

  // Use loopAnsi for ANSI-aware traversal
  loopAnsi(text, (_char, style) => {
    // If style is provided, it's a new ANSI code
    if (style !== undefined) {
      // Check if this is a reset code
      if (style === '\u001B[0m') {
        // Reset clears all previous states
        state.activeCodes = []
      } else {
        // This is a style/color code - add it to active codes
        state.activeCodes.push(style)
      }
    }
    return false // Continue looping
  })

  return state
}

/**
 * Generates a string that restores the ANSI formatting state
 *
 * @param state - Current ANSI state to restore
 * @returns String with ANSI codes to restore the current formatting
 */
function restoreAnsiState(state: AnsiState): string {
  if (!state.activeCodes.length) return ''
  return state.activeCodes.join('')
}

/**
 * Configuration options for indentation styling.
 */
interface IndentOptions {
  /**
   * Simple single-value shorthand for common indentation patterns.
   * - 'paragraph': Indents the first line (traditional paragraph style)
   * - 'hanging': Indents all lines except the first (hanging indentation)
   * - 'blockquote': Indents all lines equally from both left and right (block quotation style)
   * - 'none': No indentation (default)
   */
  type?: 'paragraph' | 'hanging' | 'blockquote' | 'none'

  /**
   * Default amount to use with the type.
   * Can be specified as:
   * - A number >= 1 (treated as character count)
   * - A decimal < 1 (treated as percentage in decimal form)
   * - A percentage string (e.g. "5%")
   *
   * For 'blockquote' type, this size is applied to both left and right indentation.
   */
  size?: number | string

  /**
   * Left indentation for all lines.
   * Uses the same format as size.
   */
  left?: number | string

  /**
   * Right indentation for all lines.
   * Uses the same format as size.
   *
   * This creates a padding on the right side, which is particularly useful
   * for creating blockquote-style text with equal margins on both sides.
   */
  right?: number | string

  /**
   * Additional indent for first line only.
   * Positive values indent, negative values outdent (hanging indent).
   * Uses the same format as size.
   */
  firstLine?: number | string
}

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

  /**
   * Whether to preserve ANSI formatting sequences when wrapping text.
   * When true, ANSI sequences won't count towards visual width and will be maintained
   * across line breaks and truncations.
   * Defaults to true.
   */
  preserveAnsiFormatting?: boolean

  /**
   * Advanced indentation options for controlling text layout.
   * Provides CSS-like control over text indentation with support for
   * paragraph indents, hanging indents, and blockquotes.
   */
  indent?: IndentOptions
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
 * Parses an indent value using the same rules as parseMargin:
 * - String ending with "%" → converted to decimal percent (0-1)
 * - String without "%" → parsed as character count
 * - Number ≥ 1 → used as character count
 * - Number < 1 → used as decimal percent (0-1)
 *
 * @param value - The indent value to parse
 * @param consoleWidth - Current console width for percentage calculations
 * @returns The calculated indent in characters
 */
function parseIndent(value: string | number | undefined, consoleWidth: number): number {
  // Reuse the logic from parseMargin function
  return parseMargin(value, consoleWidth)
}

/**
 * Resolves indentation types into concrete left/right/firstLine indent values.
 * Maps shorthand types to their appropriate indentation configurations.
 *
 * @param options - Indentation options
 * @param consoleWidth - Current console width for percentage calculations
 * @returns Object with resolved left, right, and firstLine indent values
 *
 * @example
 * ```ts
 * // For paragraph style (first line indented)
 * const indents = resolveIndentType({ type: 'paragraph', size: 4 }, 100);
 * // Returns: { leftIndent: 0, rightIndent: 0, firstLineIndent: 4 }
 *
 * // For hanging indent (all lines except first indented)
 * const indents = resolveIndentType({ type: 'hanging', size: 4 }, 100);
 * // Returns: { leftIndent: 4, rightIndent: 0, firstLineIndent: -4 }
 *
 * // For blockquote style (equal indentation on both sides)
 * const indents = resolveIndentType({ type: 'blockquote', size: 4 }, 100);
 * // Returns: { leftIndent: 4, rightIndent: 4, firstLineIndent: 0 }
 * ```
 */
function resolveIndentType(
  options: IndentOptions,
  consoleWidth: number,
): {
  leftIndent: number
  rightIndent: number
  firstLineIndent: number
} {
  const defaultSize = options.size !== undefined ? parseIndent(options.size, consoleWidth) : 4
  const result = {
    leftIndent: options.left !== undefined ? parseIndent(options.left, consoleWidth) : 0,
    rightIndent: options.right !== undefined ? parseIndent(options.right, consoleWidth) : 0,
    firstLineIndent: options.firstLine !== undefined
      ? parseIndent(options.firstLine, consoleWidth)
      : 0,
  }

  // Apply shorthand type if specified
  if (options.type) {
    switch (options.type) {
      case 'paragraph':
        // First line indented, others at margin
        result.firstLineIndent = defaultSize
        break
      case 'hanging':
        // First line at margin, others indented (negative firstLine offset)
        result.leftIndent = defaultSize
        result.firstLineIndent = -defaultSize
        break
      case 'blockquote':
        // All lines indented equally from both left and right
        result.leftIndent = defaultSize
        result.rightIndent = defaultSize // Add right indent equal to left
        result.firstLineIndent = 0 // No additional first line indent
        break
      default:
        // No indentation (already handled by the default values)
        break
    }
  }

  // Handle special case of negative firstLine with blockquote
  if (options.type === 'blockquote' && result.firstLineIndent < 0) {
    // If blockquote has negative first line indent, apply it on top of the leftIndent
    // instead of overwriting leftIndent completely
    result.firstLineIndent = result.leftIndent + result.firstLineIndent
  }

  return result
}

/**
 * Splits text into words and whitespace segments for more precise handling.
 * Preserves ANSI escape sequences with the words/spaces they modify.
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
 *
 * @example With ANSI sequences
 * ```ts
 * const parts = splitIntoWordsAndSpaces("\u001B[31mRed\u001B[0m");
 * // Returns: [
 * //   { text: "\u001B[31mRed\u001B[0m", isWhitespace: false }
 * // ]
 * // ANSI sequences are preserved with their words
 * ```
 */
function splitIntoWordsAndSpaces(text: string): Array<{ text: string; isWhitespace: boolean }> {
  const segments: Array<{ text: string; isWhitespace: boolean }> = []
  let currentSegment = ''
  let currentIsWhitespace: boolean | null = null
  let currentAnsiStyle = '' // Track the ANSI style preceding the character

  // Use loopAnsi for ANSI-aware iteration, processing grapheme by grapheme
  loopAnsi(text, (char, style) => {
    // Update the current ANSI style if it changed
    if (style !== undefined) {
      currentAnsiStyle = style
    }

    // Test if the current grapheme is whitespace
    const charIsWhitespace = /\s/.test(char)

    // If the type of character changes (whitespace vs non-whitespace), or if it's the first char
    if (currentIsWhitespace === null || charIsWhitespace !== currentIsWhitespace) {
      // If there's a completed segment, add it to the list
      if (currentSegment !== '') {
        segments.push({ text: currentSegment, isWhitespace: currentIsWhitespace ?? false })
      }
      // Start a new segment with current ANSI style
      currentSegment = currentAnsiStyle + char
      currentIsWhitespace = charIsWhitespace
    } else {
      // Continue the current segment
      currentSegment += (style !== undefined ? style : '') + char
    }

    return false // Continue looping
  })

  // Add the last segment if it exists
  if (currentSegment !== '') {
    segments.push({ text: currentSegment, isWhitespace: currentIsWhitespace ?? false })
  }

  return segments
}

/**
 * Applies max lines limit with ellipsis handling.
 * If the number of lines exceeds maxLines, truncates the array and adds an ellipsis
 * to the last line in a way that respects the available width.
 * Properly handles ANSI escape sequences during truncation.
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
 *
 * @example With ANSI formatting
 * ```ts
 * const truncated = applyMaxLinesLimit(
 *   ["\u001B[31mLine 1\u001B[0m", "Line 2", "Line 3"],
 *   2,
 *   "...",
 *   10
 * );
 * // Returns: ["\u001B[31mLine 1\u001B[0m", "Line 2..."]
 * // ANSI sequences are preserved
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
  const lastLineVisualLength = textWidth(lastLine)
  const ellipsisVisualLength = textWidth(ellipsis)

  // Check if we can fit the ellipsis
  if (lastLineVisualLength + ellipsisVisualLength <= availableWidth) {
    // We can append the ellipsis to the last line
    truncatedLines[lastLineIndex] = lastLine + ellipsis
  } else {
    // Not enough space - either truncate or use ellipsis as the last line
    if (availableWidth > ellipsisVisualLength) {
      // Truncate the last line to make room for the ellipsis
      // Use slice from @tui/strings for width-aware slicing that respects grapheme boundaries
      const cutWidth = availableWidth - ellipsisVisualLength
      truncatedLines[lastLineIndex] = slice(lastLine, 0, cutWidth) + ellipsis
    } else {
      // If we can't even fit the ellipsis, just use a truncated ellipsis
      truncatedLines[lastLineIndex] = slice(ellipsis, 0, availableWidth)
    }
  }

  return truncatedLines
}

/**
 * Wraps text while preserving whole words and maintaining consistent right alignment.
 * This is the core wrapping function used by wrapTextInBoundingBox.
 * Handles ANSI escape sequences by using visual length instead of raw string length.
 *
 * @param text - Text to wrap
 * @param availableWidth - Available width for wrapping
 * @param maxLines - Optional maximum number of lines
 * @param ellipsis - Ellipsis string to use when truncating (defaults to Characters.ELLIPSIS.HORIZONTAL)
 * @param preserveWholeWords - Whether to preserve whole words (defaults to true)
 * @param firstLineIndent - Additional indent for the first line (defaults to 0)
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
  firstLineIndent = 0,
): string[] {
  const lines: string[] = []
  const words = splitIntoWordsAndSpaces(text)
  let currentLine = ''
  let currentLineVisualLength = 0
  let currentAnsiState: AnsiState = { activeCodes: [], resetCode: '\u001B[0m' }

  // Adjust first line width for first-line indent (if any)
  const firstLineWidth = Math.max(0, availableWidth - firstLineIndent)
  // Track if we're on the first line
  let isFirstLine = true

  // Process words
  for (let i = 0; i < words.length; i++) {
    const wordObj = words[i]
    const { text: word, isWhitespace } = wordObj
    // Use textWidth instead of string.length for visual width calculation
    const wordVisualLength = textWidth(word)

    // Skip empty elements
    if (!word) continue

    // If this is a space at the start of a line, skip it
    if (isWhitespace && currentLine === '') continue

    // Update ANSI state with codes from this word
    const wordAnsiState = getAnsiState(word)
    if (wordAnsiState.activeCodes.length > 0) {
      // Add these codes to our current state unless they're overridden
      if (word.includes('\u001B[0m')) {
        // Reset found, start fresh with only codes after the reset
        const resetIndex = word.lastIndexOf('\u001B[0m')
        const afterResetText = word.substring(resetIndex + 4) // 4 is length of reset code
        currentAnsiState = getAnsiState(afterResetText)
      } else {
        // No reset, just add the new codes
        currentAnsiState.activeCodes.push(...wordAnsiState.activeCodes)
      }
    }

    // Get the effective width for the current line
    const effectiveWidth = isFirstLine ? firstLineWidth : availableWidth

    // Check if the word fits on the current line
    const wouldExceedWidth = currentLineVisualLength + wordVisualLength > effectiveWidth

    // Special handling for very long words
    if (!isWhitespace && wordVisualLength > effectiveWidth) {
      // If there's already content on the current line, add it first
      if (stripStyles(currentLine).trim()) {
        lines.push(currentLine.trimEnd())
        currentLine = restoreAnsiState(currentAnsiState)
        currentLineVisualLength = 0
        isFirstLine = false
      }

      if (preserveWholeWords) {
        // If preserveWholeWords is true, put the entire long word on its own line
        // even if it exceeds the available width
        lines.push(word)
        isFirstLine = false
      } else {
        // Use slice from @tui/strings to break the long word
        const targetWidth = isFirstLine ? firstLineWidth : availableWidth
        let remainingWord = word
        while (textWidth(remainingWord) > targetWidth) {
          const chunk = slice(remainingWord, 0, targetWidth)
          lines.push(chunk)
          remainingWord = slice(remainingWord, targetWidth)
          // Preserve ANSI state across the break is handled by slice implicitly now
          isFirstLine = false
        }
        if (textWidth(remainingWord) > 0) {
          lines.push(remainingWord)
          isFirstLine = false
        }
      }
      continue
    }

    // Normal word wrapping
    if (wouldExceedWidth && !isWhitespace && stripStyles(currentLine).trim()) {
      // Word doesn't fit, start a new line
      lines.push(currentLine.trimEnd())
      // Start new line with current ANSI state
      currentLine = restoreAnsiState(currentAnsiState) + word
      currentLineVisualLength = wordVisualLength
      isFirstLine = false
    } else {
      // Word fits, add it to the current line
      currentLine += word
      currentLineVisualLength += wordVisualLength
    }
  }

  // Add the last line if it has content
  if (stripStyles(currentLine).trim()) {
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
 * Properly handles ANSI escape sequences when calculating length and performing wrapping.
 *
 * @param text - Text to wrap
 * @param minWidth - Minimum width to enforce
 * @param maxLines - Optional maximum number of lines
 * @param ellipsis - Ellipsis string to use when truncating (defaults to Characters.ELLIPSIS.HORIZONTAL)
 * @param preserveWholeWords - Whether to preserve whole words (defaults to true)
 * @param firstLineIndent - Additional indent for the first line (defaults to 0)
 * @param rightIndent - Right indentation to apply (defaults to 0), reduces the effective width
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
  firstLineIndent = 0,
  rightIndent = 0, // Add right indent parameter
): string[] {
  // Modify the effective width calculation to account for right indentation
  const effectiveMinWidth = Math.max(1, minWidth - rightIndent)

  if (preserveWholeWords) {
    // If preserving whole words, use the standard wrapping with adjusted width
    return wrapTextPreservingAlignment(
      text,
      effectiveMinWidth,
      maxLines,
      ellipsis,
      true,
      firstLineIndent,
    )
  }

  // Otherwise, do character-by-character wrapping for extremely narrow terminals
  // This is more complex with ANSI codes since we need to maintain the styling
  const lines: string[] = []
  let currentLine = ''
  let visualPos = 0
  let isFirstLine = true

  // Adjust first line width for first-line indent (if any)
  const firstLineWidth = Math.max(1, effectiveMinWidth - firstLineIndent)
  const effectiveWidth = isFirstLine ? firstLineWidth : effectiveMinWidth

  // Use loopAnsi for ANSI-aware iteration and respect grapheme boundaries
  loopAnsi(text, (char, style) => {
    // Add character with its style
    currentLine += (style || '') + char
    // Use textWidth to get accurate visual width
    visualPos = textWidth(currentLine)

    // If we've reached the end of a line, start a new one
    if (visualPos >= effectiveWidth) {
      lines.push(currentLine)
      currentLine = ''
      visualPos = 0
      isFirstLine = false
    }

    return false // Continue looping
  })

  // Add any remaining content
  if (currentLine) {
    lines.push(currentLine)
  }

  return applyMaxLinesLimit(lines, maxLines, ellipsis, effectiveMinWidth)
}

/**
 * Calculates text wrapping within defined boundaries in a terminal.
 * Handles word wrapping, respects left/right margins, and optional line limits.
 * Ensures consistent alignment even in narrow terminals.
 * Properly handles ANSI escape sequences for colors and text formatting.
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
 *
 * @example With ANSI Formatting
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "\u001b[31mThis text is red\u001b[0m and this is normal",
 *   80,
 *   { preserveAnsiFormatting: true }
 * );
 * // ANSI color codes are preserved while calculating correct visual width
 * ```
 *
 * @example Paragraph Indentation (first line indented)
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This is a paragraph with the first line indented.",
 *   80,
 *   { indent: { type: 'paragraph', size: 4 } }
 * );
 * // First line will be indented by 4 spaces
 * ```
 *
 * @example Hanging Indentation
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This is a hanging indent where all lines except the first are indented.",
 *   80,
 *   { indent: { type: 'hanging', size: 4 } }
 * );
 * // All lines except the first will be indented by 4 spaces
 * ```
 *
 * @example Blockquote Indentation
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This is a blockquote with all lines indented equally.",
 *   80,
 *   { indent: { type: 'blockquote', size: 4 } }
 * );
 * // All lines will be indented by 4 spaces on both left and right sides
 * ```
 *
 * @example Custom Indentation
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This text has custom indentation with the first line indented differently.",
 *   80,
 *   { indent: { left: 2, firstLine: 4 } }
 * );
 * // First line will have 6 spaces (2+4), subsequent lines will have 2
 * ```
 *
 * @example Combined Left and Right Indentation
 * ```ts
 * const wrappedText = wrapTextInBoundingBox(
 *   "This text has both left and right indentation.",
 *   80,
 *   { indent: { left: 4, right: 4 } }
 * );
 * // All lines will have 4 spaces of indentation on left and right sides
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
    preserveAnsiFormatting = true,
    indent,
  } = options

  // Ensure a reasonable minimum console width (40 chars)
  const safeConsoleWidth = Math.max(consoleWidth, 40)

  // Parse margins into character counts
  const leftMarginChars = parseMargin(leftMargin, safeConsoleWidth)
  const rightMarginChars = parseMargin(rightMargin, safeConsoleWidth)

  // Resolve indentation options
  const { leftIndent, rightIndent, firstLineIndent } = indent
    ? resolveIndentType(indent, safeConsoleWidth)
    : { leftIndent: 0, rightIndent: 0, firstLineIndent: 0 }

  // Calculate the total left and right margins including indent
  const totalLeftMargin = leftMarginChars + leftIndent
  const totalRightMargin = rightMarginChars + rightIndent

  // Calculate the right boundary (position where text must wrap)
  const rightBoundary = Math.max(
    totalLeftMargin + minContentWidth, // Ensure minimum content width
    safeConsoleWidth - totalRightMargin, // Standard right boundary calculation
  )

  // Calculate available width for text content
  const availableWidth = rightBoundary - totalLeftMargin

  // Handle empty text
  if (!text || availableWidth <= 0) {
    return ['']
  }

  // If ANSI formatting is not preserved, strip ANSI sequences before processing
  const processedText = preserveAnsiFormatting ? text : stripStyles(text)

  // Normalize whitespace at the beginning to prevent it affecting alignment
  const normalizedText = processedText.trimStart()

  // Special case: If the text only contains ANSI codes and no visible content,
  // return it as-is in a single line
  if (preserveAnsiFormatting && textWidth(normalizedText) === 0 && normalizedText.length > 0) {
    return [normalizedText]
  }

  // Handle special case of very narrow terminal where we need to force wrapping
  if (availableWidth < minContentWidth) {
    // Force a minimum content width by setting the right boundary appropriately
    const wrappedText = forceWrappingWithMinWidth(
      normalizedText,
      minContentWidth,
      maxLines,
      ellipsis,
      preserveWholeWords,
      firstLineIndent,
      rightIndent, // Pass rightIndent parameter
    )

    // Apply indentation to wrapped text
    return applyIndentation(wrappedText, firstLineIndent, leftIndent, rightIndent)
  }

  // Wrap text with adjusted available width for first line indent if needed
  const wrappedLines = wrapTextPreservingAlignment(
    normalizedText,
    availableWidth,
    maxLines,
    ellipsis,
    preserveWholeWords,
    firstLineIndent,
  )

  // Handle empty result when we have content
  if (wrappedLines.length === 1 && wrappedLines[0] === '' && normalizedText !== '') {
    // Something went wrong, return the original text as a fallback
    return [normalizedText]
  }

  // Apply indentation
  return applyIndentation(wrappedLines, firstLineIndent, leftIndent, rightIndent)
}

/**
 * Applies indentation to each line of text.
 * First line gets different indentation than subsequent lines.
 *
 * @param lines - Array of text lines to indent
 * @param firstLineIndent - Additional indentation for the first line
 * @param leftIndent - Left indentation for all lines
 * @param rightIndent - Right indentation for all lines (currently unused, but preserved for API)
 *                      Right indentation is applied during the text wrapping stage by
 *                      reducing the available width, not by adding spaces
 * @returns Array of indented text lines
 */
function applyIndentation(
  lines: string[],
  firstLineIndent = 0,
  leftIndent = 0,
  _rightIndent = 0, // Parameter preserved for API consistency but not used internally
): string[] {
  if (lines.length === 0) return lines

  // Apply indentation to each line
  const indentedLines = [...lines]

  // Apply indentation to all lines
  for (let i = 0; i < indentedLines.length; i++) {
    let line = indentedLines[i]

    // Apply left indent - for all lines except first line which gets special treatment
    if (i > 0 && leftIndent > 0) {
      line = ' '.repeat(leftIndent) + line
    }

    // First line gets special indentation (in addition to leftIndent if applicable)
    if (i === 0 && firstLineIndent > 0) {
      line = ' '.repeat(firstLineIndent) + line
    }

    indentedLines[i] = line
  }

  return indentedLines
}

// Exports
export { wrapTextInBoundingBox }
