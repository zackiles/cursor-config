# cursor-config
My opinionated [Cursor Rules](https://docs.cursor.com/context/rules-for-ai). For now these only support backend Javascript/Typescript work (Sorry my React/Golang crew).

## How to Use Rules

1. Copy the global rules from `./RULES_FOR_AI.md` into your **Cursor Settings**.
2. For new projects, copy the entire `.cursor` folder into the root of your project’s workspace in Cursor. Once moved, they'll be detected in your **Cursor Settings**. You can also edit the actual rules in the `.mdc` rule files in `./cursor/rules/file.mdc` or add your own as you wish. These files are written in [MDC Syntax](https://github.com/nuxt-modules/mdc) and can be edited in a regular text editor or within Cursor for an enhanced MDC editing experience.
3. Read more on [Cursor's Documentation](https://docs.cursor.com/context/rules-for-ai) or check out community-contributed rules on the [cursor.directory](https://cursor.directory/).
4. Global rules apply to all chats. However, for the rules in `.cursor/rules`, they will either:  
   - **Have a glob specified** and will run automatically any time the glob is detected for a file in its context window.  
   - **Have no glob specified**, in which case the rule will only run when triggered manually in your chats and prompts using the [@ command](https://docs.cursor.com/context/@-symbols/basic).

## Available @ Rules
All rules can be triggered using the @ command, but some of them are always applied as configured in `RULES_FOR_AI.md` or because you've provided files in the chat to the model that match a rules glob pattern.

#### `finalize-work.mdc`
**Trigger: Semi-Automatic**  
This rule outlines the steps to take at the end of generating code or making changes. It triggers after any significant modifications to ensure that the codebase is clean, functional, and well-documented. Triggers only when the model was tasked with generating code.

#### `generate-prompt.mdc`
**Trigger: Semi-Automatic**  
This rule provides guidelines for generating prompts for AI agents. It triggers when tasked with creating a prompt, ensuring that the output is comprehensive and structured with clear objectives and examples. Triggers only when the model was asked to generate a prompt.

#### `javascript.mdc`
**Trigger: Semi-Manual**  
This rule specifies coding style guidelines for JavaScript and TypeScript files. It triggers for any code generation or modification within `.js` or `.ts` files, promoting best practices in naming, syntax, and documentation.

#### `with-deno.md`
**Trigger: Manual**
Adds a bunch of great context specifcally for Deno 2 to help better leverage the best practices and latest it has to offer straight from the Deno documentation.

#### `running-tests.mdc`
**Trigger: Manual**  
This rule details the steps for running tests in the codebase. It triggers when tests need to be executed, ensuring that the testing process is thorough and well-understood. Triggers manually with the @ command and can only be used in the Composer's Agent-Mode (as that's the only mode that has access to your terminal and it;s output).

#### `writing-tests.mdc`
**Trigger: Semi-Manual**  
This rule provides guidelines for writing tests in the codebase. It triggers when new tests are being created, emphasizing simplicity, locality, and reusability in test design. Triggers only when it detects the glob of a test file.

#### `recovery.mdc`
**Trigger: Manual**  
This rule outlines the steps to take when repeated failures occur in resolving errors. It triggers when the system encounters a cascade of issues that cannot be resolved, guiding the recovery process. Only triggered when you ask it to, but the `RULES_FOR_AI.md` configures the model to recommend to you when it should be used.

#### `prepfirst.md`
**Trigger: Manual**
Add this rule to chats or commands that require the model to zoom out and prep before they reason, propose, or make changes to the codebase so they can ensure their actions maintain cohesiveness and are well informed.

#### `propose.md`
**Trigger: Manual**
Add this rule to chats that are only for brainstorming solutions and answering questions and which require the LLM to do deep research and provide a structured fact-based answer. Note: although this rule prevent the LLM from making changes to the code directly, the structure of it's response is optimized to be exported through @summary or copying and pasting into a composer to implement. You can also use @generate-prompt.mdc directly after their proposal to convert it into a read-to-go prompt that can be given to an agent in composer mode.


## .cursorignore

**NOTE:** I've also provided my example `.cursorignore` file, mainly to illustrate that I typically ignore all files by default and manually specify what files or folders my source code is in. That way, by default, I don't pollute Cursor’s [index](https://docs.cursor.com/context/codebase-indexing) or the model's context window in quick chats or prompts with the contents of every single file in the codebase. It has the side benefit of not confusing the model if it accidentally includes outdated markdown documentation that describes the codebase differently than it currently is (a real pain to debug). Those files can always be manually included in a Cursor chat using `@` commands if really needed.
