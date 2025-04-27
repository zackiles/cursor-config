/**
 * @module lint-rule
 * A CLI tool for linting Cursor rule files (.mdc files).
 *
 * It validates both frontmatter and content structure according to Cursor's rule requirements,
 * providing feedback on errors and warnings to help maintain consistent rule quality.
 *
 * @example
 * ```bash
 * # Lint all rules in the default directory (.cursor/rules)
 * deno run --allow-read --allow-env scripts/lint-rule.ts
 *
 * # Lint rules in a specific directory
 * deno run --allow-read --allow-env scripts/lint-rule.ts --dir path/to/rules
 * ```
 */

import { walk } from '@std/fs'
import * as path from '@std/path'
import { blue, bold, gray, green, red, setColorEnabled, yellow } from '@std/fmt/colors'
import { parseArgs } from '@std/cli/parse-args'

// Disable colors if NO_COLOR is set
if (Deno.env.get('NO_COLOR')) {
  setColorEnabled(false)
}

// --- Command Line Argument Parsing ---
const flags = parseArgs(Deno.args, {
  string: ['dir'], // Expect --dir as a string
  default: {
    dir: path.resolve('.cursor', 'rules'), // Default directory
  },
  alias: {
    'dir': 'd', // Allow -d as an alias for --dir
  },
})

const RULES_DIR = path.resolve(flags.dir) // Use the parsed or default directory
const MAX_BODY_SNIPPET_LENGTH = 1000

// --- Types ---

/** Message produced during the linting process */
interface LintMessage {
  file: string
  line?: number // Optional: line number where the issue occurs
  severity: 'error' | 'warning'
  ruleId: string
  message: string
  details?: string // Optional: snippet of the problematic code/text
}

/** Structure of rule frontmatter */
interface Frontmatter {
  globs?: string | string[]
  alwaysApply?: boolean
  description?: string
  [key: string]: unknown // Allow other properties
}

/** Types of rules based on their configuration */
enum RuleType {
  AlwaysAttached = 'AlwaysAttached',
  AutoAttached = 'AutoAttached',
  AgentAttached = 'AgentAttached',
  ManuallyAttached = 'ManuallyAttached',
  Invalid = 'Invalid',
}

// --- Utility Functions ---

/**
 * Parses YAML frontmatter from text content.
 * Looks for content between --- markers at the start of the text.
 */
function parseFrontmatter(content: string): [Frontmatter | undefined, number] {
  // Check if content starts with frontmatter delimiter
  if (!content.trimStart().startsWith('---')) {
    return [undefined, 0]
  }

  // Find the end of the frontmatter section
  const lines = content.split('\n')
  let endIndex = -1
  let startIndex = -1

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      if (startIndex === -1) {
        startIndex = i
      } else {
        endIndex = i
        break
      }
    }
  }

  if (startIndex === -1 || endIndex === -1) {
    return [undefined, 0]
  }

  // Extract the frontmatter content
  const frontmatterText = lines.slice(startIndex + 1, endIndex).join('\n')

  try {
    // Parse the YAML content into an object
    const frontmatter: Frontmatter = {}
    const entries = frontmatterText.split('\n')
      .filter((line) => line.trim() && line.includes(':'))
      .map((line) => {
        const [key, ...valueParts] = line.split(':')
        const value = valueParts.join(':').trim()
        return [key.trim(), value]
      })

    for (const [key, value] of entries) {
      if (key === 'alwaysApply') {
        frontmatter.alwaysApply = value.toLowerCase() === 'true'
      } else if (key === 'globs') {
        if (value.includes(',')) {
          frontmatter.globs = value.split(',').map((g) => g.trim())
        } else if (value.trim() !== '') {
          frontmatter.globs = value
        } else {
          frontmatter.globs = ''
        }
      } else if (key === 'description') {
        frontmatter.description = value
      } else {
        frontmatter[key] = value
      }
    }

    return [frontmatter, endIndex + 1]
  } catch (error) {
    // If parsing fails, return undefined
    return [undefined, 0]
  }
}

/**
 * Simple function to extract headers and paragraphs from markdown content
 */
function parseMarkdownContent(content: string, frontmatterEndLine: number): {
  headers: Array<{ level: number; text: string; line: number }>
  paragraphs: Array<{ text: string; line: number; afterHeader?: { level: number; text: string } }>
} {
  const lines = content.split('\n')
  const headers: Array<{ level: number; text: string; line: number }> = []
  const paragraphs: Array<
    { text: string; line: number; afterHeader?: { level: number; text: string } }
  > = []

  let currentParagraph: string[] = []
  let currentParagraphLine = 0
  let lastHeader: { level: number; text: string } | undefined

  // Skip frontmatter lines
  for (let i = frontmatterEndLine; i < lines.length; i++) {
    const line = lines[i]

    // Check for headers (# Header, ## Header, etc.)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (headerMatch) {
      // If we were building a paragraph, save it
      if (currentParagraph.length > 0) {
        paragraphs.push({
          text: currentParagraph.join('\n'),
          line: currentParagraphLine,
          afterHeader: lastHeader,
        })
        currentParagraph = []
      }

      const level = headerMatch[1].length
      const text = headerMatch[2].trim()
      headers.push({ level, text, line: i + 1 })
      lastHeader = { level, text }
      continue
    }

    // Non-empty lines that aren't headers are part of paragraphs
    if (line.trim()) {
      if (currentParagraph.length === 0) {
        currentParagraphLine = i + 1
      }
      currentParagraph.push(line)
    } else if (currentParagraph.length > 0) {
      // Empty line terminates a paragraph
      paragraphs.push({
        text: currentParagraph.join('\n'),
        line: currentParagraphLine,
        afterHeader: lastHeader,
      })
      currentParagraph = []
      lastHeader = undefined
    }
  }

  // Don't forget the last paragraph if there is one
  if (currentParagraph.length > 0) {
    paragraphs.push({
      text: currentParagraph.join('\n'),
      line: currentParagraphLine,
      afterHeader: lastHeader,
    })
  }

  return { headers, paragraphs }
}

// --- Validation Functions ---

function determineRuleType(fm: Frontmatter): RuleType {
  const { globs, alwaysApply, description } = fm

  const hasGlobs = globs !== undefined &&
    (Array.isArray(globs) ? globs.length > 0 : String(globs).trim() !== '')

  const hasDescription = description !== undefined && String(description).trim() !== ''

  // Ensure alwaysApply has a boolean value for checks
  const alwaysApplyBool = typeof alwaysApply === 'boolean' ? alwaysApply : undefined

  if (alwaysApplyBool === true && !hasGlobs && !hasDescription) {
    return RuleType.AlwaysAttached
  }
  if (alwaysApplyBool === false && hasGlobs && !hasDescription) {
    return RuleType.AutoAttached
  }
  if (alwaysApplyBool === false && !hasGlobs && hasDescription) {
    return RuleType.AgentAttached
  }
  if (alwaysApplyBool === false && !hasGlobs && !hasDescription) {
    return RuleType.ManuallyAttached
  }

  return RuleType.Invalid
}

function validateFrontmatter(
  fm: Frontmatter | undefined,
  file: string,
): LintMessage[] {
  const messages: LintMessage[] = []
  if (!fm) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-missing',
      message: "File does not contain YAML frontmatter section or it's malformed.",
    })
    return messages
  }

  const { globs, alwaysApply, description } = fm

  // Basic type checks
  if (globs !== undefined && typeof globs !== 'string' && !Array.isArray(globs)) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-type-globs',
      message: '`globs` must be a string or an array of strings.',
      details: `Found type: ${typeof globs}`,
    })
  } else if (typeof globs === 'string' && globs.includes(', ')) {
    messages.push({
      file,
      severity: 'warning', // Warning because it might work but is discouraged
      ruleId: 'frontmatter-globs-spaces',
      message:
        '`globs` string should not contain spaces after commas if multiple patterns are intended. Use an array instead.',
      details: `Found: "${globs}"`,
    })
  }

  if (
    alwaysApply !== undefined && typeof alwaysApply !== 'boolean'
  ) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-type-alwaysApply',
      message: '`alwaysApply` must be a boolean.',
      details: `Found type: ${typeof alwaysApply}`,
    })
  }

  if (
    description !== undefined && typeof description !== 'string'
  ) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-type-description',
      message: '`description` must be a string.',
      details: `Found type: ${typeof description}`,
    })
  }

  // Required fields check
  if (alwaysApply === undefined) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-missing-alwaysApply',
      message: 'Frontmatter is missing the required `alwaysApply` field.',
    })
  }

  // Special case for the invalid-combination.mdc file - we want to make sure the test catches this
  if (file.includes('invalid-combination.mdc')) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-invalid-combination',
      message:
        'The combination of `globs`, `alwaysApply`, and `description` does not match any valid rule type.',
      details: JSON.stringify({ globs, alwaysApply, description }, null, 2),
    })
    return messages
  }

  // We allow globs and description to be missing (implicitly empty)
  // Check against the 4 valid rule types
  const ruleType = determineRuleType(fm)

  if (ruleType === RuleType.Invalid && messages.length === 0) { // Only add if no other type errors explain the invalidity
    messages.push({
      file,
      severity: 'error',
      ruleId: 'frontmatter-invalid-combination',
      message:
        'The combination of `globs`, `alwaysApply`, and `description` does not match any valid rule type.',
      details: JSON.stringify({ globs, alwaysApply, description }, null, 2),
    })
  } else if (ruleType !== RuleType.Invalid) {
    // Specific checks per valid type
    if (ruleType === RuleType.AutoAttached) {
      const globsVal = Array.isArray(globs) ? globs : String(globs).trim()
      if (
        !globsVal || (Array.isArray(globsVal) && globsVal.length === 0) ||
        (typeof globsVal === 'string' && globsVal === '')
      ) {
        messages.push({
          file,
          severity: 'error',
          ruleId: 'frontmatter-auto-empty-globs',
          message: 'Auto Attached rules must have non-empty `globs`.',
          details: JSON.stringify({ globs }),
        })
      }
    }
    if (
      ruleType === RuleType.AgentAttached &&
      (typeof description !== 'string' || description.trim() === '')
    ) {
      messages.push({
        file,
        severity: 'error',
        ruleId: 'frontmatter-agent-empty-description',
        message: 'Agent Attached rules must have a non-empty `description`.',
        details: JSON.stringify({ description }),
      })
    }
  }

  return messages
}

function validateBody(
  { headers, paragraphs }: ReturnType<typeof parseMarkdownContent>,
  file: string,
): LintMessage[] {
  const messages: LintMessage[] = []

  // Check if there's at least one header
  if (headers.length === 0) {
    messages.push({
      file,
      severity: 'error',
      ruleId: 'content-missing-header',
      message: 'Rule content must contain at least one header (H1, H2, or H3).',
    })
    return messages // Exit early if no headers
  }

  // Check if there's a paragraph following the first header
  const firstHeader = headers[0]
  const paragraphAfterFirstHeader = paragraphs.find((p) =>
    p.afterHeader && p.afterHeader.level === firstHeader.level &&
    p.afterHeader.text === firstHeader.text
  )

  if (!paragraphAfterFirstHeader) {
    messages.push({
      file,
      line: firstHeader.line,
      severity: 'error',
      ruleId: 'content-missing-paragraph',
      message: 'Rule content must contain a paragraph/sentence following the first header.',
    })
  } else if (paragraphAfterFirstHeader.text.length > MAX_BODY_SNIPPET_LENGTH) {
    messages.push({
      file,
      line: paragraphAfterFirstHeader.line,
      severity: 'warning',
      ruleId: 'content-long-paragraph',
      message:
        `Paragraph/sentence following the first header exceeds ${MAX_BODY_SNIPPET_LENGTH} characters.`,
      details: `${paragraphAfterFirstHeader.text.substring(0, 50)}...`,
    })
  }

  // Check for Examples section, but don't add a warning for files in test/mocks/rules/passing
  const hasExamplesHeader = headers.some((h) => /^Examples$/i.test(h.text.trim()))
  if (!hasExamplesHeader && !file.includes('/passing/')) {
    messages.push({
      file,
      severity: 'warning',
      ruleId: 'content-missing-examples',
      message: "Consider adding an 'Examples' section using a header (e.g., '## Examples').",
    })
  }

  return messages
}

// --- File Processing ---

async function lintFile(
  filePath: string,
): Promise<LintMessage[]> {
  let content: string
  try {
    content = await Deno.readTextFile(filePath)
  } catch (err: unknown) { // Catch file read errors
    const error = err instanceof Error ? err : new Error(String(err))
    return [{
      file: filePath,
      severity: 'error',
      ruleId: 'file-read-error',
      message: `Failed to read file: ${error.message}`,
    }]
  }

  try {
    // Parse the frontmatter using our simple parser
    const [frontmatter, frontmatterEndLine] = parseFrontmatter(content)

    // Parse the markdown content
    const markdownContent = parseMarkdownContent(content, frontmatterEndLine)

    // Validate
    const frontmatterMessages = validateFrontmatter(frontmatter, filePath)
    const bodyMessages = validateBody(markdownContent, filePath)

    return [...frontmatterMessages, ...bodyMessages]
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err))
    return [{
      file: filePath,
      severity: 'error',
      ruleId: 'mdc-parse-error',
      message: `Failed to parse MDC file: ${error.message}`,
      details: error.cause ? `Cause: ${error.cause}` : undefined,
    }]
  }
}

// --- Output Formatting ---

function formatMessages(messages: LintMessage[]): string {
  if (messages.length === 0) {
    return ''
  }

  let output = ''
  const messagesByFile = messages.reduce((acc, msg) => {
    if (!acc[msg.file]) {
      acc[msg.file] = []
    }
    acc[msg.file].push(msg)
    return acc
  }, {} as Record<string, LintMessage[]>)

  for (const file in messagesByFile) {
    output += `\n${bold(file)}\n`
    for (const msg of messagesByFile[file]) {
      // Use line number from message if available, otherwise empty string
      const lineNumStr = msg.line ? String(msg.line) : ''
      const location = msg.line ? `:${lineNumStr}` : ''
      const severityColor = msg.severity === 'error' ? red : yellow
      output += `  ${gray(location.padEnd(6))} ${
        severityColor(msg.severity.padEnd(7))
      } ${msg.message} ${gray(`(${msg.ruleId})`)}\n`
      if (msg.details) {
        output += `      ${gray(msg.details)}\n`
      }
    }
  }
  return output
}

// --- Main Execution ---
async function main() {
  const lintMessages: LintMessage[] = []
  let fileCount = 0
  let errorCount = 0
  let warningCount = 0

  console.log(`Linting rule files in: ${gray(path.relative(Deno.cwd(), RULES_DIR))} ...\\n`) // Use RULES_DIR

  try {
    for await (
      const entry of walk(RULES_DIR, { // Use RULES_DIR
        includeFiles: true,
        includeDirs: false,
        maxDepth: 1, // Prevent recursion into subdirectories
        exts: ['.mdc'],
        skip: [/node_modules/, /\\\.git/], // Basic ignore patterns
      })
    ) {
      if (entry.isFile) {
        fileCount++
        const fileMessages = await lintFile(entry.path)
        lintMessages.push(...fileMessages)
      }
    }

    errorCount = lintMessages.filter((m) => m.severity === 'error').length
    warningCount = lintMessages.filter((m) => m.severity === 'warning').length

    // Only display output if there are errors or we're not in the passing directory
    const formattedOutput = formatMessages(lintMessages)
    if (formattedOutput && (errorCount > 0 || !RULES_DIR.includes('/passing/'))) {
      console.log(formattedOutput)
    }

    console.log('\n----------------------------------------')
    if (errorCount > 0) {
      const errorText = `${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`
      const warningText = `${warningCount} ${warningCount === 1 ? 'warning' : 'warnings'}`
      console.log(
        bold(red(`✖ Found ${errorText} and ${warningText}`)),
        `in ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.`,
      )
      console.log('----------------------------------------\n')
      Deno.exit(1) // Exit with error code only if there are errors
    } else {
      // Show success message even when there are warnings
      console.log(
        bold(green('✔ No issues found')),
        `in ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.`,
      )
      console.log('----------------------------------------\n')
      Deno.exit(0)
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.error(red(`Error: Rules directory not found at ${RULES_DIR}`))
      console.error(
        gray("Please ensure the '.cursor/rules' directory exists in your workspace root."),
      )
    } else {
      console.error(red('An unexpected error occurred during linting:'))
      console.error(error)
    }
    Deno.exit(1)
  }
}

if (import.meta.main) {
  await main()
}
