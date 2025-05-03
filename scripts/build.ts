#!/usr/bin/env -S deno run -A

/**
 * @module build
 * @description Builds the rules.json file from MDC files by processing, validating, and transforming them.
 * This script is used to generate a consolidated ruleset for the application to consume.
 */

import { expandGlob, ensureDir } from '@std/fs'
import { basename, dirname, extname, join } from '@std/path'
import { processMdcFile } from '../src/processor.ts'
import logger from '../src/utils/logger.ts'
import type { AttachmentType, MdcFile } from '../src/types.ts'

const DEFAULT_PATH = join('.cursor', 'rules', 'global')
const OUTPUT_PATH = join('bin', 'rules.json')

/**
 * Interface for simplified rule output
 */
interface RuleMetadata{
  rule: string
  attachmentType: AttachmentType
  createdOn: string | null
  updatedOn: string | null
  [key: string]: unknown
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

  const { stdout, stderr, success } = await command.output()
  const decoder = new TextDecoder()
  const stdoutText = decoder.decode(stdout)
  const stderrText = decoder.decode(stderr)

  if (stdoutText.trim()) {
    logger.info('Linter output:')
    logger.info(stdoutText)
  }

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
 * @returns Array of processed MdcFile objects
 */
async function processMdcFiles(path: string): Promise<MdcFile[]> {
  const mdcFiles: MdcFile[] = []
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
 * Main function that:
 * 1. Runs the linter to validate MDC files
 * 2. If linting passes, processes all .mdc files in the specified directory
 * 3. Simplifies the data format
 * 4. Writes the parsed metadata to a JSON file
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
      
      // Create a filtered copy for logging
      const loggableObj = {
        filePath: file.filePath,
        frontmatter: { ...file.frontmatter },
        derivedAttachmentType: file.derivedAttachmentType
      }
      console.log(loggableObj)
      // Extract rule name from file path (remove .mdc extension) - inlined from extractRuleName()
      const rule = basename(file.filePath, extname(file.filePath))

      // Get git creation and update dates
      const { createdOn, updatedOn } = await getGitDates(file.filePath)

      const simplified: RuleMetadata= {
        rule,
        raw: file.rawContent,
        attachmentType: file.derivedAttachmentType || 'Unknown',
        createdOn,
        updatedOn,
        // Add these properties directly from the parsed object
        globs: file.frontmatter?.globs,
        alwaysApply: file.frontmatter?.alwaysApply,
      }

      // Add the raw content to the simplified rule
      simplified.raw = file.rawContent

      // Get description directly from frontmatter
      if (file.frontmatter && 'description' in file.frontmatter) {
        // Only add non-null description
        const desc = file.frontmatter.description
        if (desc !== null && desc !== undefined && desc !== '') {
          simplified.description = String(desc)
        } else {
          simplified.description = null
        }
      } else {
        simplified.description = null
      }

      // Add any remaining properties from frontmatter
      if (file.frontmatter) {
        for (const [key, value] of Object.entries(file.frontmatter)) {
          // Skip properties we've already added and internal properties
          if (key === 'description' || key === 'globs' || key === 'alwaysApply' || 
              key === 'raw' || key === 'parseError' || key === 'startLine' || key === 'endLine') {
            continue
          }
          simplified[key] = value
        }
      }

      return simplified
    }))
    
    try {
      await ensureDir(dirname(OUTPUT_PATH))

      await Deno.writeTextFile(
        OUTPUT_PATH,
        JSON.stringify(processedRules, null, 2),
      )

      logger.log(`Successfully wrote metadata to ${OUTPUT_PATH}`)
    } catch (error) {
      throw new Error(`Failed to write rules file: ${error instanceof Error ? error.message : String(error)}`)
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
