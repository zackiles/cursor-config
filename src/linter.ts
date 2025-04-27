import { parseArgs } from '@std/cli/parse-args'
import { expandGlob } from '@std/fs'
import { bold, cyan, gray, green, red, yellow } from '@std/fmt/colors'
import { loadAllRules } from './lint-rules/index.ts'
import { groupResultsByFile, processMdcFile } from './processor.ts'
import type { LintResult } from './types.ts'

// Maximum line width to use even if terminal is wider
const MAX_LINE_WIDTH = 120

/**
 * Gets the width of the console, limiting to MAX_LINE_WIDTH
 * @returns The console width or a default value if not available
 */
function getConsoleWidth(): number {
  try {
    const { columns } = Deno.consoleSize()
    // Set a reasonable minimum width to ensure proper formatting
    return Math.max(Math.min(columns, MAX_LINE_WIDTH), 40)
  } catch (_) {
    // Default width if console size isn't available
    return MAX_LINE_WIDTH
  }
}

/**
 * Wraps text to fit within specified width with proper indentation
 *
 * @param text - Text to wrap
 * @param prefixLength - Length of prefix to align wrapped lines
 * @param maxWidth - Maximum width to wrap at
 * @returns Array of wrapped lines
 */
function wrapText(text: string, prefixLength: number, maxWidth: number): string[] {
  if (!text) return ['']

  const lines: string[] = []
  const indent = ' '.repeat(prefixLength)
  let remainingText = text

  // First line doesn't need the indent because it will be appended to prefix
  let availableWidth = maxWidth - prefixLength

  // Ensure we have a minimum width to work with
  availableWidth = Math.max(availableWidth, 20)

  while (remainingText.length > 0) {
    if (remainingText.length <= availableWidth) {
      // Remaining text fits on current line
      lines.push(remainingText)
      break
    }

    // Find a good break point
    let breakPoint = remainingText.lastIndexOf(' ', availableWidth)
    if (breakPoint === -1 || breakPoint < availableWidth / 2) {
      // No good space found, or it's too early in the text
      // If no space found at all, break at the available width
      breakPoint = breakPoint === -1 ? Math.min(availableWidth, remainingText.length) : breakPoint
    }

    // Add the line
    lines.push(remainingText.slice(0, breakPoint))

    // Move to the next part of text, skipping leading spaces
    remainingText = remainingText.slice(breakPoint).replace(/^\s+/, '')
  }

  // Add indentation to all lines except the first
  return [lines[0]].concat(lines.slice(1).map((line) => `${indent}${line}`))
}

interface CliOptions {
  files: string[]
  json: boolean
  help: boolean
  verbose: boolean
  parse: boolean
  rules: boolean
}

/**
 * Parses command line arguments
 *
 * @param args - Command line arguments
 * @returns Parsed CLI options
 */
function parseCliArgs(args: string[]): CliOptions {
  const parsedArgs = parseArgs(args, {
    boolean: ['json', 'help', 'verbose', 'parse', 'rules'],
    alias: {
      h: 'help',
      j: 'json',
      v: 'verbose',
      p: 'parse',
      r: 'rules',
    },
    default: {
      json: false,
      help: false,
      verbose: false,
      parse: false,
      rules: false,
    },
  })

  return {
    files: parsedArgs._ as string[],
    json: parsedArgs.json,
    help: parsedArgs.help,
    verbose: parsedArgs.verbose,
    parse: parsedArgs.parse,
    rules: parsedArgs.rules,
  }
}

/**
 * Displays help information
 */
function showHelp(): void {
  console.log(`
${bold('MDC File Linter')}

${bold('USAGE:')}
  deno run -A src/linter.ts [OPTIONS] [...FILES]

${bold('OPTIONS:')}
  -h, --help      Show this help message
  -j, --json      Output results in JSON format
  -v, --verbose   Show verbose output
  -p, --parse     Only parse MDC files and output as JSON (no linting)
  -r, --rules     List all available lint rules as JSON

${bold('EXAMPLES:')}
  deno run -A src/linter.ts .cursor/rules/*.mdc
  deno run -A src/linter.ts --json path/to/rule.mdc
  deno run -A src/linter.ts --parse path/to/rule.mdc
  deno run -A src/linter.ts --rules
  `)
}

/**
 * Splits text into lines that fit within a maximum width
 *
 * @param text - Text to split
 * @param maxWidth - Maximum width for each line
 * @returns Array of lines
 */
function splitTextIntoLines(text: string, maxWidth: number): string[] {
  if (!text) return ['']
  if (maxWidth <= 0) return [text] // Avoid issues with negative width

  // Split text into words while preserving spaces
  const words = text.split(/(\s+)/).filter(Boolean)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    // Check if this word would make the line too long
    if ((currentLine + word).length > maxWidth) {
      // Don't start a new line with whitespace
      if (currentLine.trim().length > 0) {
        // Add the current line to our results
        lines.push(currentLine)
        // Start a new line with this word
        currentLine = word
      } else {
        // Current line is just whitespace, append the word
        currentLine += word
      }
    } else {
      // Word fits on the current line
      currentLine += word
    }

    // Handle words that are longer than the max width
    if (currentLine.length > maxWidth && currentLine.trim() === currentLine) {
      // If the current line is a single word that's too long,
      // we have no choice but to add it as is
      lines.push(currentLine)
      currentLine = ''
    }
  }

  // Add any remaining text
  if (currentLine.trim().length > 0) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Converts an absolute file path to a path relative to the given base directory
 *
 * @param absolutePath - The absolute file path to convert
 * @param baseDir - The base directory to make the path relative to
 * @returns A relative path
 */
function toRelativePath(absolutePath: string, baseDir: string): string {
  // Ensure the base directory ends with a slash
  const normalizedBaseDir = baseDir.endsWith('/') ? baseDir : `${baseDir}/`

  // If the path starts with the base directory, remove that prefix
  if (absolutePath.startsWith(normalizedBaseDir)) {
    return absolutePath.substring(normalizedBaseDir.length)
  }

  // If we can't make it relative, return the original path
  return absolutePath
}

/**
 * Formats a lint result for human-readable console output
 *
 * @param result - The lint result to format
 * @param filePath - The file path the result is associated with
 * @param verbose - Whether to include verbose details
 * @param consoleWidth - Width of the console for text wrapping
 * @returns Formatted string for console output or null if it should be hidden
 */
function formatLintResult(
  result: LintResult,
  filePath: string,
  verbose: boolean,
  consoleWidth: number,
): string[] | null {
  // If result passed, return null to hide it
  if (result.passed) {
    return null
  }

  const severityColor = result.severity === 'error' ? red : yellow
  const statusText = result.severity === 'error' ? 'FAIL' : 'WARN'
  const status = severityColor(statusText)

  // Base formatting elements
  const statusPrefix = '    ' // 4 spaces before status
  const statusPostfix = '  ' // 2 spaces after status

  // This is the position where the rule ID starts
  const ruleIdPosition = statusPrefix.length + statusText.length + statusPostfix.length

  // Rule ID and colon
  const ruleIdPart = `${result.ruleId}: `

  // The original message (not dimmed) - we'll dim each fragment of text as we use it
  const originalMessage = result.message || ''

  // The indent for continuation lines (aligned with rule ID)
  const continuationIndent = ' '.repeat(ruleIdPosition)

  // Create the output lines array
  const outputLines: string[] = []

  // Start with the status part (this never wraps)
  const firstLinePrefix = `${statusPrefix}${status}${statusPostfix}`

  // Determine effective width for wrapping
  // Make sure we have a reasonable minimum width to work with
  const effectiveWidth = Math.max(consoleWidth, ruleIdPosition + 20)

  // Helper function to properly wrap text while preserving whole words
  function wrapTextPreservingWords(text: string, maxWidth: number): string[] {
    // Split the text into words
    const words = text.split(/\s+/)
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      // Check if adding this word would exceed the width
      const potentialLine = currentLine.length === 0 ? word : `${currentLine} ${word}`

      if (potentialLine.length > maxWidth && currentLine.length > 0) {
        // Current line is full, start a new one
        lines.push(currentLine)
        currentLine = word
      } else {
        // Add the word (with a space if not the first word)
        currentLine = potentialLine
      }
    }

    // Add the last line if it has content
    if (currentLine.length > 0) {
      lines.push(currentLine)
    }

    return lines
  }

  // Only do complex wrapping if needed
  if ((firstLinePrefix + bold(ruleIdPart) + originalMessage).length <= effectiveWidth) {
    // Everything fits on one line - dim the entire message
    outputLines.push(`${firstLinePrefix}${bold(ruleIdPart)}${gray(originalMessage)}`)
  } else {
    // We need to wrap
    const fullRuleIdPartLength = ruleIdPart.length
    const firstLineAvailableSpace = effectiveWidth - firstLinePrefix.length - fullRuleIdPartLength

    if (firstLineAvailableSpace <= 10) {
      // Terminal is too narrow, just put rule ID on the first line
      outputLines.push(`${firstLinePrefix}${bold(ruleIdPart)}`)

      // And the message on subsequent lines
      const messageLines = wrapTextPreservingWords(originalMessage, effectiveWidth - ruleIdPosition)
      for (const line of messageLines) {
        outputLines.push(`${continuationIndent}${gray(line)}`)
      }
    } else {
      // Find the first set of words that fit on the first line
      const words = originalMessage.split(/\s+/)
      let firstLinePart = ''
      let remainingWords: string[] = []

      // Build first line word by word
      for (let i = 0; i < words.length; i++) {
        const nextText = firstLinePart ? `${firstLinePart} ${words[i]}` : words[i]
        if (nextText.length <= firstLineAvailableSpace) {
          firstLinePart = nextText
        } else {
          remainingWords = words.slice(i)
          break
        }
      }

      // Output first line with rule ID and as many words as fit
      outputLines.push(`${firstLinePrefix}${bold(ruleIdPart)}${gray(firstLinePart)}`)

      // If there are remaining words, wrap them properly
      if (remainingWords.length > 0) {
        const remainingText = remainingWords.join(' ')
        const wrappedLines = wrapTextPreservingWords(remainingText, effectiveWidth - ruleIdPosition)

        for (const line of wrappedLines) {
          outputLines.push(`${continuationIndent}${gray(line)}`)
        }
      }
    }
  }

  // Handle verbose output with proper indentation
  if (verbose && !result.passed) {
    if (result.offendingLines?.length) {
      outputLines.push('      Offending lines:')
      for (const line of result.offendingLines) {
        outputLines.push(`        ${gray(`${filePath}:${line.line}`)} ${line.content}`)
      }
    }

    if (result.offendingValue) {
      const valueStr = `      Offending value: ${result.offendingValue.propertyPath} = ${
        JSON.stringify(result.offendingValue.value)
      }`

      // Wrap long offending values with proper indentation
      const verboseIndent = 8 // "      Of" is 8 chars
      const verboseChunks = splitTextIntoLines(valueStr, effectiveWidth - verboseIndent)
      outputLines.push(verboseChunks[0])
      for (let i = 1; i < verboseChunks.length; i++) {
        outputLines.push(`${' '.repeat(verboseIndent)}${verboseChunks[i]}`)
      }
    }

    if (result.reason) {
      const reasonStr = `      Reason: ${result.reason}`
      const verboseIndent = 14 // "      Reason: " is 14 chars
      const reasonChunks = splitTextIntoLines(reasonStr, effectiveWidth - verboseIndent)
      outputLines.push(reasonChunks[0])
      for (let i = 1; i < reasonChunks.length; i++) {
        outputLines.push(`${' '.repeat(verboseIndent)}${reasonChunks[i]}`)
      }
    }
  }

  return outputLines
}

/**
 * Main function to run the linter
 */
async function main(): Promise<void> {
  const options = parseCliArgs(Deno.args)

  if (options.help) {
    showHelp()
    return
  }

  // Handle the --rules flag to list all available lint rules
  if (options.rules) {
    const rules = await loadAllRules()

    // Format the rules information for output
    const rulesInfo = rules.map((rule) => ({
      id: rule.id,
      severity: rule.severity,
      description: rule.description,
    }))

    // Sort by severity (errors first) then by id
    rulesInfo.sort((a, b) => {
      if (a.severity === b.severity) {
        return a.id.localeCompare(b.id)
      }
      return a.severity === 'error' ? -1 : 1
    })

    console.log(JSON.stringify(rulesInfo, null, 2))
    return
  }

  if (options.files.length === 0) {
    showHelp()
    return
  }

  // Load all lint rules
  const rules = await loadAllRules()
  if (options.verbose) {
    console.log(`Loaded ${rules.length} lint rules`)
  }

  // Get console width for text wrapping
  const consoleWidth = getConsoleWidth()

  // Find all .mdc files that match the glob patterns
  const fileResults: Array<{ filePath: string; result: LintResult }> = []
  const parsedFiles: Array<{ filePath: string; parsedContent: Record<string, unknown> }> = []
  // Map to store derived rule types by file path
  const fileRuleTypes = new Map<string, string>()
  // Track all matched MDC files
  const matchedMdcFiles = new Set<string>()

  for (const filePattern of options.files) {
    for await (const file of expandGlob(filePattern)) {
      if (file.isFile && file.path.endsWith('.mdc')) {
        matchedMdcFiles.add(file.path)
        const mdcFile = await processMdcFile(file.path)

        // Store the derived rule type for this file
        if (mdcFile.derivedRuleType) {
          fileRuleTypes.set(file.path, mdcFile.derivedRuleType)
        }

        if (options.parse) {
          // Filter out raw content for cleaner output
          const parsedContent: Record<string, unknown> = {}

          // Include only important derived properties
          if (mdcFile.frontmatter?.parsed) {
            parsedContent.frontmatter = mdcFile.frontmatter.parsed
          }

          if (mdcFile.markdownContent) {
            // Find the top-level header (lowest level number)
            const headers = mdcFile.markdownContent.headers

            if (headers.length > 0) {
              // Sort headers by level to find the top-level one (e.g., H1, then H2, etc.)
              const sortedHeaders = [...headers].sort((a, b) => a.level - b.level)
              const topHeader = sortedHeaders[0]

              // Find the description paragraph (first paragraph after the top header)
              const description = mdcFile.markdownContent.paragraphs.find(
                (p) => p.afterHeader?.line === topHeader.line,
              )?.text || ''

              parsedContent.title = topHeader.text
              parsedContent.description = description
            }
          }

          if (mdcFile.derivedRuleType) {
            parsedContent.ruleType = mdcFile.derivedRuleType
          }

          parsedFiles.push({
            filePath: file.path,
            parsedContent,
          })
          continue
        }

        // Run each rule against the file
        for (const rule of rules) {
          try {
            const result = await rule.lint(mdcFile)
            fileResults.push({ filePath: file.path, result })
          } catch (error) {
            const result: LintResult = {
              ruleId: rule.id,
              severity: rule.severity,
              passed: false,
              message: `Rule execution error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            }
            fileResults.push({ filePath: file.path, result })
          }
        }
      }
    }
  }

  if (options.parse) {
    // Output parsed MDC files as JSON
    const prettyOutput = parsedFiles.map(({ filePath, parsedContent }) => ({
      filePath,
      ...parsedContent,
    }))
    console.log(JSON.stringify(prettyOutput, null, 2))
    return
  }

  // Group results by file
  const groupedResults = groupResultsByFile(fileResults)

  // Output results
  if (options.json) {
    // JSON output
    const jsonOutput = [...groupedResults.entries()].map(([filePath, results]) => ({
      filePath,
      ruleType: fileRuleTypes.get(filePath) || 'Unknown',
      results: results.map((r) => ({
        ruleId: r.ruleId,
        severity: r.severity,
        passed: r.passed,
        message: r.message,
        offendingLines: r.offendingLines,
        offendingValue: r.offendingValue,
        reason: r.reason,
      })),
    }))

    console.log(JSON.stringify(jsonOutput, null, 2))
  } else {
    // Human-readable output
    let errorCount = 0
    let warningCount = 0
    let passCount = 0

    // Add separator line function for visual clarity
    const printSeparator = () => console.log('─'.repeat(Math.min(80, consoleWidth)))

    // Determine the common parent directory of all files
    let basePath = ''
    if (matchedMdcFiles.size > 0) {
      const allPaths = Array.from(matchedMdcFiles)
      // Extract common path prefix
      basePath = allPaths[0].substring(0, allPaths[0].lastIndexOf('/'))
      for (const path of allPaths) {
        const dirPath = path.substring(0, path.lastIndexOf('/'))
        while (!dirPath.startsWith(basePath)) {
          basePath = basePath.substring(0, basePath.lastIndexOf('/'))
          if (basePath === '') break
        }
      }
      if (basePath === '') {
        // If no common directory found, use the current directory
        basePath = Deno.cwd()
      }
    } else {
      // If no files were processed, use the first pattern
      basePath = options.files[0].substring(0, options.files[0].lastIndexOf('/'))
      if (!basePath) basePath = Deno.cwd()
    }

    // Track files with errors, warnings, and files without errors
    let filesWithErrors = 0
    let filesWithWarnings = 0
    let filesWithoutErrors = 0
    const totalFiles = groupedResults.size

    // Print header
    console.log(cyan('@zackiles/cursor-workbench - Linter Report'))
    printSeparator()
    console.log(`${bold('Path:')} ${basePath}`)
    console.log(`${bold('Lint Rules:')} ${rules.length}`)
    console.log(`${bold('Cursor Rules:')} ${matchedMdcFiles.size}`)

    // Generate a string representation of the options
    const optionsStr = [
      options.json ? '--json' : '',
      options.verbose ? '--verbose' : '',
      options.parse ? '--parse' : '',
      options.rules ? '--rules' : '',
    ].filter(Boolean).join(' ') || 'default'

    console.log(`${bold('Options:')} ${optionsStr}`)

    // Add horizontal separator lines between header and report
    printSeparator()

    // Process each file one by one
    let isFirstFile = true
    for (const [filePath, results] of groupedResults.entries()) {
      // Add separator between files (but not before the first one)
      if (!isFirstFile) {
        console.log('')
        printSeparator()
        console.log('')
      } else {
        isFirstFile = false
      }

      // Convert absolute path to relative path
      const relativePath = toRelativePath(filePath, basePath)

      // Display file header with clear formatting
      console.log(`${bold('📄 Rule:')} ${relativePath}`)

      // Display the derived rule type below the file path
      const ruleType = fileRuleTypes.get(filePath) || 'Unknown'
      console.log(`${bold('Derived Type:')} ${ruleType}`)
      console.log('') // Add extra spacing

      // Count results
      let fileHasErrors = false
      let fileHasWarnings = false

      for (const result of results) {
        if (result.passed) {
          passCount++
        } else if (result.severity === 'error') {
          errorCount++
          fileHasErrors = true
        } else {
          warningCount++
          fileHasWarnings = true
        }
      }

      // Update file counts
      if (fileHasErrors) {
        filesWithErrors++
      } else {
        // Files without errors are considered "passing" even if they have warnings
        filesWithoutErrors++
        if (fileHasWarnings) {
          filesWithWarnings++
        }
      }

      // Check if the file has any failures
      const hasFailures = results.some((result) => !result.passed)

      if (!hasFailures) {
        // If the file passes all rules, show a single PASS message
        console.log(
          `  ${
            green('PASS')
          } the cursor rule and prompt adheres to all lint rules and best practices`,
        )
      } else {
        // Otherwise, only show the failures
        for (const result of results) {
          const formattedResultLines = formatLintResult(
            result,
            filePath,
            options.verbose,
            consoleWidth,
          )
          if (formattedResultLines) {
            // Print each line of the formatted result
            for (const line of formattedResultLines) {
              console.log(line)
            }
          }
        }
      }
    }

    // Summary section with visual separation
    console.log('')
    printSeparator()
    console.log('')
    console.log(
      `${bold('Summary:')} ${
        green(`${passCount} passed (${filesWithoutErrors}/${totalFiles})`)
      }, ` +
        `${red(`${errorCount} errors (${filesWithErrors}/${totalFiles})`)}, ` +
        `${yellow(`${warningCount} warnings (${filesWithWarnings}/${totalFiles})`)}`,
    )
  }

  // Exit with code 1 if there are any errors
  const hasErrors = [...groupedResults.values()].some(
    (results) => results.some((r) => !r.passed && r.severity === 'error'),
  )

  if (hasErrors) {
    Deno.exit(1)
  }
}

// Execute the main function
if (import.meta.main) {
  main().catch((error) => {
    console.error('Unhandled error:', error)
    Deno.exit(1)
  })
}
