# TODOs

## 1) Shadow Root For Localized Context

Instead of many `*.md` file in every folder tracking context for AI establish a pattern where we use a folder named `.cursor/shadow` where we mimic file and folders of the project route and have the ability to stash context for all or some of them.

### Examples:

**NOTE**: ".mem" files are just simple text files.

- Given *project root* folder `test/`
  - Shadow root created at`.cursor/shadow/test`
- User prompts the agent: "@remember to always review `test/README.md` before running tests in `test/`
  - Instructed by the @remember rule the Agent prepends `- always review test/README.md before running tests in test/` to file `.cursor/shadow/test/index.mem`
  - Instructed by the @remember rule the Agent updates the `@with-memory` rule to add the enabled shadow path of `.cursor/shadow/test/index.mem` to a list of paths in a section named "## Enabled Shadow Paths" if it doesn't already exist/there were no memories added for this folder yet.
- In a next message, user prompts the agent: "@remember to always run the test at `test/auth.test.ts` with the --verbose flag."
  - Instructed by the `@remember` rule the Agent prepends "- always run the test at `test/auth.test.ts` with the --verbose flag." to the file `.cursor/shadow/test/auth.test.ts.mem`
  - Instructed by the @remember rule the Agent updates the `@with-memory` rule to add the enabled shadow path of `.cursor/shadow/test/auth.test.ts.mem` to a list of paths in a section named "## Enabled Shadow Paths" if it doesn't already exist/there were no memories added for this file yet.
- Given a global system prompt that exists indefinitely in the context window and instructs the agent to "always check its "memory" for information on a file or folder listed in the section in its rule called "# Enabled Shadow Paths" before it reads/accesses/writes by following the instructions in `@with-memory`":
  - User prompts the agent: "run the test at `test/auth.test.ts`"
    - Agent tries to access the test file and both the `text/` folder and `test/auth.test.ts` enter its context window
    - Before running the test the agent realizes the global system prompt requires following instructions in `@with-memory` so they load those instructions and it informs them they need to go read two from with notes or instructions for them to follow before taking any other actions. It provides them the shadow paths of both `.cursor/shadow/test/index.mem` and `.cursor/shadow/test/admin.test.ts.mem`
    - Agent reads the files and receives all the notes and instructions that were prepended to them with the `@remember` command: - "always review test/README.md before running tests in `test/` and "always run the test at `test/auth.test.ts` with the --verbose flag."
    - Agent continues their workflow of running the test and now remembers to use the --verbose flag and review test/README.md.

## Shadow Folder Examples

### GOOD Paths

- Path `src/utils/steaming-video.ts`
  - Shadow `.cursor/shadow/src/utils/streaming-video.ts.mem`

- Path `src/README.md`
  - Shadow `.cursor/shadow/src/README.md.mem`

- Path `logs/`
  - Shadow `.cursor/shadow/logs/index.mem`

### BAD Paths

Assuming the current project or workspace root is `Users/documents/my-project` and the shadow root is `Users/documents/my-project/.cursor/shadow` the following would become BAD paths that the `@remember` command would detect and return an error to a user. No memory files will be written for BAD paths such as these:

- `.cursor`
  - "ERROR: Memory files can't be created for files or folders within the `.cursor` folder."
- `.cursor/memory`
  - "ERROR: Memory files can't be created for files or folders matching `.cursor/**/**`
- `Users/documents`
  - "ERROR: Memory files can't be for files or folders outside the current project or workspace root (hint: the one `.cursor` is in)."
- `Users/documents`
  - "ERROR: Memory files can't be for files or folders outside the current project or workspace root (hint: the one `.cursor` is in)."

## `@remember` vs `@with-memory`

1) `@remember`:

- Manually attached cursor rule that MUST be triggered manually by using it in a chat message
- Will typically be used like "@remember this fact about such and such" but must be converted to grammatically correct bullet point such as "- FACT: such and such"
- Takes the users current message and preprocess it into content and makes a perfect entry for it in a mem file
- Creates mem files for files and folders
- Maintains a list of enabled memory files in the shadow root in a section named "## Enabled Shadow Paths" inside the rule file named `@with-memory`.
  - Ensures when files or folders on the list in "## Enabled Shadow Paths" no longer exist that they're removed from the list.
- Creates folders in the shadow root if they don't exist
- Manages conflicts, such as when a file or folder is removed, moved, or renamed from the project root and so those actions must be mirrored on-demand (whenever they're noticed) in the shadow root.
- Handles and informs the users of errors that happen when saving their memory and guides them in those instances on how to solve the error and relevant debugging information related to the error and memory.
- Maintains the consistency of the memory file at all times, such as when updating the mem file with a new memory it will also ensure previous memories are still consistently written and formatted according to the requirements.
- Detect user errors in specifying the correct file or folder name to save a memory for. If a file or folder doesn't exist in project, it will error and NOT create a shadow file or folder or write a memory for it.

1) `@with-memory`

- Always attached to every context window.
- Provides comprehensive details on how to access memory, what the valid and enabled shadow paths.
- Defines a strict specification and interface to accessing memory (.mem) files for agents trying to access mem files in the shadow root.
- Acts silently unless there is an error. If it's manually triggered by attaching it to a current user message, and its unable to determine what the memory file is or a memory file doesn't exist, it will not inform the user and fail silently.
  - If the user explicitly instructs to receive a specific memory file that doesn't exist, then it will error and let the user know.
- Maintains a list of enabled memory files in the shadow root in one of its sections in the rule file named "## Enabled Shadow Paths".
  - Ensures when files or folders on the list in "## Enabled Shadow Paths" no longer exist that they're removed from the list.



### General Notes

- The `@remember` rule might have to instruct the agent to create the `.cursor/shadow` folder if it doesn't exist.
  - It should instruct to create folders for subpaths on demand if there is every a memory being where the full shadow path doesn't exist yet (when no memories saved in the path yet).
- ALL memories in the mem files MUST be added with a bullet points. All content in mem files is just a single long running bullet point list
- Prepending was chose over appending so that the latest memory always stays at the top.
- The typical memory will be just a few sentences or paragraphs that must be processed where needed to fit into a bullet point list in the mem file if the original format isn't compatible with that, such as when the content is a table or multiple broken lines. In those instances the agent will be instructed in the @remember command to preprocess and convert the users memory into a bullet point before writing it to the mem file.
- Bullet points in mem files can have 3 levels of sub-bullet points if needed but no more.
- Ideally, the most important theme or word id the memory should be refactored and formatted as a bolded label at the start of the bullet point when writing it to the mem file.

### Objective

This will enable the typical pattern used by software engineers using agentic code-generation systems like Cursor, Claude Code, or Windsurf, where they'll configure dynamic context to be injected automatically during runtime into the agents window when certain files or folders enter it.

Since agents that read or work on filesystems need to first load those files or folders into their context window, it becomes the perfect place to inject context at the moment they are starting or taking a step in a known workflow. Consider the chaining capabilities such an approach unlocks through an example:

- Agent is prompted to edit some update and then update the changelog
- A trigger is preset to watch the context window and at the moment the changelog is read, new context is injected into the window to instruct the agent to work on a brand new task.
- The agent could indefinitely be prompted to "do this task and then update the changelog" and each time the agent goes to read the changelog before editing it, a new set of instructions are injected without ever having to keep that full instruction in the agents memory between turns.

## Summary

- Create a cursor rule named `@remember` that is manually triggered and provides all the instructions needed to meet the requirements of appending the users notes or instructions that come after the command to a shadow file.
- Create an Always Attach cursor rule named `@with-memory` that enforces the agent to read (if they exist) shadow files each and every time there is a file or folder match the path (or partial path in the case of a folder), providing them the pattern for finding their associated shadow file.
- Ensure both cursor rule files include every detail (and more) that ensures the requirements and objectives of this document are met and that each rule ensures rules execute consistently, and that the agent's act in the same way each and every time when it comes to managing and using mem files that result in 100% deterministic outcomes each and every time those instructions are followed in the rules.
