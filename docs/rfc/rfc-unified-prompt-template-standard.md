# A Unified Standard for Agentic Tool-Calling and Context Formatting

## Introduction

Agentic code generation systems – where large language models (LLMs) can plan, invoke tools, and iterate – are evolving rapidly. Recent releases from OpenAI, Anthropic, Google, and several IDE-based assistants (Cursor, Windsurf, Aider) demonstrate new techniques for **tool calling** and **prompt structuring**. However, existing approaches often trade off token efficiency for clarity. For example, OpenAI’s function calling uses verbose JSON, which “can use twice as many tokens as other formats for the same data”. As LLM context windows grow, maintaining a lightweight, **token-efficient** convention becomes crucial for speed and cost. In this paper, we propose two complementary standards:

* **(1) A Lightweight Agentic Calling Convention:** A minimal-but-expressive format for instructing and triggering tool use (spanning system prompts, user requests, and agent responses).
* **(2) A Complete Prompt Format in XML:** A standardized XML-based markup for full conversational context – supporting nested conversation turns, file attachments, inlined references, and global memory – optimized for composability and token reuse.

These standards draw on emerging best practices. We incorporate OpenAI’s JSON function schemas, Anthropic’s tool-use protocol, Google’s Gemini function interface, and techniques from IDE agents like Cursor’s “Cascade” system prompt and Aider’s diff-based edits. By unifying these insights, we aim to define a **compact, robust protocol** for multi-agent developer platforms. The proposal includes new terminology, example code blocks, and schematic diagrams to illustrate design decisions. Compatibility with VS Code, JavaScript runtimes, and CLI usage is emphasized, so developers can adopt the format across environments.

## 1. Lightweight Agentic Tool-Calling Convention

Modern LLMs can decide to call external tools (APIs, commands, etc.) mid-conversation. OpenAI, Anthropic, and Google have all introduced structured interfaces for this capability:

* **OpenAI (GPT-4/4.5):** Function calling via JSON. The system provides function definitions (name, description, JSON schema of params); the model responds with a `function_call` object containing the function name and arguments when appropriate. This approach reliably bridges to external code, but JSON syntax and repeated keys add overhead.
* **Anthropic (Claude 3.x):** “Tool use” API with content blocks. Claude can output a message with a special `tool_use` part (including tool `name` and `input` args) and a stop\_reason indicating a tool should be executed. The developer then returns a `tool_result` back into the conversation. Anthropic also suggests using their largest models (Claude 3.7 “Sonnet”) for complex multi-tool decisions.
* **Google (Gemini 2.x):** Similar JSON-based function calls. Google’s Gemini API expects a *function declaration* block with name and parameters, and the model will return a structured JSON if a function is to be called. The process mirrors OpenAI’s, as shown in Google’s flow diagram (the model chooses either a direct answer or a function call).

Despite different implementations, the pattern is consistent: **the model is primed with tool specs and responds with a structured call when needed.** The challenge is making this interaction **token-efficient** without losing clarity. JSON is verbose (with quotes, braces, etc.), and lengthy tool schemas (hundreds of lines) can “add \~1300 tokens per query” even if unused. We propose a new convention that preserves structure but minimizes overhead:

### 1.1 System Prompt Format for Tools

The system prompt (or an initialization message) should succinctly teach the agent what tools are available and how to invoke them. Best practices from industry include providing a name and description for each tool, and an invocation schema. For compactness, we recommend:

* **Assigning Short Codes:** Give each tool a short alias (e.g. `W` for a weather API, `G` for a git command) and each parameter a short key. For example: *Tool* **W** = “getWeather(location)”.
* **Structured Listing:** Present the tool list in a compressed tabular or tagged format. For instance, an XML snippet or pseudo-JSON with no unnecessary whitespace. In practice, Cursor’s Cascade system used an HTML-like tagging to section the prompt for tools. We can leverage a similar idea, but focusing on brevity. For example:

```text
<tools>
  <tool name="W" desc="Get weather by location">
    <param key="loc" type="string" desc="location query"/>
  </tool>
  <tool name="G" desc="Git commit search">
    <param key="q" type="string" desc="search query"/>
  </tool>
</tools>
```

This defines two tools with one parameter each. The entire definition uses short keys (`loc`, `q`) and no extraneous text. The model is instructed that to call a tool, it will output a `<call>` tag as described below. The use of consistent tags (`<tool>`, `<param>`) is **tokenization-friendly** – repeated tags become familiar tokens for the model, and the structure can be compressed in the model’s embedding space due to regularity. Notably, the Windsurf Cascade prompt similarly divided tool instructions using tags like `<tool_calling>` to encapsulate rules, which helps the model internalize the pattern.

Furthermore, to encourage **token reuse**, the system prompt can define template patterns. For example: “All tool calls will use the format `<call name="…">…</call>` with parameters as attributes or inner XML.” By defining this once, the model can reuse the same few tokens (`<call`, `name=`, etc.) whenever it issues a tool request, rather than generating a fresh JSON structure with many unique tokens.

### 1.2 User Message Format to Trigger Tools

In a lightweight convention, the user’s messages remain natural language, but we allow optional structured triggers:

* **Implicit Trigger:** In most cases, the user simply asks a question or gives an instruction, e.g. *“What’s the weather in San Francisco?”*. The agent’s decision to use a tool is guided by the system prompt and its own reasoning. The user need not explicitly invoke the tool.
* **Explicit Trigger Syntax (Optional):** For advanced users or system-initiated queries, we support a concise directive. For example, a user message could include a tag or shorthand like `[#W: "San Francisco"]` to explicitly request the weather tool. Here `#W` refers to the tool’s short code. This tag could be part of the user prompt format and would be taught in the system instructions. The model, upon seeing `[#W: "..."]`, knows it *must* call tool **W** with the given string as the `loc` parameter. This is similar to how developers can force function calls with OpenAI’s API, but in-text. It remains lightweight (just 3–5 tokens).

We caution that explicit triggers are optional; the primary design keeps user prompts human-readable. The system prompt should clarify how an explicit tool request looks if used (e.g., *“The user may invoke a tool by writing `[#ToolCode: ...]`. Treat that as a direct instruction to call the tool.”*). Otherwise, the agent should rely on its own judgment to decide on tool use.

### 1.3 Agent Response Format for Tool Calls

When the agent decides to call a tool, it should output a **single compact structured call** instead of a verbose explanation. The convention is:

* Use a `<call>` tag (or a similar minimal notation) at the **end** of the assistant’s message, after any reasoning it chooses to show. For example, the assistant might first respond with a brief thought (if we allow it to expose reasoning) and then the call:

```xml
<thinking>I need fresh data for this query.</thinking>
<call name="W" loc="San Francisco"/>
```

Here `<call name="W" loc="San Francisco"/>` is the agent’s tool invocation. This format is both human-readable and easily machine-parseable (XML). It is **semantically expressive** (includes which tool and what parameters) but very concise – no repetitive quote keys, no braces. The entire call could be tokenized to just a handful of tokens (the angle-bracket token, `call`, `name`, etc., likely appear as known tokens). By using attributes for parameters, we avoid repeating parameter names as full strings each time (they are fixed in the system prompt and here appear as exact tokens like `loc="..."`). This leverages **internal embedding reuse**: the model has seen `loc="` in the context of the tool definition, so reproducing it is straightforward and doesn’t introduce new semantic content, just a recall of the slot.

* **No extra commentary:** The agent should not surround the `<call>` with apologies or fluff. Cascade’s prompt explicitly instructs: “Before calling each tool, first explain to the USER why you are calling it”. For a lightweight convention, we might relax this. The agent can give a one-line rationale if needed (marked as `<thinking>` or even as a comment), but the critical part is the `<call>` itself. This separation of *thought vs action* echoes the ReAct pattern (Reason then Act) but in a highly structured form. Anthropic’s API actually returns a similar separation (a “thinking” text and the `tool_use` JSON) – our format mirrors that approach in XML form.

* **Compact success/failure handling:** If the model *knows* a tool isn’t available or a call is not possible, it should not output a malformed call. The system prompt can include a rule like: “Never call tools not provided”, which Cascade enforced. This prevents wasted tokens on invalid calls. If the user asks about tool availability, the agent can respond with a prepared description list, not the raw internal names. All of these guidelines ensure the agent’s tool invocation is as tight and correct as possible on the first try.

**Why XML tags?** XML (or XML-like syntax) is chosen because it is easily compressible and transformable. In fact, prompt designers have noted that using consistent XML/HTML tags can delineate sections clearly. Our `<call>` tag is essentially a structured suffix – a block at the end of the assistant message that the orchestrating program can detect and execute. It’s much like OpenAI’s `function_call` JSON, but leaner. And because it’s well-formed, a simple regex or XML parser can extract the tool name and attributes without error-prone string parsing.

### 1.4 Design Patterns and Token Reuse

The proposed convention takes advantage of several token-saving patterns:

* **Schema-Once Principle:** Define the tool interface once (in system prompt) in a way that the model can *reuse tokens* from that definition in its response. E.g., if the system prompt says: *Tool W expects `<call name="W" loc="..."/>`*, then the model’s output will contain many of the same substrings (`<call`, `name="W"`, `loc="`). Those likely map to the same token sequences it saw in the prompt, resulting in efficient encoding. By contrast, with JSON, the model might output `{"tool": "get_weather", "location": "San Francisco"}` which shares relatively fewer identical token fragments with the prompt (the key names might, but the exact braces/quotes pattern is new in the output). In our convention, we maximize overlap between prompt and response format.

* **Tag-based compressibility:** Using tags like `<tool_calling>` in the system prompt (as Cascade did) and `<call>` in responses creates a sort of “compression artifact” – these tokens group instructions. Language model tokenizers often have single tokens for frequent sequences like `<tool` or entire common tags if they appear in training data. Even if not, the repeated pattern means the model’s attention can focus on differences (the parameter values) rather than the surrounding syntax, effectively reusing context embeddings. In Cascade’s system prompt, the use of `<tool_calling>` and other tags carved the instructions into clear chunks, which the model can attend to or ignore as needed without confusion. We extend that idea: our tags both separate roles and minimize new verbiage.

* **Programmatic transformations:** The structured nature means that the same conversation can be programmatically converted to other forms (JSON, YAML, etc.) if needed, without loss. This is useful for developers who might log interactions or feed them into different LLMs. A simple XSLT (XML transform) or regex can turn `<call name="W" loc="SF"/>` into a JSON object or a function call in code. Thus, our convention is *not tied to a single representation* – it’s easy to map to OpenAI’s format or Anthropic’s with a lightweight translator. The consistency also means fewer prompt engineering surprises. For example, in internal testing, developers found that strictly enforcing an output format with minimal freedom (like a unified diff format in Aider) greatly improved model reliability. Our convention similarly narrows the model’s output options when it decides to act, leading to more deterministic behavior.

**Summary of Convention:** We dub this proposal the **Lightweight Agentic Invocation Convention (LAIC)**. It specifies that tools are listed with short identifiers and invoked via a `<call>` tag with attributes. The system prompt includes a LAIC section, the user can implicitly or explicitly request tools, and the assistant replies with a LAIC `<call>` when needed. This design strives to be *“compressible, computationally lightweight, yet semantically expressive”* – the assistant can do everything it could with a verbose format, but using far fewer tokens.

## 2. Complete XML-Based Prompt Format for Context

Beyond tool calls, complex LLM applications pass a wealth of context each turn: conversation history, code files, documentation snippets, and long-term memory. It’s critical to organize this information so that the model can parse it, and so that we as developers can easily compose or manipulate it. We propose a **fully standardized XML context format** to wrap all these pieces. This format – let’s call it **Prompt Markup Language (PML)** – treats the entire LLM input as an XML document with defined sections for each type of content.

Our goals for PML are: (a) **Composability** – you can mix and match segments (e.g. attach a file excerpt to a user query seamlessly); (b) **Expressiveness** – capture all needed context (conversation, files, memory, etc.); (c) **Token Efficiency** – minimize boilerplate tokens via reusable tags and structured packing.

### 2.1 Overall Structure – Conversation Wrapper

At the top level, we use a `<conversation>` root tag to encompass the dialogue. This root can have attributes like `id` or metadata, but primarily it contains the sequence of turns. For example:

```xml
<conversation id="12345" topic="Bug Fixing Session">
    ... (turns go here) ...
</conversation>
```

This single wrapper ensures that from the model’s perspective, all prompt content is within a known context container. It’s similar to how OpenAI’s ChatML implicitly wraps the dialogue, but here it’s explicit and standard. All content outside `<conversation>` (or other defined top-level tags like `<memory>`, see below) can be ignored by the model if we instruct it so.

### 2.2 Turn and Message Wrappers

Within `<conversation>`, each interaction (user or assistant message) is encapsulated. We define a `<turn>` element which can have one `<user>` and one `<assistant>` element (for a full round trip), or just a `<user>` if it’s the latest prompt waiting for a reply. For example:

```xml
<turn index="1">
    <user role="user" name="Alice">
        <text>How can I improve the performance of this function?</text>
        ... (possibly attachments here) ...
    </user>
    <assistant role="assistant" name="DevAI">
        <text>I will analyze the code to find inefficiencies.</text>
    </assistant>
</turn>
```

We give each message a `<text>` sub-element that contains the main natural language content. Separating the role tag (`<user>` or `<assistant>`) from the actual message text has two benefits:

1. We can attach additional structured data to the message (inside the `<user>` or `<assistant>` tags but outside the `<text>`), and
2. It clearly delineates what the model should treat as conversational utterance versus what is meta-information.

For instance, the `<user>` tag could directly contain a `<file>` or `<context>` attachment (see next subsection) alongside the `<text>` question. By nesting those inside `<user>`, the model knows they are provided by the user’s environment, not something the assistant should treat as its own output.

This approach is inspired by how IDE agents attach file context. In the Cascade system prompt, the model was told: “Each time the USER sends a message, we will automatically attach some information about their current state, such as what files they have open, and where their cursor is”. Our PML makes this explicit: such info would simply appear as part of the `<user>` element. For example:

```xml
<user role="user" name="Alice">
    <text>Fix the bug in the file below.</text>
    <attachment type="file" name="utils.py" path="/proj/utils.py">
        <content><![CDATA[
            def compute(x):
                # ... code ...
        ]]></content>
    </attachment>
    <attachment type="cursor">Line 42 in utils.py</attachment>
</user>
```

Here we introduced an `<attachment>` tag for any extra content the user provides. This message shows a code file snippet (wrapped in a `<![CDATA[ ]]>` section to avoid escaping issues) and a cursor location. The assistant receiving this sees clearly the user’s request and the relevant file content labeled as such. In a traditional prompt without structure, one might prepend the file content with a phrase like “Here is file utils.py:” which costs tokens and could confuse the model’s role perception. Instead, by using `<attachment type="file">`, we leverage structure: the model can be instructed (in the system prompt) that `<attachment>` elements under a user message are additional context and not the user’s question itself. This separation can improve the model’s focus and reduce confusion.

**Wrapping individual messages in tags also aids token efficiency.** The role labels (“User:”, “Assistant:”) which are often included in raw conversation transcripts can be dropped in favor of the tags `<user>` and `<assistant>` themselves. Those tags, once part of the model’s vocabulary through repeated usage, are shorter than writing out “User” or “Assistant” every turn. They also eliminate the need for newlines or colons as separators (which are tokens too). In essence, the XML structure acts as both delineation and compression.

### 2.3 File and Metadata Attachments

Our format must support attaching files, code snippets, or data to a prompt. We define a generic `<attachment>` element with a required attribute `type` (to distinguish different kinds). Common types could be: `"file"` for source code or text files, `"image"` for images (possibly as base64 or a URL), `"table"` for tabular data, `"cursor"` for an IDE cursor position, etc.

As shown above, a `<attachment type="file" name="...">` can contain a `<content>` child (possibly wrapped in CDATA for raw text). The `name` and perhaps a `path` attribute give context. Another example:

```xml
<attachment type="doc" name="ArrayAlgorithms">
    <content>In computer science, array algorithms often trade space for time...</content>
</attachment>
```

This could be an inline documentation excerpt provided to assist the model. By marking it as type `"doc"`, the system can later programmatically replace or update it (for instance, swap in a different excerpt if needed) without altering the core conversation text.

**Inline Supplemental Context:** The user’s query might mention something like “using algorithm X,” and we want to inject a definition of algorithm X from a reference manual. Using an `<attachment>` of type `"doc"` or `"ref"` right in the user’s turn achieves this. It avoids the user having to paste a long definition themselves. The model, seeing this structured, can treat it as additional knowledge. We would instruct in the system prompt that `<attachment type="doc">` elements under a user query are supplemental information the user is providing (or the system is providing on the user’s behalf) – essentially an open-book reference. This is much cleaner than prepending “Reference: … (text)… Now answer the question:” as one big string.

In tests of agentic systems, supplying context in a structured manner often improves relevance. For example, Anthropic’s **Model Context Protocol (MCP)** aims to let AI assistants retrieve and maintain context from various sources in a standardized way. PML can be seen as a formatting layer complementary to something like MCP: MCP fetches the data, and PML defines how to embed it in the prompt. Our attachment tags could naturally carry data retrieved via an MCP server (e.g., results from a database query could be attached as `<attachment type="db">`).

Multiple attachments can be included in one message. We anticipate 10–20 nested segments in complex cases (the prompt might have a user query, plus 5–6 attached files, plus 3–4 documentation notes, etc., potentially totaling \~10–20 `<...>` elements in the XML). The format is designed to handle that load by keeping each segment identifiable and allowing the model to compress less important ones if needed. XML’s hierarchical nature also means irrelevant attachments can be pruned out by preprocessing if, say, memory is running low, without breaking the overall format.

### 2.4 Global Memory and Context History

In addition to the conversation transcript, many applications want to provide global context – e.g. a summary of prior interactions, or some user profile/preferences, or a scratchpad for the agent. Our standard supports this via dedicated sections outside the main `<conversation>` (or as part of it with special tags). Two key constructs we propose:

* **Global `<memory>` Section:** This is an optional top-level tag (a sibling to `<conversation>`). It contains any long-term memory or background info that should always be available. For instance:

```xml
<memory>
    <fact>User prefers Python code examples.</fact>
    <fact>Project uses TensorFlow 2.0.</fact>
    <summary>In last session, we optimized the database queries.</summary>
</memory>
```

Here we show two `<fact>` entries and a `<summary>`. The exact subtags under memory can be flexible (facts, summaries, prior conclusions, etc.), but the idea is the model can treat this as always-on context. The system prompt can instruct: “You have a `<memory>` section with persistent facts about the user’s project and preferences. Don’t repeat them, but consider them in your answers.” Because the memory is wrapped in a tag, if it’s not needed for a given query, the model can perhaps more easily compress it (or we can choose not to send it if not needed). Token efficiency is also gained by using short tags like `<fact>` rather than full sentences; e.g. instead of *“The user’s preferred language is Python.”* (which is \~7 tokens), we have `<fact>user_pref:Python</fact>` which might be 3-4 tokens. Over many stored facts, this is a win.

* **Structured History in `<conversation>`:** Since the conversation turn structure already captures history, we might not need anything else for it. However, one could allow an `<assistant>` message to contain a `<tool_result>` or similar tags (like Anthropic’s content blocks). In PML, we could standardize a way to embed the result of a tool call in the conversation. For example, after the assistant’s `<call>` (from section 1), the system (or some orchestrator) would add a new `<turn>` with a special role, or perhaps as a continuation of the assistant turn, something like:

```xml
<assistant role="assistant">
    <text>(Tool executed: getWeather)</text>
    <tool_output>{"temperature": "15°C", "condition": "Sunny"}</tool_output>
</assistant>
```

This way, the model can see the output in the next step. Alternatively, treat tool outputs as a user message with role “system” or similar in the conversation. The exact method can vary, but PML provides the flexibility – one could define a `<system>` role tag for non-human, non-assistant inserts (like tool outputs, or moderator messages). For completeness, we include this idea in the standard: any turn can have `<system>` as well, where `role="system"` might denote environment-provided info. This is analogous to OpenAI’s system role but used within conversation to inject results or corrections.

### 2.5 Balancing Token Efficiency and Expressiveness

XML by nature has more characters (angle brackets) than a minimal JSON or YAML might. However, because of **consistency and the tokenizer’s training**, this overhead is often negligible compared to verbose natural language. In our proposed prompt format, virtually every piece of content is either:

* Within a `<text>` (natural language that must be there), or
* Labeled by a short tag that appears frequently.

We also note that Google’s team chose not to use XML in their function calling examples due to personal preference, but our use-case is different: we are not returning data to a user, we are structuring the prompt to the model. The model itself benefits from clear markup (it reduces ambiguity). A developer may never actually see the raw XML prompt if it’s assembled by a framework, so human readability is secondary to model interpretability. Nonetheless, we’ve designed tags to be fairly self-explanatory (`<conversation>`, `<attachment>`, etc.), which helps if developers debug prompts.

**Comparative Efficiency:** Let’s briefly compare what a similar prompt would look like with and without PML:

* *Without PML (plain text prompts):*

  * System prompt might say: *“You are an assistant. The user may provide code files. If they say something like ‘Here is file X: ...’ then incorporate it. The user might also give previous results in quotes. Keep track of history.”* (Already \~40 tokens of instructions)
  * User prompt with a file: *“User: Fix the bug in this code.\n`python\n<code here>\n`\n(User’s cursor is at line 42.)”* – The file is included in markdown fences, cursor info in parentheses. The model has to parse that this code block is from the user and likely relevant. The total tokens here include markdown syntax and possibly the “User:” identifier.
  * Assistant response calling a tool: might say: *“Assistant: I will use the test runner.\n{function: run\_tests, args: {"all": true}}”* if we tried to do a JSON call in text – which mixes natural text and JSON in a non-standard way.

* *With PML:*

  * System prompt has a pre-defined format and does *not* need to explain how code is attached (the assistant can infer from `<attachment type="file">`). So those 40 tokens of explanation can be replaced by a concise rule: e.g., *“Interpret `<attachment>` blocks as described in the standard.”* if the model is fine-tuned or familiar with this convention. In practice initially, we might still need some instructions, but far fewer.
  * User prompt becomes: (as shown) `<user> <text>Fix bug...</text> <attachment type="file".../> <attachment type="cursor".../> </user>`. There’s no ambiguity that the code is part of the user’s input. The XML tags replace natural-language separators like triple backticks, which actually can be quite large token-wise (each \`\`\` is a token and often newlines and language around it).
  * Assistant tool call is just `<call name="X" .../>` without any extra text like “Assistant: I will use…”. The role is implicit by being inside `<assistant>`.

A rough token count example: Suppose a file content is 100 tokens of code. Without PML, you might have 5 tokens of markdown/bookends around it and some sentence referencing it. With PML, you have maybe 2 tokens for `<attachment` and `</attachment>` combined (assuming each tag compresses to \~1 token or slightly more). That’s a savings of a few tokens. Multiply similar savings across 5 attachments and several turns, and we accumulate significant reduction. More importantly, we **avoid repetition** of patterns in ad-hoc ways – the patterns are always the same tokens.

### 2.6 Industrial Patterns and Innovations

The PML design is inspired by what we observe in current systems, generalized and made more rigorous:

* **Cursor & Windsurf IDEs:** These IDE agents feed the model code context automatically. Windsurf’s Cascade agent was “the original AI IDE agent that can automatically fill context, run commands, etc.”. In practice, they likely insert relevant code into the prompt. By standardizing how to insert it (via `<attachment>`), we make such context injection systematic. Both Windsurf and Cursor use Anthropic’s Claude under the hood, meaning a consistent prompt structure could work across them. Indeed, our unified format could allow an agent to switch between Claude, GPT-4, or Gemini with minimal changes, since the structure (XML) is model-agnostic. The fact that Windsurf and Cursor achieved similar outcomes with the same model underscores the value of having a consistent prompt interface.
* **Aider (CLI Assistant):** Aider used Git diffs and commit messages to manage changes. For example, it shifted from a “search/replace block” format to unified diffs to coax GPT-4 into making direct changes. In our XML format, we could have an attachment type for diffs or a `<edit>` tag to represent code edits. This would clearly separate “instructions” from “proposed code change”. Aider’s success with diff formats suggests that giving the model a clear, familiar structure significantly improves reliability (it reduced GPT-4 Turbo’s “lazy” errors by 3×). PML can incorporate such structures as first-class elements. For example, a future extension `<edit file="x.py">...</edit>` could encapsulate a diff or patch.
* **Model Context Protocol (Anthropic MCP):** MCP standardizes connecting an AI to external data sources via “MCP servers”. One can imagine MCP being used to fetch, say, a Slack message history or a database record, and then PML’s role is to embed that result into the conversation in a standardized way (perhaps as `<attachment type="slack">...</attachment>` or `<attachment type="db">...</attachment>`). The open nature of our XML schema means new context types can be added with new `type` values. The agent doesn’t need new training for each – just a system prompt update to say “there is a type X which means Y”.
* **Clarity through Tags:** The SegmentFault analysis of the Cascade prompt highlighted that it was “long, but clearly partitioned… using HTML tags to delineate sections”. This clarity makes it easier for prompt designers to modify specific sections without side effects. Our PML does the same for the entire prompt: one can swap out the `<memory>` section or drop certain `<turn>` elements programmatically. It’s essentially an **RFC-style** encoding of a chat – much like an email with MIME parts, but for LLM context.

### 2.7 Specification Summary and Example

To illustrate the proposed standard, we provide a concise specification table of major elements, followed by a short example prompt snippet.

**Table 1: Key Elements in Prompt Markup Language (PML)**

| Element          | Description                                                                                                                                                                                                                              | Children/Content                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<conversation>` | Root container for the dialogue. Can have attributes like `id`, `topic`.                                                                                                                                                                 | `<turn>` elements (and/or `<system>` messages, if any outside turns).                                                                                       |
| `<turn>`         | Wraps a user->assistant exchange (or a single user query). May include an `index` attribute for ordering (optional).                                                                                                                     | One `<user>` plus one `<assistant>` (optional if waiting for answer).                                                                                       |
| `<user>`         | A user message. Has attribute `role="user"` (for clarity, though redundant by tag) and optionally a `name` or `id`.                                                                                                                      | `<text>` for the user’s message text. Optional `<attachment>` elements for any files or data provided with the message.                                     |
| `<assistant>`    | An assistant/agent message. Attribute `role="assistant"`. Optionally `name` (e.g., “GPT-4” or agent name) or `id`.                                                                                                                       | Typically a `<text>` with the assistant’s reply. May also include special tags like `<call>` (for tool use) or `<tool_output>` if applicable.               |
| `<system>`       | (Optional) Denotes a system instruction or out-of-band message in the turn sequence. Could be used for tool outputs or moderator notes. `role="system"`.                                                                                 | Could contain a `<text>` or other context (e.g., `<tool_output>`). Use is flexible.                                                                         |
| `<text>`         | Encapsulates natural language text of a message (either user query or assistant response). Keeps it distinct from attachments or actions.                                                                                                | Raw text (which may include markdown or code snippets, but those would be within CDATA or appropriate escaping if needed).                                  |
| `<attachment>`   | Attached supplemental content or data, tied to a user or assistant message. Must have a `type` attribute (e.g., file, image, doc, etc). Can also have `name`, `path`, or other identifying attrs.                                        | Usually contains a `<content>` element with the data (text or base64, etc). Alternatively could be self-closing if no content (like a placeholder).         |
| `<content>`      | The payload container for an attachment. Often wrapped in CDATA for raw text.                                                                                                                                                            | The actual data (file text, document text, etc.).                                                                                                           |
| `<call>`         | (In assistant message) Represents a tool function call the agent wants to make. Attributes: `name` (the tool code/name). Additional attributes for each parameter, as defined by the tool’s schema. Self-closing tag (no child content). | *No child elements.* All info is in attributes. Example: `<call name="W" loc="London"/>`.                                                                   |
| `<tool_output>`  | (Either in a system turn or assistant turn) Contains the results returned from a tool execution. A sibling format to `<text>` to distinguish raw output data from normal dialogue.                                                       | Could contain JSON or text. E.g., `<tool_output>{"result":42}</tool_output>` or `<tool_output><content>Test passed</content></tool_output>`.                |
| `<memory>`       | Top-level section (outside `<conversation>` or before it) that holds persistent context.                                                                                                                                                 | Any number of child elements conveying facts or summaries. We can use generic `<fact>` or `<summary>` tags inside, or simply `<content>` with labeled text. |

Using these elements, here is a stylized example that demonstrates a user asking a coding question with a file, the assistant calling a tool, and the tool result being returned:

```xml
<memory>
    <fact>UserName=Alice</fact>
    <fact>PreferredLanguage=Python</fact>
</memory>

<conversation topic="Performance Tuning">
  <turn index="1">
    <user role="user" name="Alice">
      <text>How can I improve the performance of the function in util.py?</text>
      <attachment type="file" name="util.py">
        <content><![CDATA[
def compute_heavy(data):
    result = []
    for i in range(len(data)):
        for j in range(len(data)):
            if i != j:
                result.append(data[i]*data[j])
    return result
        ]]></content>
      </attachment>
    </user>
    <assistant role="assistant" name="DevAI">
      <text>It looks like a double loop – an O(n^2) algorithm. I will see if any tool can analyze its complexity.</text>
      <call name="ComplexityAnalyzer" file="util.py" function="compute_heavy"/>
    </assistant>
  </turn>
  <turn index="2">
    <system role="system">
      <tool_output>{"complexity": "O(n^2)", "suggestion": "Use vectorized operations or caching."}</tool_output>
    </system>
    <assistant role="assistant" name="DevAI">
      <text>The analyzer indicates the function is O(n^2). To improve it, we should try to eliminate the nested loop. For example, using NumPy for vectorized multiplication would leverage C optimizations under the hood. Alternatively, caching partial results might help if repetitive.</text>
    </assistant>
  </turn>
</conversation>
```

In this example, we see the following in action:

* A `<memory>` section providing background (the model could use the user’s name or language preference if relevant – here it might influence that the answer uses Python libraries).
* Turn 1: User attaches a code file. The assistant recognizes a performance issue and uses a `<call>` to a hypothetical tool “ComplexityAnalyzer” (passing which file and function to analyze as attributes). Note how token-efficient that call is – it’s a single self-contained tag.
* Turn 2: The tool’s result comes in as a `<system>` message with `<tool_output>` (the orchestrator inserted it). The assistant then produces a final answer to the user, using the info (O(n^2) complexity) from the tool output.

This dialogue in raw text would have taken significantly more tokens (the code itself remains the same size, but explaining what is being done around it would add overhead). With PML, the structure is self-explanatory to the model. We would instruct the model on how to interpret `<tool_output>` – likely treating it as if the tool’s answer was given to it by the system, which it can then use.

### 2.8 Compatibility and Implementation Notes

The PML standard as proposed is meant to be used *within* a system that orchestrates the LLM (such as an IDE plugin, or a chatbot framework). We do not expect the model to output XML to the end-user; rather, this is an internal format for prompts and possibly the model’s own internal reasoning traces. However, because it’s in the prompt, the model will see it. Therefore:

* Models need to either be fine-tuned or at least few-shot prompted to handle this XML. This is feasible – many models have been trained on HTML/XML to some extent, and our tags are chosen to be intuitive. Even without special tuning, GPT-4 or Claude can follow XML structure if prompted carefully (experience with tools like LangChain’s XML prompts shows good results).
* The design is forward-looking: as agentic systems become more prevalent, we could imagine an industry-agreed subset of XML (or JSON) for prompts. Our proposal could serve as an RFC basis. It is similar in spirit to how HTML standardized web content – here we aim to standardize prompt content for complex AI assistants.
* We also considered YAML or JSON for the complete format. JSON could work (it’s what e.g. LangChain’s conversation memory might use internally), but JSON is not great at representing very large text fields (you’d have to escape newlines and quotes inside code files, etc., which balloons token count). XML with CDATA is more straightforward for embedding arbitrary text. YAML is more concise than JSON (no quotes around keys, etc.) and could be a worthy alternative; however, parsing YAML reliably (especially streaming to a model) can be tricky, and indent-based structure might confuse the model if not perfectly rendered. XML’s explicit tags avoid those issues.

Lastly, we highlight **modularity**: Because each segment of context is tagged, one can swap different pieces in or out. For example, in a VS Code extension, if a user opens a new file, the extension can generate an `<attachment type="file">` element and insert it into the ongoing conversation context without rebuilding the entire prompt from scratch. In a CLI, if a user says “forget that file,” the system can simply remove that `<attachment>` element. This modularity is a direct benefit of using a structured format.

## Conclusion

We have outlined a comprehensive proposal combining a **Lightweight Agentic Calling Convention (LAIC)** and a **Prompt Markup Language (PML)** for context. By examining cutting-edge systems (OpenAI GPT-4.5, Anthropic Claude 3.7, Google Gemini 2.7, and AI-assisted IDEs like Cursor and Windsurf), we distilled common patterns and innovative tricks – from OpenAI’s strict JSON schemas to Cursor’s HTML-esque prompt chunking – and unified them into a single, extensible framework.

Our lightweight calling convention allows an AI agent to invoke tools with minimal tokens (using `<call>` tags and short parameters) while remaining robust and expressive. It builds on the idea that structured suffixes and consistent tags can drastically reduce prompt length and even improve the model’s embedding reuse for repeated instructions. Meanwhile, the XML-based prompt format provides a **“USB-C for AI context”** (to borrow Anthropic’s analogy): a universal plug for conversation, files, and facts that any agent can interface with.

We expect that adopting these standards will lead to **better multi-agent interoperability** (a conversation formatted in PML can be handed from one agent to another or logged, parsed, and analyzed easily) and **improved reliability** (as seen when structured prompts reduced errors in practice). Importantly, it maintains clarity – tags like `<assistant>` or `<attachment>` make the role of each segment explicit, which aligns with how models like clarity in instructions.

Future work may involve creating conversion libraries and fine-tuning LLMs on dialogues formatted in PML/LAIC to further boost efficiency. As the ecosystem converges on standards, we foresee a time when a developer’s intention (e.g., “use this tool if needed, here’s some data, and maintain this memory”) is conveyed to any LLM agent in a concise, machine-readable way, without the verbosity of current prompt engineering. The proposals in this paper are a step in that direction, aiming to make prompts **as structured and reliable as code**, yet as flexible and rich as natural language.

**Sources:**

* OpenAI API function calling and discussions
* Anthropic Claude tool use and Model Context Protocol
* Google Gemini function calling documentation【70†】
* Cursor/Windsurf Cascade leaked prompt and analysis
* Aider AI diff format benchmark
* Token efficiency studies (JSON vs others)
* Developer observations on model compatibility and prompt clarity.
