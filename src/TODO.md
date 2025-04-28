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

## 2. Unicode/Grapheme Awareness

**Goal:** Correctly handle and measure characters that aren't single code points or single column width (emojis, CJK, combining marks).

**Risks of Not Implementing:**
*   Relies on `string.length` and basic `\s+` splitting, which is incorrect for visual width and grapheme units.
*   **Failure Modes:**
    *   Incorrect Wrapping (Lines break wrong): **High Probability** (esp. user content, emoji).
    *   Visual Glitches (Overlap/Gaps): **Medium-High Probability**.
    *   Broken Graphemes (Splitting emojis): **Medium Probability**.
    *   Incorrect Truncation/Ellipsis: **High Probability**.

**Solution:**
*   Use a grapheme splitting library (e.g., `grapheme-splitter`) to treat visual units atomically.
*   Integrate character width calculation (e.g., `eastasianwidth`) for accurate measurement.

```typescript
// Example import
import { splitGraphemes } from 'https://deno.land/x/grapheme_splitter/mod.ts';
// Need width calculation library too
```

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

## 7. ANSI Escape Sequence Awareness (Refined)

**Goal:** Correctly handle ANSI color codes and terminal formatting (e.g., `\x1B[31m`, `\x1B[1m`) within the text being wrapped, ensuring that these non-printing characters do not interfere with line length calculations, wrapping points, or visual alignment.

**Risks of Not Implementing:**
*   Current implementation counts ANSI escape sequences as visible characters.
*   **Failure Modes:**
    *   **Premature Line Wrapping:** Lines containing ANSI codes will wrap earlier than visually expected because the escape sequences contribute to the calculated length. **High Probability**.
    *   **Incorrect Width Calculation:** The calculated `availableWidth` will be consumed by invisible ANSI characters, leading to less visible text fitting on a line than intended. **Guaranteed**.
    *   **Visual Formatting Errors:** If a wrap occurs *within* an ANSI sequence (less likely with simple word splitting but possible if `preserveWholeWords` is false or with very long sequences), it breaks the formatting. More commonly, formatting (like color) might not be correctly reset or reapplied on the new line if the wrapping logic doesn't handle the state. **High Probability**.
    *   **Broken Formatting Spans:** An ANSI sequence starting on one line might have its corresponding reset code (`\x1B[0m`) wrapped to the next, causing the formatting to incorrectly "bleed" across lines or terminate unexpectedly. **High Probability**.

**Proposed Solution (Custom Implementation):**

1.  **Measure Visual Length:** Implement a function to calculate the *display* width of a string, ignoring ANSI escape sequences.
    ```typescript
    // Removes ANSI escape codes to get the printable character count.
    function visualLength(str: string): number {
      // Basic regex for common CSI (Control Sequence Introducer) sequences.
      // May need refinement for more complex ANSI types (e.g., OSC).
      // Source for regex: General understanding + https://www.lihaoyi.com/post/BuildyourownCommandLinewithANSIescapecodes.html
      return str.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').length;
    }
    ```
2.  **Modify Wrapping Logic:** Update `wrapTextPreservingAlignment` (and potentially `splitIntoWordsAndSpaces`) to use `visualLength` for all width calculations. The splitting logic needs to ensure ANSI sequences are kept intact with the word or space they modify, or handled as zero-width units that don't affect wrapping decisions directly but are included in the final output lines. A more robust splitter might be needed:

    ```typescript
    // Example of a more aware split approach (conceptual)
    function splitAware(text: string): Array<{ chunk: string; visualWidth: number; isAnsi: boolean }> {
      // Logic to split text while keeping ANSI sequences attached to words
      // or treating them as separate zero-width chunks.
      // ... complex implementation ...
      return []; // Placeholder
    }

    // In wrapTextPreservingAlignment:
    // ... loop through chunks from splitAware ...
    const wordVisualWidth = chunk.visualWidth; // Use visual width
    if (currentLineVisualWidth + wordVisualWidth > availableWidth) {
       // wrap line
    } else {
       currentLine += chunk.chunk; // Append the raw chunk (with ANSI)
       currentLineVisualWidth += wordVisualWidth;
    }
    // ...
    ```

**Robustness Analysis of Proposed Solution:**
*   The proposed `visualLength` function, using a regex to strip ANSI codes, is generally effective for *calculating* the visual width and addresses the "Premature Line Wrapping" and "Incorrect Width Calculation" risks **effectively**, provided the regex is comprehensive enough for the expected ANSI codes.
*   However, simply stripping codes for measurement doesn't solve the "Visual Formatting Errors" or "Broken Formatting Spans" risks on its own. The core wrapping logic (`wrapTextPreservingAlignment`) needs significant modification to track and preserve these codes correctly across line breaks. It needs to understand that adding an ANSI sequence doesn't consume `availableWidth`.
*   **Flexibility:** This custom approach is flexible, as the regex and wrapping logic can be tailored. However, correctly handling *all* ANSI variations (CSI, OSC, different parameter forms) and maintaining formatting state across lines (e.g., ensuring a color started on one line is implicitly continued on the next wrapped line) can become extremely complex and error-prone. It might not be *completely* robust against all edge cases without significant effort.

**Alternative Solution (Using Existing Library):**

Instead of manually parsing and handling ANSI codes, we can leverage existing libraries designed for this purpose. A good candidate available via Deno/JSR is `strip-ansi` which is part of the Deno standard library (`fmt`). While `strip-ansi` primarily *removes* codes, which is useful for getting raw text length, a library specifically for *calculating visual string width* considering ANSI and Unicode characters would be ideal (like Node's `string-width`).

*   **Library:** We can use `@std/fmt/strip-ansi` for basic stripping, or look for/adapt a more specialized width calculation library if needed.
    ```typescript
    import stripAnsi from "jsr:@std/fmt/strip-ansi";
    // Or import a hypothetical displayWidth function if available/adapted
    // import { displayWidth } from "some-deno-display-width-lib";

    function visualLengthWithStdLib(str: string): number {
        // Option 1: Simple stripping (less accurate for complex Unicode but handles ANSI)
        return stripAnsi(str).length;
        // Option 2: Use a dedicated display width library (preferred if available)
        // return displayWidth(str);
    }
    ```
*   **Integration:** Replace `.length` calls in `wrapTextPreservingAlignment` with `visualLengthWithStdLib(string)` or `displayWidth(string)` for width calculations.

**Robustness Analysis of Alternative:**
*   Using a dedicated library (like `strip-ansi` or a hypothetical `displayWidth`) is **highly robust** for calculating visual width compared to a custom regex. These libraries handle various ANSI sequences and potentially Unicode complexities (fullwidth, combining characters) more reliably. This directly solves "Premature Line Wrapping" and "Incorrect Width Calculation".
*   **Ease of Use:** This approach is significantly **easier** to implement correctly for width calculation.
*   **Completeness:** It **does not inherently solve** the "Visual Formatting Errors" or "Broken Formatting Spans" related to *maintaining formatting state* across lines. The wrapping logic *still* needs awareness to avoid breaking sequences and potentially re-apply styles. However, accurate width calculation is crucial and prevents many errors.

**Comparison and Recommendation:**

*   **Custom Solution:** High control, high complexity, high risk of bugs/edge cases.
*   **Library Solution:** Simpler, more reliable for width calculation (the core issue). Leverages community expertise.

**Recommendation:** **Start by integrating a robust library function** (`strip-ansi` from `@std/fmt` or a more specialized display width calculator if found/adapted) to handle visual width calculation. This provides the most immediate and reliable fix for the primary risks. Address the more complex issue of formatting state preservation across lines as a subsequent refinement if necessary. The priority is accurate width calculation.
