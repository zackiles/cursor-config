#!/usr/bin/env -S deno run -A

/**
 * @module build
 * @description Builds rules.json and rules.md from MDC files in the project.
 *
 * This script processes .mdc files to generate consolidated rulesets and documentation
 * for consumption by the application and users. It performs the following steps:
 *
 * 1. Validates all MDC files using a linter to ensure correctness
 * 2. Processes each .mdc file to extract metadata and content
 * 3. Retrieves Git history for creation and update dates of each rule
 * 4. Simplifies the rule data format for easier consumption
 * 5. Generates a JSON file (rules.json) with processed rule metadata
 * 6. Creates a markdown file (rules.md) with organized documentation in GitHub Flavored Markdown with HTML elements
 * 7. Creates an HTML file (rules.html) from the markdown file using GitHub's Markdown Rendering API
 * 8. Copies other supporting dependencies and documentation files to the output directory
 *
 * @example
 * ```bash
 * deno run -A scripts/build.ts
 * # Or with custom path
 * deno run -A scripts/build.ts .cursor/rules/custom
 * ```
 *
 * @see https://github.com/qnighy/dedent
 * @see https://jsr.io/@std/path/doc
 * @see https://jsr.io/@std/path/doc/~/join
 * @see https://jsr.io/@std/path/doc/~/extname
 * @see https://jsr.io/@std/path/doc/~/dirname
 * @see https://jsr.io/@std/path/doc/~/basename
 * @see https://jsr.io/@std/fs/doc
 * @see https://jsr.io/@std/fs/doc/~/ensureDir
 * @see https://jsr.io/@std/fs/doc/~/expandGlob
 */

import { ensureDir, expandGlob } from '@std/fs'
import { dedent } from '@qnighy/dedent'
import { basename, dirname, extname, join } from '@std/path'
import { processMdcFile } from '../src/processor.ts'
import logger from '../src/utils/logger.ts'
import type { RuleFileRaw, RuleFileSimple } from '../src/types.ts'
import { AttachmentType } from '../src/types.ts'

const COMPILE_PATH = Deno.env.get('COMPILE_PATH') || 'bin'
const UNCOMPILED_RULES_PATH = join('.cursor', 'rules', 'global')
const OUTPUT_PATH = join(COMPILE_PATH, 'rules.json')
const OUTPUT_JSONC_PATH = join(COMPILE_PATH, 'rules.jsonc')
const MARKDOWN_PATH = join(COMPILE_PATH, 'rules.md')
const HTML_PATH = join(COMPILE_PATH, 'rules.html')
const HOW_RULES_WORK_SRC = join('docs', 'how-cursor-rules-work.md')
const HOW_RULES_WORK_DEST = join(COMPILE_PATH, 'how-cursor-rules-work.md')
const GITHUB_MARKDOWN_API = 'https://api.github.com/markdown'
const CSS_PATH = join('assets', 'rules-docs.css')

// Markdown styling configuration
const MARKDOWN_CONFIG = {
  header: dedent`
    # Available Cursor Rules In This Project

    This project contains Cursor rules created through **Cursor Workbench**!

    This document was auto-generated and describes all global rules used by this project in the \`.cursor/rules/global\` directory.

    > [!TIP]
    > **New to Cursor Rules?** Read this deep-dive guide on [How Cursor Rules Work](./how-cursor-rules-work.md).

    > [!NOTE]
    > Rules in \`.cursor/rules/global\` are used for global rules shared with the project and others. Project-specific rules unique to this project should be stored in \`.cursor/rules/local\` or \`.cursor/rules/\` instead.
  `,
  customRuleFieldsDescription: dedent`
    This project adds specialized fields to the frontmatter on Cursor rule files that help with discoverability of rules as well as extending their functionality outside of what Cursor provides. This section documents all of the custom fields used in Cursor rules for this project.

    > [!IMPORTANT]
    > The Cursor IDE opens rule files by default using the Cursor MDC Editor, which hides all of the frontmatter fields that are contained in the raw file. If you'd like to see or edit any of the custom fields you'll need to open the .mdc file in a plain text editor.

    > [!TIP]
    > It's recommended to choose a default editor for .mdc files by setting \`"workbench.editorAssociations": {"*.mdc": "default"}\` in your settings.json. This will make editing custom fields contained in the frontmatter header easier. You can still choose 'Open With -> MDC Editor' to use Cursor's editor at any time by right-clicking the rule file.
  `,
  ruleClassifierSections: [
    {
      title: 'Field: Attachment Type',
      description:
        "Describes **when** a rule will attach to the context. This is a derived value set by the compiler ONLY (it can't be set directly). It's a simplified way of expressing the complex combination of existing Cursor MDC frontmatter (e.g. `alwaysApply`, `globs`, and `description`) during rule-compilation.",
      renderBody: (): string =>
        Object.entries(MARKDOWN_CONFIG.attachmentTypeDescriptions)
          .map(([type, description]) =>
            `- <a id="attachment-type-${type.toLowerCase()}"></a>**${type}**: ${description}`
          )
          .join('\n'),
    },
    {
      title: 'Field: Attachment Method',
      description:
        'Describes **how** a rule will attach to the context. Set in the frontmatter using the `attachmentMethod` field. Example: `attachmentMethod: system` makes a rule override the system prompt.',
      renderBody: (): string =>
        Object.entries(MARKDOWN_CONFIG.attachmentMethodDescriptions)
          .filter(([method]) => method !== 'default')
          .map(([method, description]) => {
            const formattedMethod = method.charAt(0).toUpperCase() + method.slice(1)
            return `- <a id="attachment-method-${method.toLowerCase()}"></a>**${formattedMethod}**: ${description}`
          })
          .join('\n'),
    },
    {
      title: 'Field: Category',
      description: "Adding a `category` in a rule's frontmatter helps organize and discover rules.",
      renderBody: (rules: RuleFileSimple[]): string => {
        const categories = new Set(
          rules
            .filter((rule) => rule.category)
            .map((rule) => rule.category?.toLowerCase() || '')
            .filter((category) => category !== ''),
        )

        return categories.size === 0
          ? 'No categories are currently used in this project.\n'
          : `**Categories Used In This Project:** ${
            renderCollapsibleList(Array.from(categories), MARKDOWN_CONFIG.maxItemsBig)
          }\n`
      },
    },
    {
      title: 'Field: Tags',
      description:
        "Adding `tags` in a rule's frontmatter provides a finer-grained way to categorize and discover rules in a large collection. Tags are specified as a comma-separated string in the frontmatter. Each tag can contain spaces and multiple words.",
      renderBody: (rules: RuleFileSimple[]): string => {
        const tags = new Set(
          rules
            .filter((rule) => rule.tags && Array.isArray(rule.tags))
            .flatMap((rule) => {
              if (rule.tags && Array.isArray(rule.tags)) {
                return rule.tags.map((tag) => tag.toLowerCase())
              }
              return []
            }),
        )

        return tags.size === 0
          ? 'No tags are currently used in this project.\n'
          : `**Tags Used In This Project:** ${
            renderCollapsibleList(Array.from(tags), MARKDOWN_CONFIG.maxItemsBig)
          }\n`
      },
    },
  ],
  table: {
    columnWidths: {
      ruleContent: 65, // Width % for combined rule name and description column
      tags: 35, // Width % for tags column
    },
    columnAlignment: {
      ruleContent: 'left',
      tags: 'left',
    },
  },
  maxItemsSmall: 4, // Maximum tags to show in tables before using expandable section
  maxItemsBig: 25, // Maximum tags to show in Tags/Category section before using expandable section
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
  attachmentTypeDescriptions: {
    AlwaysAttached:
      'Defined by `alwaysApply: true` in frontmatter. The rule is always active in the Cursor context.',
    AutoAttached:
      'Defined by `alwaysApply: false` with non-empty `globs` in frontmatter. The rule is automatically activated when a file matching the `globs` pattern is opened or focused in Cursor.',
    AgentAttached:
      'Defined by non-empty `description` in frontmatter. Loaded and used by the AI agent based on context, guided by the `description`.',
    ManuallyAttached:
      'Defined by `alwaysApply: false`, empty or no `globs`, empty or no `description`. The rule is only activated when manually referenced by the user with `@rule-name`.',
  },
} as const

/**
 * Renders a collection of items with collapsible section if needed
 *
 * @param items - Array of items to render
 * @param maxVisible - Maximum number of items to show before collapsing
 * @param useCodeTags - Whether to wrap items in HTML code tags
 * @returns HTML string with visible and potentially collapsed items
 */
function renderCollapsibleList(items: string[], maxVisible: number, useCodeTags = true): string {
  if (items.length === 0) return ''

  const sortedItems = [...items].sort()

  // Format each item with HTML code tags if requested
  const formatItem = (item: string) => useCodeTags ? `<code>${item}</code>` : item
  const visibleItems = sortedItems.slice(0, maxVisible).map(formatItem).join(', ')

  // If we have more items than maxVisible, create a collapsible section
  if (sortedItems.length > maxVisible) {
    const hiddenItems = sortedItems.slice(maxVisible).map(
      (item) => `<code>${item}</code>`,
    ).join(', ')
    const remainingCount = sortedItems.length - maxVisible

    return dedent`
      ${visibleItems}
      <details>
        <summary><i>Show ${remainingCount} more</i></summary>
        ${hiddenItems}
      </details>
    `
  }

  return visibleItems
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
  // --- Helper Functions (unchanged from previous refactor) ---
  const renderRuleTableRow = (rule: RuleFileSimple): string => {
    const ruleName = rule.rule
    const ruleDescription = rule.description || 'No description provided'
    const formattedDescription = ruleDescription.trim().endsWith('.')
      ? ruleDescription
      : `${ruleDescription}.`
    const attachmentMethod = rule.attachmentMethod || 'none'
    const formattedMethod = attachmentMethod.charAt(0).toUpperCase() + attachmentMethod.slice(1)
    const attachmentTypeName = rule.attachmentType || AttachmentType.Unknown

    let globsInfo = ''
    if (rule.globs) {
      const globList = Array.isArray(rule.globs)
        ? rule.globs.map((glob) => `<i>${glob}</i>`).join(', ')
        : `<i>${rule.globs}</i>`
      globsInfo = `<br><strong>Globs</strong>: ${globList}`
    }

    let tagsText = '-'
    if (rule.tags && Array.isArray(rule.tags) && rule.tags.length > 0) {
      const formatTag = (tag: string) => `<i>${tag}</i>`
      const visibleTags = rule.tags.slice(0, MARKDOWN_CONFIG.maxItemsSmall).map(formatTag).join(
        ', ',
      )

      if (rule.tags.length > MARKDOWN_CONFIG.maxItemsSmall) {
        const hiddenTags = rule.tags.slice(MARKDOWN_CONFIG.maxItemsSmall).map(formatTag).join(', ')
        const remainingCount = rule.tags.length - MARKDOWN_CONFIG.maxItemsSmall
        tagsText = dedent`
          ${visibleTags}<br>
          <br><details>
            <summary><i>Show ${remainingCount} more</i></summary>
            ${hiddenTags}
          </details>
        `
      } else {
        tagsText = visibleTags
      }
    }

    return dedent`
      <tr id="rule-${ruleName}" style="border-bottom: 16px solid transparent;">
        <td valign="top" style="padding-bottom: 15px;">
          <strong>Name</strong>: <code>@${ruleName}</code><br>
          <strong>Attachment</strong>: <a href="#attachment-type-${
      (attachmentTypeName || '').toLowerCase()
    }">${attachmentTypeName}</a> / <a href="#attachment-method-${attachmentMethod.toLowerCase()}">${formattedMethod}</a>${globsInfo}<br><br>
          ${formattedDescription}
        </td>
        <td valign="top" align="left" style="padding-bottom: 15px;">${tagsText}</td>
      </tr>
    `
  }

  const renderCategorySection = (
    category: string,
    rulesInCategory: RuleFileSimple[],
    categoryNumber?: string,
  ): string => {
    const formattedCategory = category
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    const categoryId = `category-${category.toLowerCase().replace(/\s+/g, '-')}`
    const { ruleContent, tags } = MARKDOWN_CONFIG.table.columnWidths
    const formattedCategoryWithNumber = categoryNumber
      ? `${categoryNumber} ${formattedCategory}`
      : formattedCategory

    return dedent`
      #### <a id="${categoryId}"></a>${formattedCategoryWithNumber}

      <table width="100%">
        <tr>
          <th width="${ruleContent}%" align="left">Rule</th>
          <th width="${tags}%" align="left">Tags</th>
        </tr>
      ${rulesInCategory.map(renderRuleTableRow).join('\n')}
      </table>
    `
  }

  // --- Static Workflow Data & Category Mapping ---
  const workflows: Record<string, { description: string; labels: string[] }> = {
    'Build': {
      'description':
        'Focus on creating, enhancing, and maintaining the core system, including code execution, performance, testing, and tooling essential for the software to function effectively.',
      'labels': [
        'backend',
        'development',
        'runtime',
        'testing',
        'refactoring',
        'performance',
        'resilience',
        'tooling',
      ],
    },
    'Plan': {
      'description':
        'Define objectives, sequence tasks, coordinate efforts, and prepare workflows to ensure smooth execution of development and operational activities.',
      'labels': [
        'planning',
        'preparation',
        'completion',
        'collaboration',
        'release',
        'tasks',
      ],
    },
    'Design': {
      'description':
        'Shape the structure, organization, and interaction patterns of the system, focusing on aesthetics, conventions, protocols, and user interaction principles.',
      'labels': [
        'design',
        'structure',
        'conventions',
        'style',
        'protocols',
        'interaction',
      ],
    },
    'Document': {
      'description':
        'Capture, maintain, and improve written knowledge including documentation, cleanup, and any activities that preserve understanding and clarity for both humans and AI.',
      'labels': [
        'documentation',
        'cleanup',
      ],
    },
  }
  const categoryToWorkflow = Object.fromEntries(
    Object.entries(workflows).flatMap(([wf, { labels }]) =>
      labels.map((l) => [l.toLowerCase(), wf])
    ),
  )

  // --- Group Rules by Workflow -> Category (and sort categories) ---
  const rulesByWorkflowAndCategory = Object.entries(
    rules.reduce((acc, rule) => {
      const category = rule.category || 'Uncategorized'
      const workflow = categoryToWorkflow[category.toLowerCase()] || 'Other'
      acc[workflow] = acc[workflow] || {}
      acc[workflow][category] = acc[workflow][category] || []
      acc[workflow][category].push(rule)
      return acc
    }, {} as Record<string, Record<string, RuleFileSimple[]>>),
  ).reduce((acc, [workflow, categories]) => {
    // Sort categories alphabetically within the workflow
    acc[workflow] = Object.fromEntries(
      Object.entries(categories).sort(([a], [b]) => a.localeCompare(b)),
    )
    return acc
  }, {} as Record<string, Record<string, RuleFileSimple[]>>)

  // --- Determine Ordered Workflow List ---
  const orderedWorkflows = [
    ...Object.keys(workflows).filter((wf) => rulesByWorkflowAndCategory[wf]), // Keep defined order
    ...(rulesByWorkflowAndCategory.Other ? ['Other'] : []), // Add 'Other' last if present
  ]

  // --- Build Markdown Sections ---
  const headerSection = MARKDOWN_CONFIG.header
  const customFieldsSection = MARKDOWN_CONFIG.ruleClassifierSections.map((section) =>
    dedent`
      ### ${section.title}

      ${section.description ? `${section.description}\n\n` : ''}${section.renderBody(rules) // Needs original flat list for category/tag aggregation
    }
    `
  ).join('\n\n')

  const indexSection = dedent`
    ### Overview

    Project rules are grouped into the following workflows:

    ${
    orderedWorkflows.map((workflow) => {
      const categoryLinks = Object.keys(rulesByWorkflowAndCategory[workflow]).map(
        (category) => {
          const formatted = category.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ')
          return `[${formatted}](#category-${category.toLowerCase().replace(/\\s+/g, '-')})`
        },
      ).join(', ')
      return `- **${workflow.toUpperCase()}**: ${categoryLinks}`
    }).join('\n')
  }
  `

  const rulesSections = orderedWorkflows.map((workflow, wIndex) => {
    const workflowNum = wIndex + 1
    const workflowData = workflows[workflow]
    const description = workflowData?.description
      ? `${workflowData.description}\n\n`
      : workflow === 'Other'
      ? "Categories that don't fit into the main workflows but still contain valuable rules.\n\n"
      : ''
    const categoryMarkdown = Object.entries(rulesByWorkflowAndCategory[workflow])
      .map(([cat, catRules], cIndex) => {
        const catNum = `${workflowNum}.${cIndex + 1}`
        return renderCategorySection(cat, catRules, catNum)
      })
      .join('\n')

    // Add horizontal line after each section except the last one
    const isLastWorkflow = wIndex === orderedWorkflows.length - 1
    const horizontalLine = isLastWorkflow ? '' : '\n\n<hr>\n'

    return dedent`
      ### ${workflowNum}. ${workflow}

      ${description}${categoryMarkdown}${horizontalLine}
    `
  }).join('\n\n')

  // --- Assemble Final Markdown ---
  return dedent`
    ${headerSection}
    ## About These Rules

    ${MARKDOWN_CONFIG.customRuleFieldsDescription}

    ${customFieldsSection}
    ## All Rules By Workflow

    ${indexSection}${rulesSections}
  `
}

/**
 * Adds appropriate header comments to a file based on its file type
 *
 * @param filePath - Path to the file
 * @param content - Content to write to the file
 * @returns The content with appropriate header comments
 */
async function addFileHeaderComments(filePath: string, content: string): Promise<string> {
  // Generate timestamp in the same format for all file types
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)

  // Get file extension
  const ext = extname(filePath).toLowerCase()

  switch (ext) {
    case '.md':
      return dedent`
        <!-- IMPORTANT: DO NOT EDIT. This document was auto-generated by Cursor Workbench on ${timestamp} and uses [Github Flavored Markdown](https://github.github.com/gfm/#atx-headings). To change how it's generated edit build.ts.-->

        ${content}
      `

    case '.html': {
      // Read the CSS file content
      let cssContent = ''
      try {
        cssContent = await Deno.readTextFile(CSS_PATH)
      } catch (error) {
        logger.error(
          `Warning: Could not read CSS file: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        // If CSS file can't be read, create an empty style block
        cssContent = '/* CSS file could not be loaded */'
      }

      return dedent`
        <!-- IMPORTANT: DO NOT EDIT. This document was auto-generated by Cursor Workbench on ${timestamp} and rendered from Markdown to HTML using the GitHub Markdown API with GitHub Flavored Markdown (GFM) mode. To change how it's generated edit build.ts.-->
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Cursor Rules Documentation</title>
          <style>
        ${cssContent}
          </style>
        </head>
        <body>
          ${content}
        </body>
        </html>
      `
    }

    case '.jsonc':
      return dedent`
        /**
         * IMPORTANT: DO NOT EDIT. This file was auto-generated by Cursor Workbench on ${timestamp}. To change how it's generated edit build.ts.
         * 
         * It contains metadata about all available Cursor rules in this project.
         * DO NOT EDIT THIS FILE DIRECTLY - it will be overwritten.
         * 
         * To modify rules, edit the original .mdc files in the .cursor/rules directory
         * and compile them with Cursor Workbench.
         */

        ${content}
      `

    default:
      // No comments for JSON files
      return content
  }
}

/**
 * Generates an HTML file from markdown content using GitHub's Markdown API
 *
 * @param markdownContent - The markdown content to convert
 * @returns HTML content as a string (without HTML wrapper)
 */
async function convertMarkdownToHtml(markdownContent: string): Promise<string> {
  try {
    logger.log('Converting markdown to HTML using GitHub API...')

    const response = await fetch(GITHUB_MARKDOWN_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Cursor-Config-Builder',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        text: markdownContent,
        mode: 'gfm',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`GitHub API error (${response.status}): ${errorText}`)
    }

    return await response.text()
  } catch (error) {
    logger.error(
      `Error converting markdown to HTML: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
    throw error
  }
}

/**
 * Main function that:
 * 1. Runs the linter to validate MDC files
 * 2. If linting passes, processes all .mdc files in the specified directory
 * 3. Simplifies the data format
 * 4. Writes the parsed metadata to a JSON file
 * 5. Creates a markdown file from the rules data
 * 6. Converts markdown to HTML and saves as rules.html
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

      // Ensure description ends with a period
      if (ruleMetadata.description) {
        ruleMetadata.description = ruleMetadata.description.trim().endsWith('.')
          ? ruleMetadata.description
          : `${ruleMetadata.description}.`
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

      // Generate the JSON content
      const jsonContent = JSON.stringify(processedRules, null, 2)

      // Write standard JSON file (without comments)
      await Deno.writeTextFile(OUTPUT_PATH, jsonContent)
      logger.log(`Successfully wrote metadata to ${OUTPUT_PATH}`)

      // Write JSONC file (with comments)
      const jsoncContent = await addFileHeaderComments(OUTPUT_JSONC_PATH, jsonContent)
      await Deno.writeTextFile(OUTPUT_JSONC_PATH, jsoncContent)
      logger.log(`Successfully wrote commented metadata to ${OUTPUT_JSONC_PATH}`)

      // Create markdown file from the rules data
      const markdownContent = createRulesMarkdown(processedRules)

      // Apply header comments and write the markdown file
      const markdownWithComments = await addFileHeaderComments(MARKDOWN_PATH, markdownContent)
      await Deno.writeTextFile(MARKDOWN_PATH, markdownWithComments)
      logger.log(`Successfully wrote markdown to ${MARKDOWN_PATH}`)

      // Convert markdown to HTML using GitHub API
      try {
        const htmlContent = await convertMarkdownToHtml(markdownContent)

        // Apply header and wrapper to HTML content
        const htmlWithComments = await addFileHeaderComments(HTML_PATH, htmlContent)
        await Deno.writeTextFile(HTML_PATH, htmlWithComments)
        logger.log(`Successfully converted markdown to HTML and saved to ${HTML_PATH}`)
      } catch (error) {
        logger.error(
          `Warning: Could not convert markdown to HTML: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
        // Continue execution even if this step fails
      }

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
