# **zackiles/cursor-config**

An opinionated suite of general-purpose, and modern [Cursor Rules](https://docs.cursor.com/context/rules-for-ai) as well as global Cursor configuration that compliments these rules. Battle-tested and leverages best practices of prompt design. Optimized for agent-mode.

> [!NOTE]  
> Checkout [How Cursor Rules Work](how-cursor-rules-work.md) for an undocumented deep-dive on how Cursor uses them internally.

## **How To Use These Rules**

Run the following command in the root of the project you want to install to the rules to. If you have similar name rules they will not be overwritten.

```bash
curl -fsSL https://raw.githubusercontent.com/zacharyiles/cursor-config/main/install.sh | bash
```

That's it! The rules will be automatically detected by Cursor and the [documentation for the rules](CURSOR-RULES.md) will be written to your project root for reference. If you ever want to update the rules, simply run the install script again.

## Available Rules

**The following rules are available**: `with-deno`, `with-javascript`, `with-javascript-vibe`, `with-mcp`, `with-tests`, `create-mcp-server`, `create-prompt`, `create-release`, `create-tests`, `finalize`, `prepare`, `propose`, `recover`

> [!NOTE]  
> For full documentation and examples for each of these rules see [CURSOR-RULES.md](CURSOR-RULES.md).

## Editing Rules

Rules are written in [MDC Syntax](https://github.com/nuxt-modules/mdc) and can be edited in a regular text editor or within Cursor for an enhanced MDC editing experience. They're stored in `./cursor/rules/*.mdc`.

Read more on [Cursor's Documentation](https://docs.cursor.com/context/rules-for-ai) or check out community-contributed rules on the [cursor.directory](https://cursor.directory/).

## Manual vs Automatic Rules

Automatic rules apply to all chats. However, for the rules in `.cursor/rules`, they will either:  

- **Have a glob specified** and will run automatically any time the glob is detected for a file in its context window.  
- **Have no glob specified**, in which case the rule will only run when triggered manually in your chats and prompts using the [@ command](https://docs.cursor.com/context/@-symbols/basic).

## Other Configurations In This Project

### Cursor Global Prompt (Optional)

The file [CURSOR-GLOBAL-PROMPT.md](CURSOR-GLOBAL-PROMPT.md) can be copy and pasted directly into the `User Rules` box in `Cursor Settings -> Rules`. Anything placed there acts as the global prompt/rule applied to all interactions with the agent. It's a great place to set broad rules and context, especially to provide guidance on how to use the rules themselves found in `.cursor/rules`.

[CURSOR-GLOBAL-PROMPT.md](CURSOR-GLOBAL-PROMPT.md) is optimized to work best with the rules provided, but it's optional if you want to add it or not to your Cursor settings.

### .cursorignore & .cursorindexignore

I've provided my example `.cursorignore` and `.cursorignoreindex` files. They illustrate that I typically ignore many files that are documentation or configuration unless they're prefixed with "AI-". Instead, when needed, I'll manually specify those files or folders when needed. That way, by default, I don't pollute Cursor's [index](https://docs.cursor.com/context/codebase-indexing) or the model's context window in quick chats or prompts with the contents of every single file in the codebase. It has the side benefit of not confusing the model if it accidentally includes outdated markdown documentation that describes the codebase differently than it currently is (a real pain to debug). Those files can always be manually included in a Cursor chat using `@` commands if really needed.

#### Differences

**.cursorignore:** For completely ignoring files in cursor. Note: things in `.gitignore` are already automatically ignored. I'll often use this to temporarily ignore files that might confused the AI based on work I'm doing. 

**.cursorignoreindex:** For files you want available to cursor, but only when manually provided to it. These files will NOT be indexed. Note: things in `.gitignore` are already automatically ignored. I'll often use this to not index code that may confused the AI unless I provide it manually with specific context, such as a large schema file or random project notes and documentation. A typical file you'll want to ignore is lock files.

## TODO

- Add general purpose MCP servers
- Add AI docs to be used with Cursors `@doc` system. See [Cursor @Docs](https://docs.cursor.com/context/@-symbols/@-docs).
