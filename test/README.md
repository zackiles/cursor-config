# Working With Tests in this `test/` Folder

This document is a technical reference to running and writing tests in this codebase. It should be reviewed and followed before interacting with any files in this folder. It should also be review when handling mock files in the `test/mocks` folder.

## Test File Structure and Patterns

### Core Testing Principles

- Use Deno's built-in test runner and assertion library (`@std/assert`)
- Follow a consistent test file naming pattern: `{feature-name}.test.ts`
- Group related test utilities in `test-utils.ts`
- Use descriptive test names that clearly indicate what is being tested
- Structure test files with JSDoc documentation for clarity

### Test Commands

Always prefer using the predefined tasks in `deno.json` when available. For this project:

```bash
# Run all tests (preferred method)
deno task test

# Format and lint before testing
deno task fmt && deno task lint && deno task test
```

If you need more granular control, use the Deno CLI test commands:

```bash
# Run all tests in the project
deno test -A

# Run tests in a specific directory
deno test -A test/specific-directory/

# Run a single test file
deno test -A test/specific-feature.test.ts

# Run tests matching a pattern
deno test -A --filter "test name pattern"

# Run a specific test step
deno test -A --filter "test name" --filter "step name"
```

#### Available Test Flags

- **Test Selection and Filtering**:
  - `--filter <pattern>` - Run tests with names matching the pattern
  - `--ignore <pattern>` - Ignore tests with names matching the pattern
  - `--fail-fast` - Stop on first test failure
  - `--shuffle` - Randomize test order
  - `--parallel` - Run tests in parallel

- **Output and Reporting**:
  - `--reporter=<type>` - Set output format (pretty, dot, junit)
  - `--quiet` - Suppress output of test cases
  - `--junit-path=<file>` - Write JUnit XML report to file
  - `--coverage` - Collect coverage information
  - `--coverage-dir=<dir>` - Output directory for coverage data

- **Debugging and Troubleshooting**:
  - `--inspect` - Enable inspector
  - `--inspect-brk` - Enable inspector and break on start
  - `--strace-ops` - Trace ops for performance debugging
  - `--log-level=<level>` - Set log level (debug, info, warn)
  - `--allow-none` - Don't error if no test files are found

- **Runtime and Environment**:
  - `--watch` - Watch for file changes and restart tests
  - `--no-check` - Skip type checking
  - `--reload` - Force reload of all dependencies
  - `--trace-ops` - Log all ops
  - `--seed <number>` - Set random number generator seed

- **Resource Control**:
  - `--jobs <number>` - Set number of parallel workers
  - `--timeout <ms>` - Set test timeout in milliseconds
  - `--sanitizers` - Enable sanitizers for memory issues

Remember: The `-A` flag grants all permissions. For production environments, consider using more specific permissions:

- `--allow-read` - Allow file system read access
- `--allow-write` - Allow file system write access
- `--allow-net` - Allow network access
- `--allow-env` - Allow environment access
- `--allow-run` - Allow running subprocesses

### Standard Test File Layout

```typescript
/**
 * Test suite description in JSDoc format
 * @module testModuleName
 * @see related modules/implementations
 */
import { assert } from '@std/assert'
import { featureToTest } from '../src/path/to/feature.ts'
import { testUtils } from './test-utils.ts'

const TEST_CONFIG = {
  TEST_NAME: 'category/feature-name',
  PASSING_MOCK_PATH: 'passing-rules/.cursor/rules/**/*.mdc',
  FAILING_MOCK_PATH: 'failing-rules/.cursor/rules/**/*.mdc',
  DENO_ENV: 'test' as const,
} as const

// Group related tests under descriptive Deno.test blocks
Deno.test(`[${TEST_CONFIG.TEST_NAME}]: test description`, async (t) => {
  // Use test steps for granular organization
  await t.step('specific test case', async () => {
    // Test implementation
  })
})
```

### Test Utilities

The `test-utils.ts` file provides common utilities for:

1. Loading mock rule files:
   ```typescript
   const mockRuleFiles = await loadMockRuleFiles('rules/**/*.mdc')
   ```

2. Verifying mock files exist:
   ```typescript
   const verifiedFiles = await verifyAndGetMockRuleFiles(t, mockGlobPattern)
   ```

3. Processing and validating MDC files:
   ```typescript
   const mdcFile = await processAndVerifyMdcFile(filePath)
   ```

## Mock Files Organization

The `test/mocks` directory contains structured test cases for linting rules:

```
test/mocks/
├── failing-rules/          # MDC files that should fail lint rules
│   └── .cursor/
│       └── rules/
│           └── subfolder/  # Organized by rule category
├── passing-rules/          # MDC files that should pass lint rules
│   └── .cursor/
│       └── rules/
│           └── subfolder/
└── warning-rules/          # MDC files that should trigger warnings
    └── .cursor/
        └── rules/
            └── subfolder/
```

### Mock File Categories

- **Passing Rules**: Contains valid MDC files that should pass all relevant lint rules
- **Failing Rules**: Contains MDC files with intentional errors to test lint rule failure cases
- **Warning Rules**: Contains MDC files that should trigger warning-level lint messages

Each category mirrors the `.cursor/rules` structure to maintain consistency with real-world usage.

## Creating Mock MDC Files

When creating mock MDC files for testing, follow these guidelines:

### Rule Type Structure

MDC files must conform to one of the following rule types as defined in the core documentation:

1. **AlwaysAttached**:
   ```yaml
   ---
   alwaysApply: true
   globs: []
   description: ""
   ---
   ```

2. **AutoAttached**:
   ```yaml
   ---
   alwaysApply: false
   globs: ["*.ts", "*.tsx"]
   description: ""
   ---
   ```

3. **AgentAttached**:
   ```yaml
   ---
   alwaysApply: false
   globs: []
   description: "When to use this rule..."
   ---
   ```

4. **ManuallyAttached**:
   ```yaml
   ---
   alwaysApply: false
   globs: []
   description: ""
   ---
   ```

### Mock File Creation Steps

1. Determine the test case category (passing/failing/warning)
2. Choose appropriate rule type based on test requirements
3. Create the file in the correct subfolder structure
4. Add frontmatter according to rule type specification
5. Add relevant markdown content following content guidelines
6. Ensure the mock demonstrates specific lint rule behavior

### Example Mock Cursor Rule File

```markdown
---
alwaysApply: false
globs: ["*.ts"]
description: ""
category: "Testing"
---

# Test Rule Title

This is a paragraph that follows the header, as required.

## Section Header

Another required paragraph under this section.

### Examples

```typescript
// Code example
const example = "test"
```

## Running Tests

To run tests for the project:

```bash
# Run all tests
deno test -A

# Run specific test file
deno test -A test/specific-feature.test.ts

# Run tests with coverage
deno test -A --coverage

# Run tests in watch mode
deno test -A --watch
```

## Test Coverage Requirements

- All lint rules must have corresponding test cases in all three categories (passing/failing/warning)
- Each test file must include both positive and negative test cases
- Mock files should cover edge cases and common usage patterns
- Test utilities should be well-documented and reusable

## Logging, Debugging, Inspecting, and Troubleshooting Tests

### Test Logger Configuration

The project includes a dedicated debug logger in `test/test-utils.ts` that provides consistent logging across test suites. The logger is designed to handle various data types intelligently and format output for maximum readability.

#### Enabling Debug Logging

Debug logging is controlled by the Deno log level flag:
```bash
# Run tests with debug logging enabled
deno test -A --log-level=debug

# Run specific test with debug logging
deno test -A test/specific-feature.test.ts --log-level=debug
```

#### Using the Debug Logger

```typescript
import { DEBUG } from './test-utils.ts'

Deno.test("my test", async (t) => {
  DEBUG.log("Test started", { config: testConfig })
  // ... test implementation ...
  DEBUG.log("Complex object:", complexData)
})
```

#### Debug Logger Features

The logger uses `Deno.inspect` with optimized settings for test debugging:

- **Formatting Options**:
  - `depth: 6` - Deep object inspection
  - `colors: true` - ANSI color output for readability
  - `compact: false` - Expanded output format
  - `breakLength: 80` - Standard terminal width

- **Content Control**:
  - `iterableLimit: 50` - Manageable array/iterable output
  - `strAbbreviateSize: 150` - Concise string truncation
  - `showHidden: true` - Shows non-enumerable properties
  - `getters: true` - Evaluates getter properties

- **Special Handling**:
  - Direct output for primitives and errors
  - Custom `toString()` method support
  - `toJSON()` method support for JSON-serializable objects
  - Proxy inspection with `showProxy: true`

### Advanced Troubleshooting

#### Operation Tracing with --strace-ops

For debugging persistent issues or performance problems:

```bash
# Trace operations with output to file
deno test -A --strace-ops test/specific-feature.test.ts > ops_trace.log

# Combine with debug logging
deno test -A --strace-ops --log-level=debug test/specific-feature.test.ts
```

The trace log will show:
- Operation dispatch and completion times
- Hanging or slow operations
- Resource usage patterns

#### Interactive Debugging

Use Chrome DevTools for step-by-step debugging:

```bash
# Start test with debugger
deno test -A --inspect-brk test/specific-feature.test.ts

# With operation tracing
deno test -A --inspect-brk --strace-ops test/specific-feature.test.ts
```

Then:
1. Open Chrome and navigate to `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Set breakpoints and debug

#### Test Filtering and Organization

Improve troubleshooting with test filters:

```bash
# Run specific test by name
deno test -A --filter "test name" 

# Run tests in specific directory
deno test -A test/specific-directory/

# Stop on first failure
deno test -A --fail-fast
```

#### Test Output Reporters

Choose appropriate output format for debugging:

```bash
# Detailed output
deno test -A --reporter=pretty

# Minimal output
deno test -A --reporter=dot

# CI-friendly output
deno test -A --reporter=junit
```

#### Common Troubleshooting Steps

1. **Verify Test Environment**:
   ```bash
   deno info -A test/specific-feature.test.ts
   ```

2. **Check Test Dependencies**:
   ```bash
   deno info -A --json test/specific-feature.test.ts
   ```

3. **Force Cache Reload**:
   ```bash
   deno test -A --reload
   ```

4. **Increase Log Verbosity**:
   ```bash
   deno test -A --log-level=debug --strace-ops
   ```

5. **Isolate Test Cases**:
   ```bash
   # Run single test step
   deno test -A --filter "test name" --reporter=pretty
   ```

## Example Test File (some-test.ts)

Below is an example test template you could use for illustration:

```ts
/**
 * @module someTest
 */
import { assert } from '@std/assert'
import { processAndVerifyMdcFile, verifyAndGetMockRuleFiles } from './test-utils.ts'

const TEST_CONFIG = {
  TEST_NAME: 'some-test',
  DENO_ENV: 'test' as const,
} as const

Deno.test(`[${TEST_CONFIG.TEST_NAME}]: Test 1`, async (t) => {
  // Write your test as well as any t.step() inside it.
})

```

Remember to check the test utilities (test/@test-utils.ts) and mock files when troubleshooting, as they often contain valuable context and debugging capabilities.
