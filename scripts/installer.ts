#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run --allow-env

/**
 * @module installer
 *
 * A flexible pack/unpack utility for for files with built in multi-version tracking and change detection.
 * A mini-registry in a script. Works with local files and files hosted on GitHub.
 *
 * This module provides a command-line tool for archiving and extracting files
 * with intelligent version tracking and change detection. It creates flat tar archives
 * with comprehensive metadata tracking, ensuring efficient synchronization and
 * preventing unnecessary file overwrites during extraction.
 *
 * Key features:
 * - Content-based change detection using SHA-256/512 hashing
 * - Git integration for version tracking
 * - Smart extraction that only updates changed files
 * - Extensible hook system for custom processing
 * - Cross-platform path normalization
 * - Preserves original directory structure in metadata
 * - GitHub repository support for remote file packing
 * - Manifest registry for tracking changes across versions
 * - Automatic detection of new, modified, renamed, and removed files
 * - Deterministic manifest hashing for version comparison
 *
 * The tool is designed for scenarios where MDC content needs to be:
 * - Distributed as a single archive
 * - Synchronized between locations while preserving newer changes
 * - Tracked for version control purposes
 * - Processed with custom transformations via hooks
 * - Packaged directly from GitHub repositories without local cloning
 * - Monitored for changes between different versions
 *
 * ## Manifest Registry System
 *
 * The pack command maintains a manifest registry that tracks the complete history of packed
 * manifests. This registry enables:
 *
 * 1. **Change Detection**: Automatically identifies new, modified, renamed, and removed files
 *    by comparing against the previous manifest.
 *
 * 2. **Rename Detection**: Files with identical content hashes but different names are detected
 *    as renames, with warnings displayed during packing.
 *
 * 3. **Version History**: All manifests are stored with their unique hashes, creating a complete
 *    history of packed versions.
 *
 * 4. **Deterministic Hashing**: Each manifest receives a hash computed from its sorted file
 *    content hashes, ensuring consistent identification across runs.
 *
 * ## Smart Unpack File Selection Algorithm
 *
 * The unpack function uses a sophisticated algorithm to determine which files should be copied:
 *
 * 1. **Manifest Comparison**: When unpacking, the tool first checks for an existing manifest in the
 *    destination directory. If none exists, all files from the archive are extracted.
 *
 * 2. **File-by-File Decision**: For each file in the archive, the tool applies the following logic:
 *    - If the file doesn't exist in the destination, it's copied.
 *    - If the file exists but has a different content hash from the archived version, the tool
 *      proceeds to timestamp comparison.
 *    - If content hashes match exactly, the file is skipped (no changes needed).
 *
 * 3. **Timestamp Preservation**: For changed files, the tool compares modification times:
 *    - If the destination file is newer than the archived version, it's preserved (not overwritten).
 *    - If the archived file is newer, it replaces the destination file.
 *
 * 4. **Hook Integration**: Throughout this process, custom `beforeFileProcess` hooks can override
 *    decisions, allowing for custom logic (e.g., skipping certain file types).
 *
 * This approach ensures that:
 * - Local changes are never lost during synchronization
 * - Only truly changed files are updated
 * - Unnecessary writes are avoided for performance
 * - The manifest is always updated to reflect the current state
 *
 * @example Basic pack operation
 * ```ts
 * // Pack all .mdc files from a directory into a tar archive
 * // Run from command line:
 * ./scripts/installer.ts pack -i ./content -o ./backup.tar
 *
 * // Or programmatically:
 * import { pack } from "./installer.ts"
 *
 * await pack({
 *   inputDir: "./content",
 *   outputDir: "./backup.tar",
 *   filePattern: "&ast;&ast;/&ast;.mdc",
 *   manifestName: "packed-files.json",
 *   manifestRegistryName: "packed-files-registry.json",
 *   tempDirPrefix: "mdc-pack-",
 *   hashAlgorithm: "SHA-256"
 * })
 * ```
 *
 * @example Pack from GitHub repository
 * ```ts
 * // Pack files from entire GitHub repository
 * ./scripts/installer.ts pack -i https://github.com/owner/repo -o ./backup.tar
 *
 * // Pack files from specific branch and path
 * ./scripts/installer.ts pack -i https://github.com/owner/repo/tree/main/.cursor -o ./backup.tar
 *
 * // Or programmatically:
 * await pack({
 *   inputDir: "https://github.com/zackiles/cursor-config/tree/main/.cursor",
 *   outputDir: "./cursor-config.tar",
 *   filePattern: "&ast;&ast;/&ast;.{mdc,md,json,jsonc}",
 *   manifestName: "cursor-workbench.json",
 *   manifestRegistryName: "cursor-workbench-registry.json",
 *   tempDirPrefix: "mdc-pack-",
 *   hashAlgorithm: "SHA-256"
 * })
 * ```
 *
 * @example Smart unpack operation
 * ```ts
 * // Unpack only changed files from archive
 * // Run from command line:
 * ./scripts/installer.ts unpack -i ./backup.tar -o ./restored
 *
 * // Or programmatically:
 * import { unpack } from "./installer.ts"
 *
 * await unpack({
 *   inputDir: "./backup.tar",
 *   outputDir: "./restored",
 *   filePattern: "&ast;&ast;/&ast;.mdc",
 *   manifestName: "packed-files.json",
 *   manifestRegistryName: "packed-files-registry.json",
 *   tempDirPrefix: "mdc-pack-",
 *   hashAlgorithm: "SHA-256"
 * })
 * ```
 *
 * @example Using hooks for custom processing
 * ```ts
 * import { pack, hooks } from "./installer.ts"
 *
 * // Add custom validation before packing
 * hooks.beforeFileProcess = async (file, metadata) => {
 *   // Skip files larger than 1MB
 *   if (metadata.size && metadata.size > 1024 * 1024) {
 *     console.log(`Skipping large file: ${file}`)
 *     return false
 *   }
 *   return true
 * }
 *
 * // Log after successful pack
 * hooks.afterPack = async (config, manifest) => {
 *   console.log(`Packed ${manifest.files.length} files`)
 *   console.log(`Total size: ${manifest.files.reduce((sum, f) => sum + f.size, 0)} bytes`)
 *   console.log(`Manifest hash: ${manifest.manifestHash}`)
 *   if (manifest.changes) {
 *     console.log(`Changes: ${manifest.changes.new.length} new, ${manifest.changes.modified.length} modified`)
 *   }
 * }
 *
 * await pack({
 *   inputDir: "./content",
 *   outputDir: "./output.tar",
 *   filePattern: "&ast;&ast;/&ast;.mdc",
 *   manifestName: "packed-files.json",
 *   manifestRegistryName: "packed-files-registry.json",
 *   tempDirPrefix: "mdc-pack-",
 *   hashAlgorithm: "SHA-256"
 * })
 * ```
 *
 * @example Manifest structure
 * ```json
 * {
 *   "version": "1.0.0",
 *   "createdAt": "2024-01-15T10:30:00.000Z",
 *   "manifestHash": "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
 *   "files": [
 *     {
 *       "name": "readme.mdc",
 *       "archivedAt": "2024-01-15T10:30:00.000Z",
 *       "originalPath": "docs/readme.mdc",
 *       "contentHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
 *       "gitHash": "abc123def456",
 *       "mtime": "2024-01-14T08:00:00.000Z",
 *       "size": 2048
 *     }
 *   ],
 *   "changes": {
 *     "new": ["docs/readme.mdc"],
 *     "modified": [],
 *     "renamed": [],
 *     "removed": []
 *   }
 * }
 * ```
 *
 * @example Manifest Registry structure
 * ```json
 * {
 *   "createdAt": "2024-01-15T10:00:00.000Z",
 *   "updatedAt": "2024-01-15T10:30:00.000Z",
 *   "currentManifestHash": "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
 *   "source": "./content",
 *   "manifests": {
 *     "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730": {
 *       "version": "1.0.0",
 *       "createdAt": "2024-01-15T10:30:00.000Z",
 *       "manifestHash": "7d865e959b2466918c9863afca942d0fb89d7c9ac0c99bafc3749504ded97730",
 *       "files": [...],
 *       "changes": {...}
 *     }
 *   }
 * }
 * ```
 *
 * @see {@link Config} for configuration options
 * @see {@link Hooks} for available extension points
 * @see {@link PackedManifest} for manifest structure
 * @see {@link ManifestRegistryConfig} for manifest registry structure
 * @see {@link FileMetadata} for file metadata structure
 *
 * @since 1.0.0
 */

import { parseArgs } from '@std/cli/parse-args'
import { TarStream, type TarStreamInput, UntarStream } from '@std/tar'
import { stat } from '@std/fs/unstable-stat'
import { copy, ensureDir, expandGlob } from '@std/fs'
import { realPath } from '@std/fs/unstable-real-path'
import { basename, dirname, join, normalize, relative } from '@std/path'

const DEFAULT_CONFIG: Partial<Config> = {
  filePattern: '**/*.{mdc,md,ts,js,json,jsonc,html}',
  manifestName: 'cursor-workbench-manifest.json',
  manifestRegistryName: 'cursor-workbench-manifest-registry.json',
  tempDirPrefix: 'mdc-pack-',
  hashAlgorithm: 'SHA-256',
}

// Configuration and types
interface FileMetadata {
  name: string
  archivedAt: string
  originalPath: string
  contentHash: string
  gitHash?: string
  mtime?: string
  atime?: string
  birthtime?: string
  size: number
}

interface PackedManifest {
  version: string
  createdAt: string
  manifestHash: string
  files: FileMetadata[]
  changes?: {
    new: string[]
    modified: string[]
    renamed: Array<{ from: string; to: string; hash: string }>
    removed: string[]
  }
}

interface ManifestRegistryConfig {
  createdAt: string
  updatedAt: string
  currentManifestHash: string
  source: string
  manifests: Record<string, PackedManifest>
}

interface Config {
  inputDir: string
  outputDir: string
  filePattern: string
  manifestName: string
  manifestRegistryName: string
  tempDirPrefix: string
  hashAlgorithm: 'SHA-256' | 'SHA-512'
}

// GitHub URL handling
interface GitHubUrlInfo {
  owner: string
  repo: string
  ref: string
  path: string
  cloneUrl: string
}

function isGitHubUrl(url: string): boolean {
  return url.startsWith('https://github.com/') || url.startsWith('http://github.com/')
}

function parseGitHubUrl(url: string): GitHubUrlInfo {
  const urlObj = new URL(url)
  const pathParts = urlObj.pathname.split('/').filter(Boolean)

  if (pathParts.length < 2) {
    throw new Error('Invalid GitHub URL: must include owner and repository')
  }

  const owner = pathParts[0]
  const repo = pathParts[1]

  let ref = 'main'
  let path = ''

  if (pathParts.length > 2) {
    if (pathParts[2] === 'tree' && pathParts.length > 3) {
      ref = pathParts[3]
      if (pathParts.length > 4) {
        path = pathParts.slice(4).join('/')
      }
    }
  }

  return {
    owner,
    repo,
    ref,
    path,
    cloneUrl: `https://github.com/${owner}/${repo}.git`,
  }
}

async function cloneGitHubRepo(urlInfo: GitHubUrlInfo, tempDir: string): Promise<string> {
  const repoDir = join(tempDir, urlInfo.repo)

  console.log(`📡 Cloning ${urlInfo.owner}/${urlInfo.repo}@${urlInfo.ref}...`)

  const command = new Deno.Command('git', {
    args: ['clone', '--depth', '1', '--branch', urlInfo.ref, urlInfo.cloneUrl, repoDir],
    stdout: 'piped',
    stderr: 'piped',
  })

  const { success, stderr } = await command.output()

  if (!success) {
    const errorText = new TextDecoder().decode(stderr)
    throw new Error(`Failed to clone repository: ${errorText}`)
  }

  const targetDir = urlInfo.path ? join(repoDir, urlInfo.path) : repoDir

  // Verify the target directory exists
  try {
    await stat(targetDir)
  } catch {
    throw new Error(
      `Path "${urlInfo.path}" not found in repository ${urlInfo.owner}/${urlInfo.repo}`,
    )
  }

  console.log(`✅ Successfully cloned to ${targetDir}`)
  return targetDir
}

// Pipeline hooks
interface Hooks {
  beforePack?: (config: Config) => Promise<void>
  afterPack?: (config: Config, manifest: PackedManifest) => Promise<void>
  beforeUnpack?: (config: Config) => Promise<void>
  afterUnpack?: (config: Config, manifest: PackedManifest) => Promise<void>
  beforeFileProcess?: (file: string, metadata: Partial<FileMetadata>) => Promise<boolean>
  afterFileProcess?: (file: string, metadata: FileMetadata) => Promise<void>
}

const hooks: Hooks = {}

// Utility functions
async function getGitHash(filePath: string): Promise<string | undefined> {
  try {
    const command = new Deno.Command('git', {
      args: ['rev-parse', 'HEAD'],
      cwd: dirname(filePath),
      stdout: 'piped',
      stderr: 'null',
    })
    const { stdout, success } = await command.output()
    if (!success) return undefined
    return new TextDecoder().decode(stdout).trim()
  } catch {
    return undefined
  }
}

async function computeFileHash(
  filePath: string,
  algorithm: Config['hashAlgorithm'],
): Promise<string> {
  const content = await Deno.readFile(filePath)
  const hash = await crypto.subtle.digest(algorithm, content)
  const hashArray = Array.from(new Uint8Array(hash))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function computeManifestHash(
  files: FileMetadata[],
  algorithm: Config['hashAlgorithm'],
): Promise<string> {
  // Sort files by originalPath for deterministic hash
  const sortedFiles = [...files].sort((a, b) => a.originalPath.localeCompare(b.originalPath))

  // Create a string from all content hashes
  const hashString = sortedFiles
    .map((f) => f.contentHash)
    .join('')

  // Compute hash of the combined hashes
  const encoder = new TextEncoder()
  const data = encoder.encode(hashString)
  const hash = await crypto.subtle.digest(algorithm, data)
  const hashArray = Array.from(new Uint8Array(hash))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function createFileMetadata(
  filePath: string,
  baseDir: string,
  config: Config,
): Promise<FileMetadata> {
  const fileInfo = await stat(filePath)
  const contentHash = await computeFileHash(filePath, config.hashAlgorithm)
  const gitHash = await getGitHash(filePath)
  const relativePath = relative(baseDir, filePath)

  return {
    name: basename(relativePath),
    archivedAt: new Date().toISOString(),
    originalPath: relativePath,
    contentHash,
    gitHash,
    mtime: fileInfo.mtime?.toISOString(),
    atime: fileInfo.atime?.toISOString(),
    birthtime: fileInfo.birthtime?.toISOString(),
    size: fileInfo.size,
  }
}

async function shouldCopyFile(
  existingManifest: PackedManifest | null,
  newFile: FileMetadata,
  targetPath: string,
): Promise<boolean> {
  // If no existing manifest, copy all files
  if (!existingManifest) return true

  // Check if file exists in manifest
  const existingFile = existingManifest.files.find(
    (f) => f.originalPath === newFile.originalPath,
  )

  if (!existingFile) return true

  // Check if target file exists
  try {
    const targetInfo = await stat(targetPath)

    // If content hash matches, skip
    if (existingFile.contentHash === newFile.contentHash) return false

    // If target is newer than archived version, skip
    if (targetInfo.mtime && newFile.mtime) {
      const targetTime = targetInfo.mtime.getTime()
      const archiveTime = new Date(newFile.mtime).getTime()
      if (targetTime > archiveTime) return false
    }

    return true
  } catch {
    // File doesn't exist, should copy
    return true
  }
}

// Main functions
async function pack(config: Config): Promise<void> {
  let inputDir: string
  let gitTempDir: string | null = null

  // Handle GitHub URLs or local paths
  if (isGitHubUrl(config.inputDir)) {
    gitTempDir = await Deno.makeTempDir({ prefix: 'git-clone-' })
    try {
      const urlInfo = parseGitHubUrl(config.inputDir)
      inputDir = await cloneGitHubRepo(urlInfo, gitTempDir)
    } catch (error) {
      await Deno.remove(gitTempDir, { recursive: true })
      throw error
    }
  } else {
    inputDir = await realPath(config.inputDir)
  }

  const outputDir = await realPath(dirname(config.outputDir))
  const outputFileName = basename(config.outputDir)
  const outputFile = join(outputDir, outputFileName)

  // Create temp directory
  const tempDir = await Deno.makeTempDir({ prefix: config.tempDirPrefix })

  try {
    await hooks.beforePack?.(config)

    // Load existing manifest registry if it exists
    let manifestRegistry: ManifestRegistryConfig | null = null
    let previousManifest: PackedManifest | null = null
    const registryPath = join(inputDir, config.manifestRegistryName)

    try {
      const registryContent = await Deno.readTextFile(registryPath)
      manifestRegistry = JSON.parse(registryContent)
      if (
        manifestRegistry?.currentManifestHash &&
        manifestRegistry.manifests[manifestRegistry.currentManifestHash]
      ) {
        previousManifest = manifestRegistry.manifests[manifestRegistry.currentManifestHash]
      }
    } catch {
      // No existing manifest registry
    }

    // Find all matching files
    const files: FileMetadata[] = []
    const tarEntries: TarStreamInput[] = []
    const fileHashMap = new Map<string, string>() // contentHash -> originalPath
    const currentFiles = new Set<string>() // originalPath

    for await (const entry of expandGlob(config.filePattern, { root: inputDir })) {
      if (!entry.isFile) continue

      const metadata = await createFileMetadata(entry.path, inputDir, config)

      const shouldProcess = await hooks.beforeFileProcess?.(entry.path, metadata)
      if (shouldProcess === false) continue

      files.push(metadata)
      fileHashMap.set(metadata.contentHash, metadata.originalPath)
      currentFiles.add(metadata.originalPath)

      // Open file for streaming
      const file = await Deno.open(entry.path, { read: true })
      tarEntries.push({
        type: 'file',
        path: metadata.name,
        size: metadata.size,
        readable: file.readable,
      })

      await hooks.afterFileProcess?.(entry.path, metadata)
    }

    // Track changes
    const changes: PackedManifest['changes'] = {
      new: [],
      modified: [],
      renamed: [],
      removed: [],
    }

    if (previousManifest) {
      const previousFileMap = new Map<string, FileMetadata>()
      const previousHashMap = new Map<string, string>()

      for (const file of previousManifest.files) {
        previousFileMap.set(file.originalPath, file)
        previousHashMap.set(file.contentHash, file.originalPath)
      }

      // Check for new, modified, and renamed files
      for (const file of files) {
        const previousFile = previousFileMap.get(file.originalPath)

        if (!previousFile) {
          // Check if it's a renamed file (same hash, different name)
          const previousPath = previousHashMap.get(file.contentHash)
          if (previousPath && previousPath !== file.originalPath) {
            console.warn(
              `⚠️  Warning: the file being packed named '${file.originalPath}' has the same hash as '${previousPath}' from the previous manifest ${manifestRegistry?.currentManifestHash}. File being packed.`,
            )
            changes.renamed.push({
              from: previousPath,
              to: file.originalPath,
              hash: file.contentHash,
            })
          } else {
            changes.new.push(file.originalPath)
          }
        } else if (previousFile.contentHash !== file.contentHash) {
          changes.modified.push(file.originalPath)
        }
      }

      // Check for removed files
      for (const [path, file] of previousFileMap) {
        if (!currentFiles.has(path)) {
          changes.removed.push(path)
        }
      }
    } else {
      // No previous manifest, all files are new
      changes.new = files.map((f) => f.originalPath)
    }

    // Compute manifest hash
    const manifestHash = await computeManifestHash(files, config.hashAlgorithm)

    // Create manifest
    const manifest: PackedManifest = {
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      manifestHash,
      files,
      changes,
    }

    // Update or create manifest registry
    const now = new Date().toISOString()
    if (!manifestRegistry) {
      manifestRegistry = {
        createdAt: now,
        updatedAt: now,
        currentManifestHash: manifestHash,
        source: config.inputDir,
        manifests: {
          [manifestHash]: manifest,
        },
      }
    } else {
      manifestRegistry.updatedAt = now
      manifestRegistry.currentManifestHash = manifestHash
      manifestRegistry.manifests[manifestHash] = manifest
    }

    // Add manifest to tar
    const manifestContent = new TextEncoder().encode(
      JSON.stringify(manifest, null, 2),
    )
    tarEntries.push({
      type: 'file',
      path: config.manifestName,
      size: manifestContent.byteLength,
      readable: new Blob([manifestContent]).stream(),
    })

    // Add manifest registry to tar
    const registryContent = new TextEncoder().encode(
      JSON.stringify(manifestRegistry, null, 2),
    )
    tarEntries.push({
      type: 'file',
      path: config.manifestRegistryName,
      size: registryContent.byteLength,
      readable: new Blob([registryContent]).stream(),
    })

    // Create tar archive
    const tarPath = join(tempDir, 'archive.tar')
    const tarFile = await Deno.open(tarPath, { write: true, create: true })

    try {
      const tarStream = new TarStream()
      const writableStream = tarFile.writable

      // Stream files to tar
      const readable = ReadableStream.from(tarEntries).pipeThrough(tarStream)
      await readable.pipeTo(writableStream)
    } finally {
      // TODO: I think there is a bug here. Apparently the file is already closed here.
      //tarFile.close()
    }

    // Copy to output
    await ensureDir(dirname(outputFile))
    await copy(tarPath, outputFile, { overwrite: true })

    // Save manifest registry to input directory (if not a GitHub URL)
    if (!isGitHubUrl(config.inputDir)) {
      await Deno.writeTextFile(registryPath, JSON.stringify(manifestRegistry, null, 2))
    }

    await hooks.afterPack?.(config, manifest)

    console.log(`✅ Packed ${files.length} files to ${outputFile}`)
    if (changes.new.length > 0) console.log(`  📄 New files: ${changes.new.length}`)
    if (changes.modified.length > 0) console.log(`  ✏️  Modified files: ${changes.modified.length}`)
    if (changes.renamed.length > 0) console.log(`  🔄 Renamed files: ${changes.renamed.length}`)
    if (changes.removed.length > 0) console.log(`  🗑️  Removed files: ${changes.removed.length}`)
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true })
    if (gitTempDir) {
      await Deno.remove(gitTempDir, { recursive: true })
    }
  }
}

async function unpack(config: Config): Promise<void> {
  // Resolve paths
  const inputFile = await realPath(config.inputDir)
  const outputDir = normalize(config.outputDir)

  // Create temp directory
  const tempDir = await Deno.makeTempDir({ prefix: config.tempDirPrefix })

  try {
    await hooks.beforeUnpack?.(config)

    // Check for existing manifest
    const existingManifestPath = join(outputDir, config.manifestName)
    let existingManifest: PackedManifest | null = null

    try {
      const manifestContent = await Deno.readTextFile(existingManifestPath)
      existingManifest = JSON.parse(manifestContent)
    } catch {
      // No existing manifest
    }

    // Extract tar to temp directory
    const tarFile = await Deno.open(inputFile, { read: true })
    const extracted = new Map<string, Uint8Array>()

    try {
      const untarStream = new UntarStream()

      for await (const entry of tarFile.readable.pipeThrough(untarStream)) {
        if (!entry.readable) {
          console.warn(`⚠️  Entry ${entry.path} has no readable stream`)
          continue
        }

        const chunks: Uint8Array[] = []
        for await (const chunk of entry.readable) {
          chunks.push(new Uint8Array(chunk))
        }
        const content = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0))
        let offset = 0
        for (const chunk of chunks) {
          content.set(chunk, offset)
          offset += chunk.length
        }
        extracted.set(entry.path, content)
      }
    } finally {
      // TODO: I think there is a bug here. Apparently the file is already closed here.
      //tarFile.close()
    }

    // Parse manifest from extracted files
    const manifestContent = extracted.get(config.manifestName)
    if (!manifestContent) {
      throw new Error('No manifest found in archive')
    }

    const manifest: PackedManifest = JSON.parse(new TextDecoder().decode(manifestContent))

    // Parse manifest registry from extracted files (if it exists)
    const registryContent = extracted.get(config.manifestRegistryName)
    let manifestRegistry: ManifestRegistryConfig | null = null
    if (registryContent) {
      manifestRegistry = JSON.parse(new TextDecoder().decode(registryContent))
    }

    // Process files
    let copiedCount = 0

    for (const fileMetadata of manifest.files) {
      const content = extracted.get(fileMetadata.name)
      if (!content) continue

      const targetPath = join(outputDir, fileMetadata.originalPath)

      const shouldCopy = await shouldCopyFile(existingManifest, fileMetadata, targetPath)
      if (!shouldCopy) {
        console.log(`⏭️  Skipping ${fileMetadata.originalPath} (unchanged or newer)`)
        continue
      }

      const shouldProcess = await hooks.beforeFileProcess?.(targetPath, fileMetadata)
      if (shouldProcess === false) continue

      // Ensure directory exists
      await ensureDir(dirname(targetPath))

      // Write file
      await Deno.writeFile(targetPath, content)
      copiedCount++

      await hooks.afterFileProcess?.(targetPath, fileMetadata)

      console.log(`📄 Unpacked ${fileMetadata.originalPath}`)
    }

    // Update manifest
    await Deno.writeTextFile(existingManifestPath, JSON.stringify(manifest, null, 2))

    // Update manifest registry if it was in the archive
    if (manifestRegistry) {
      const registryPath = join(outputDir, config.manifestRegistryName)
      await Deno.writeTextFile(registryPath, JSON.stringify(manifestRegistry, null, 2))
    }

    await hooks.afterUnpack?.(config, manifest)

    console.log(`✅ Unpacked ${copiedCount} files to ${outputDir}`)
  } finally {
    // Cleanup
    await Deno.remove(tempDir, { recursive: true })
  }
}

function showHelp(): void {
  console.log(`
MDC Pack/Unpack Tool

Usage:
  installer.ts <command> [options]

Commands:
  pack      Pack .mdc files from a directory or GitHub repository into a tar archive
  unpack    Unpack .mdc files from a tar archive to a directory
  help      Show this help message

Options:
  -i, --input   Input directory, GitHub URL (for pack) or tar file (for unpack)
  -o, --output  Output tar file (for pack) or directory (for unpack)

Examples:
  # Pack files from local directory
  ./installer.ts pack -i ./source -o ./output/archive.tar
  
  # Pack files from GitHub repository (entire repo)
  ./installer.ts pack -i https://github.com/owner/repo -o ./output/archive.tar
  
  # Pack files from specific branch and path in GitHub repository
  ./installer.ts pack -i https://github.com/owner/repo/tree/main/src -o ./output/archive.tar
  
  # Unpack files
  ./installer.ts unpack -i ./archive.tar -o ./destination
`)
}

// Main execution
async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    string: ['input', 'output'],
    alias: {
      i: 'input',
      o: 'output',
    },
  })

  const command = args._[0]?.toString()

  if (!command || command === 'help') {
    showHelp()
    Deno.exit(0)
  }

  if (!args.input || !args.output) {
    console.error('❌ Error: Both --input and --output are required')
    showHelp()
    Deno.exit(1)
  }

  const config: Config = {
    ...DEFAULT_CONFIG,
    inputDir: args.input,
    outputDir: args.output,
  } as Config

  try {
    switch (command) {
      case 'pack':
        await pack(config)
        break
      case 'unpack':
        await unpack(config)
        break
      default:
        console.error(`❌ Error: Unknown command '${command}'`)
        showHelp()
        Deno.exit(1)
    }
  } catch (error) {
    console.error(
      `❌ Error: ${error instanceof Error ? error.stack || error.message : String(error)}`,
    )
    Deno.exit(1)
  }
}

if (import.meta.main) {
  await main()
}

export {
  type Config,
  type FileMetadata,
  type GitHubUrlInfo,
  type Hooks,
  hooks,
  isGitHubUrl,
  type ManifestRegistryConfig,
  pack,
  type PackedManifest,
  parseGitHubUrl,
  unpack,
}
