## HOW YOU THINK, PLAN, DESIGN, AND ARCHITECT

**Apply EXTREME LATERAL THINKING** (reason: fosters solutions for complex, unstructured problems). Approach unconventional or hard challenges from multiple angles:  

- **Analogical Thinking** (reason: leverage domain parallels)  
  Example: If building an event-scheduling system, reference how assembly lines process inputs sequentially.  
- **Divergent Thinking** (reason: generate numerous innovative ideas)  
- **Pattern Recognition** (reason: reuse proven solution templates)  
- **Reverse Thinking** (reason: see new possibilities by inverting constraints)  
- **Systems Thinking** (reason: track first- and second-order effects in interconnected parts)  

Break domains into symbolic systems and subsystems to manage cascading impacts more effectively.

## HOW YOU GENERATE OR MODIFY CODE AND IMPLEMENT SOLUTIONS

- **Elegance and Practicality** (reason: ensure readability while limiting complexity)  
- **Meaningful Names** (reason: communicate responsibilities in larger codebases)  
- **Reusable and Composable** (reason: promote modularity and future scalability)  
- **Modern and Cutting-Edge** (reason: avoid legacy or obsolete libraries/patterns)  
- **Sparse Inline Comments** (reason: reduce noise; clarify only complex logic)  

On medium to large codebases, prioritize maintainability, extensibility, and clarity via self-documenting patterns.

## FINALIZING WORK

After requested code changes are completed and accepted, **ALWAYS** apply **ALL** steps in `@finalize-work.mdc` for medium or large changes (reason: preserve consistency). Skip for minimal or text-only modifications.

## HOW YOU DOCUMENT

- **Inline Comments**: Should be used rarely unless the inline comment describes an extremely unusual or confusing line or block of code. When it's absolutely necessary to add an inline comment they should NEVER describe _what_ the code is doing, and instead describe _why_ its doing it.
- **Jsdoc**: Top-level functions, classes, types and modules must be documented with Jsdoc and leverage Jsdoc attributes to enrich the documentation where possible. **IMPORTANT**: Any time a top-level thing is modified that has a Jsdoc comment you MUST ensure the comment is updated and accurate according to the changes you made if they're relevant to the comment.
- **AI DOCUMENTATION**: Markdown files that have the prefix "AI-" contain highly relevant documentation for you and other AI agents working on the codebase. You should read them and update them often in a way that is optimized for you and the other AI agents. Humans will not use these documents. Examples of "AI DOCUMENTATION" files: `AI-README` or `AI-CHANGELOG.md` or `AI-CONTRIBUTING.md`.

## HOW YOU DEBUG AND FIX BUGS OR ISSUES

- If two consecutive errors appear, **ALWAYS** expand debugging efforts (reason: deeper insight into the root cause). Examples: add debug lines, run a single failing test in isolation, write logs to disk for progress tracking, or filter logs with `cat`/`grep` to isolate relevant details.  
- If an error persists, offer to run tests, enable debug logs, research solutions, and do most troubleshooting on behalf of the user (reason: reduce user burden).  
- If no solutions remain, recommend activating “recovery mode” using `@recovery.md` (reason: final fallback for critical issues).

### FIXING FAILING TESTS

- **Never fix a broken test before reading the entire code it’s testing** (reason: obtain full context).  
- **Always assume the test could be incorrect** (reason: tests may be outdated or misaligned). Consider asking the user to remove repeatedly failing tests if you can’t resolve them after a few tries.  
- **If tests reside in a shared folder (like `/test`), review file names for mocks or test-utilities** (reason: codebase-specific files might affect test behaviors).

## IMPORTANT: CONFLICT RESOLUTION

When ANY guideline here contradicts established codebase practices, follow the codebase norms (reason: maintain project-wide uniformity).
