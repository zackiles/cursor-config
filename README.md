# **zackiles/cursor-config**

An opinionated suite of general-purpose and modern [Cursor Rules](https://docs.cursor.com/context/rules-for-ai) as well as global Cursor configuration that complements these rules. Battle-tested and leverages best practices of prompt design. Optimized for agent-mode.

> [!TIP]
> For more details on how Cursor Rules work, please read this deep-dive guide on [How Cursor Rules Work](./docs/how-cursor-rules-work.md).

## **How To Use These Rules**

Run the following command in the root of the project where you want to install the rules. If you have rules with similar names, they will not be overwritten.

```bash
curl -fsSL https://raw.githubusercontent.com/zackiles/cursor-config/main/install.sh | bash
```

That's it! The rules will be automatically detected by Cursor and the [documentation for the rules](CURSOR-RULES.md) will be written to your project root for reference. If you ever want to update the rules, simply run the install script again.

> [!IMPORTANT]  
> This project stores its rules at `.cursor/rules/global` and creates a separate folder for your custom project rules you can use at `.cursor/rules/local`. For brevity this documentation references the base path of `.cursor/rules`.

## Available Rules

**The following rules are available**: `with-deno`, `with-javascript`, `with-javascript-vibe`, `with-mcp`, `with-tests`, `with-project-directory`, `create-mcp-server`, `create-prompt`, `create-release`, `create-tests`, `finalize`, `prepare`, `propose`, `recover`

> [!TIP]  
> For full documentation and examples for each of these rules, see [CURSOR-RULES.md](CURSOR-RULES.md).

## Creating and Editing Rules

### Global Rules

Rules are written in [MDC Syntax](https://github.com/nuxt-modules/mdc) and can be edited in a regular text editor or within Cursor for an enhanced MDC editing experience. They're stored in `.cursor/rules/global/*.mdc`.

### Project Rules

This project also creates a second sub-directory named `.cursor/rules/local` for you to use to store your own project-specific rules. Separating cursor rules this way is a best practice and helps managing many global and project-specific rules across code-bases easier. You can even symlink the globals folder in your project and centralize them elsewhere in your workspace.

**Read more** on [Cursor's Documentation](https://docs.cursor.com/context/rules-for-ai) or check out community-contributed rules on [cursor.directory](https://cursor.directory/).

## Manual vs Automatic Rules

Cursor rules have four Attachment Types:

1) **Agent Attached**: a description is given that an LLM uses in each conversation to determine if the rule should be attached to the context window.

2) **Auto Attached**: a glob patter specifies if a rule will be attached to the context window.

3) **Always Attached**: every conversation will have the rule added to the context window.

4) **Manually Attached**: the rule must be manually attached with the `@` command in the chat, or another rule in the context window explicitly references the manually attached rule using the `@` command.

> [!TIP]  
> **@ Command Usage** Any rule can be manually attached regardless of it's attachment type using the [@ command](https://docs.cursor.com/context/@-symbols/basic).

## Other Configurations In This Project

### Cursor Global Prompt (Optional)

The file [CURSOR-GLOBAL-PROMPT.md](CURSOR-GLOBAL-PROMPT.md) can be copied and pasted directly into the `User Rules` box in `Cursor Settings -> Rules`. Anything placed there acts as the global prompt/rule applied to all interactions with the agent. It's a great place to set broad rules and context, especially to provide guidance on how to use the rules themselves found in `.cursor/rules`.

[CURSOR-GLOBAL-PROMPT.md](CURSOR-GLOBAL-PROMPT.md) is optimized to work best with the rules provided, but it's optional whether you want to add it to your Cursor settings.

### `.cursorignore` & `.cursorindexignore`

Provided as examples. These files illustrate a typical approach where many documentation or configuration files are ignored unless prefixed with "AI-". Instead, when needed, these files or folders are manually specified. This prevents polluting Cursor's [index](https://docs.cursor.com/context/codebase-indexing) or the model's context window in quick chats or prompts with the contents of every single file in the codebase by default. An additional benefit is avoiding model confusion if the model accidentally includes outdated markdown documentation describing the codebase differently than its current state. Such files can always be manually included in a Cursor chat using `@` commands if necessary.

#### Differences

**`.cursorignore`**: For completely ignoring files in Cursor. Note: things in `.gitignore` are already automatically ignored. I'll often use this to temporarily ignore files that might confuse the AI based on work I'm doing.

**`.cursorindexignore`**: For files you want available to Cursor, but only when manually provided to it. These files will NOT be indexed. Note: things in `.gitignore` are already automatically ignored. I'll often use this to not index code that may confuse the AI unless I provide it manually with specific context, such as a large schema file or random project notes and documentation. A typical file you'll want to ignore is lock files.

## TODO

- Add general purpose MCP servers
- Add AI docs to be used with Cursor's `@doc` system. See [Cursor @Docs](https://docs.cursor.com/context/@-symbols/@-docs).
