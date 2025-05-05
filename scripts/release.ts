#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env

/**
 * @module release
 *
 * Creates a release package of Cursor rules into a zip file.
 *
 * This script prepares a release by processing a rules.jsonc file that lists
 * the rule names to include, copying each rule's .mdc file from the global rules
 * directory to the compile path, and creating a zip archive with these files.
 * It manages clean-up of temporary files at the end of the process.
 *
 * @example
 * ```bash
 * # Run with default bin directory
 * deno run --allow-read --allow-write --allow-env scripts/release.ts
 *
 * # Run with custom compile path
 * COMPILE_PATH=custom/path deno run --allow-read --allow-write --allow-env scripts/release.ts
 * ```
 *
 * @requires Permission --allow-read to read rule files
 * @requires Permission --allow-write to write output files
 * @requires Permission --allow-env to read COMPILE_PATH environment variable
 *
 * @throws {Error} If the COMPILE_PATH directory does not exist
 * @throws {Error} If any required file is missing from the COMPILE_PATH directory
 * @throws {Error} If rules.jsonc does not contain a valid array
 * @throws {Error} If any rule file specified in rules.jsonc is not found
 *
 * @note This script will overwrite existing .mdc files in the COMPILE_PATH directory
 * @note This script will overwrite an existing rules.zip file without confirmation
 *
 * @dependencies
 * - @std/path: For path manipulation
 * - @std/jsonc: For parsing rules.jsonc
 * - @std/fs: For file existence checks
 * - @zip-js/zip-js: For creating zip archives
 *
 * @see {@link https://jsr.io/@zip-js/zip-js@2.7.60/doc} Documentation for @zip-js/zip-js
 */

import { basename, join } from '@std/path'
import { parse } from '@std/jsonc'
import { exists } from '@std/fs'
import { BlobWriter, TextReader, ZipWriter } from '@zip-js/zip-js'

// Configuration constants
const RULES_PATH = join('.cursor', 'rules', 'global')
const COMPILE_PATH = Deno.env.get('COMPILE_PATH') || 'bin'
const REQUIRED_FILES = ['rules.html', 'rules.jsonc', 'rules.md']
const ZIP_FILENAME = 'rules.zip'

// Track created files for cleanup
const createdFiles: string[] = []
const filesToKeep: string[] = []

/**
 * Load and parse rules from rules.jsonc
 */
async function loadRules(): Promise<Array<{ rule: string }>> {
  const rulesJsoncPath = join(COMPILE_PATH, 'rules.jsonc')
  const rulesJsoncContent = await Deno.readTextFile(rulesJsoncPath)
  const rules = parse(rulesJsoncContent) as Array<{ rule: string }>

  if (!Array.isArray(rules)) {
    throw new Error('rules.jsonc must contain an array')
  }

  return rules
}

/**
 * Check if required files exist in the bin directory
 */
async function checkRequiredFiles() {
  const checkFile = async (file: string) => {
    const filePath = join(COMPILE_PATH, file)
    if (!await exists(filePath)) {
      throw new Error(`Required file '${file}' not found in bin directory`)
    }
  }

  await Promise.all(REQUIRED_FILES.map(checkFile))
}

/**
 * Copy rule files from RULES_PATH to bin directory
 */
async function copyRuleFiles(rules: Array<{ rule: string }>): Promise<string[]> {
  const copyRule = async (ruleObj: { rule: string }): Promise<string> => {
    if (typeof ruleObj.rule !== 'string') {
      throw new Error("Each rule object must have a 'rule' property with a string value")
    }

    const ruleName = ruleObj.rule
    const sourceFile = join(RULES_PATH, `${ruleName}.mdc`)
    const targetFile = join(COMPILE_PATH, `${ruleName}.mdc`)

    if (!await exists(sourceFile)) {
      throw new Error(`Rule file '${sourceFile}' not found`)
    }

    await Deno.copyFile(sourceFile, targetFile)
    createdFiles.push(targetFile)
    console.log(`Copied ${sourceFile} to ${targetFile}`)

    return targetFile
  }

  return await Promise.all(rules.map(copyRule))
}

/**
 * Create zip file containing the rule files and documentation files
 */
async function createZipFile(filePaths: string[]) {
  const zipWriter = new ZipWriter(new BlobWriter())

  const addFileToZip = async (filePath: string) => {
    const fileName = basename(filePath)
    const fileContent = await Deno.readTextFile(filePath)
    await zipWriter.add(fileName, new TextReader(fileContent))
  }

  // Add all rule .mdc files
  await Promise.all(filePaths.map(addFileToZip))

  // Add required documentation files
  for (const requiredFile of REQUIRED_FILES) {
    const filePath = join(COMPILE_PATH, requiredFile)
    await addFileToZip(filePath)
    console.log(`Added ${requiredFile} to zip file`)
  }

  const zipBlob = await zipWriter.close()
  const zipData = new Uint8Array(await zipBlob.arrayBuffer())

  const zipPath = join(COMPILE_PATH, ZIP_FILENAME)
  await Deno.writeFile(zipPath, zipData)
  createdFiles.push(zipPath)
  filesToKeep.push(zipPath)
}

/**
 * Clean up created files, optionally preserving the files in filesToKeep array
 *
 * @param keepSuccess - If true, only remove files not in filesToKeep array
 */
async function cleanup(keepSuccess = false) {
  console.log('Cleaning up temporary files...')

  const filesToRemove = keepSuccess
    ? createdFiles.filter((file) => !filesToKeep.includes(file))
    : createdFiles

  const removeFile = async (file: string) => {
    try {
      await Deno.remove(file)
      console.log(`Removed ${file}`)
    } catch (error: unknown) {
      console.error(
        `Failed to remove ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  await Promise.all(filesToRemove.map(removeFile))
}

/**
 * Main function to execute the release process
 */
async function main() {
  try {
    if (!await exists(COMPILE_PATH, { isDirectory: true })) {
      throw new Error(`'${COMPILE_PATH}' directory does not exist`)
    }

    await checkRequiredFiles()
    const rules = await loadRules()
    const ruleFiles = await copyRuleFiles(rules)
    await createZipFile(ruleFiles)

    console.log(`Successfully created ${join(COMPILE_PATH, ZIP_FILENAME)}`)

    // Clean up temporary files but keep the zip
    await cleanup(true)
  } catch (error: unknown) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
    await cleanup(false)
    Deno.exit(1)
  }
}

// Run the main function
if (import.meta.main) {
  await main()
}
