# Cursor Rule Linter & Toolkit

This Deno-based package provides tools for linting, parsing, and programmatically working with Cursor Rule (`.mdc`) files. It includes a CLI for linting files against a set of predefined rules and can also be used as a library in other Deno projects.

## Purpose

The primary goal of this package is to ensure the quality, consistency, effectiveness, and validity of `.mdc` files (and prompts within) used within the Cursor ecosystem. It helps enforce best practices, detect common errors in rule definitions, and act as a general workbench for programmatically managing rules.

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

    ❌ FAIL  frontmatter-missing-alwaysApply: Frontmatter is missing the required 'alwaysApply'
          property (lines 1-2).
    ⚡ WARN  content-missing-examples: Rule is missing an 'Examples' section (lines 5-6).
```

## System and Architecture Overview

The package is built using Deno and TypeScript. Its core components are:

1. **Linter CLI (`src/linter.ts`):** The main entry point for command-line usage. Parses arguments, orchestrates file discovery using globs, processing, linting, and result formatting.
2. **Processor (`src/processor.ts`):** Contains the `processMdcFile` function, which reads an `.mdc` file and uses the parsers to create a structured `RuleFileRaw` object. It also includes helpers like `groupResultsByFile`.
3. **Parsers (`src/parsers/`):** Modules responsible for parsing specific parts of an `.mdc` file:
    * `frontmatter.ts`: Parses the frontmatter block.
    * `markdown.ts`: Parses the Markdown content.
    * `attachment-type.ts`: Determines the `AttachmentType` based on the parsed frontmatter.
4. **Lint Rules (`src/lint-rules/`):** Individual rule modules, each exporting a `LintRule` object containing metadata (`id`, `severity`, `description`) and the `lint` function. `index.ts` aggregates and exports all built-in rules via `loadAllRules`. The system also supports loading custom rules from an external directory.
5. **Types (`src/types.ts`):** Defines all the core TypeScript interfaces and enums used throughout the package (e.g., `RuleFileRaw`, `LintRule`, `LintResult`, `AttachmentType`).
6. **Console Components (`src/console-components.ts`):** Utilities for formatting output to the console.
7. **Character Symbols (`src/characters.ts`):** Contains Unicode character symbols used for displaying status indicators and formatting.

**Workflow:**

* The CLI (`linter.ts`) parses command-line arguments.
* It uses `@std/fs/expandGlob` to find `.mdc` files matching the provided patterns.
* For each file, `processMdcFile` is called.
* `processMdcFile` reads the file content.
* `parseFrontmatter` attempts to parse the YAML frontmatter.
* `parseMarkdownContent` parses the remaining content (or the whole file if no frontmatter exists).
* `determineAttachmentType` analyzes the parsed frontmatter to classify the rule.
* The results are combined into a `RuleFileRaw` object.
* If not in `--parse` mode, `loadAllRules` fetches the lint rule definitions.
* Each loaded rule's `lint` function is executed against the `RuleFileRaw` object.
* The results (`LintResult[]`) are collected.
* Finally, the CLI formats the results (human-readable summary or JSON) and prints them to the console. It exits with code 1 if any 'error' severity rules fail.

## File and Folder Structure (`src/`)

```txt
src/
├── lint-rules/       # Individual lint rule implementations
│   ├── index.ts      # Aggregates and exports lint rules
│   └── *.ts          # Specific rule files (e.g., frontmatter-missing-alwaysApply.ts)
├── parsers/          # Modules for parsing different parts of MDC files
│   ├── frontmatter.ts
│   ├── markdown.ts
│   └── attachment-type.ts
├── bounding-box.ts   # Text wrapping utilities for console output
├── characters.ts     # Unicode character constants for formatting
├── console-components.ts # Console output formatting utilities
├── linter.ts         # Main CLI entry point and logic
├── mod.ts            # Module exports for library usage
├── processor.ts      # Core MDC file processing logic (processMdcFile)
└── types.ts          # TypeScript interfaces and enums
```

## Rule Attachment Types (`AttachmentType`)

An `.mdc` file represents a Cursor Rule. The attachment type is determined by the presence and values of specific fields in its YAML frontmatter (`---`). The `AttachmentType` enum categorizes these:

* **`AttachmentType.AlwaysAttached`**:
  * Defined by: `alwaysApply: true` in frontmatter.
  * Behavior: The rule is always active in the Cursor context.

* **`AttachmentType.AutoAttached`**:
  * Defined by: `alwaysApply: false`, non-empty `globs` in frontmatter.
  * Behavior: The rule is automatically activated when a file matching the `globs` pattern is opened or focused in Cursor.
  * Note: The `globs` field must contain at least one pattern.

* **`AttachmentType.AgentAttached`**:
  * Defined by: Non-empty `description` in frontmatter.
  * Behavior: Loaded and used by the AI agent based on context, guided by the `description`.
  * Note: The `description` must be a non-empty string that explains to the AI agent when to use the rule.

* **`AttachmentType.ManuallyAttached`**:
  * Defined by: `alwaysApply: false`, empty or no `globs`, empty or no `description`.
  * Behavior: The rule is only activated when manually referenced by the user with `@rule-name`.

* **`AttachmentType.Invalid`**:
  * Condition: The combination of frontmatter fields is invalid or contradictory.
  * Common issues: Having invalid combinations of frontmatter properties that don't clearly indicate a valid attachment type.

* **`AttachmentType.Unknown`**:
  * Condition: Parsing failed before the attachment type could be determined, or the frontmatter structure doesn't match any known type pattern. This often indicates a syntax error in the frontmatter or a read error.

## Rule Attachment Methods (`AttachmentMethod`)

While `AttachmentType` indicates **when** a rule will be injected into the context, in contrast the `AttachmentMethod` indicates **how** that rule will be injected once it's attached to the context.

To achieve this differentiated injection, compiled rules are wrapped in a specialized higher-order prompt depending on their `AttachmentMethod` that instructs the agent on how to use them depending on the method.  Only `message` is not wrapped and essentially acts like a vanilla Cursor rule. `message` is the default if `AttachmentMethod` is not set when the rules are built.

The `attachmentMethod` field in the frontmatter can have one of the following values:

* **`AttachmentMethod.System`** (`system`):
  * **Purpose**: Injects into the internal system prompt and attempts to overrule it.
  * **Use cases**: Setting modes, overruling other rules or polluted context, establishing base AI instructions.
  * **Behavior**: Rules will be transparently wrapped in XML.
  * **Best for**: Rules that need to set agent context before a conversation or task begins.

* **`AttachmentMethod.Message`** (`message`):
  * **Purpose**: Default method, injects into the current user message or conversation.
  * **Use cases**: General-purpose rules that augment the current interaction context.
  * **Behavior**: Standard attachment without special wrapping.
  * **Best for**: Most rule types and typical usage scenarios.

* **`AttachmentMethod.Task`** (`task`):
  * **Purpose**: Specifically triggers an agent action.
  * **Use cases**: When the rule should cause the agent to perform a specific task.
  * **Behavior**: Injects and wraps any optional user message.
  * **Best for**: Rules that should initiate specific agent behaviors, such as creating a file if the rule is named '@create-file'.

* **`AttachmentMethod.None`** (`none`):
  * **Purpose**: References the rule without loading its full context.
  * **Use cases**: When you want to avoid context pollution but need to refer to a rule.
  * **Behavior**: Enables lazy-loading of the rule content when needed.
  * **Best for**: Large or complex rules that you only want loaded at certain steps in your instructions.

If the `attachmentMethod` field is not specified in the frontmatter, it defaults to `message`. If an invalid value is provided, it will also default to `message` with a warning during linting.

Example in frontmatter:
```yaml
---
alwaysApply: true
attachmentMethod: system
---
```

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

### Examples Section

* **Include Examples**: Rules should include an 'Examples' section that demonstrates how to apply the rule correctly.
  * This helps AI agents understand how to implement the rule in practice.
  * Examples should be clear, concise, and illustrative of the rule's application.

### Frontmatter Organization

* **Category Field**: While not a standard Cursor field, adding a `category` field to your frontmatter helps organize and discover rules in your codebase.
  * Examples of useful categories: `Code Generation`, `Tool Usage`, `Testing and Debugging`, `Documentation`, `Code Style`, etc.
  * The `category` field makes it easier to filter and group rules when you have a large collection.
  * Example usage in frontmatter:
    ```yaml
    ---
    alwaysApply: false
    globs: *.ts,*.tsx
    category: Code Generation
    ---
    ```

* **Attachment Method Field**: The `attachmentMethod` field determines how a rule should be injected into the context when compiled.
  * Valid values are:
    * `system`: Injects into the internal system prompt and attempts to overrule it. Used for setting modes, overruling other rules or a polluted context, and setting other internal context. Rules will be transparently wrapped in XML.
    * `message` (default): Injects into the current user message or conversation. Multi-purpose.
    * `task`: Used specifically to trigger an agent action. Injects and wraps any optional user message.
    * `none`: Injects a reference to the rule but does not load its full context into the window. Used for lazy-loading of rules.
  * Example usage in frontmatter:
    ```yaml
    ---
    alwaysApply: false
    globs: *.ts,*.tsx
    attachmentMethod: system
    ---
    ```
  * Note: If not specified, defaults to `message`. Invalid values will also default to `message` with a warning.

* **Tags Field**: Adding tags provides another way to categorize and filter rules.
  * Tags are specified as a comma-separated string in the frontmatter.
  * Each tag can contain spaces and multiple words.
  * Example usage in frontmatter:
    ```yaml
    ---
    alwaysApply: false
    globs: *.ts,*.tsx
    tags: javascript,typescript,react,component generation,styling
    ---
    ```

### Content Organization

* **Clear Section Hierarchy**: Use headers to create a clear hierarchy in your rule document.
* **Consistent Formatting**: Maintain consistent formatting throughout the document to help the AI parse and understand the content.
* **Concise Language**: Use clear and concise language to communicate requirements and expectations to the AI agent.
* **Reasonable Paragraph Length**: Avoid excessively long paragraphs that may be difficult for AI agents to process effectively.

## Structured Data Model (`RuleFileRaw`)

When an `.mdc` file is processed by `processMdcFile`, it's converted into a structured `RuleFileRaw` object (defined in `src/types.ts`). This object provides a convenient way to access the file's components programmatically.

```typescript
interface RuleFileRaw {
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
  raw: string                      // Raw YAML string
  description?: string | null      // Extracted 'description' value
  globs?: string | string[] | null // Extracted 'globs' value
  alwaysApply?: boolean            // Extracted 'alwaysApply' value
  category?: string | null         // Optional 'category' value for rule organization
  attachmentMethod?: AttachmentMethod | null // How the rule should be injected into the context
  startLine: number                // 1-based start line of frontmatter block
  endLine: number                  // 1-based end line of frontmatter block
  parseError?: Error               // YAML parsing error
  [key: string]: unknown           // Other properties from frontmatter
}

interface ParsedMarkdownContent {
  raw: string                      // Raw markdown string
  ast?: unknown                    // Raw AST from the parser (optional)
  headers: MarkdownHeader[]        // Array of parsed H1, H2, etc.
  paragraphs: MarkdownParagraph[]  // Array of parsed paragraphs
  codeBlocks: MarkdownCodeBlock[]  // Array of parsed code blocks
  startLine: number                // 1-based line where markdown content starts
  parseError?: Error               // Markdown parsing error
}

// Supporting types:
interface MarkdownHeader { text: string; level: number; line: number }
interface MarkdownParagraph { 
  text: string; 
  line: number; // 1-based line number where paragraph starts
  afterHeader?: MarkdownHeader // Link to header immediately preceding this paragraph
}
interface MarkdownCodeBlock { text: string; lang?: string; line: number }
```

## Method Specification (API Reference)

Key exported functions and types for programmatic use:

**Functions:**

*   **`processMdcFile(filePath: string): Promise<RuleFileRaw>`** (`src/processor.ts`)
    *   Reads, parses, and analyzes an `.mdc` file at the given `filePath`.
    *   Returns a Promise resolving to the structured `RuleFileRaw` object.
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

*   **`RuleFileRaw`**: The core object representing a processed `.mdc` file. (See "Structured Data Model" section).
*   **`RuleFileSimple`**: A simplified representation of a rule file used for output.
    *   Contains key metadata like rule name, attachment type, creation/modification dates, and frontmatter properties.
*   **`LintRule`**: Defines the structure for a lint rule.
    *   `id: string`: Unique identifier (e.g., "frontmatter-missing-alwaysApply").
    *   `severity: 'error' | 'warning'`: Severity level.
    *   `description: string`: Human-readable description of the rule.
    *   `lint: (file: RuleFileRaw) => LintResult | Promise<LintResult>`: The function that performs the lint check.
*   **`LintResult`**: Represents the outcome of a single lint rule execution.
    *   `ruleId: string`: ID of the rule that generated this result.
    *   `severity: 'error' | 'warning'`: Severity of the rule.
    *   `passed: boolean`: True if the check passed, false otherwise.
    *   `message?: string`: Optional message explaining the failure/pass.
    *   `offendingLines?: { line: number; content: string }[]`: Specific lines causing failure.
    *   `offendingValue?: { propertyPath: string; value: unknown }`: Specific data value causing failure.
    *   `reason?: string`: Optional additional context for the failure.
*   **`AttachmentType`**: Enum representing the different types of Cursor rule attachments (See "MDC Attachment Types" section).
*   **`ParsedFrontmatter`**: Structure holding parsed frontmatter data.
*   **`ParsedMarkdownContent`**: Structure holding parsed markdown data.
*   **`MarkdownHeader`**, **`MarkdownParagraph`**, **`MarkdownCodeBlock`**: Interfaces representing specific elements parsed from markdown.
