# Available Cursor @ Rules

This project contains Cursor rules!

The following rules are configured in `.cursor/rules` and can be triggered using the `@` command, though some activate automatically based on configuration in `RULES_FOR_AI.md` or when relevant files are added to the chat that match the rule's glob pattern.

## 1. Development and Code Generation

General purpose and frequently used rules for code generation. Battle tested, and frequently updated. Can be added anywhere in the prompt, or added to the end. Can be used in Agent or Chat mode

| Rule | Trigger Type | Description |
|------|--------------|-------------|
| **`[with-javascript.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-javascript.mdc)`** | Semi-Manual | Enforces coding standards for JavaScript/TypeScript files. Applies to `.js` or `.ts` files, promoting best practices in naming, syntax, and documentation. |
| **`[with-javascript-vibe.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-javascript-vibe.mdc)`** | Manual | Alternative to standard JS rules for "bleeding edge" coding styles. *Use with caution.* |
| **`[with-deno.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-deno.md)`** | Semi-Manual | Provides Deno 2-specific best practices from official documentation. Triggers manually or when a `deno.json{c}` file was added to the context. |
| **`[with-project-directory](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-project-directory)`** | Semi-Manual | Provides specific guidelines for files in the `src/utils/`, `bin/`, and `scripts/` directories. Ensures code follows the intended purpose and structure for each special directory. |
| **`[with-mcp.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-mcp.md)`** | Semi-Manual | Provides context on the [Model Context Protocol](https://spec.modelcontextprotocol.io/specification/draft/) for writing MCP Servers using the MCP Typescript SDK. See: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk/tree/main). Triggers manually or when a `mcp-schema.json` file was added to the context. |
| **`[create-mcp-server.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/create-mcp-server.md)`** | Semi-Manual | Prompts the AI to generate a complete [Model Context Protocol](https://spec.modelcontextprotocol.io/specification/draft/) server using the MCP Typescript SDK. See: [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk/tree/main). You can provide your own instructions along with the prompt. Triggers manually or when a `mcp-schema.json` file was added to the context. |
| **`[create-release.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/create-release.md)`** | Manual | Intelligently handles almost everything needed to release a package or module for a Javascript project. Handles version bumps, documentation and changelog updates, branching, commit message formatting, pushing and tagging etc. Supports npm and JSR registries and will compliment existing CI/CD setups. |
| **`[finalize.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/finalize.mdc)`** | Semi-Automatic | Ensures the AI fully completes it's previous work. Outlines cleanup steps after code generation or modifications to ensure the changes they made to the codebase are clean, functional, free of dead-code, and well-documented. Great to use after every code-generation prompt to help the AI close out any loose ends and double check their last changes were implemented properly. I personally use this one a LOT. Does not need additional context provided. |

## 2. Testing and Debugging

These rules are best to add at the end of your message to provide additional context in Agent mode.

| Rule | Trigger Type | Description |
|------|--------------|-------------|
| **`[create-tests.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/create-tests.mdc)`** | Semi-Manual | Guidelines for creating effective tests, emphasizing simplicity, locality, and reusability. Triggers manually or automatically when a file in the format `*.test.{js/ts}` has been added to the context. |
| **`[with-tests.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/with-tests.mdc)`** | Manual | Procedures for chatting about and analyzing your tests as well as running tests. Triggers manually or automatically when a file in the format `*.test.{js/ts}` has been added to the context. |
| **`[recover.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/recover.mdc)`** | Manual | Steps to take when facing persistent errors. Configured to be recommended by the model when appropriate, otherwise triggers manually. |

### 2.1 Examples

Here's an entire workflow to write tests, run them, and then recover if the test writing goes wrong:

1 ) Write the tests (Agent Mode):

```text
"Add a new test to ensure graceful shutdown. @create-tests"
```

2 ) Run the tests (Agent Mode):

```text
"Great tests. Now run them and debug any errors in the output. @with-tests"
```

3 ) Run the tests (Agent Mode):

```text
"You keep introducing errors into the tests! @recover"
```

## 3. Planning and Documentation

These rules are for Chat mode only, and are best added at the end of your message to provide additional context.

| Rule | Trigger Type | Description |
|------|--------------|-------------|
| **`[prepare.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/prepare.md)`** | Manual | Prompts the model to perform thorough research and preparation before making changes to maintain code cohesiveness. |
| **`[propose.md](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/propose.md)`** | Manual | Structures brainstorming sessions and question-answering without direct code changes. Results can be exported via @summary or implemented in composer mode. |
| **`[create-prompt.mdc](https://github.com/zackiles/cursor-config/tree/main/.cursor/rules/create-prompt.mdc)`** | Semi-Automatic | Guidelines for creating comprehensive AI prompts with clear objectives and examples. Activates when prompt generation is requested. |

### 3.1 Examples

Here's an entire workflow to plan an implement a big sweeping change!

1 ) Plan a great proposal first, and iron out the details. Combine `@prepare` with `@create-prompt` if you want for the best proposal:

```text
"Review the files I've shared and write a proposal to refactor the code to be more DRY. @propose @prepare"
```

2 ) Then after the proposal looks good:

```text
"Great proposal, now and generate a prompt to implement it. @create-prompt"
```
