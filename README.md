# cursor-config
My opinionated [Cursor Rules](https://docs.cursor.com/context/rules-for-ai).

## How to Use

1. Copy the global rules from `./RULES_FOR_AI.md` into your **Cursor Settings**.
2. For new projects, copy the entire `.cursor` folder into the root of your project’s workspace in Cursor. Once moved, they'll be detected in your **Cursor Settings**. You can also edit the actual rules in the `.mdc` rule files in `./cursor/rules/file.mdc` or add your own as you wish. These files are written in [MDC Syntax](https://github.com/nuxt-modules/mdc) and can be edited in a regular text editor or within Cursor for an enhanced MDC editing experience.
3. Read more on [Cursor's Documentation](https://docs.cursor.com/context/rules-for-ai) or check out community-contributed rules on the [cursor.directory](https://cursor.directory/).
4. Global rules apply to all chats. However, for the rules in `.cursor/rules`, they will either:  
   - **Have a glob specified** and will run automatically any time the glob is detected for a file in its context window.  
   - **Have no glob specified**, in which case the rule will only run when triggered manually in your chats and prompts using the [@ command](https://docs.cursor.com/context/@-symbols/basic).

**NOTE:** I've also provided my example `.cursorignore` file, mainly to illustrate that I typically ignore all files by default and manually specify what files or folders my source code is in. That way, by default, I don't pollute Cursor’s [index](https://docs.cursor.com/context/codebase-indexing) or the model's context window in quick chats or prompts with the contents of every single file in the codebase. It has the side benefit of not confusing the model if it accidentally includes outdated markdown documentation that describes the codebase differently than it currently is (a real pain to debug). Those files can always be manually included in a Cursor chat using `@` commands if really needed.
