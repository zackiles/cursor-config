import { parse as parseYaml } from '@std/yaml'
import type { ParsedFrontmatter } from '../types.ts'

/**
 * Checks if a value is an empty object (but not an array)
 *
 * @param value - The value to check
 * @returns True if the value is an empty non-array object
 */
function isEmptyObject(value: unknown): boolean {
  return typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value as object).length === 0
}

/**
 * Normalizes empty values (empty string, empty object, undefined) to null
 * This ensures consistent handling of empty values throughout the codebase
 *
 * @param value - The value to normalize
 * @param fieldName - Optional field name for special handling
 * @returns null if the value is empty, otherwise the original value
 */
function normalizeEmptyValue(value: unknown, fieldName?: string): unknown {
  // Special handling for the description field - don't normalize if it has any value
  if (fieldName === 'description' && value !== undefined && value !== null) {
    return value
  }

  if (value === undefined || value === '') {
    return null
  }

  if (isEmptyObject(value)) {
    return null
  }

  return value
}

/**
 * Pre-processes YAML string to ensure consistent parsing of all fields
 *
 * This function handles various field-specific preprocessing tasks to ensure
 * that the YAML parser correctly interprets the frontmatter values:
 *
 * 1. Handles glob patterns in non-standard format
 * 2. Ensures description field is properly preserved
 * 3. Preserves boolean values like alwaysApply: false
 *
 * @param yaml - Raw YAML string to preprocess
 * @returns Processed YAML string ready for standard parsing
 */
function preprocessYaml(yaml: string): string {
  // Process the YAML line by line
  const lines = yaml.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Handle globs field
    if (trimmedLine.startsWith('globs:')) {
      const globsMatch = /^globs:\s*(.*)$/.exec(trimmedLine)

      if (globsMatch) {
        const globsValue = globsMatch[1].trim()

        // Only process non-empty values that aren't already in array format
        if (globsValue && !(globsValue.startsWith('[') && globsValue.endsWith(']'))) {
          // Split by comma and process
          const globArray = globsValue.split(',').map((g: string) => g.trim()).filter(Boolean)

          if (globArray.length >= 1) {
            if (globArray.length === 1) {
              // Single value, quote it
              lines[i] = `globs: "${globArray[0]}"`
            } else {
              // Multiple values, create proper array
              lines[i] = `globs: [${globArray.map((g: string) => `"${g}"`).join(', ')}]`
            }
          }
        }
      }
    }

    // Handle description field - ensure it's properly quoted if needed
    if (trimmedLine.startsWith('description:')) {
      const descMatch = /^description:\s*(.*)$/.exec(trimmedLine)

      if (descMatch) {
        const descValue = descMatch[1].trim()

        // If not empty and not already quoted, add quotes
        if (
          descValue && !((descValue.startsWith('"') && descValue.endsWith('"')) ||
            (descValue.startsWith("'") && descValue.endsWith("'")))
        ) {
          // Quote the description to ensure it's parsed as a string
          lines[i] = `description: "${descValue}"`
        }
      }
    }
  }

  return lines.join('\n')
}

/**
 * Parses the YAML frontmatter from an MDC file
 *
 * @param fileContent - The raw file content
 * @returns Object containing parsed frontmatter information or undefined if no frontmatter delimiters found
 */
export function parseFrontmatter(fileContent: string): {
  frontmatter: ParsedFrontmatter | null
  contentStartIndex: number
} | undefined {
  // A valid frontmatter block must start at the beginning of the file with '---'
  if (!fileContent.startsWith('---')) {
    return undefined
  }

  // Find the closing delimiter, starting from position 4 (after the opening '---' and newline)
  const endDelimiterIndex = fileContent.indexOf('\n---', 4)
  if (endDelimiterIndex === -1) {
    // No closing delimiter found
    return undefined
  }

  // Extract the raw YAML content between delimiters
  const rawFrontmatter = fileContent.substring(4, endDelimiterIndex).trim()

  // Calculate content start index (after the closing '---' and newline)
  const contentStartIndex = endDelimiterIndex + 4 // 4 = '\n---'.length

  // Count the number of lines before frontmatter
  const frontmatterStartLine = 1 // Always starts at line 1

  // Count lines in the frontmatter
  const frontmatterLines = rawFrontmatter.split('\n')
  const frontmatterEndLine = frontmatterStartLine + frontmatterLines.length + 1 // +1 for closing delimiter

  let parsedContent: Record<string, unknown> | null = null
  let parseError: Error | undefined = undefined

  try {
    // Pre-process the YAML to handle all fields correctly
    const processedYaml = preprocessYaml(rawFrontmatter)

    // Parse the processed YAML with the default schema
    parsedContent = parseYaml(processedYaml) as Record<string, unknown>

    // Ensure parsedContent is an object
    if (
      parsedContent === null || typeof parsedContent !== 'object' || Array.isArray(parsedContent)
    ) {
      parsedContent = {}
    }
  } catch (error) {
    parseError = error instanceof Error ? error : new Error(String(error))
    // Create an empty object if parsing failed
    parsedContent = {}
  }

  const frontmatter: ParsedFrontmatter = {
    raw: rawFrontmatter,
    parsed: parsedContent,
    parseError,
    startLine: frontmatterStartLine,
    endLine: frontmatterEndLine,
  }

  // Extract known frontmatter fields
  // Handle globs field, normalizing empty values to null
  if (parsedContent && 'globs' in parsedContent) {
    const globsValue = parsedContent.globs
    // Cast to appropriate type including null
    const normalizedValue = normalizeEmptyValue(globsValue)
    frontmatter.globs = normalizedValue === null ? null : normalizedValue as string | string[]
  }

  // Handle alwaysApply field - ensure we don't lose boolean false values
  if (parsedContent && 'alwaysApply' in parsedContent) {
    // The alwaysApply value might be a boolean or a string
    const alwaysApplyValue = parsedContent.alwaysApply

    // Convert to boolean if needed
    if (typeof alwaysApplyValue === 'string') {
      // Handle string values like 'true', 'false', 'yes', 'no'
      frontmatter.alwaysApply = /^(true|yes|1)$/i.test(alwaysApplyValue.trim())
    } else {
      // For boolean values, use as is
      frontmatter.alwaysApply = Boolean(alwaysApplyValue)
    }
  } else if (parsedContent) {
    // Check for alwaysApply in the raw string since YAML parsing might miss it
    const alwaysApplyMatch = rawFrontmatter.match(/alwaysApply:\s*(true|false|yes|no|1|0)/i)
    if (alwaysApplyMatch) {
      const value = alwaysApplyMatch[1].toLowerCase()
      frontmatter.alwaysApply = value === 'true' || value === 'yes' || value === '1'
    }
  }

  // Handle description field with special care
  if (parsedContent && 'description' in parsedContent) {
    // Extract description directly from raw YAML if it's not being correctly parsed
    const descriptionMatch = rawFrontmatter.match(/description:\s*([^\n]+)/)
    if (descriptionMatch?.[1]?.trim()) {
      // Use the raw value from the frontmatter
      frontmatter.description = descriptionMatch[1].trim()
    } else {
      // Fallback to the parsed value
      const descValue = parsedContent.description
      const normalizedValue = normalizeEmptyValue(descValue, 'description')
      frontmatter.description = normalizedValue === null ? null : normalizedValue as string
    }
  }

  return {
    frontmatter,
    contentStartIndex,
  }
}
