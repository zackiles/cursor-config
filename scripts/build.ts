#!/usr/bin/env -S deno run -A

/**
 * @module build
 * @description Builds the rules.json file from MDC files by processing, validating, and transforming them.
 * This script is used to generate a consolidated ruleset for the application to consume.
 */

import { ensureDir, expandGlob } from '@std/fs'
import { basename, dirname, extname, join } from '@std/path'
import { processMdcFile } from '../src/processor.ts'
import logger from '../src/utils/logger.ts'
import type { RuleFileRaw, RuleFileSimple } from '../src/types.ts'

const DEFAULT_PATH = join('.cursor', 'rules', 'global')
const OUTPUT_PATH = join('bin', 'rules.json')
const MARKDOWN_PATH = join('bin', 'rules.md')

/**
 * Run the MDC linter to ensure all files are valid
 *
 * @param path - Directory path with MDC files to lint
 * @returns True if linting passed with no errors (warnings are allowed)
 */
async function runLinter(path: string): Promise<boolean> {
  logger.log(`Running linter on MDC files in: ${path}`)

  const command = new Deno.Command('deno', {
    args: [
      'run',
      '-A',
      join('src', 'linter.ts'),
      join(path, '**/*.mdc'),
    ],
    stdout: 'piped',
    stderr: 'piped',
  })

  const { _stdout, stderr, success } = await command.output()
  const decoder = new TextDecoder()
  const stderrText = decoder.decode(stderr)

  if (stderrText.trim()) {
    logger.error('Linter error:')
    logger.error(stderrText)
  }

  // NOTE: Warnings are allowed, so we don't exit on failure
  return success
}

/**
 * Get file creation and last update dates from git history
 *
 * @param filePath - Path to the file
 * @returns Object containing createdOn and updatedOn dates
 */
async function getGitDates(
  filePath: string,
): Promise<{ createdOn: string | null; updatedOn: string | null }> {
  try {
    // Get creation date (first commit with this file)
    const creationCommand = new Deno.Command('git', {
      args: ['log', '--follow', '--format=%aI', '--reverse', filePath],
      stdout: 'piped',
      stderr: 'piped',
    })

    const creationOutput = await creationCommand.output()
    let createdOn: string | null = null

    if (creationOutput.success) {
      const decoder = new TextDecoder()
      const output = decoder.decode(creationOutput.stdout).trim()
      const dates = output.split('\n').filter(Boolean)

      if (dates.length > 0) createdOn = dates[0]
    }

    // Get last update date (most recent commit with this file)
    const updateCommand = new Deno.Command('git', {
      args: ['log', '--format=%aI', '-n', '1', filePath],
      stdout: 'piped',
      stderr: 'piped',
    })

    const updateOutput = await updateCommand.output()
    let updatedOn: string | null = null

    if (updateOutput.success) {
      const decoder = new TextDecoder()
      const output = decoder.decode(updateOutput.stdout).trim()

      if (output) {
        updatedOn = output
      }
    }

    return { createdOn, updatedOn }
  } catch (error) {
    logger.error(`Error getting git dates for ${filePath}:`, error)
    return { createdOn: null, updatedOn: null }
  }
}

/**
 * Processes all .mdc files in a directory and its subdirectories
 *
 * @param path - Directory path to search for .mdc files
 * @returns Array of processed RuleFileRaw objects
 */
async function processMdcFiles(path: string): Promise<RuleFileRaw[]> {
  const mdcFiles: RuleFileRaw[] = []
  const globPattern = join(path, '**/*.mdc')

  // Use expandGlob to recursively find all .mdc files
  for await (const entry of expandGlob(globPattern)) {
    if (entry.isFile) {
      logger.log(`Processing file: ${entry.path}`)
      const processedFile = await processMdcFile(entry.path)
      mdcFiles.push(processedFile)
    }
  }

  return mdcFiles
}

/**
 * Creates a markdown file from the rules data, organizing rules by category
 *
 * @param rules - Array of processed rule objects
 * @returns Markdown content as a string
 */
function createRulesMarkdown(rules: RuleFileSimple[]): string {
  // Start with the header
  let markdown = `# Available Cursor @ Rules

This project contains Cursor rules!

> [!TIP]
> For more details on how Cursor Rules work, please read this deep-dive guide on [How Cursor Rules Work](./docs/how-cursor-rules-work.md).

The following rules are configured in \`.cursor/rules\` and can be triggered using the \`@\` command, though some activate automatically based on configuration in \`RULES_FOR_AI.md\` or when relevant files are added to the chat that match the rule's glob pattern.
`

  // Group rules by category
  const rulesByCategory: Record<string, RuleFileSimple[]> = {}

  for (const rule of rules) {
    const category = rule.category || 'Uncategorized'
    if (!rulesByCategory[category]) {
      rulesByCategory[category] = []
    }
    rulesByCategory[category].push(rule)
  }

  // Sort categories for consistent output
  const sortedCategories = Object.keys(rulesByCategory).sort()

  // Create sections for each category
  for (const [index, category] of sortedCategories.entries()) {
    const rulesInCategory = rulesByCategory[category]

    // Format category name for display (capitalize first letter of each word)
    const formattedCategory = category
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')

    markdown += `\n## ${index + 1}. ${formattedCategory}\n\n`

    // Add a table for rules in this category
    markdown += '| Rule | Trigger Type | Description | Tags |\n'
    markdown += '|------|--------------|-------------|------|\n'

    for (const rule of rulesInCategory) {
      const ruleName = rule.rule
      const description = rule.description || 'No description provided'

      // Determine trigger type based on attachmentType
      let triggerType = 'Manual'
      switch (rule.attachmentType) {
        case 'AgentAttached':
          triggerType = 'Semi-Manual'
          break
        case 'AutoAttached':
          triggerType = 'Automatic'
          break
        case 'ManuallyAttached':
          triggerType = 'Manual'
          break
        default:
          triggerType = 'Unknown'
      }

      // Add globs information if available
      let globsInfo = ''
      if (rule.globs) {
        if (Array.isArray(rule.globs)) {
          globsInfo = ` Applies to \`${rule.globs.join('`, `')}\` files.`
        } else {
          globsInfo = ` Applies to \`${rule.globs}\` files.`
        }
      }

      // Format tags if available, enclosing each in backticks
      let tagsText = '-'
      if (rule.tags && Array.isArray(rule.tags) && rule.tags.length > 0) {
        tagsText = rule.tags.map((tag) => `\`${tag}\``).join(', ')
      }

      markdown +=
        `| **\`${ruleName}\`** | ${triggerType} | ${description}${globsInfo} | ${tagsText} |\n`
    }

    markdown += '\n'
  }

  return markdown
}

/**
 * Main function that:
 * 1. Runs the linter to validate MDC files
 * 2. If linting passes, processes all .mdc files in the specified directory
 * 3. Simplifies the data format
 * 4. Writes the parsed metadata to a JSON file
 * 5. Creates a markdown file from the rules data
 */
async function main() {
  try {
    // Get directory path from command line args or use default
    const path = Deno.args[0] || DEFAULT_PATH
    logger.log(`Scanning for .mdc files in: ${path}`)

    // Run the linter first to validate the MDC files
    const lintingPassed = await runLinter(path)

    // Only continue if linting passed (no errors)
    if (!lintingPassed) {
      logger.error('Linting failed with errors. Fix the errors before building rules.json.')
      Deno.exit(1)
    }

    logger.log('Linting passed (warnings are allowed). Continuing with build...')

    // Process all .mdc files
    const processedFiles = await processMdcFiles(path)
    logger.log(`Processed ${processedFiles.length} .mdc files`)

    // Simplify the rules - inlined from simplifyRules()
    const processedRules = await Promise.all(processedFiles.map(async (file) => {
      // Extract rule name from file path (remove .mdc extension) - inlined from extractRuleName()
      const rule = basename(file.filePath, extname(file.filePath))

      // Get git creation and update dates
      const { createdOn, updatedOn } = await getGitDates(file.filePath)

      const ruleMetadata: RuleFileSimple = {
        rule,
        attachmentType: file.derivedAttachmentType || 'Unknown',
        createdOn,
        updatedOn,
        category: file.frontmatter.category || null,
        description: file.frontmatter.description || null,
        globs: file.frontmatter.globs || null,
        tags: file.frontmatter.tags || null,
        alwaysApply: file.frontmatter.alwaysApply || null,
      }

      // Add any remaining properties from frontmatter
      if (file.frontmatter) {
        for (const [key, value] of Object.entries(file.frontmatter)) {
          // Skip properties we've already added and internal properties
          if (
            key === 'description' || key === 'globs' || key === 'alwaysApply' || key === 'tags' ||
            key === 'raw' || key === 'parseError' || key === 'startLine' || key === 'endLine'
          ) {
            continue
          }
          ruleMetadata[key] = value
        }
      }

      return ruleMetadata
    }))

    try {
      await ensureDir(dirname(OUTPUT_PATH))

      await Deno.writeTextFile(
        OUTPUT_PATH,
        JSON.stringify(processedRules, null, 2),
      )

      logger.log(`Successfully wrote metadata to ${OUTPUT_PATH}`)

      // Create markdown file from the rules data
      const markdownContent = createRulesMarkdown(processedRules)

      await Deno.writeTextFile(
        MARKDOWN_PATH,
        markdownContent,
      )

      logger.log(`Successfully wrote markdown to ${MARKDOWN_PATH}`)
    } catch (error) {
      throw new Error(
        `Failed to write output files: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  } catch (error) {
    if (error instanceof URIError) {
      logger.error('URI Error:', error.message)
    } else if (error instanceof SyntaxError) {
      logger.error('Syntax Error:', error.message)
    } else if (error instanceof Error) {
      logger.error('Error:', error.message)
    } else {
      logger.error('Unknown error:', String(error))
    }
    Deno.exit(1)
  }
}

// Run the main function
main()
