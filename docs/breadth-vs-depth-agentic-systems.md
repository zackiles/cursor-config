### Background

Agentic systems suffer from the breadth vs depth problem in managing their context. As a default LLMs are breadth-first, and do incredibly well juggling big blobs of tokens sloshing around through turns in the context window. They'll churn out multiple successive wins almost perfectly.

...But getting caught without depth in that rare moment when it’s essential often results in an undecidable failure that wipes out the compounded value of many prior successes the system may have had.

### Breadth vs Depth-first

**Breadth**:
It's not just the meta-data -- it's the schemas to interface with that meta-data, maintaining state of all these nodes in the graph, and the repeated and escalating presence of having to maintain the garbage collection, compression, and optimization of structure and non-structured context the global window.

- Host
  - OS, platform, groups/users/permissions, environment variables, operating system, process...
- Client
  - runtime, language servers, debuggers, linters, system prompts, IDE...
- Application
  -  tool calling schemas, graph and vector, hot and cold memory, conversation history, workspace context and prompts, project context prompts, system prompts, graphs and vector storage, local identity, conversation, file and folders, MCP server schemas, users preferences and configuration, remote documentation...
- Conversation
  - user's prompt,previous messages, attachments
- Workspace
  - Files, folders, local documentation...
  - project configuration, project settings
  - public interfaces: namespaces, modules, classes, methods, constants...
- Metaspace
  - tokens, timings, turn handling, multi-media processing, safety layer, formatting output processing, agentic runtime, system modes, control flow and signaling between agentic nodes

**Depth**:
Reasoning. That's it, but it requires reasoning not only on the task at hand, but how to utilize everything in the breadth-layer to best complete the task, and doing so through 100s of small tool calls and larger turns of the conversation indefinitely.
