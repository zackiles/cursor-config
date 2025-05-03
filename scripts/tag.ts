#!/usr/bin/env -S deno run --allow-run=git --allow-read --allow-write --allow-net --allow-env

/**
 * @module scripts/tag
 *
 * Automates the release tagging process following semantic versioning.
 * Handles validation, git operations, and ensures proper tag sequencing.
 *
 * @example
 * ```bash
 * deno task tag v1.2.3
 * ```
 */

import { parseArgs } from '@std/cli'
import * as semver from '@std/semver'

type CommandResult = {
  stdout: string
  stderr: string
  success: boolean
}

type TagContext = {
  tag: string
  latestTag?: string | undefined
}

class TagError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TagError'
  }
}

// Git operations encapsulated in a client class
class GitClient {
  private decoder = new TextDecoder()

  async execute(args: string[]): Promise<CommandResult> {
    const command = new Deno.Command('git', {
      args,
      stdout: 'piped',
      stderr: 'piped',
    })

    const { stdout, stderr, success } = await command.output()

    return {
      stdout: this.decoder.decode(stdout),
      stderr: this.decoder.decode(stderr),
      success,
    }
  }

  // Repository status operations
  async getStatus(): Promise<string> {
    const result = await this.execute(['status', '--porcelain'])
    if (!result.success) throw new TagError('Failed to check git status')
    return result.stdout.trim()
  }

  async stageChanges(): Promise<void> {
    const result = await this.execute(['add', '.'])
    if (!result.success) throw new TagError(`Failed to stage changes: ${result.stderr}`)
  }

  async commitChanges(message: string): Promise<void> {
    const result = await this.execute(['commit', '-m', message])
    if (!result.success) throw new TagError(`Failed to commit changes: ${result.stderr}`)
  }

  // Remote operations
  async syncWithRemote(): Promise<void> {
    const result = await this.execute(['pull', '--rebase', 'origin', 'main'])

    if (!result.success) {
      const message = result.stderr.includes('CONFLICT')
        ? 'Merge conflicts detected. Resolve manually and retry.'
        : `Failed to sync with remote: ${result.stderr}`

      throw new TagError(message)
    }
  }

  async pushToMain(): Promise<boolean> {
    const result = await this.execute(['push', 'origin', 'main'])
    return result.success
  }

  // Tag operations
  async fetchTags(): Promise<void> {
    await this.execute(['fetch', '--tags'])
  }

  async getLatestTag(): Promise<string | undefined> {
    const result = await this.execute(['describe', '--tags', '--abbrev=0'])
    return result.success ? result.stdout.trim() : undefined
  }

  async checkLocalTag(tag: string): Promise<boolean> {
    const result = await this.execute(['tag', '-l', tag])
    if (!result.success) throw new TagError('Failed to check local tags')
    return result.stdout.trim() === tag
  }

  async checkRemoteTag(tag: string): Promise<boolean> {
    const result = await this.execute([
      'ls-remote',
      '--exit-code',
      '--tags',
      'origin',
      `refs/tags/${tag}`,
    ])
    return result.success
  }

  async deleteLocalTag(tag: string): Promise<void> {
    const result = await this.execute(['tag', '-d', tag])
    if (!result.success) throw new TagError(`Failed to delete local tag: ${result.stderr}`)
  }

  async deleteRemoteTag(tag: string): Promise<boolean> {
    const result = await this.execute(['push', '--delete', 'origin', tag])
    return result.success
  }

  async createTag(tag: string): Promise<void> {
    const result = await this.execute(['tag', tag])
    if (!result.success) throw new TagError(`Failed to create tag: ${result.stderr}`)
  }

  async pushTag(tag: string): Promise<void> {
    const result = await this.execute(['push', 'origin', tag])
    if (!result.success) throw new TagError(`Failed to push tag: ${result.stderr}`)
  }
}

// Validation helper functions
const validateTagFormat = (tag: string): void => {
  if (!tag.startsWith('v') || !semver.canParse(tag.substring(1))) {
    throw new TagError(
      `Invalid tag format '${tag}'. Tag must start with 'v' and follow SemVer (e.g., v1.0.0).`,
    )
  }
}

const validateSemVerIncrement = ({ tag, latestTag }: TagContext): void => {
  if (!latestTag) return

  if (!latestTag.startsWith('v') || !semver.canParse(latestTag.substring(1))) {
    console.warn(`⚠️ Could not parse latest tag '${latestTag}' as SemVer. Proceeding with caution.`)
    return
  }

  const targetVersion = tag.substring(1)
  const latestVersion = latestTag.substring(1)

  const targetSemVer = semver.parse(targetVersion)
  const latestSemVer = semver.parse(latestVersion)

  if (!targetSemVer || !latestSemVer) {
    throw new TagError('Could not parse one of the tags as SemVer.')
  }

  const comparison = semver.compare(targetSemVer, latestSemVer)

  if (comparison < 0) {
    throw new TagError(`Target tag '${tag}' is older than the latest tag '${latestTag}'.`)
  }

  if (comparison === 0 && tag !== latestTag) {
    throw new TagError(
      `Target tag '${tag}' seems equal but not identical to latest tag '${latestTag}'.`,
    )
  }
}

const isValidCommitMessage = (message: string): boolean => {
  const commitRegex = /^(feat|fix|chore|ci|docs|style|refactor|perf|test)(\(.+\))?!?: .+$/
  return commitRegex.test(message.trim())
}

// User interface helpers
const promptUser = async (promptText: string, defaultValue?: string): Promise<string> => {
  if (defaultValue) {
    console.log(`${promptText} (Default: "${defaultValue}", press Enter to use default)`)
  } else {
    console.log(promptText)
  }

  const inputBuffer = new Uint8Array(1024)
  const bytesRead = await Deno.stdin.read(inputBuffer)

  const input = bytesRead === null
    ? ''
    : new TextDecoder().decode(inputBuffer.subarray(0, bytesRead)).trim()

  return input || defaultValue || ''
}

const log = {
  info: (message: string): void => console.log(message),
  success: (message: string): void => console.log(`✅ ${message}`),
  warning: (message: string): void => console.warn(`⚠️ ${message}`),
  error: (message: string): void => console.error(`❌ Error: ${message}`),
  process: (message: string): void => console.log(`🔄 ${message}`),
  tag: (message: string): void => console.log(`🏷️ ${message}`),
  delete: (message: string): void => console.log(`🗑️  ${message}`),
  push: (message: string): void => console.log(`⏫ ${message}`),
  create: (message: string): void => console.log(`➕ ${message}`),
  complete: (message: string): void => console.log(`🎉 ${message}`),
}

// Workflow steps
const processWorkingDirectory = async (git: GitClient, tagValue: string): Promise<boolean> => {
  log.process('Checking git status...')
  const status = await git.getStatus()

  if (status === '') {
    log.success('Working directory is clean.')
    return false
  }

  log.warning('Working directory is not clean. Staging changes...')
  await git.stageChanges()
  log.success('Changes staged.')

  const defaultMessage = `chore: tag version ${tagValue}`
  let commitMessage = ''

  while (true) {
    commitMessage = await promptUser(
      'Enter commit message:',
      defaultMessage,
    )

    if (isValidCommitMessage(commitMessage)) break

    log.warning(
      'Invalid commit message format. Please use conventional commit format (e.g., type: subject).',
    )
  }

  log.info(`📝 Committing changes with message: "${commitMessage}"`)
  await git.commitChanges(commitMessage)
  log.success('Changes committed.')

  return true
}

const syncWithRemoteMain = async (git: GitClient): Promise<void> => {
  log.process('Syncing with remote main branch (pull --rebase)...')
  await git.syncWithRemote()
  log.success('Successfully synced with remote main.')
}

const pushChangesToRemote = async (git: GitClient): Promise<void> => {
  // Always push to ensure we're in sync
  log.push('Pushing changes to remote main...')
  const success = await git.pushToMain()
  if (success) {
    log.success('Changes pushed to remote main.')
  } else {
    log.warning('Failed to push to remote main. Continuing with tagging...')
  }
}

const fetchAndValidateExistingTags = async (
  git: GitClient,
  tag: string,
): Promise<TagContext> => {
  log.process('Checking existing tags...')
  await git.fetchTags()
  const latestTag = await git.getLatestTag()

  const context = { tag, latestTag }

  if (latestTag) {
    log.info(`ℹ️ Latest existing tag found: ${latestTag}`)
    validateSemVerIncrement(context)

    const targetSemVer = semver.parse(tag.substring(1))
    const latestSemVer = semver.parse(latestTag.substring(1))

    if (targetSemVer && latestSemVer) {
      const comparison = semver.compare(targetSemVer, latestSemVer)

      if (comparison === 0) {
        log.info(`ℹ️ Target tag '${tag}' matches the latest tag. Will overwrite.`)
      } else {
        log.success(`Target tag '${tag}' is newer than latest tag '${latestTag}'.`)
      }
    }
  } else {
    log.info('ℹ️ No previous tags found. Creating new tag.')
  }

  return context
}

const createAndPushTag = async (git: GitClient, tag: string): Promise<void> => {
  // Handle local tag
  const localTagExists = await git.checkLocalTag(tag)

  if (localTagExists) {
    log.delete(`Deleting existing local tag '${tag}'...`)
    await git.deleteLocalTag(tag)
  }

  log.create(`Creating local tag '${tag}'...`)
  await git.createTag(tag)
  log.success(`Local tag '${tag}' created.`)

  // Handle remote tag
  log.process(`Checking remote tag '${tag}'...`)
  const remoteTagExists = await git.checkRemoteTag(tag)

  if (remoteTagExists) {
    log.delete(`Deleting existing remote tag '${tag}'...`)
    await git.deleteRemoteTag(tag)
  } else {
    log.info(`ℹ️ Remote tag '${tag}' does not exist.`)
  }

  log.push(`Pushing tag '${tag}' to remote...`)
  await git.pushTag(tag)
  log.success(`Tag '${tag}' successfully pushed to remote.`)
}

// Main script execution pipeline
const createTag = async (tagValue: string): Promise<void> => {
  log.tag(`Validating tag format for '${tagValue}'...`)
  validateTagFormat(tagValue)
  log.success('Tag format is valid.')

  const git = new GitClient()

  // Process workflow in sequence
  const _hasChanges = await processWorkingDirectory(git, tagValue)
  await syncWithRemoteMain(git)
  await pushChangesToRemote(git)
  await fetchAndValidateExistingTags(git, tagValue)
  await createAndPushTag(git, tagValue)

  log.complete('Tagging process complete!')
}

// Script entry point
const main = async (): Promise<void> => {
  try {
    // Parse command line arguments
    const { _ } = parseArgs(Deno.args, { string: ['_'] })
    const targetTag = _[0] as string | undefined

    if (!targetTag) {
      log.error('Missing tag argument.')
      log.info('Usage: deno run -A scripts/tag.ts vX.Y.Z')
      Deno.exit(1)
    }

    await createTag(targetTag)
  } catch (error: unknown) {
    if (error instanceof TagError) {
      log.error(error.message)
    } else if (error instanceof Error) {
      log.error(`Unexpected error: ${error.message}`)
    } else {
      log.error('Unknown error occurred')
    }
    Deno.exit(1)
  }
}

await main()
