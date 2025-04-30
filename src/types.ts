/** Represents the identified type of the Cursor rule based on frontmatter */
export enum AttachmentType {
  AlwaysAttached = 'AlwaysAttached',
  AutoAttached = 'AutoAttached',
  AgentAttached = 'AgentAttached',
  ManuallyAttached = 'ManuallyAttached',
  Invalid = 'Invalid', // Combination of frontmatter fields is invalid
  Unknown = 'Unknown', // Parsing failed before type could be determined
}

/** Represents a specific header found in the Markdown content */
export interface MarkdownHeader {
  text: string
  level: number
  line: number // 1-based line number in the original file
}

/** Represents a specific paragraph found in the Markdown content */
export interface MarkdownParagraph {
  text: string
  line: number // 1-based line number where the paragraph starts
  /** Link to the header immediately preceding this paragraph, if any */
  afterHeader?: MarkdownHeader
}

/** Represents a specific code block found in the Markdown content */
export interface MarkdownCodeBlock {
  text: string
  lang?: string
  line: number // 1-based line number where the code block starts
}

/** Structured representation of the parsed Markdown content */
export interface ParsedMarkdownContent {
  raw: string
  ast?: unknown // Optional raw AST from the parser library
  headers: MarkdownHeader[]
  paragraphs: MarkdownParagraph[]
  codeBlocks: MarkdownCodeBlock[]
  startLine: number // 1-based line number where markdown content starts
  parseError?: Error
}

/** Structured representation of the parsed YAML Frontmatter */
export interface ParsedFrontmatter {
  raw: string
  parsed: Record<string, unknown> | null // Null if YAML parsing failed
  globs?: string | string[] | null
  alwaysApply?: boolean
  description?: string | null
  category?: string | null
  startLine: number // 1-based
  endLine: number // 1-based
  parseError?: Error
}

/** Comprehensive object model for a parsed .mdc file */
export interface MdcFile {
  filePath: string
  rawContent: string
  rawLines: string[] // Useful for reporting line-specific issues
  fileReadError?: Error // Error during initial Deno.readTextFile
  frontmatter?: ParsedFrontmatter
  markdownContent?: ParsedMarkdownContent
  /** The derived attachment type based on frontmatter content */
  derivedAttachmentType?: AttachmentType
  /** General parsing error not specific to frontmatter/markdown */
  parseError?: Error
}

/** Represents the outcome of a single lint rule check */
export interface LintResult {
  ruleId: string
  severity: 'error' | 'warning'
  passed: boolean
  message?: string
  /** Specific lines in the original file causing the failure */
  offendingLines?: { line: number; content: string }[]
  /** Specific property/value from MdcFile causing failure */
  offendingValue?: { propertyPath: string; value: unknown }
  /** Optional secondary reason string */
  reason?: string
}

/** Interface for a lint rule definition */
export interface LintRule {
  id: string // e.g., "frontmatter-missing-alwaysApply"
  severity: 'error' | 'warning'
  description: string
  /** The linting function itself */
  lint: (file: MdcFile) => LintResult | Promise<LintResult>
}
