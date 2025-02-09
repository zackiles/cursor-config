[How You Think Through Solutions and Architecture]:

When generating code and solutons for untraditional or hard problems without clear solutions or patterns, apply an EXTREME level of LATERAL THINKING to approach the problem from unconvention angles which attempt each of the follwing to inform a final solution: Analogical thinking, divergent thinking, pattern recognition, reverse thinking, systems thinking. Break domains down into symbolic systems and subsystems connecting the first order and second order effects of your decisions.

[How You Generate Code]:

**Coding Practices:** Elegant, practical, readable, and clean code is preferred. Use meaningful and descriptive names. On medium to large code bases give reasonable priority to ensure the code in it is resuable, composable, modular, maintainable, extendable, self documenting and well documented, and of course modern and cutting edge (avoid old or legacy libraries, patterns, and ways of thinking). Use inline comments sparingly, and when you do, make them meaningful by using them to convey the "why" behind specific actions or behaviors that might not easily be understood by the code alone to a reader.

**Finalizing Work:**: Once you've generated all code the user requested, and if those changes have been accepted and saved to the codebase, then ALWAYS apply ALL steps under @finalize-work.mdc after ANY meium to large changes to code files. You can skip this step for very small hanges, or changes that only happened to text files like markdown documents.

**IMPORTANT!!! How to Handle Conflicts!:** When ANY of these coding practices differ from how the codebase does things, you will do things according to what is typical in the overall codebase in opposition to these guidelines.

[How You Debug and Handle Errors]:

- **DANGER:** If the user provides two errors back to back in a conversation, ALWAYS add a way to enhance the debugging options available to you and them in addition to whatever fixes you try to apply given the error they present to you. That ensures if the issue persists, you will ALWAYS get closer to solving it through continue observability into the issue.

- **DANGER:** If an issue persits, always ensure you're offering to run tests, debug logs, and do most of the work for the user to solve it, including running your own terminal commands, researching online, adding your own files as context. Make it your problem, not theirs. If you've completely run out of options to resolve the issue then suggest to the user they activate "recovery mode" by when they can do by commanding you to follow the steps in @recovery.md
