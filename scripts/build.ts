#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run=git

/**
 * @module build
 * Parses `.cursor/rules/*.mdc` files, extracts metadata and content,
 * retrieves git history, and generates `bin/rules.json`.
 *
 * This script uses `@nuxtjs/mdc` to parse Markdown Component files and
 * standard Deno APIs for file system and subprocess operations.
 *
 * @example
 * Run the build process using the Deno task runner:
 * ```sh
 * deno task build
 * ```
 * @see {@link RuleObject} for the output structure.
 * @see https://docs.deno.com/runtime/tutorials/subprocess
 * @see https://www.npmjs.com/package/@nuxtjs/mdc
 */

import * as fs from '@std/fs'
import * as path from '@std/path'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'

const IS_TEST_ENV = Deno.env.get('DENO_ENV') === 'test'

/**
 * Centralized logging utility that handles test mode properly.
 * In test mode, only errors are logged to stderr, while other logs are suppressed.
 */
const logger = {
  log(message: string): void {
    if (!IS_TEST_ENV) {
      console.log(message)
    }
  },

  error(message: string | Error | unknown): void {
    // Always log errors, even in test mode
    if (message instanceof Error) {
      console.error(message.message)
    } else if (typeof message === 'string') {
      console.error(message)
    } else {
      console.error('Unknown error:', message)
    }
  },

  warn(message: string): void {
    if (!IS_TEST_ENV) {
      console.warn(message)
    }
  },
}

/**
 * Represents a node in the Markdown Abstract Syntax Tree (AST).
 * Basic definition; could be expanded based on specific needs.
 */
type MdcNode = {
  type: string
  tag?: string
  children?: MdcNode[]
  value?: string
  props?: Record<string, unknown>
}

/**
 * Type definition for the AST body returned by `parseMarkdown`.
 * Assumes a root node containing children.
 */
type MdcAstBody = {
  type: string // Typically 'root'
  children: MdcNode[]
}

/**
 * Represents the metadata extracted from the YAML frontmatter of an MDC rule file.
 */
interface RuleMetadata {
  description?: string
  globs?: string[] | string
  alwaysApply?: boolean
  // Future: Add other potential metadata fields here
}

/**
 * Normalizes glob patterns from various input formats into a string array.
 * Handles single string, comma-separated string, and array inputs.
 * @param globs The glob pattern(s) from the frontmatter
 * @returns Normalized array of glob patterns
 * @private
 */
function normalizeGlobPatterns(globs: string | string[] | undefined): string[] | undefined {
  if (!globs) return undefined
  if (Array.isArray(globs)) return globs
  // Split by comma and trim each entry
  return globs.split(',').map((g) => g.trim())
}

/**
 * Represents the final structured object for a rule, combining metadata,
 * extracted content, and git history.
 */
interface RuleObject extends RuleMetadata {
  fileName: string
  title?: string
  descriptionShort?: string
  descriptionLong?: string
  examples?: string
  createdOn?: string
  updatedOn?: string
}

/**
 * Executes a `git log` command safely.
 * @param args Arguments to pass to `git log`.
 * @param filePath The target file path for the log command.
 * @returns The command's stdout as a string, or undefined on error.
 * @private
 */
async function safeGitLog(
  args: string[],
  filePath: string,
): Promise<string | undefined> {
  try {
    const command = new Deno.Command('git', {
      args: ['log', ...args, '--', filePath],
      stdout: 'piped',
      stderr: 'piped',
    })
    const { code, stdout, stderr } = await command.output()
    if (code !== 0) {
      const error = new TextDecoder().decode(stderr)
      logger.warn(
        `Git command error for ${filePath} with args [${args.join(', ')}]: ${error.trim()}`,
      )
      return undefined
    }
    return new TextDecoder().decode(stdout).trim()
  } catch (error) {
    logger.error(
      `Error running git log for ${filePath} with args [${args.join(', ')}]: ${error}`,
    )
    return undefined
  }
}

/**
 * Retrieves the creation (first commit) and last updated dates for a file.
 * Uses `safeGitLog` for executing git commands.
 * @param filePath The path to the file.
 * @returns A promise resolving to an object with `created` and `updated` dates (YYYY-MM-DD),
 *          or undefined for dates if git history is unavailable.
 * @throws Never - Errors during git command execution are logged, returning undefined dates.
 */
async function getGitDates(
  filePath: string,
): Promise<{ created: string | undefined; updated: string | undefined }> {
  // In test environment, return fixed dates to avoid git dependency
  if (IS_TEST_ENV) {
    return { created: '2024-01-01', updated: '2024-01-15' }
  }

  const createdLog = await safeGitLog([
    '--diff-filter=A',
    '--follow',
    '--format=%as',
  ], filePath)
  const updatedLog = await safeGitLog(['-1', '--format=%as'], filePath)

  // Handle cases where git log returns multiple dates for --diff-filter=A
  const createdDate = createdLog?.split('\n').pop() || undefined
  const updatedDate = updatedLog || undefined

  return { created: createdDate, updated: updatedDate }
}

/**
 * Extracts the plain text content from an MDC AST node and its children.
 * @param node The MDC AST node to extract text from.
 * @returns The concatenated text content.
 * @private
 */
function getTextContent(node: MdcNode): string {
  if (node.type === 'text') {
    return node.value ?? ''
  }
  if (node.children) {
    return node.children.map(getTextContent).join('')
  }
  return ''
}

/**
 * Finds the first paragraph node following a given start index in an array of nodes.
 * @param nodes An array of sibling AST nodes.
 * @param startIndex The index to start searching from.
 * @returns The text content of the first paragraph found, or undefined.
 * @private
 */
function findNextParagraphText(
  nodes: MdcNode[],
  startIndex: number,
): string | undefined {
  for (let i = startIndex; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.type === 'element' && node.tag === 'p') {
      return getTextContent(node).trim()
    }
    // Stop searching if another header is encountered before a paragraph
    if (node.type === 'element' && (node.tag?.match(/^h[1-6]$/))) {
      break
    }
  }
  return undefined
}

/**
 * Extracts and formats documentation content found under headings named "Example" or "Examples".
 * Captures subsequent paragraphs, code blocks, and lists until another heading of the same or higher level is found.
 * @param nodes An array of top-level AST nodes from the parsed Markdown body.
 * @returns A formatted markdown string containing all captured examples, or undefined if none are found.
 */
function extractExamples(nodes: MdcNode[]): string | undefined {
  let exampleContent = ''
  let isCapturing = false
  let exampleHeaderLevel = 0

  for (const node of nodes) {
    if (node.type === 'element' && node.tag?.match(/^h[1-6]$/)) {
      const currentLevel = Number.parseInt(node.tag.substring(1), 10)
      const headerText = getTextContent(node).trim()

      if (headerText.toLowerCase().startsWith('example')) {
        isCapturing = true
        exampleHeaderLevel = currentLevel
        exampleContent += `\n${'#'.repeat(currentLevel)} ${headerText}\n\n` // Include the Example header
      } else if (isCapturing && currentLevel <= exampleHeaderLevel) {
        // Stop capturing if we hit another header at the same or higher level
        isCapturing = false
        break // No need to process further nodes if capture ended
      } else if (isCapturing) {
        // Lower level header within examples section, treat as subsection
        exampleContent += `${'#'.repeat(currentLevel)} ${headerText}\n\n`
      }
    } else if (isCapturing) {
      // Capture relevant content types within the example section
      if (node.type === 'element' && node.tag === 'pre') {
        const codeNode = node.children?.find((c) => c.type === 'element' && c.tag === 'code')
        const codeText = codeNode ? getTextContent(codeNode) : ''
        let lang = (codeNode?.props?.language as string) || ''
        if (!lang && Array.isArray(codeNode?.props?.className)) {
          const langClass = (codeNode.props.className as string[])
            .find((cn) => cn.startsWith('language-'))
          lang = langClass ? langClass.substring('language-'.length) : ''
        }
        exampleContent += `\`\`\`${lang}\n${codeText.trim()}\n\`\`\`\n\n`
      } else if (node.type === 'element' && node.tag === 'p') {
        exampleContent += `${getTextContent(node).trim()}\n\n`
      } else if (
        node.type === 'element' && (node.tag === 'ul' || node.tag === 'ol')
      ) {
        for (
          const li of node.children?.filter((item) =>
            item.type === 'element' && item.tag === 'li'
          ) ?? []
        ) {
          exampleContent += `- ${getTextContent(li).trim()}\n`
        }
        exampleContent += '\n'
      }
      // Future: Add handling for other elements like tables if needed
    }
  }
  return exampleContent.trim() || undefined
}

/**
 * Parses a single MDC rule file, extracting metadata and content.
 * @param filePath The absolute path to the MDC file.
 * @returns A Promise resolving to the structured RuleObject.
 * @throws If the MDC file cannot be parsed.
 * @private
 */
async function parseRuleFile(
  filePath: string,
  content: string,
): Promise<RuleObject> {
  try {
    const ast = await parseMarkdown(content)
    const metadata = (ast.data?.frontmatter || {}) as RuleMetadata
    const bodyChildren = (ast.body as MdcAstBody)?.children || []

    // Normalize glob patterns
    const normalizedGlobs = normalizeGlobPatterns(metadata.globs)

    let title: string | undefined
    let descriptionLong: string | undefined
    let firstHeaderLevel = 7 // Initialize higher than any possible header level (h1-h6)

    // Find the highest-level header (h1 > h2 > h3) to use as title
    for (let i = 0; i < bodyChildren.length; i++) {
      const node = bodyChildren[i]
      if (node.type === 'element' && node.tag?.match(/^h[1-3]$/)) { // Prioritize h1-h3
        const currentLevel = Number.parseInt(node.tag.substring(1), 10)
        if (currentLevel < firstHeaderLevel) {
          title = getTextContent(node).trim()
          firstHeaderLevel = currentLevel
          // Only get description from paragraph if it immediately follows the title
          const nextPara = findNextParagraphText(bodyChildren, i + 1)
          if (nextPara) {
            descriptionLong = nextPara
          }
        }
      }
      // Optimization: if we found an H1, we can stop searching for title/desc
      if (firstHeaderLevel === 1) break
    }

    // Use frontmatter description if available, otherwise use long description
    const descriptionShort = metadata.description || descriptionLong

    const examples = extractExamples(bodyChildren)
    const { created, updated } = await getGitDates(filePath)

    return {
      fileName: path.basename(filePath),
      title,
      description: metadata.description,
      globs: normalizedGlobs,
      alwaysApply: metadata.alwaysApply,
      descriptionShort,
      descriptionLong,
      examples,
      createdOn: created,
      updatedOn: updated,
    }
  } catch (parseError) {
    logger.error(`Error parsing MDC file: ${filePath}`)
    if (parseError instanceof Error) {
      logger.error(`Parser Error: ${parseError.message}`)
      if (content.startsWith('---') && !content.substring(3).includes('---')) {
        logger.error(
          "Hint: Frontmatter block might be missing closing '---'.",
        )
      } else if (parseError.message.includes('YAML')) {
        logger.error('Hint: Check YAML syntax in the frontmatter block.')
      }
    } else {
      logger.error(`An unknown parsing error occurred: ${String(parseError)}`)
    }
    // Re-throw to halt the build process on a single file failure
    throw new Error(`Failed to parse ${filePath}.`)
  }
}

/**
 * Main build process function.
 * Iterates through rule files, parses them, and writes the output JSON.
 * @throws If any file fails to parse or if there are issues writing the output.
 */
async function buildRulesJson(): Promise<void> {
  const rulesDir = IS_TEST_ENV
    ? path.resolve('test/mocks/rules') // Use mock dir for tests
    : path.resolve('.cursor/rules')
  const outputDir = path.resolve('bin')
  const outputPath = path.join(outputDir, 'rules.json')
  const rules: RuleObject[] = []

  try {
    // Don't ensure output dir exists in test env, as we won't write to it
    if (!IS_TEST_ENV) {
      await fs.ensureDir(outputDir)
      logger.log(`Output directory ensured: ${outputDir}`)
    } else {
      // Ensure mock input dir exists for tests
      await fs.ensureDir(rulesDir)
      logger.log(`Mock input directory ensured for testing: ${rulesDir}`)
    }

    for await (const entry of Deno.readDir(rulesDir)) {
      if (entry.isFile && entry.name.endsWith('.mdc')) {
        const filePath = path.join(rulesDir, entry.name)
        logger.log(`Processing file: ${filePath}`)
        const content = await Deno.readTextFile(filePath)
        const ruleObject = await parseRuleFile(filePath, content)
        rules.push(ruleObject)
        logger.log(` -> Successfully processed: ${entry.name}`)
      }
    }

    // Sort rules alphabetically by fileName for consistent output
    rules.sort((a, b) => a.fileName.localeCompare(b.fileName))

    const outputJson = JSON.stringify(rules, null, 2)

    if (IS_TEST_ENV) {
      // Output JSON to stdout in test environment
      console.log(outputJson)
    } else {
      // Write to file in normal execution
      await Deno.writeTextFile(outputPath, outputJson)
      logger.log(
        `\nSuccessfully wrote ${rules.length} rules to ${outputPath}`,
      )
    }
  } catch (error) {
    // Catch errors from ensureDir, readDir, or parseRuleFile
    logger.error(
      `Error during build process: ${error instanceof Error ? error.message : String(error)}`,
    )
    Deno.exit(1) // Exit with non-zero code on error
  }
}

// --- Script Execution ---
if (import.meta.main) {
  await buildRulesJson()
}

export default buildRulesJson
