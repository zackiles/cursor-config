/** Represents the identified type of the Cursor rule based on frontmatter */
enum AttachmentType {
  AlwaysAttached = 'AlwaysAttached',
  AutoAttached = 'AutoAttached',
  AgentAttached = 'AgentAttached',
  ManuallyAttached = 'ManuallyAttached',
  Invalid = 'Invalid', // Combination of frontmatter fields is invalid
  Unknown = 'Unknown', // Parsing failed before type could be determined
}

/** Represents how a rule should be injected into the context */
enum AttachmentMethod {
  System = 'system',
  Message = 'message',
  Task = 'task',
  None = 'none',
}

/** Represents a specific header found in the Markdown content */
interface MarkdownHeader {
  text: string
  level: number
  line: number // 1-based line number in the original file
}

/** Represents a specific paragraph found in the Markdown content */
interface MarkdownParagraph {
  text: string
  line: number // 1-based line number where the paragraph starts
  /** Link to the header immediately preceding this paragraph, if any */
  afterHeader?: MarkdownHeader
}

/** Represents a specific code block found in the Markdown content */
interface MarkdownCodeBlock {
  text: string
  lang?: string
  line: number // 1-based line number where the code block starts
}

/** Structured representation of the parsed Markdown content */
interface ParsedMarkdownContent {
  raw: string
  ast?: unknown // Optional raw AST from the parser library
  headers: MarkdownHeader[]
  paragraphs: MarkdownParagraph[]
  codeBlocks: MarkdownCodeBlock[]
  startLine: number // 1-based line number where markdown content starts
  parseError?: Error
}

/** Structured representation of the parsed YAML Frontmatter */
interface ParsedFrontmatter {
  raw: string
  description?: string | null
  globs?: string | string[] | null
  tags?: string[] | null // Array of tags parsed from comma-separated string
  alwaysApply?: boolean
  category?: string | null
  attachmentMethod?: AttachmentMethod | null // How the rule should be injected into the context
  startLine: number // 1-based
  endLine: number // 1-based
  parseError?: Error
  // Add other properties that might be in the frontmatter YAML
  [key: string]: unknown
}

/** Represents the outcome of a single lint rule check */
interface LintResult {
  ruleId: string
  severity: 'error' | 'warning'
  passed: boolean
  message?: string
  /** Specific lines in the original file causing the failure */
  offendingLines?: { line: number; content: string }[]
  /** Specific property/value from RuleFileRaw causing failure */
  offendingValue?: { propertyPath: string; value: unknown }
  /** Optional secondary reason string */
  reason?: string
}

/** Interface for a lint rule definition */
interface LintRule {
  id: string // e.g., "frontmatter-missing-alwaysApply"
  severity: 'error' | 'warning'
  description: string
  /** The linting function itself */
  lint: (file: RuleFileRaw) => LintResult | Promise<LintResult>
}

/** Comprehensive object model for a parsed .mdc file */
interface RuleFileRaw {
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

/** Represents metadata about a rule used in the output rules.json file */
interface RuleFileSimple {
  /** Name of the rule derived from the filename */
  rule: string
  /** The attachment type of the rule */
  attachmentType: AttachmentType
  /** ISO date string of when the rule was first created (from git) */
  createdOn: string | null
  /** ISO date string of when the rule was last updated (from git) */
  updatedOn: string | null
  /** Optional category of the rule */
  category: string | null
  /** Optional description of the rule */
  description: string | null
  /** Optional glob patterns the rule applies to */
  globs: string | string[] | null
  /** Optional tags for categorizing the rule */
  tags: string[] | null
  /** Whether the rule should always be applied */
  alwaysApply: boolean | null
  /** How the rule should be injected into the context */
  attachmentMethod: AttachmentMethod | null
  /** Additional properties from frontmatter */
  [key: string]: unknown
}

// Export all types and interfaces
export { AttachmentMethod, AttachmentType }

export type {
  LintResult,
  LintRule,
  MarkdownCodeBlock,
  MarkdownHeader,
  MarkdownParagraph,
  ParsedFrontmatter,
  ParsedMarkdownContent,
  RuleFileRaw,
  RuleFileSimple,
}
