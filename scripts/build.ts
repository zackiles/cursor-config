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
import { AttachmentType } from '../src/types.ts'

const COMPILE_PATH = Deno.env.get('COMPILE_PATH') || 'bin'
const UNCOMPILED_RULES_PATH = join('.cursor', 'rules', 'global')
const OUTPUT_PATH = join(COMPILE_PATH, 'rules.json')
const MARKDOWN_PATH = join(COMPILE_PATH, 'rules.md')
const HOW_RULES_WORK_SRC = join('docs', 'how-cursor-rules-work.md')
const HOW_RULES_WORK_DEST = join(COMPILE_PATH, 'how-cursor-rules-work.md')

// Markdown styling configuration
const MARKDOWN_CONFIG = {
  table: {
    columnWidths: {
      rule: 15, // Width % for rule name column
      description: 40, // Width % for description column (increased to accommodate attachment type)
      tags: 35, // Width % for tags column
    },
    columnAlignment: {
      rule: 'left',
      description: 'left',
      tags: 'center',
    },
  },
  attachmentMethodDescriptions: {
    system:
      'System attachment method. Injects into the internal system prompt and attempts to overrule it. Best for setting modes, establishing base AI instructions, and rules that need to set agent context before a conversation or task begins.',
    message:
      'Message attachment method (default). Injects into the current user message or conversation. Best for most rule types and general-purpose rules that augment the current interaction context.',
    task:
      'Task attachment method. Injects into the current message or conversation and explicitly instructs the agent to perform an action. Best for rules that should initiate specific agent behaviors, such as creating a file if the rule is named "@create-file".',
    none:
      'No attachment method/reference only. References the rule without loading its full content into the current context. Best for large or complex rules that you only want lazy-loaded by the agent at certain steps in your instructions. The agent will be aware of the rule and will have the choice to load its contents when it chooses.',
    default: 'Custom attachment method with behavior defined by the system.',
  },
  header: `# Available Cursor @Rules

This project contains Cursor rules created through **Cursor Workbench**!

This document was auto-generated and describes all global rules used by this project in the \`.cursor/rules/global\` directory.

> [!TIP]
> **New to Cursor Rules?** Read this deep-dive guide on [How Cursor Rules Work](./how-cursor-rules-work.md).

> [!IMPORTANT]
> Rules in \`.cursor/rules/global\` are to be used ONLY for global rules shared outside of this codebase and were generated using Cursor Workbench. Project-specific rules should use \`.cursor/rules/local\` or \`.cursor/rules/\` instead.

`,
}

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

  const { stderr, code } = await command.output()
  const decoder = new TextDecoder()
  const stderrText = decoder.decode(stderr)

  if (stderrText.trim()) {
    logger.error('Linter error:')
    logger.error(stderrText)
  }

  // NOTE: Warnings are allowed, so we don't exit on failure
  return code === 0
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

    if (creationOutput.code === 0) {
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

    if (updateOutput.code === 0) {
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
  // Start with the header from config
  let markdown = MARKDOWN_CONFIG.header

  // Group rules first by attachmentMethod, then by category
  const rulesByMethod: Record<string, Record<string, RuleFileSimple[]>> = {}

  for (const rule of rules) {
    const attachmentMethod = rule.attachmentMethod || 'none'
    const category = rule.category || 'Uncategorized'

    if (!rulesByMethod[attachmentMethod]) {
      rulesByMethod[attachmentMethod] = {}
    }

    if (!rulesByMethod[attachmentMethod][category]) {
      rulesByMethod[attachmentMethod][category] = []
    }

    rulesByMethod[attachmentMethod][category].push(rule)
  }

  // Use specific order for attachment methods: system, message, task, none
  const methodOrder = ['system', 'message', 'task', 'none']
  const sortedMethods = Object.keys(rulesByMethod).sort((a, b) => {
    const indexA = methodOrder.indexOf(a)
    const indexB = methodOrder.indexOf(b)

    // If both methods are in our predefined order, sort by that order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB
    }

    // If only one is in our predefined order, prioritize it
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1

    // For any other methods not in our predefined list, sort alphabetically
    return a.localeCompare(b)
  })

  // Create sections for each attachment method
  for (const [_methodIndex, method] of sortedMethods.entries()) {
    const categoriesByMethod = rulesByMethod[method]

    // Format method name for display
    const formattedMethod = method.charAt(0).toUpperCase() + method.slice(1)

    // Get description from config or use default if not found
    const methodDescription = MARKDOWN_CONFIG
      .attachmentMethodDescriptions[
        method as keyof typeof MARKDOWN_CONFIG.attachmentMethodDescriptions
      ] ||
      MARKDOWN_CONFIG.attachmentMethodDescriptions.default

    markdown += `\n## Attachment Method: ${formattedMethod}\n\n${methodDescription}\n`

    // Sort categories within this method
    const sortedCategories = Object.keys(categoriesByMethod).sort()

    // Create subsections for each category within this method
    for (const category of sortedCategories) {
      const rulesInCategory = categoriesByMethod[category]

      // Format category name for display (capitalize first letter of each word)
      const formattedCategory = category
        .split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')

      markdown += `\n### ${formattedCategory}\n\n`

      // Add a table for rules in this category using HTML for fixed column widths
      const { rule, description, tags } = MARKDOWN_CONFIG.table.columnWidths

      // Use HTML table with explicit column widths instead of GFM table
      markdown += `<table width="100%">
  <tr>
    <th width="${rule}%" align="left">Rule</th>
    <th width="${description}%" align="left">Description</th>
    <th width="${tags}%" align="center">Tags</th>
  </tr>
`

      for (const rule of rulesInCategory) {
        const ruleName = rule.rule
        const ruleDescription = rule.description || 'No description provided'

        // Use the actual attachment type value directly
        const attachmentTypeName = rule.attachmentType || AttachmentType.Unknown

        // Add globs information if available
        let globsInfo = ''
        if (rule.globs) {
          if (Array.isArray(rule.globs)) {
            globsInfo = ` Applies to \`${rule.globs.join('`, `')}\` files.`
          } else {
            globsInfo = ` Applies to \`${rule.globs}\` files.`
          }
        }

        // Format tags if available, enclosing each in HTML code tags instead of markdown backticks
        let tagsText = '-'
        if (rule.tags && Array.isArray(rule.tags) && rule.tags.length > 0) {
          tagsText = rule.tags.map((tag) => `<code>${tag}</code>`).join(', ')
        }

        // Create HTML table row with attachment type display
        markdown += `  <tr>
    <td><strong><code>@${ruleName}</code></strong></td>
    <td><strong>Type</strong>: ${attachmentTypeName}<br><br>${ruleDescription}${globsInfo}</td>
    <td align="center">${tagsText}</td>
  </tr>
`
      }

      // Close HTML table
      markdown += '</table>\n\n'
    }
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
    const path = Deno.args[0] || UNCOMPILED_RULES_PATH
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
        attachmentType: file.derivedAttachmentType || AttachmentType.Unknown,
        createdOn,
        updatedOn,
        category: file.frontmatter?.category || null,
        description: file.frontmatter?.description || null,
        globs: file.frontmatter?.globs || null,
        tags: file.frontmatter?.tags || null,
        alwaysApply: file.frontmatter?.alwaysApply || null,
        attachmentMethod: file.frontmatter?.attachmentMethod || null,
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

      // Copy the how-cursor-rules-work.md file to the bin folder
      try {
        await Deno.copyFile(HOW_RULES_WORK_SRC, HOW_RULES_WORK_DEST)
        logger.log(`Successfully copied ${HOW_RULES_WORK_SRC} to ${HOW_RULES_WORK_DEST}`)
      } catch (error) {
        logger.error(
          `Warning: Could not copy documentation file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        // Continue execution even if this step fails
      }
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
