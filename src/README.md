# Cursor Rule Linter & Toolkit

This Deno-based package provides tools for linting, parsing, and programmatically working with Cursor Rule (`.mdc`) files. It includes a CLI for linting files against a set of predefined rules and can also be used as a library in other Deno projects.

## Purpose

The primary goal of this package is to ensure the quality, consistency, effectiveness and validity of `.mdc` files (and prompts within) used within the Cursor ecosystem. It helps enforce best practices, detect common errors in rule definitions, and act as a general workbench for programmatically managing rules.

## High-Level Usage & Features

### Command-Line Interface (CLI)

The package includes a CLI tool (`src/linter.ts`) for linting `.mdc` files.

**Basic Linting:**

```bash
deno run -A src/linter.ts .cursor/rules/**/*.mdc
```

**Options:**

* `--json` / `-j`: Output linting results in JSON format.
* `--verbose` / `-v`: Show detailed information for failures, including the content of offending lines and additional context. Line numbers are always shown in error messages regardless of this flag.
* `--parse` / `-p`: Parse the specified `.mdc` files into a structured JSON representation without running linters. Outputs key meta information like the rule's frontmatter, title, description, category, globs, and attachment type.
* `--rules` / `-r`: List all enabled lint rules used by the linter along with their severity, and descriptions. Output is in JSON.
* `--help` / `-h`: Display the help message.

**Examples:**

```bash
# Lint all .mdc files in the .cursor/rules directory and sub-directories:
deno run -A src/linter.ts .cursor/rules/**/*.mdc

# Lint a specific file and output results as JSON:
deno run -A src/linter.ts --json path/to/rule.mdc

# Parse a file and output its structured data:
deno run -A src/linter.ts --parse path/to/rule.mdc

# List all available lint rules:
deno run -A src/linter.ts --rules
```

**Sample Output:**

The linter displays clear error and warning messages with line numbers:

```bash
📄 Rule: sample.mdc
Derived Type: AgentAttached

    FAIL  frontmatter-missing-alwaysApply: Frontmatter is missing the required 'alwaysApply'
          property (lines 1-2).
    FAIL  content-missing-paragraph: No paragraph text found after the first header (line 7).
    WARN  content-missing-examples: Rule is missing an 'Examples' section (lines 5-6).
```

## System and Architecture Overview

The package is built using Deno and TypeScript. Its core components are:

1. **Linter CLI (`src/linter.ts`):** The main entry point for command-line usage. Parses arguments, orchestrates file discovery using globs, processing, linting, and result formatting.
2. **Processor (`src/processor.ts`):** Contains the `processMdcFile` function, which reads an `.mdc` file and uses the parsers to create a structured `MdcFile` object. It also includes helpers like `groupResultsByFile`.
3. **Parsers (`src/parsers/`):** Modules responsible for parsing specific parts of an `.mdc` file:
    * `frontmatter.ts`: Parses the frontmatter block.
    * `markdown.ts`: Parses the Markdown content.
    * `attachment-type.ts`: Determines the `AttachmentType` based on the parsed frontmatter.
4. **Lint Rules (`src/lint-rules/`):** Individual rule modules, each exporting a `LintRule` object containing metadata (`id`, `severity`, `description`) and the `lint` function. `index.ts` aggregates and exports all built-in rules via `loadAllRules`. The system also supports loading custom rules from an external directory.
5. **Types (`src/types.ts`):** Defines all the core TypeScript interfaces and enums used throughout the package (e.g., `MdcFile`, `LintRule`, `LintResult`, `AttachmentType`).

**Workflow:**

* The CLI (`linter.ts`) parses command-line arguments.
* It uses `@std/fs/expandGlob` to find `.mdc` files matching the provided patterns.
* For each file, `processMdcFile` is called.
* `processMdcFile` reads the file content.
* `parseFrontmatter` attempts to parse the YAML frontmatter.
* `parseMarkdownContent` parses the remaining content (or the whole file if no frontmatter exists).
* `determineAttachmentType` analyzes the parsed frontmatter to classify the rule.
* The results are combined into an `MdcFile` object.
* If not in `--parse` mode, `loadAllRules` fetches the lint rule definitions.
* Each loaded rule's `lint` function is executed against the `MdcFile` object.
* The results (`LintResult[]`) are collected.
* Finally, the CLI formats the results (human-readable summary or JSON) and prints them to the console. It exits with code 1 if any 'error' severity rules fail.

## File and Folder Structure (`src/`)

```txt
src/
├── lint-rules/       # Individual lint rule implementations
│   ├── index.ts      # Aggregates and exports lint rules
│   └── *.ts          # Specific rule files (e.g., frontmatterMissingAlwaysApply.ts)
├── parsers/          # Modules for parsing different parts of MDC files
│   ├── frontmatter.ts
│   ├── markdown.ts
│   └── attachment-type.ts
├── linter.ts         # Main CLI entry point and logic
├── processor.ts      # Core MDC file processing logic (processMdcFile)
└── types.ts          # TypeScript interfaces and enums
```

## MDC Attachment Types (`AttachmentType`)

An `.mdc` file represents a Cursor Rule. The attachment type is determined by the presence and values of specific fields in its YAML frontmatter (`---`). The `AttachmentType` enum categorizes these:

* **`AttachmentType.AlwaysAttached`**:
  * Defined by: `alwaysApply: true` in frontmatter, empty `globs`, and empty `description`.
  * Behavior: The rule is always active in the Cursor context.
  * Note: Empty values (null, undefined, or empty string) are treated as equivalent.

* **`AttachmentType.AutoAttached`**:
  * Defined by: `alwaysApply: false` AND non-empty `globs` in frontmatter, with empty `description`.
  * Behavior: The rule is automatically activated when a file matching the `globs` pattern is opened or focused in Cursor.
  *  Note: The `globs` field must contain at least one pattern.

* **`AttachmentType.AgentAttached`**:
  * Defined by: Empty `globs`, non-empty `description`, and `alwaysApply: false` (or absent).
  * Behavior: Loaded and used by the AI agent based on context, guided by the `description`.
  * Note: The `description` must be a non-empty string that explains to the AI agent when to use the rule.

* **`AttachmentType.ManuallyAttached`**:
  * Defined by: `alwaysApply: false`, empty `globs`, and empty `description`.
  * Behavior: The rule is only activated when manually referenced by the user with `@rule-name`.
  * Note: Empty values (null, undefined, or empty string) are treated as equivalent.

* **`AttachmentType.Invalid`**:
  * Condition: The combination of frontmatter fields is invalid or contradictory.
  * Common issues: Having both `alwaysApply: true` and non-empty `globs`, or having non-empty `globs` along with non-empty `description` and `alwaysApply: false`.

* **`AttachmentType.Unknown`**:
  * Condition: Parsing failed before the attachment type could be determined, or the frontmatter structure doesn't match any known type pattern. This often indicates a syntax error in the frontmatter or a read error.

## Rule Content Best Practices

When writing Cursor rules, following these content guidelines ensures the AI agent can effectively understand and apply your rules:

### Header and Paragraph Structure

* **Paragraph After Headers**: Each header must be followed by at least one paragraph of explanatory text, not just lists or code blocks. This context is crucial for AI agents to understand the purpose of the section.
  * Lists (ordered or unordered), code blocks, and other non-paragraph elements are not considered paragraphs by the parser.
  * Example of correct structure:
    ```markdown
    ## Section Title
    
    This introductory paragraph explains the purpose of this section and provides context.
    
    1. First rule point
    2. Second rule point
    ```
  * This paragraph requirement helps AI agents grasp the semantic relationship between the header and the following content, improving their ability to apply rules correctly and contextually.

### Rule References

* **Valid Cursor Rule References**: When referencing other Cursor rules using markdown links with the format `[rule-name](mdc:.cursor/rules/path/to/rule.mdc)`, ensure the referenced file actually exists.
  * All references to paths containing `.cursor/rules` must point to valid, existing files.
  * This helps maintain a clean web of interconnected rules and prevents confusing AI agents with broken references.
  * Example of correct reference:
    ```markdown
    For formatting instructions, see [with-javascript.mdc](mdc:.cursor/rules/global/with-javascript.mdc).
    ```
  * References to other file types (not in `.cursor/rules`) are not validated by this rule.

### Frontmatter Organization

* **Category Field**: While not a standard Cursor field, adding a `category` field to your frontmatter helps organize and discover rules in your codebase.
  * Examples of useful categories: `Code Generation`, `Tool Usage`, `Testing and Debugging`, `Documentation`, `Code Style`, etc.
  * The `category` field makes it easier to filter and group rules when you have a large collection.
  * Example usage in frontmatter:
    ```yaml
    ---
    alwaysApply: false
    globs: ["*.ts", "*.tsx"]
    category: Code Generation
    ---
    ```

### Content Organization

* **Clear Section Hierarchy**: Use headers to create a clear hierarchy in your rule document.
* **Consistent Formatting**: Maintain consistent formatting throughout the document to help the AI parse and understand the content.
* **Concise Language**: Use clear and concise language to communicate requirements and expectations to the AI agent.

## Structured Data Model (`MdcFile`)

When an `.mdc` file is processed by `processMdcFile`, it's converted into a structured `MdcFile` object (defined in `src/types.ts`). This object provides a convenient way to access the file's components programmatically.

```typescript
interface MdcFile {
  filePath: string          // Original path to the file
  rawContent: string        // Full raw text content of the file
  rawLines: string[]        // File content split into lines
  fileReadError?: Error     // Error encountered during file reading

  frontmatter?: ParsedFrontmatter // Parsed YAML frontmatter block
  markdownContent?: ParsedMarkdownContent // Parsed Markdown content section

  derivedAttachmentType?: AttachmentType // The determined AttachmentType based on frontmatter
  parseError?: Error         // General parsing error not specific to frontmatter/markdown
}

interface ParsedFrontmatter {
  raw: string                      // Raw YAML string (without delimiters)
  parsed: Record<string, unknown> | null // JS object from parsed YAML, or null on error
  globs?: string | string[] | null  // Extracted 'globs' value (null for empty values)
  alwaysApply?: boolean             // Extracted 'alwaysApply' value
  description?: string | null       // Extracted 'description' value (null for empty values)
  category?: string | null          // Optional 'category' value for rule organization
  startLine: number                // 1-based start line of frontmatter block
  endLine: number                  // 1-based end line of frontmatter block
  parseError?: Error                // YAML parsing error
}

interface ParsedMarkdownContent {
  raw: string                      // Raw markdown string
  ast?: unknown                    // Raw AST from the 'marked' parser (optional)
  headers: MarkdownHeader[]        // Array of parsed H1, H2, etc.
  paragraphs: MarkdownParagraph[]    // Array of parsed paragraphs
  codeBlocks: MarkdownCodeBlock[]  // Array of parsed code blocks
  startLine: number                // 1-based line where markdown content starts
  parseError?: Error                // Markdown parsing error
}

// Supporting types:
interface MarkdownHeader { text: string; level: number; line: number }
interface MarkdownParagraph { text: string; line: number; afterHeader?: MarkdownHeader }
interface MarkdownCodeBlock { text: string; lang?: string; line: number }
```

## Method Specification (API Reference)

Key exported functions and types for programmatic use:

**Functions:**

*   **`processMdcFile(filePath: string): Promise<MdcFile>`** (`src/processor.ts`)
    *   Reads, parses, and analyzes an `.mdc` file at the given `filePath`.
    *   Returns a Promise resolving to the structured `MdcFile` object.
*   **`loadAllRules(extraRulesPath?: string): Promise<LintRule[]>`** (`src/lint-rules/index.ts`)
    *   Loads all built-in lint rules.
    *   Optionally loads additional rules from `.ts` files in the `extraRulesPath` directory.
    *   Returns a Promise resolving to an array of `LintRule` objects.
*   **`determineAttachmentType(frontmatter: Record<string, unknown> | null): AttachmentType`** (`src/parsers/attachment-type.ts`)
    *   Takes a parsed frontmatter object (or null) and returns the corresponding `AttachmentType`.
*   **`parseFrontmatter(fileContent: string): { frontmatter: ParsedFrontmatter | null; contentStartIndex: number } | undefined`** (`src/parsers/frontmatter.ts`)
    *   Attempts to parse YAML frontmatter from the start of `fileContent`.
    *   Returns the parsed `frontmatter` object and the `contentStartIndex` (where the markdown begins), or `undefined` if no valid frontmatter delimiters are found.
*   **`parseMarkdownContent(markdownContent: string, startLine: number): ParsedMarkdownContent`** (`src/parsers/markdown.ts`)
    *   Parses the given `markdownContent` string into a structured `ParsedMarkdownContent` object.
    *   `startLine` indicates the 1-based line number in the original file where this content begins.

**Types & Interfaces:** (`src/types.ts`)

*   **`MdcFile`**: The core object representing a processed `.mdc` file. (See "Structured Data Model" section).
*   **`LintRule`**: Defines the structure for a lint rule.
    *   `id: string`: Unique identifier (e.g., "frontmatter-missing").
    *   `severity: 'error' | 'warning'`: Severity level.
    *   `description: string`: Human-readable description of the rule.
    *   `lint: (file: MdcFile) => LintResult | Promise<LintResult>`: The function that performs the lint check.
*   **`LintResult`**: Represents the outcome of a single lint rule execution.
    *   `ruleId: string`: ID of the rule that generated this result.
    *   `severity: 'error' | 'warning'`: Severity of the rule.
    *   `passed: boolean`: True if the check passed, false otherwise.
    *   `message?: string`: Optional message explaining the failure/pass. When displayed, line numbers from the offending lines or offending value are automatically appended to this message.
    *   `offendingLines?: { line: number; content: string }[]`: Specific lines causing failure.
    *   `offendingValue?: { propertyPath: string; value: unknown }`: Specific data value causing failure.
    *   `reason?: string`: Optional additional context for the failure.
*   **`AttachmentType`**: Enum representing the different types of Cursor rule attachments (See "MDC Attachment Types" section).
*   **`ParsedFrontmatter`**: Structure holding parsed frontmatter data.
*   **`ParsedMarkdownContent`**: Structure holding parsed markdown data.
*   **`MarkdownHeader`**, **`MarkdownParagraph`**, **`MarkdownCodeBlock`**: Interfaces representing specific elements parsed from markdown.
