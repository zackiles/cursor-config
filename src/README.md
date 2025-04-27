# Cursor Rule Linter & Toolkit

This Deno-based package provides tools for linting, parsing, and programmatically working with Cursor Rule (`.mdc`) files. It includes a CLI for linting files against a set of predefined rules and can also be used as a library in other Deno projects.

## Purpose

The primary goal of this package is to ensure the quality, consistency, effectiveness and validity of `.mdc` files (and prompts within) used within the Cursor ecosystem. It helps enforce best practices, detect common errors in rule definitions, and act as a general workbench for programmatically managing rules.

## High-Level Usage & Features

### Command-Line Interface (CLI)

The package includes a CLI tool (`src/linter.ts`) for linting `.mdc` files.

**Basic Linting:**

```bash
deno run -A src/linter.ts path/to/your/rules/**/*.mdc
```

**Options:**

*   `--json` / `-j`: Output linting results in JSON format.
*   `--verbose` / `-v`: Show detailed information for failures, including offending lines and values.
*   `--parse` / `-p`: Parse the specified `.mdc` files into a structured JSON representation without running linters. Outputs key information like frontmatter, title, description, and rule type.
*   `--rules` / `-r`: List all available lint rules, their severity, and descriptions in JSON format.
*   `--help` / `-h`: Display the help message.

**Examples:**

```bash
# Lint all .mdc files in the .cursor/rules directory
deno run -A src/linter.ts .cursor/rules/*.mdc

# Lint a specific file and output results as JSON
deno run -A src/linter.ts --json path/to/rule.mdc

# Parse a file and output its structured data
deno run -A src/linter.ts --parse path/to/rule.mdc

# List all available lint rules
deno run -A src/linter.ts --rules
```

### Programmatic Usage

You can import functions and types from this package into your own Deno projects.

```typescript
import { processMdcFile } from 'jsr:@your-org/cursor-rule-linter'; // Hypothetical JSR path
import { loadAllRules } from 'jsr:@your-org/cursor-rule-linter/lint-rules';
import type { MdcFile, LintRule } from 'jsr:@your-org/cursor-rule-linter/types';

const filePath = './path/to/your/rule.mdc';

// Process an MDC file into a structured object
const mdcFile: MdcFile = await processMdcFile(filePath);
console.log(mdcFile.derivedRuleType);
console.log(mdcFile.frontmatter?.parsed);
console.log(mdcFile.markdownContent?.headers);

// Load lint rules and run them
const rules: LintRule[] = await loadAllRules();
for (const rule of rules) {
  const result = await rule.lint(mdcFile);
  if (!result.passed) {
    console.error(`Rule ${result.ruleId} failed: ${result.message}`);
  }
}
```

## System and Architecture Overview

The package is built using Deno and TypeScript. Its core components are:

1.  **Linter CLI (`src/linter.ts`):** The main entry point for command-line usage. Parses arguments, orchestrates file discovery using globs, processing, linting, and result formatting.
2.  **Processor (`src/processor.ts`):** Contains the `processMdcFile` function, which reads an `.mdc` file and uses the parsers to create a structured `MdcFile` object. It also includes helpers like `groupResultsByFile`.
3.  **Parsers (`src/parsers/`):** Modules responsible for parsing specific parts of an `.mdc` file:
    *   `frontmatter.ts`: Parses the YAML frontmatter block.
    *   `markdown.ts`: Parses the main Markdown content using the `marked` library.
    *   `rule-type.ts`: Determines the `RuleType` based on the parsed frontmatter.
4.  **Lint Rules (`src/lint-rules/`):** Individual rule modules, each exporting a `LintRule` object containing metadata (`id`, `severity`, `description`) and the `lint` function. `index.ts` aggregates and exports all built-in rules via `loadAllRules`. The system also supports loading custom rules from an external directory.
5.  **Types (`src/types.ts`):** Defines all the core TypeScript interfaces and enums used throughout the package (e.g., `MdcFile`, `LintRule`, `LintResult`, `RuleType`).

**Workflow:**

*   The CLI (`linter.ts`) parses command-line arguments.
*   It uses `@std/fs/expandGlob` to find `.mdc` files matching the provided patterns.
*   For each file, `processMdcFile` is called.
*   `processMdcFile` reads the file content.
*   `parseFrontmatter` attempts to parse the YAML frontmatter.
*   `parseMarkdownContent` parses the remaining content (or the whole file if no frontmatter exists).
*   `determineRuleType` analyzes the parsed frontmatter to classify the rule.
*   The results are combined into an `MdcFile` object.
*   If not in `--parse` mode, `loadAllRules` fetches the lint rule definitions.
*   Each loaded rule's `lint` function is executed against the `MdcFile` object.
*   The results (`LintResult[]`) are collected.
*   Finally, the CLI formats the results (human-readable summary or JSON) and prints them to the console. It exits with code 1 if any 'error' severity rules fail.

## File and Folder Structure (`src/`)

```
src/
├── lint-rules/       # Individual lint rule implementations
│   ├── index.ts      # Aggregates and exports lint rules
│   └── *.ts          # Specific rule files (e.g., frontmatter-missing.ts)
├── parsers/          # Modules for parsing different parts of MDC files
│   ├── frontmatter.ts
│   ├── markdown.ts
│   └── rule-type.ts
├── linter.ts         # Main CLI entry point and logic
├── processor.ts      # Core MDC file processing logic (processMdcFile)
└── types.ts          # TypeScript interfaces and enums
```

## MDC File Types (`RuleType`)

An `.mdc` file represents a Cursor Rule. The type of rule is determined by the presence and values of specific fields in its YAML frontmatter (`---`). The `RuleType` enum categorizes these:

*   **`RuleType.AlwaysAttached`**:
    *   Defined by: `alwaysApply: true` in frontmatter.
    *   Behavior: The rule is always active in the Cursor context. `globs` should not be present.
*   **`RuleType.AutoAttached`**:
    *   Defined by: `alwaysApply: false` (or absent) AND `globs: <pattern(s)>` in frontmatter.
    *   Behavior: The rule is automatically activated when a file matching the `globs` pattern is opened or focused in Cursor.
*   **`RuleType.AgentAttached`**:
    *   Defined by: `globs: <pattern(s)>` present, `alwaysApply` is absent.
    *   Behavior: These rules are intended to be fetched and used by the AI agent based on context, potentially triggered by `globs`.
*   **`RuleType.ManuallyAttached`**:
    *   Defined by: `alwaysApply: false` present, `globs` is absent.
    *   Behavior: The rule is only activated when manually selected or attached by the user in Cursor.
*   **`RuleType.Invalid`**:
    *   Condition: The combination of frontmatter fields is invalid (e.g., neither `globs` nor `alwaysApply` is present). Lint rules will typically flag these as errors.
*   **`RuleType.Unknown`**:
    *   Condition: Parsing failed before the type could be determined, or the frontmatter structure doesn't match any known type pattern. This often indicates a syntax error in the frontmatter or a read error.

## Structured Data Model (`MdcFile`)

When an `.mdc` file is processed by `processMdcFile`, it's converted into a structured `MdcFile` object (defined in `src/types.ts`). This object provides a convenient way to access the file's components programmatically.

```typescript
interface MdcFile {
  filePath: string;          // Original path to the file
  rawContent: string;        // Full raw text content of the file
  rawLines: string[];        // File content split into lines
  fileReadError?: Error;     // Error encountered during file reading

  frontmatter?: ParsedFrontmatter; // Parsed YAML frontmatter block
  markdownContent?: ParsedMarkdownContent; // Parsed Markdown content section

  derivedRuleType?: RuleType; // The determined RuleType based on frontmatter
  parseError?: Error;         // General parsing error not specific to frontmatter/markdown
}

interface ParsedFrontmatter {
  raw: string;                      // Raw YAML string (without delimiters)
  parsed: Record<string, unknown> | null; // JS object from parsed YAML, or null on error
  globs?: string | string[];         // Extracted 'globs' value
  alwaysApply?: boolean;             // Extracted 'alwaysApply' value
  description?: string;              // Extracted 'description' value
  startLine: number;                // 1-based start line of frontmatter block
  endLine: number;                  // 1-based end line of frontmatter block
  parseError?: Error;                // YAML parsing error
}

interface ParsedMarkdownContent {
  raw: string;                      // Raw markdown string
  ast?: unknown;                    // Raw AST from the 'marked' parser (optional)
  headers: MarkdownHeader[];        // Array of parsed H1, H2, etc.
  paragraphs: MarkdownParagraph[];    // Array of parsed paragraphs
  codeBlocks: MarkdownCodeBlock[];  // Array of parsed code blocks
  startLine: number;                // 1-based line where markdown content starts
  parseError?: Error;                // Markdown parsing error
}

// Supporting types:
interface MarkdownHeader { text: string; level: number; line: number; }
interface MarkdownParagraph { text: string; line: number; afterHeader?: MarkdownHeader; }
interface MarkdownCodeBlock { text: string; lang?: string; line: number; }
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
*   **`determineRuleType(frontmatter: Record<string, unknown> | null): RuleType`** (`src/parsers/rule-type.ts`)
    *   Takes a parsed frontmatter object (or null) and returns the corresponding `RuleType`.
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
    *   `message?: string`: Optional message explaining the failure/pass.
    *   `offendingLines?: { line: number; content: string }[]`: Specific lines causing failure.
    *   `offendingValue?: { propertyPath: string; value: unknown }`: Specific data value causing failure.
    *   `reason?: string`: Optional additional context for the failure.
*   **`RuleType`**: Enum representing the different types of Cursor rules (See "MDC File Types" section).
*   **`ParsedFrontmatter`**: Structure holding parsed frontmatter data.
*   **`ParsedMarkdownContent`**: Structure holding parsed markdown data.
*   **`MarkdownHeader`**, **`MarkdownParagraph`**, **`MarkdownCodeBlock`**: Interfaces representing specific elements parsed from markdown.
