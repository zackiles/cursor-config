# Testing Standards and Guidelines

This document outlines the standards, patterns, and guidelines for working with tests in the Cursor Rule Linter project.

## Test File Structure and Patterns

### Core Testing Principles

- Use Deno's built-in test runner and assertion library (`@std/assert`)
- Follow a consistent test file naming pattern: `{feature-name}.test.ts`
- Group related test utilities in `test-utils.ts`
- Use descriptive test names that clearly indicate what is being tested
- Structure test files with JSDoc documentation for clarity

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

### Example Mock File

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
deno test

# Run specific test file
deno test test/specific-feature.test.ts

# Run tests with coverage
deno test --coverage

# Run tests in watch mode
deno test --watch
```

## Test Coverage Requirements

- All lint rules must have corresponding test cases in all three categories (passing/failing/warning)
- Each test file must include both positive and negative test cases
- Mock files should cover edge cases and common usage patterns
- Test utilities should be well-documented and reusable
