# Bounding Box Improvements TODO

Here are potential improvements for `src/bounding_box.ts` to enhance terminal UX capabilities:

## 1. Dynamic Margin Reactivity (Deno 2)

**Goal:** Allow the bounding box to adapt dynamically to terminal resize events.

**Implementation Detail (Deno 2):**

*   Use `Deno.consoleSize().columns` to get the current width.
*   Monitor changes using platform-specific methods:
    *   **Polling (Cross-Platform Fallback):** `setInterval(() => checkSize(), intervalMs)`. Reliable everywhere but less efficient.
    *   **Signal Listener (Unix-like: Linux, macOS):** `Deno.addSignalListener("SIGWINCH", () => handleResize())`. Efficient but platform-specific.
    *   **Windows:** No direct signal equivalent for `SIGWINCH` exposed by standard Deno APIs. Rely on **polling** `Deno.consoleSize()`.
    *   **Integrated Terminals (VS Code, etc.):** Generally emulate host OS behavior (`SIGWINCH` on Unix-like, polling needed on Windows).
    *   **SSH Sessions / tmux / screen:** Typically forward `SIGWINCH`, so the signal approach should work if the underlying OS supports it.
*   Debounce frequent `SIGWINCH` events or rapid polling results using `setTimeout`.
*   Update `BoundingBoxOptions` to include `dynamicResize: number | 'SIGWINCH'` and `resizeDebounceMs: number`.

```typescript
// Example structure:
interface BoundingBoxOptions {
  dynamicResize?: number | 'SIGWINCH'; // Use 'SIGWINCH' on Unix-like, number for polling interval
  resizeDebounceMs?: number; // e.g., 100
  // ... other options
}

let lastKnownWidth = Deno.consoleSize().columns;
let debounceTimeout: number | undefined;

function handleResize(options: BoundingBoxOptions) {
  const currentWidth = Deno.consoleSize().columns;
  if (currentWidth !== lastKnownWidth) {
    lastKnownWidth = currentWidth;
    console.log(`Terminal resized to ${currentWidth} columns. Re-rendering...`);
    // Trigger re-wrapping/re-rendering logic
  }
}

function setupResizeListener(options: BoundingBoxOptions) {
  const debounceMs = options.resizeDebounceMs ?? 100;
  // Prioritize SIGWINCH on supported platforms
  if (options.dynamicResize === 'SIGWINCH' && Deno.build.os !== 'windows') {
    console.log("Using SIGWINCH for resize detection.");
    Deno.addSignalListener("SIGWINCH", () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => handleResize(options), debounceMs);
    });
  } else if (typeof options.dynamicResize === 'number' && options.dynamicResize > 0) {
    // Fallback to polling if SIGWINCH not specified or on Windows
    console.log(`Using polling interval: ${options.dynamicResize}ms`);
    setInterval(() => {
        // Optional: Add debouncing here too if polling interval is very short
        handleResize(options);
    }, options.dynamicResize);
  } else if (options.dynamicResize && Deno.build.os === 'windows') {
      console.warn("SIGWINCH not supported on Windows. Consider using a polling interval (e.g., dynamicResize: 250).")
  }
  handleResize(options); // Initial check
}
```

**Benefit:** Enables responsive UIs that reflow content gracefully on terminal resize across various environments.

## 3. Bidirectional Text (RTL) Support

**Goal:** Correctly render text containing Right-to-Left languages (Arabic, Hebrew) and handle mixed LTR/RTL content.

**Risks of Not Implementing:**
*   Current logic assumes pure LTR flow.
*   **Failure Modes:**
    *   Jumbled Text (Letters/words out of order): **Guaranteed Failure** for RTL.
    *   Incorrect Alignment: **Guaranteed Failure**.
    *   Wrong Punctuation Placement: **Guaranteed Failure**.
*   **Probability:** **Low** if *only* LTR users/data. **High** if any chance of RTL content (makes tool unusable for those cases).

**Solution:**
*   Integrate a library implementing the Unicode Bidirectional Algorithm (e.g., `bidi-js`).
*   Detect text direction (`bidi.getDirection(text)`).
*   Apply appropriate LTR or RTL layout logic.

## 4. Interactive Element Preservation (Clickable Links)

**Goal:** Ensure ANSI escape codes for features like hyperlinks (OSC 8) are not broken during wrapping.

**How it Works:**
*   OSC 8 sequence: `\x1B]8;;URL\x1B\\TextToShow\x1B]8;;\x1B\\`
*   Terminals supporting it render `TextToShow` as clickable, opening `URL`.

**Platform Support:**
*   **Good:** iTerm2, WezTerm, Kitty, Foot, GNOME Terminal (VTE >= 0.52), Windows Terminal.
*   **Limited/None:** Older terminals, basic xterm, some embedded terminals.

**Solution:**
*   Update splitting logic (e.g., regex) to treat the entire OSC 8 sequence as an atomic unit to prevent breaking it.
    ```regex
    /(\s+)|(\x1B]8;;.*?\x1B\\.*?\x1B]8;;\x1B\\)/g
    ```
*   **Note:** True interactive *buttons* usually require full TUI libraries.

## 5. Streaming API for Large Texts

**Goal:** Process and wrap large amounts of text efficiently without high memory usage or blocking the UI.

**Risks of Not Implementing:**
*   Current `wrapTextInBoundingBox` needs the *entire* string in memory.
*   **Failure Scenarios:** Displaying large logs, query results, real-time feeds.
*   **How it Fails:**
    *   **Memory Exhaustion:** Crashes (`OutOfMemoryError`) or extreme slowness if input > available RAM.
    *   **UI Blocking:** Main thread hangs during processing, making the app unresponsive.

**Solution:**
*   Implement a streaming function using async iterators.

```typescript
export async function* streamWrappedText(
  textStream: AsyncIterable<string>,
  consoleWidth: number,
  options: BoundingBoxOptions
) {
  let buffer = '';
  // Logic to process chunks, wrap lines from buffer, yield completed lines, keep remainder in buffer
  for await (const chunk of textStream) {
    buffer += chunk;
    const lines = wrapTextInBoundingBox(buffer, consoleWidth, options); // Or a modified internal version
    if (lines.length > 1) {
       const linesToYield = lines.slice(0, -1);
       if (linesToYield.length > 0) yield linesToYield;
       buffer = lines.at(-1) ?? '';
    }
  }
  if (buffer) yield [buffer]; // Flush remaining buffer
}
```

**Benefits of Streaming:**
*   **Low Memory Footprint:** Constant, low memory usage regardless of input size.
*   **Responsiveness:** UI remains interactive; lines displayed progressively.
*   **Scalability:** Handles arbitrarily large inputs.
*   **Composability:** Fits into standard shell pipelines.

## 6. Advanced Indentation Control (First-Line, Hanging, Right)

**Goal:** Provide fine-grained control over indentation within the bounding box, supporting standard typographic conventions like first-line indents and hanging indents, as well as right-side indentation.

**Risks of Not Implementing:**
*   Limited text layout capabilities, preventing common formatting styles (e.g., standard paragraphs, bibliographies, blockquotes needing right margin).
*   Forces users to manually pre-format text with spaces, which is brittle and doesn't adapt to wrapping or resizing.
*   **Failure Modes:**
    *   Inability to create standard paragraph indentation: **Guaranteed Limitation**.
    *   Inability to create hanging indents (like for lists/definitions): **Guaranteed Limitation**.
    *   Difficulty formatting text requiring right margin adjustments (e.g., aligning text away from the right edge): **Guaranteed Limitation**.
    *   Visual inconsistency if users attempt manual spacing.

**Solution:**
*   Simplify the indentation API with a more intuitive interface:

```typescript
interface BoundingBoxOptions {
  // ... existing options ...
  
  // Simplified indentation API - CSS-like approach
  indent?: {
    // Simple single-value shorthand for common cases
    type?: 'paragraph' | 'hanging' | 'blockquote' | 'none';
    size?: number | string; // Default amount to use with the type (e.g., 4 or '5%')
    
    // More granular control when needed (only specify what you need)
    left?: number | string;        // All lines left indent
    right?: number | string;       // All lines right indent
    firstLine?: number | string;   // Additional indent for first line only (+ means indent, - means outdent)
  };
}

// EXAMPLES:

// Standard paragraph indent (first line indented 5 spaces)
const paragraphIndent: BoundingBoxOptions = {
  indent: { type: 'paragraph', size: 5 }
  // Equivalent to: indent: { firstLine: 5 }
};

// Hanging indent (subsequent lines indented 3 spaces)
const hangingIndent: BoundingBoxOptions = {
  indent: { type: 'hanging', size: 3 }
  // Equivalent to: indent: { firstLine: -3, left: 3 }
};

// Blockquote style (all lines indented 4 from left, 4 from right)
const blockQuote: BoundingBoxOptions = {
  indent: { type: 'blockquote', size: 4 }
  // Equivalent to: indent: { left: 4, right: 4 }
};

// First line flush left, rest indented 2 spaces, all text 10% from right edge
const complexIndent: BoundingBoxOptions = {
  indent: { firstLine: -2, left: 2, right: '10%' }
};
```

The above design provides:
1. **Common Presets**: Most users can use simple `type` + `size` combinations
2. **Granular Control**: Advanced users retain access to detailed customization
3. **Intuitive API**: Clear property names based on typographic concepts
4. **Reduced Complexity**: Single `indent` property with nested options instead of six separate properties
5. **Backward Compatibility**: Easy to implement a compatibility layer that maps the old properties to the new structure

This approach makes typical use cases extremely concise while maintaining all the flexibility of the original design.

## 7. Utilize `indent.left` in Consumers (`linter.ts`)

**Goal:** Refactor consumers of `bounding-box.ts` (like `linter.ts`) to use the built-in `indent.left` option instead of manually prepending spaces after wrapping.

**Rationale:** The `linter.ts` currently calculates required indentation and passes it as `leftMargin` to `wrapTextInBoundingBox`, then manually prepends spaces to the wrapped lines. Using the `indent.left` option directly within `wrapTextInBoundingBox` is the intended way to achieve this, simplifying the consumer's code and relying on the bounding box's internal logic.

**Before Output (Visual):**
```
Rule:  path/to/some-rule.mdc
Type:  RuleType
────────────────────────────────────────
  ✖ FAIL rule-id: This is the main message describing the failure which might be quite long and require wrapping. (line 42)
                 This is the continuation of the wrapped message.
                 
                 ▶ Offending content:
                 Line 42: Some offending code here
                 ▶ Reason:
                 A detailed explanation of why this failed which can also be long and needs wrapping.
                 This is the continuation of the reason.
```

**After Output (Visual):** (Identical to Before)
```
Rule:  path/to/some-rule.mdc
Type:  RuleType
────────────────────────────────────────
  ✖ FAIL rule-id: This is the main message describing the failure which might be quite long and require wrapping. (line 42)
                 This is the continuation of the wrapped message.
                 
                 ▶ Offending content:
                 Line 42: Some offending code here
                 ▶ Reason:
                 A detailed explanation of why this failed which can also be long and needs wrapping.
                 This is the continuation of the reason.
```

**Downsides:** None. Cleaner implementation in the consumer (`linter.ts`).

**Effort:** Low. Modify calls to `wrapTextInBoundingBox` in `linter.ts` to use `indent: { left: ... }` instead of `leftMargin: ...` and remove manual space prepending.

## 8. Consolidate Ellipsis Style in Consumers (`linter.ts`)

**Goal:** Use a consistent ellipsis style (`HORIZONTAL` or `MIDDLE`) when wrapping different types of content in consumers like `linter.ts`.

**Rationale:** `linter.ts` currently uses `HORIZONTAL` ellipsis (`…`) for main messages and `MIDDLE` ellipsis (`...`) for verbose content (like code snippets or paths). While `MIDDLE` can be useful for preserving start/end context, using two different styles might feel visually inconsistent. Consolidating to one style would create a more uniform appearance.

**Before Output (Ellipsis Examples):**
*   Main message: `This is a very long message that gets truncated…`
*   Verbose content: `Very/long/path/or/code/snip...that/gets/truncated`

**After Output (Using HORIZONTAL):**
*   Main message: `This is a very long message that gets truncated…`
*   Verbose content: `Very/long/path/or/code/snippet/that/gets/tr…`

**After Output (Using MIDDLE):**
*   Main message: `This is a very long mess...hat gets truncated`
*   Verbose content: `Very/long/path/or/code/snip...that/gets/truncated`

**Downsides:** Minor visual change. If `MIDDLE` ellipsis is specifically preferred for verbose content readability, changing it might be slightly detrimental.

**Effort:** Low. Update the `ellipsis` property in the `BoundingBoxOptions` used within `linter.ts`'s `formatLintResult` function to use a single, consistent character (e.g., `Characters.ELLIPSIS.HORIZONTAL`).

## 9. Linter: Support Shallow Folder Linting

**Goal:** Update `linter.ts` to accept a directory path as input alongside file paths and globs.
**Behavior:** When a directory path is provided, the linter should process all `.mdc` files directly within that directory, but *not* recursively search subdirectories. Globs (`**/*.mdc`) should still be required for recursive linting.
**Rationale:** Simplifies common use case of linting all rules in the main `.cursor/rules/` folder without needing a glob pattern. Improves CLI usability based on user feedback/confusion identified in README review.
**Effort:** Medium. Requires updating argument parsing in `linter.ts` to detect directory paths, using `Deno.readDir` to list files within that directory, filtering for `.mdc` files, and integrating these paths into the file processing loop alongside `expandGlob` results.

## 10. Documentation: Frontmatter Null/Empty Value Handling

**Goal:** Verify and accurately document how different frontmatter fields (`globs`, `description`, `alwaysApply`, `category`) handle null, undefined, and empty string values during parsing and attachment type determination.
**Tasks:**
1.  Analyze the parsing logic in `src/parsers/frontmatter.ts` and `src/parsers/rule-type.ts`.
2.  Determine precisely how `null`, `undefined`, and `""` are treated for each relevant field.
3.  Update the "MDC File Types" section in `src/README.md` to reflect the exact behavior, removing the potentially inaccurate statement "empty values (null, undefined, or empty string) are treated as equivalent" if it's not universally true. Provide clear examples if behavior differs between fields.
**Rationale:** Ensures documentation is precise and accurately reflects the parser's behavior, preventing user confusion. Addresses discrepancy found during README review.
**Effort:** Medium. Requires code analysis and careful documentation updates.

## 11. Code Quality: Investigate `ParsedMarkdownContent.ast` Usage

**Goal:** Determine if the `ast?: unknown` property within the `ParsedMarkdownContent` interface (`src/types.ts`) is actually populated or used anywhere in the codebase.
**Tasks:**
1.  Search the codebase (including `src/parsers/markdown.ts`, `src/processor.ts`, `src/linter.ts`, and any tests) for usage of the `markdownContent.ast` property.
2.  If the property is confirmed to be unused, remove it from the `ParsedMarkdownContent` interface definition in `src/types.ts`.
3.  Remove any mention of the `ast` property from documentation, specifically in the "Structured Data Model (`MdcFile`)" section of `src/README.md`.
**Rationale:** Removes potentially dead code/unused properties, simplifying the data model and reducing confusion. Addresses discrepancy found during README review.
**Effort:** Low. Primarily involves code search and minor deletions.

## 12. Documentation: Correct `Invalid` Attachment Type Conditions

**Goal:** Update the description of the `Invalid` attachment type in `src/README.md` to accurately reflect the conditions that lead to it.
**Tasks:**
1.  Review the logic in `src/parsers/rule-type.ts` (soon to be `attachment-type.ts`) that returns `AttachmentType.Invalid`.
2.  Identify the specific contradictory combinations of frontmatter fields (e.g., `alwaysApply: true` with non-empty `globs`) that trigger this type.
3.  Rewrite the "Common issues" description for `AttachmentType.Invalid` in the "MDC File Types" (soon to be "MDC Attachment Types") section of `src/README.md` to accurately list these conditions, removing the incorrect statement about "missing both `globs` and `alwaysApply`".
**Rationale:** Ensures documentation accurately describes error conditions. Addresses discrepancy found during README review.
**Effort:** Low. Requires reviewing specific logic and updating a small documentation section.
