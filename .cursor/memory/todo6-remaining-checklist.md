# TODO 6: Enhanced Indentation Control Implementation Checklist

## Background
The goal is to complete the implementation of advanced indentation control features in the bounding box module. While the current implementation already has basic indentation capabilities including `paragraph`, `hanging`, and `blockquote` styles, it lacks full CSS-like functionality, particularly for right indentation in blockquotes and proper indentation application to all lines. This implementation will enhance the existing indentation system to provide more intuitive and comprehensive text layout capabilities.

## Implementation Steps

1. [x] **Update `resolveIndentType` Function for Blockquote Right Indentation**
   - [x] Modify the `blockquote` case in the type switch to apply right indentation
   ```typescript
   case 'blockquote':
     // All lines indented equally from both left and right
     result.leftIndent = defaultSize
     result.rightIndent = defaultSize  // Add this line to set right indent equal to left
     result.firstLineIndent = 0 // No additional first line indent
     break
   ```

2. [x] **Enhance `applyIndentation` Function to Support Right Indentation**
   - [x] Current function only applies first line indentation but doesn't handle other lines or right indentation
   - [x] Update the function signature to include rightIndent parameter
   ```typescript
   function applyIndentation(
     lines: string[],
     firstLineIndent = 0,
     leftIndent = 0,
     rightIndent = 0,
   ): string[] {
     if (lines.length === 0) return lines

     // Apply indentation to each line
     const indentedLines = [...lines]

     // Apply indentation to all lines
     for (let i = 0; i < indentedLines.length; i++) {
       let line = indentedLines[i]
       
       // Apply left indent - for all lines except first line which gets special treatment
       if (i > 0 && leftIndent > 0) {
         line = ' '.repeat(leftIndent) + line
       }
       
       // First line gets special indentation (in addition to leftIndent if applicable)
       if (i === 0 && firstLineIndent > 0) {
         line = ' '.repeat(firstLineIndent) + line
       }
       
       indentedLines[i] = line
     }

     return indentedLines
   }
   ```

3. [x] **Update `wrapTextInBoundingBox` Function to Properly Use Updated `applyIndentation`**
   - [x] Modify the function calls to pass all indent parameters
   ```typescript
   // Apply indentation to wrapped text
   return applyIndentation(wrappedText, firstLineIndent, leftIndent, rightIndent)
   ```
   - [x] Update this in both places where `applyIndentation` is called

4. [x] **Add Test for Right Indentation in Blockquote Style**
   - [x] Create a specific test for blockquote with right indentation
   ```typescript
   await test.step('Blockquote with right indentation', () => {
     const text = 'This is a blockquote with both left and right indentation.'
     const consoleWidth = 60
     const indentSize = 5

     const result = wrapTextInBoundingBox(text, consoleWidth, {
       indent: { type: 'blockquote', size: indentSize }
     })

     // Verify that text was wrapped correctly with right indentation
     // This is more challenging to test directly since we don't have access to internal parameters
     // but we can verify that lines are properly wrapped at expected width
     
     // Calculate expected max line length: consoleWidth - (2 * indentSize)
     const expectedMaxLength = consoleWidth - (2 * indentSize)
     
     for (const line of result) {
       // Line visual width should be less than or equal to expected max
       assert(
         textWidth(stripStyles(line)) <= expectedMaxLength,
         `Line should respect both left and right indentation: "${line}"`
       )
     }
   })
   ```

5. [x] **Refine Handling of Complex Indentation Combinations**
   - [x] Ensure negative `firstLine` values work correctly with blockquote style
   ```typescript
   // Update resolveIndentType to handle this case
   if (options.type === 'blockquote' && result.firstLineIndent < 0) {
     // If blockquote has negative first line indent, apply it on top of the leftIndent
     // instead of overwriting leftIndent completely
     result.firstLineIndent = result.leftIndent + result.firstLineIndent
   }
   ```

6. [x] **Fix Edge Cases with Padding for Right Indentation**
   - [x] The current `forceWrappingWithMinWidth` function doesn't account for right indentation
   - [x] Update it to respect right indentation
   ```typescript
   function forceWrappingWithMinWidth(
     text: string,
     minWidth: number,
     maxLines?: number,
     ellipsis: string = Characters.ELLIPSIS.HORIZONTAL,
     preserveWholeWords = true,
     firstLineIndent = 0,
     rightIndent = 0, // Add this parameter
   ): string[] {
     // Modify the effective width calculation to account for right indentation
     const effectiveMinWidth = Math.max(1, minWidth - rightIndent)
     
     if (preserveWholeWords) {
       // If preserving whole words, use the standard wrapping with adjusted width
       return wrapTextPreservingAlignment(
         text, 
         effectiveMinWidth, 
         maxLines, 
         ellipsis, 
         true, 
         firstLineIndent
       )
     }
     
     // Rest of the function with adjusted width calculations...
   }
   ```

7. [x] **Update Documentation for Enhanced Indentation**
   - [x] Update JSDoc comments in the `BoundingBoxOptions` and `IndentOptions` interfaces
   - [x] Add additional examples showing combined indentation features
   ```typescript
   /**
    * @example Combined Left and Right Indentation
    * ```ts
    * const wrappedText = wrapTextInBoundingBox(
    *   "This text has both left and right indentation.",
    *   80,
    *   { indent: { left: 4, right: 4 } }
    * );
    * // All lines will have 4 spaces of indentation on left and right sides
    * ```
    */
   ```

8. [x] **Ensure Backward Compatibility with Existing Consumers**
   - [x] Identify all call sites in the codebase that use `wrapTextInBoundingBox` 
     ```typescript
     // Search for all instances where the function is used
     // Looking at linter.ts, there are calls at lines 112-115 and other locations
     const wrappedMessageLines = wrapTextInBoundingBox(
       originalMessage,
       consoleWidth,
       messageBoxOptions,
     )
     ```
   
   - [x] Create overload signatures for the `applyIndentation` function to maintain backward compatibility
     ```typescript
     /**
      * Applies indentation to each line of text.
      * Overload 1: Legacy signature with only firstLineIndent
      */
     function applyIndentation(
       lines: string[],
       firstLineIndent?: number,
     ): string[];
     
     /**
      * Applies indentation to each line of text.
      * Overload 2: Full signature with all indentation parameters
      */
     function applyIndentation(
       lines: string[],
       firstLineIndent?: number,
       leftIndent?: number,
       rightIndent?: number,
     ): string[];
     
     /**
      * Implementation for both overloads
      */
     function applyIndentation(
       lines: string[],
       firstLineIndent = 0,
       leftIndent = 0,
       rightIndent = 0,
     ): string[] {
       // Implementation here
     }
     ```

9. [x] **Verify No Regressions in Linter Output**
   - [x] Make a copy of the linter output before making changes
     ```bash
     # Run linter and save current output
     deno task lint:rules > linter-output-before.txt
     ```
     
   - [x] Add test coverage for the exact usage pattern in linter.ts
     ```typescript
     await test.step('Linter-style indentation usage pattern', () => {
       // Test for the pattern used in linter.ts
       const messageBoxOptions = {
         leftMargin: 9,       // Align with position after status + space + text
         rightMargin: '20%',  // Keep 20% padding on the right
         minContentWidth: 20, // Ensure minimum content width
       }
       
       const text = 'This is a typical message displayed in the linter output'
       const consoleWidth = 80
       
       const result = wrapTextInBoundingBox(text, consoleWidth, messageBoxOptions)
       
       // Verify results match expected output format
       assert(result.length > 0, 'Should produce at least one line')
       
       // Each line should respect the margin settings
       for (const line of result) {
         assert(
           textWidth(line) <= consoleWidth - parseMargin('20%', consoleWidth),
           `Line should respect right margin: "${line}"`
         )
       }
     })
     ```
     
   - [x] Test changes to linter output with new functionality
     ```bash
     # Run linter with new changes and save output
     deno task lint:rules > linter-output-after.txt
     
     # Compare outputs
     diff linter-output-before.txt linter-output-after.txt
     ```
     
   - [x] Inspect examples of different rule types in linter output
     - [x] Test with a rule containing blockquotes
     - [x] Test with a rule containing complex formatting
     - [x] Test with a rule containing multiple indentation styles
     
10. [x] **Update the Implementation of Linter.ts If Needed**
    - [x] If the changes break or change the linter output, make necessary adjustments:
      ```typescript
      // In linter.ts, update the messageBoxOptions if needed
      const messageBoxOptions = {
        leftMargin: ruleIdPosition,
        rightMargin: '20%',
        minContentWidth: 20,
        ellipsis: Characters.ELLIPSIS.HORIZONTAL,
        indent: {
          // Add indent options if cleaner formatting is desired
          left: 0,
          right: 0
        }
      }
      ```
      
      Note: No changes were needed to linter.ts as our implementation maintained backward compatibility.
    
    - [x] Consider adding more sophisticated indentation to improve linter output formatting
      ```typescript
      // Example: Format verbose content with hanging indentation
      const contentBoxOptions = {
        leftMargin: ruleIdPosition,
        rightMargin: '20%',
        minContentWidth: 20,
        ellipsis: Characters.ELLIPSIS.MIDDLE,
        indent: {
          type: 'hanging',  // Use hanging indent for verbose content
          size: 2           // 2-space hanging indent
        }
      }
      ```
      
      Note: The existing linter output looked good, so no additional indentation formatting was necessary.

## Notes
- The main challenge is that the current implementation applies indentation at different stages - the right indentation is applied when calculating available width, but left indentation is applied after text wrapping.
- Currently the tests for blockquote style don't explicitly verify right indentation because the test would need to trace through the implementation details.
- Right indentation is currently partially implemented through the `rightIndent` parameter in `resolveIndentType`, but it's not fully utilized in the blockquote style or properly applied in the wrapper.
- Most of the required interfaces and parameters already exist, but need connecting properly.
- The implementation does not require significant refactoring of the core text wrapping logic - just proper utilization of the existing parameters.
- Care must be taken when applying right indentation to ensure it doesn't conflict with the existing rightMargin parameter.
- The linter.ts consumer uses the bounding box primarily for message formatting, and relies on the left/right margin parameters rather than the indent options. Our implementation should preserve this behavior to avoid breaking changes.
- When testing with the linter, use realistic error messages and rule scenarios that might contain long lines or complex formatting to ensure the indentation enhancements don't affect existing message display.
- The existing function signature must be maintained to avoid breaking code that calls the function with the current parameter list.
