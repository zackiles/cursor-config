import { parseArgs } from '@std/cli/parse-args'
import { expandGlob } from '@std/fs'
import { bold, gray, green, red, yellow } from '@std/fmt/colors'
import { loadAllRules } from './lint-rules/index.ts'
import { groupResultsByFile, processMdcFile } from './processor.ts'
import type { LintResult } from './types.ts'
import { footer, header, horizontalLine, labeledList, newLine } from './console-components.ts'
import Characters from './characters.ts'
import { wrapTextInBoundingBox } from './bounding-box.ts'

// Maximum line width to use even if terminal is wider
const MAX_LINE_WIDTH = 100

/**
 * Command line options for the linter
 */
interface CLIOptions {
  files: string[]
  json: boolean
  help: boolean
  verbose: boolean
  parse: boolean
  rules: boolean
}

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
 * @param verbose - Whether to include verbose details
 * @param consoleWidth - Width of the console for text wrapping
 * @returns Formatted string array for console output or null if it should be hidden
 */
function formatLintResult(
  result: LintResult,
  verbose: boolean,
  consoleWidth: number,
): string[] | null {
  // If result passed, return null to hide it
  if (result.passed) {
    return null
  }

  const severityColor = result.severity === 'error' ? red : yellow
  const statusText = result.severity === 'error' ? 'FAIL' : 'WARN'
  // Ensure consistent 2-character width for symbols + padding
  const statusSymbol = result.severity === 'error'
    ? ` ${Characters.STATUS.ERROR.CROSS}` // Add space prefix for alignment
    : `${Characters.STATUS.WARNING.VOLTAGE}` // Already 2 chars wide visually
  const status = severityColor(`${statusSymbol} ${statusText}`)

  // No space before the status symbol for the rule ID line - start at the leftmost position
  const statusPrefix = '' // Was: ' ' (one space)
  const statusPostfix = ' ' // One space after the status text

  // Calculate the starting column for the message lines (after status + rule ID spacing)
  // With the status now at the leftmost position, we count from the beginning of the line
  // Lengths: symbol(2) + space(1) + text(4) + postfix(1) = 8
  const ruleIdPosition = 2 + 1 + 4 + 1 // Was: 1 + 2 + 1 + 4 + 1 = 9 (had an extra space prefix)
  const continuationIndent = ' '.repeat(ruleIdPosition)

  // Rule ID part with trailing colon
  const ruleIdPart = `${result.ruleId}:`

  // The original message (not dimmed) - we'll dim each fragment of text as we use it
  let originalMessage = result.message || ''

  // Append line number information to the message if available
  let lineInfo = ''
  if (result.offendingLines?.length) {
    const firstLine = result.offendingLines[0].line
    const lastLine = result.offendingLines[result.offendingLines.length - 1].line
    lineInfo = firstLine === lastLine ? `(line ${firstLine})` : `(lines ${firstLine}-${lastLine})`
  } else if (result.offendingValue?.propertyPath) {
    const matches = result.offendingValue.propertyPath.match(/line(?:s)?\s*(\d+)(?:-(\d+))?/i)
    if (matches) {
      const firstLine = Number.parseInt(matches[1], 10)
      const lastLine = matches[2] ? Number.parseInt(matches[2], 10) : firstLine
      lineInfo = firstLine === lastLine ? `(line ${firstLine})` : `(lines ${firstLine}-${lastLine})`
    }
  }
  if (lineInfo) {
    originalMessage = `${originalMessage} ${lineInfo}`
  }

  // Prepare output lines array
  const outputLines: string[] = []

  // The prefix for the rule ID line - now starting at the leftmost position
  const firstLinePrefix = `${statusPrefix}${status}${statusPostfix}`

  // Add the rule ID line starting at the leftmost position
  outputLines.push(`${firstLinePrefix}${bold(severityColor(ruleIdPart))}`)

  // Configuration for the message box that will start on the next line
  const messageBoxOptions = {
    leftMargin: ruleIdPosition, // Align with the position after status + space + text
    rightMargin: '20%', // Keep 20% padding on the right
    minContentWidth: 20, // Ensure minimum content width for very narrow terminals
    ellipsis: Characters.ELLIPSIS.HORIZONTAL, // Use the standard horizontal ellipsis
  }

  // Wrap the message content
  const wrappedMessageLines = wrapTextInBoundingBox(
    originalMessage,
    consoleWidth,
    messageBoxOptions,
  )

  // Add all message lines with proper indentation
  for (const line of wrappedMessageLines) {
    outputLines.push(`${continuationIndent}${gray(line)}`)
  }

  // Add a blank line for spacing if there's a message AND verbose info will follow
  const willHaveVerboseOutput = verbose && (
    result.offendingLines?.length || result.offendingValue || result.reason
  )
  if (wrappedMessageLines.length > 0 && willHaveVerboseOutput) {
    outputLines.push('') // Add blank line for spacing
  }

  // Handle verbose output with proper indentation using the bounding box utility
  if (verbose && !result.passed) {
    const verboseIndent = ' '.repeat(ruleIdPosition) // Base indent for verbose lines

    // Helper to format and add a verbose item (label + wrapped content)
    const formatVerboseItem = (labelSymbol: string, labelText: string, content: string) => {
      // Print the label line, indented
      outputLines.push(`${verboseIndent}${labelSymbol} ${labelText}`)

      // Consistent configuration for verbose content - ensure identical alignment
      const contentBoxOptions = {
        leftMargin: ruleIdPosition, // Align with rule ID start (character-based margin)
        rightMargin: '20%', // Keep 20% padding on the right
        minContentWidth: 20, // Same min width for consistent layout
        ellipsis: Characters.ELLIPSIS.MIDDLE, // Use a middle ellipsis for variety
      }

      // Wrap the actual content
      const wrappedContentLines = wrapTextInBoundingBox(content, consoleWidth, contentBoxOptions)

      // Print wrapped content lines, indented and dimmed
      for (const line of wrappedContentLines) {
        outputLines.push(`${verboseIndent}${gray(line)}`)
      }
    }

    if (result.offendingLines?.length) {
      const labelText = 'Offending content:'
      // Create a single string with line numbers for wrapping
      const content = result.offendingLines
        .map((line) => `Line ${line.line}: ${line.content.trim()}`)
        .join('\n') // Use newlines for joining, wrapping will handle display
      formatVerboseItem(Characters.LIST.BULLET.TRIANGLE, labelText, content)
    }

    if (result.offendingValue) {
      const labelText = 'Offending value:'
      const content = `${result.offendingValue.propertyPath} = ${
        JSON.stringify(result.offendingValue.value)
      }`
      formatVerboseItem(Characters.LIST.BULLET.TRIANGLE, labelText, content)
    }

    if (result.reason) {
      const labelText = 'Reason:'
      const content = result.reason
      formatVerboseItem(Characters.LIST.BULLET.TRIANGLE, labelText, content)
    }
  }

  // Add final blank line for separation between results, only if lines were added
  if (outputLines.length > 0) {
    outputLines.push('')
  }

  return outputLines
}

/**
 * Custom sorting function for MDC files based on their relative paths
 * Sorting order:
 * 1. Special characters (non-alphanumeric prefixes)
 * 2. Numeric prefixed files in natural number order
 * 3. Alphabetical order
 *
 * @param a - First file path
 * @param b - Second file path
 * @returns Comparison result (-1, 0, or 1)
 */
function sortMdcFilePaths(a: string, b: string): number {
  // Extract the file names from paths
  const fileNameA = a.substring(a.lastIndexOf('/') + 1)
  const fileNameB = b.substring(b.lastIndexOf('/') + 1)

  // Helper function to determine file type
  function getFileType(fileName: string): number {
    // Check if starts with a number
    const startsWithNumber = /^\d/.test(fileName)
    // Check if starts with a letter
    const startsWithLetter = /^[a-zA-Z]/.test(fileName)

    if (startsWithNumber) return 1 // Number files (type 1)
    if (startsWithLetter) return 2 // Letter files (type 2)
    return 0 // Special character files (type 0)
  }

  const typeA = getFileType(fileNameA)
  const typeB = getFileType(fileNameB)

  // First, sort by file type (special chars, then numbers, then letters)
  if (typeA !== typeB) {
    return typeA - typeB
  }

  // If both are number-prefixed files, use natural number sorting
  if (typeA === 1 && typeB === 1) {
    // Extract the numeric prefixes
    const numPrefixA = fileNameA.match(/^(\d+)/)?.[1] || ''
    const numPrefixB = fileNameB.match(/^(\d+)/)?.[1] || ''

    // If numeric values are the same length, compare numerically
    if (numPrefixA.length === numPrefixB.length) {
      return Number.parseInt(numPrefixA, 10) - Number.parseInt(numPrefixB, 10)
    }

    // If different lengths but same value (e.g., "01" vs "1"), sort by length (padding)
    const numA = Number.parseInt(numPrefixA, 10)
    const numB = Number.parseInt(numPrefixB, 10)

    if (numA === numB) {
      return numPrefixA.length - numPrefixB.length
    }

    // Otherwise sort by the numeric value
    return numA - numB
  }

  // For all other cases, use standard lexicographic comparison
  return fileNameA.localeCompare(fileNameB)
}

/**
 * Converts an object with label/value pairs to the format expected by keyValueList
 */
function convertToKeyValueFormat(
  data: Record<string, { label: string; value: string | number | string[] }>,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [_key, item] of Object.entries(data)) {
    result[item.label] = typeof item.value === 'number' ? String(item.value) : item.value
  }
  return result
}

/**
 * Parses command line arguments
 *
 * @param args - Command line arguments
 * @returns Parsed CLI options
 */
function parseCliArgs(args: string[]): CLIOptions {
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
  -v, --verbose   Show detailed information for failures, including the content of offending lines
  -p, --parse     Only parse MDC files and output as JSON (no linting)
  -r, --rules     List all available lint rules as JSON

${bold('EXAMPLES:')}
  deno run -A src/linter.ts .cursor/rules/*.mdc
  deno run -A src/linter.ts --json path/to/rule.mdc
  deno run -A src/linter.ts --parse path/to/rule.mdc
  deno run -A src/linter.ts --rules
  `)
}
// --- End Restored Functions ---

/**
 * Main function to run the linter
 */
async function main(): Promise<void> {
  // Add error handling for broken pipe
  try {
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

    const rules = await loadAllRules()

    // Console width used for bounding boxes and text wrapping
    const consoleWidth = getConsoleWidth()

    // Find all .mdc files that match the glob patterns
    const fileResults: Array<{ filePath: string; result: LintResult }> = []
    const parsedFiles: Array<{ filePath: string; parsedContent: Record<string, unknown> }> = []
    // Map to store derived attachment types by file path
    const fileAttachmentTypes = new Map<string, string>()
    // Track all matched MDC files
    const matchedMdcFiles = new Set<string>()

    for (const filePattern of options.files) {
      for await (const file of expandGlob(filePattern)) {
        if (file.isFile && file.path.endsWith('.mdc')) {
          matchedMdcFiles.add(file.path)
          const mdcFile = await processMdcFile(file.path)

          // Store the derived attachment type for this file
          if (mdcFile.derivedAttachmentType) {
            fileAttachmentTypes.set(file.path, mdcFile.derivedAttachmentType)
          }

          if (options.parse) {
            // Filter out raw content for cleaner output
            const parsedContent: Record<string, unknown> = {}

            // Include only important derived properties
            if (mdcFile.frontmatter) {
              // Filter out internal properties like 'raw', 'parseError', etc.
              const frontmatterContent: Record<string, unknown> = {}
              for (const [key, value] of Object.entries(mdcFile.frontmatter)) {
                if (!['raw', 'parseError', 'startLine', 'endLine'].includes(key)) {
                  frontmatterContent[key] = value
                }
              }
              parsedContent.frontmatter = frontmatterContent
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

            if (mdcFile.derivedAttachmentType) {
              parsedContent.attachmentType = mdcFile.derivedAttachmentType
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
        attachmentType: fileAttachmentTypes.get(filePath) || 'Unknown',
        results: results.map((r) => {
          // For JSON output, we need to enhance the message with line numbers
          // similar to how we do it for human-readable output
          let enhancedMessage = r.message || ''

          if (!r.passed) {
            if (r.offendingLines?.length) {
              const firstLine = r.offendingLines[0].line
              const lastLine = r.offendingLines[r.offendingLines.length - 1].line

              // Format as "(line X)" if only one line, or "(lines X-Y)" if multiple lines
              const lineInfo = firstLine === lastLine
                ? `(line ${firstLine})`
                : `(lines ${firstLine}-${lastLine})`

              // Append line info to the original message
              enhancedMessage = `${enhancedMessage} ${lineInfo}`
            } else if (r.offendingValue?.propertyPath) {
              // Try to extract line numbers from the property path
              const matches = r.offendingValue.propertyPath.match(/line(?:s)?\s*(\d+)(?:-(\d+))?/i)
              if (matches) {
                const firstLine = Number.parseInt(matches[1], 10)
                const lastLine = matches[2] ? Number.parseInt(matches[2], 10) : firstLine

                const lineInfo = firstLine === lastLine
                  ? `(line ${firstLine})`
                  : `(lines ${firstLine}-${lastLine})`

                enhancedMessage = `${enhancedMessage} ${lineInfo}`
              }
            }
          }

          return {
            ruleId: r.ruleId,
            severity: r.severity,
            passed: r.passed,
            message: enhancedMessage,
            offendingLines: r.offendingLines,
            offendingValue: r.offendingValue,
            reason: r.reason,
          }
        }),
      }))

      console.log(JSON.stringify(jsonOutput, null, 2))
    } else {
      // Human-readable output
      let errorCount = 0
      let warningCount = 0
      let passCount = 0

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

      // Collect unique categories from the processed MDC files
      const categories = new Set<string>()
      for (const [filePath, _] of groupedResults) {
        try {
          const mdcFile = await processMdcFile(filePath)
          if (mdcFile.frontmatter?.category) {
            const category = String(mdcFile.frontmatter.category)
            categories.add(category)
          }
        } catch (_) {
          // Ignore any errors during processing - we're just collecting categories when available
        }
      }

      header({
        title: 'Cursor Workbench - Lint Report',
        subtitle: 'Version 0.0.1',
      })

      // Generate a string representation of the options
      const optionsStr = [
        options.json ? '--json' : '',
        options.verbose ? '--verbose' : '',
        options.parse ? '--parse' : '',
        options.rules ? '--rules' : '',
      ].filter(Boolean).join(' ') || 'default'

      // Define the key-value pairs for the report header
      const reportData = {
        generatedOn: { label: 'Generated On', value: new Date().toLocaleString() },
        rulesPath: { label: 'Rules Path', value: basePath },
        workingDirectory: { label: 'Working Directory', value: Deno.cwd() },
        lintOptions: { label: 'Lint Options', value: optionsStr },
        lintRules: { label: 'Lint Rules', value: rules.length },
        cursorRules: { label: 'Cursor Rules', value: matchedMdcFiles.size },
        ruleCategories: {
          label: 'Categories',
          value: categories.size > 0 ? Array.from(categories) : ['N/A'],
        },
      }

      labeledList({ list: convertToKeyValueFormat(reportData) })

      const sortedEntries = [...groupedResults.entries()].sort((a, b) => {
        const relativePathA = toRelativePath(a[0], basePath)
        const relativePathB = toRelativePath(b[0], basePath)
        return sortMdcFilePaths(relativePathA, relativePathB)
      })

      let firstFileInList = true
      newLine()
      newLine()
      for (const [filePath, results] of sortedEntries) {
        if (firstFileInList) {
          horizontalLine({ character: Characters.BOX.HORIZONTAL.DOTTED })
        } else {
          firstFileInList = false
        }

        // Convert absolute path to relative path
        const relativePath = toRelativePath(filePath, basePath)

        // Display file header with clear formatting
        console.log(`${bold('Rule:')}  ${relativePath}`)

        // Display the derived attachment type below the file path
        const attachmentType = fileAttachmentTypes.get(filePath) || 'Unknown'
        console.log(`${bold('Type:')}  ${attachmentType}`)
        horizontalLine({ character: Characters.BOX.HORIZONTAL.DOTTED })
        newLine()

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
              green(`${Characters.STATUS.SUCCESS.HEAVY_CHECK} PASS`)
            } the cursor rule and prompt adheres to all lint rules and best practices`,
          )
        } else {
          // Otherwise, only show the failures
          for (const result of results) {
            const formattedResultLines = formatLintResult(
              result,
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
        newLine()
      }
      newLine()

      const summaryText =
        `${green(`${passCount} passed (${filesWithoutErrors}/${totalFiles})`)}, ` +
        `${red(`${errorCount} errors (${filesWithErrors}/${totalFiles})`)}, ` +
        `${yellow(`${warningCount} warnings (${filesWithWarnings}/${totalFiles})`)}`

      // Apply status indicators to the summary
      const successIndicator = Characters.STATUS.SUCCESS.CHECK
      const errorIndicator = Characters.STATUS.ERROR.CROSS
      const warningIndicator = Characters.STATUS.WARNING.TRIANGLE

      let formattedSummary = summaryText
      if (formattedSummary.includes('passed')) {
        formattedSummary = formattedSummary.replace(/(\d+ passed)/g, `${successIndicator} $1`)
      }
      if (formattedSummary.includes('error')) {
        formattedSummary = formattedSummary.replace(/(\d+ errors?)/g, `${errorIndicator} $1`)
      }
      if (formattedSummary.includes('warning')) {
        formattedSummary = formattedSummary.replace(/(\d+ warnings?)/g, `${warningIndicator} $1`)
      }

      footer({ summary: formattedSummary })
    }

    // Exit with code 1 if there are any errors
    const hasErrors = [...groupedResults.values()].some(
      (results) => results.some((r) => !r.passed && r.severity === 'error'),
    )

    if (hasErrors) {
      Deno.exit(1)
    }
  } catch (error) {
    // Handle broken pipe error gracefully
    if (error instanceof Error && error.name === 'BrokenPipe') {
      // This is expected when piping to commands like 'head' or 'grep'
      // Exit gracefully with code 0 since this isn't a real error
      Deno.exit(0)
    } else {
      // For other errors, log and exit with code 1
      console.error('Unhandled error:', error)
      Deno.exit(1)
    }
  }
}

// Execute the main function
if (import.meta.main) {
  main().catch((error) => {
    // Already handled errors inside main()
    if (error instanceof Error && error.name !== 'BrokenPipe') {
      console.error('Fatal error:', error)
      Deno.exit(1)
    }
  })
}
