import { bold, brightGreen, cyan, gray } from '@std/fmt/colors'
import Characters from './characters.ts'

// Utility for conditional margin rendering
const renderMargin = (size = 0, char = Characters.EOL.LF) => {
  if (size > 0) newLine({ character: char }, { repeat: size })
}

const StyleConfig = {
  header: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    lineCharacter: Characters.BOX.HORIZONTAL.DOUBLE,
  },
  labeledList: {
    labelMarginRight: 4,
    marginTop: 0,
    marginBottom: 0,
    spacingCharacter: Characters.SPACE.NORMAL,
  },
  horizontalLine: {
    character: Characters.BOX.HORIZONTAL.SINGLE,
    repeat: 80,
    marginTop: 0,
    marginBottom: 0,
  },
  footer: {
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    lineCharacter: Characters.BOX.HORIZONTAL.DOUBLE,
  },
  newLine: {
    character: Characters.EOL.LF,
    repeat: 0,
  },
}

/**
 * Displays a formatted header in the terminal with a title and optional subtitle.
 *
 * @param content - Object containing content to display
 * @param content.title - Main title text (defaults to current process name)
 * @param content.subtitle - Secondary text below title (defaults to script name)
 * @param content.lineCharacter - Character to use for the horizontal line (defaults to double line)
 * @param options - Object containing display options
 * @param options.marginTop - Number of newlines to add before the header
 * @param options.marginBottom - Number of newlines to add after the header
 * @param options.paddingTop - Number of newlines to add before the title
 * @param options.paddingBottom - Number of newlines to add after the title
 *
 * @example
 * ```ts
 * import { header } from "./console-components.ts"
 *
 * header({ title: "My Application", subtitle: "Configuration Report" })
 * ```
 */
function header(
  content: {
    title?: string
    subtitle?: string
    lineCharacter?: string
  } = {},
  options: {
    marginTop?: number
    marginBottom?: number
    paddingTop?: number
    paddingBottom?: number
  } = {},
): void {
  const { title, subtitle, lineCharacter = StyleConfig.header.lineCharacter } = content
  const {
    marginTop = StyleConfig.header.marginTop,
    marginBottom = StyleConfig.header.marginBottom,
    paddingTop = StyleConfig.header.paddingTop,
    paddingBottom = StyleConfig.header.paddingBottom,
  } = options

  const processFile = new URL(import.meta.url).pathname.split('/').pop() || ''
  const defaultTitle = processFile.replace(/\.[^/.]+$/, '')
  const defaultSubtitle = import.meta.url.split('/').pop() || ''

  const finalTitle = title ?? defaultTitle
  const finalSubtitle = subtitle ?? defaultSubtitle

  horizontalLine({ character: lineCharacter }, {
    marginTop: marginTop,
    marginBottom: paddingTop,
  })
  console.log(bold(brightGreen(finalTitle)))
  if (finalSubtitle && finalSubtitle !== finalTitle) {
    console.log(gray(finalSubtitle))
  }
  horizontalLine({ character: lineCharacter }, {
    marginBottom: marginBottom,
    marginTop: paddingBottom,
  })
}

/**
 * Displays a list of labeled key-value pairs with aligned values.
 *
 * @param content - Object containing the list of key-value pairs to display
 * @param content.list - Object containing the list of key-value pairs to display
 * @param options - Configuration options for display formatting
 * @param options.labelMarginRight - Minimum spaces between labels and values
 * @param options.marginTop - Number of newlines to add before the list
 * @param options.marginBottom - Number of newlines to add after the list
 * @param options.paddingCharacter - Character to use for padding between label and value
 *
 * @example
 * ```ts
 * import { labeledList } from "./console-components.ts"
 * import Characters from "./characters.ts"
 *
 * labeledList({
 *   list: {
 *     "User": "admin",
 *     "Status": "active",
 *     "Roles": ["admin", "editor"]
 *   }
 * })
 * ```
 */
function labeledList(
  content: { list: Record<string, string | string[]> },
  options: {
    labelMarginRight?: number
    marginTop?: number
    marginBottom?: number
    spacingCharacter?: string
  } = {},
): void {
  const { list } = content
  const {
    labelMarginRight = StyleConfig.labeledList.labelMarginRight,
    marginTop = StyleConfig.labeledList.marginTop,
    marginBottom = StyleConfig.labeledList.marginBottom,
    spacingCharacter = StyleConfig.labeledList.spacingCharacter,
  } = options

  const entries = Object.entries(list)
  if (entries.length === 0) return

  const formattedEntries = entries.map(([label, value]) => ({
    label: label.endsWith(':') ? label : `${label}:`,
    value,
  }))

  const longestLabelLength = Math.max(...formattedEntries.map(({ label }) => label.length))

  // Get terminal width for dynamic wrapping, limiting to a maximum of 100 chars
  let terminalWidth = 80
  try {
    const { columns } = Deno.consoleSize()
    terminalWidth = Math.min(columns, 100) // Limit to 100 chars max width
  } catch {
    // Fallback to a sensible default if consoleSize is unavailable
    terminalWidth = 80
  }

  // Helper function to wrap text within the available width
  const wrapText = (text: string, startColumn: number, maxWidth: number): string[] => {
    if (!text) return ['']

    const availableWidth = Math.max(maxWidth - startColumn, 20) // Ensure minimum width
    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      // Handle very long words that need to be broken
      if (word.length > availableWidth) {
        // If we already have content on the current line, add it first
        if (currentLine) {
          lines.push(currentLine)
          currentLine = ''
        }

        // Break the long word into chunks
        let remainingWord = word
        while (remainingWord.length > 0) {
          const chunk = remainingWord.slice(0, availableWidth)
          lines.push(chunk)
          remainingWord = remainingWord.slice(availableWidth)
        }
        continue
      }

      // Check if adding this word would exceed the width
      if (currentLine && (currentLine.length + word.length + 1) > availableWidth) {
        // Current line is full, add it and start a new one
        lines.push(currentLine)
        currentLine = word
      } else {
        // Add word with a space if not the first word in the line
        currentLine = currentLine ? `${currentLine} ${word}` : word
      }
    }

    // Add the last line if it has content
    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  const formatValue = (value: string | string[]): string => {
    if (Array.isArray(value)) {
      // For short arrays, join with commas
      if (value.join(', ').length <= terminalWidth - longestLabelLength - labelMarginRight) {
        return value.join(', ')
      }
      // For longer arrays, join with commas but allow wrapping
      return value.join(', ')
    }
    return value
  }

  renderMargin(marginTop)
  for (const { label, value } of formattedEntries) {
    const formattedValue = formatValue(value)
    const padding = spacingCharacter.repeat(longestLabelLength - label.length + labelMarginRight)
    const labelWithPadding = `${bold(label)}${padding}`

    // Calculate where the value will start (column position)
    const valueStartColumn = longestLabelLength + labelMarginRight

    // Wrap the text to fit within the terminal width
    const wrappedLines = wrapText(formattedValue, valueStartColumn, terminalWidth)

    // Print the first line with the label - apply gray() to dim the value
    console.log(`${labelWithPadding}${gray(wrappedLines[0])}`)

    // Print any additional wrapped lines with proper indentation - dim these lines too
    if (wrappedLines.length > 1) {
      const indent = ' '.repeat(valueStartColumn)
      for (let i = 1; i < wrappedLines.length; i++) {
        console.log(`${indent}${gray(wrappedLines[i])}`)
      }
    }
  }
  renderMargin(marginBottom)
}

/**
 * Prints a horizontal line to the terminal using the specified character.
 *
 * @param content - Object containing content configuration
 * @param content.character - Character to use for the line
 * @param options - Object containing display options
 * @param options.repeat - Number of times to repeat the character
 * @param options.marginTop - Number of newlines to add before the line
 * @param options.marginBottom - Number of newlines to add after the line
 *
 * @example
 * ```ts
 * import { horizontalLine } from "./console-components.ts"
 * import Characters from "./characters.ts"
 *
 * horizontalLine() // Prints default line
 * horizontalLine({ character: "=" }) // Prints line with custom character
 * horizontalLine({ character: Characters.BOX.HORIZONTAL.DOUBLE }) // Prints double line
 * ```
 */
function horizontalLine(
  content: {
    character?: string
  } = {},
  options: {
    repeat?: number
    marginTop?: number
    marginBottom?: number
  } = {},
): void {
  const { character = StyleConfig.horizontalLine.character } = content
  const {
    repeat = StyleConfig.horizontalLine.repeat,
    marginTop = StyleConfig.horizontalLine.marginTop,
    marginBottom = StyleConfig.horizontalLine.marginBottom,
  } = options

  // Get terminal width using Deno API and limit the line length
  let lineLength = repeat
  try {
    const { columns } = Deno.consoleSize()
    lineLength = Math.min(repeat, columns)
  } catch {
    // Fallback to configured repeat or 80 if consoleSize is unavailable
    lineLength = Math.min(repeat, 80)
  }

  renderMargin(marginTop)
  // Use writeSync instead of console.log to avoid automatic newline
  const encoder = new TextEncoder()
  Deno.stdout.writeSync(encoder.encode(character.repeat(lineLength)))
  newLine()
  renderMargin(marginBottom)
}

/**
 * Displays a simple footer in the terminal with a summary and optional title/subtitle.
 *
 * @param content - Object containing content to display
 * @param content.summary - Required summary text to display
 * @param content.title - Optional main title text
 * @param content.subtitle - Optional secondary text below title
 * @param options - Object containing display options
 * @param options.marginTop - Number of newlines to add before the footer
 * @param options.marginBottom - Number of newlines to add after the footer
 *
 * @example
 * ```ts
 * import { footer } from "./console-components.ts"
 *
 * footer({ summary: "209 passed (12/14), 2 errors (2/14), 27 warnings (12/14)" })
 * ```
 */
function footer(
  content: {
    summary: string
    title?: string
    subtitle?: string
    lineCharacter?: string
  },
  options: {
    marginTop?: number
    marginBottom?: number
    paddingTop?: number
    paddingBottom?: number
  } = {},
): void {
  const { summary, title, subtitle, lineCharacter = StyleConfig.footer.lineCharacter } = content
  const {
    marginTop = StyleConfig.footer.marginTop,
    marginBottom = StyleConfig.footer.marginBottom,
    paddingTop = StyleConfig.footer.paddingTop,
    paddingBottom = StyleConfig.footer.paddingBottom,
  } = options
  horizontalLine({ character: lineCharacter }, { marginTop: marginTop, marginBottom: paddingTop })

  if (title) {
    console.log(bold(cyan(title)))
  }

  if (subtitle && subtitle !== title) {
    console.log(gray(subtitle))
  }
  console.log(`${bold('Summary:')} ${summary}`)

  horizontalLine({ character: lineCharacter }, {
    marginBottom: marginBottom,
    marginTop: paddingBottom,
  })
}

/**
 * Prints the specified number of newlines to the console.
 *
 * @param content - Object containing content configuration
 * @param content.character - Character to use for line endings (default: LF)
 * @param options - Object containing display options
 * @param options.repeat - Number of line endings to print (default: 1)
 *
 * @example
 * ```ts
 * import { newLine } from "./console-components.ts"
 * import Characters from "./characters.ts"
 *
 * // Unix style line ending
 * newLine()
 *
 * // Windows style line ending
 * newLine({ character: Characters.EOL.CRLF })
 *
 * // Multiple line endings
 * newLine({ character: Characters.EOL.LF }, { repeat: 3 })
 * ```
 */
function newLine(
  content: {
    character?: string
  } = {},
  options: {
    repeat?: number
  } = {},
): void {
  const { character = StyleConfig.newLine.character } = content
  const { repeat = StyleConfig.newLine.repeat } = options

  for (const line of character.repeat(repeat).split(character)) {
    console.log(line)
  }
}

export { footer, header, horizontalLine, labeledList, newLine }
