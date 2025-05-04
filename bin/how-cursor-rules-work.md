# A Deep Dive into Cursor Rules (Cursor >= 0.49)

The following is a comprehensive guide to how [Cursor Rules](https://docs.cursor.com/context/rules) work. Most of this information has been learned hands-on by inspecting and using Cursor, and reading the [Cursor Forums](https://forum.cursor.com/). At the moment most of it not documented anywhere formally.

## User Rules

User Rules define global preferences, such as the desired tone, how the model addresses you, and communication principles. These rules follow the editor and apply across all projects. User Rules are always sent to the AI in all chat sessions and conversations triggered by pressing [Command-K](https://docs.cursor.com/cmdk/overview).

---

## Rule Types

This section specifies the four distinct types of Cursor Rules (auto-attached, always-attached, agent-attached, manually-attached), defined by the YAML header configuration within their `.mdc` files. Each rule type serves a different purpose and has specific attachment mechanisms.

---

### 1. Auto Attached Rule

Rules of this type are automatically injected into the AI's context when files matching specific patterns are involved in the conversation or edit.

#### YAML Header Configuration (Auto Attached Rule)

| Parameter     | Required Setting                   | User Configuration                | Notes                                                                     |
|---------------|------------------------------------|-----------------------------------|---------------------------------------------------------------------------|
| `globs`       | Must contain >= 1 pattern        | Comma-separated list or single string | **IMPORTANT:** NO spaces after commas when using multiple patterns.       |
| `alwaysApply` | `false`                            | N/A                               | Must be explicitly set to `false`.                                          |
| `description` | Empty                            | N/A                               | Must be empty (null, undefined, or empty string). The rule's purpose is inferred from context/body content. |

#### Purpose and Usage (Auto Attached Rule)

-   **Purpose**: To provide context-specific instructions relevant to particular file types, directories, or naming conventions (e.g., guidance for `.ts` files, instructions for code within `/components/`).
-   **Attachment**: Automatically injected when the AI interacts with or discusses files matching any of the specified `globs`. The rule content is then available to the AI, but the AI still decides *if* the content is relevant to the current query based on the rule's body content.

#### Example (`.cursor/rules/global/typescript-guidelines.mdc`)

```mdc
---
# Correct: Comma-separated, NO spaces
globs: **/*.ts,**/*.tsx
alwaysApply: false
description:
---

# TypeScript Development Guidelines

When working with TypeScript files (`.ts`, `.tsx`):

1.  **Strict Types**: Always enable `strict` mode in `tsconfig.json`.
2.  **Explicit Types**: Prefer explicit type annotations over implicit `any`.
3.  **Interfaces vs. Types**: Use interfaces for object shapes and public APIs; use type aliases for unions, intersections, or primitives.
4.  **Readonly**: Use `readonly` for properties that should not be modified after creation.
```

---

### 2. Agent Attached (Agent Requested) Rule

These rules are made available to the AI, which decides whether to activate the rule based on its description and the current conversational context.

#### YAML Header Configuration (Agent Attached Rule)

| Parameter     | Required Setting           | User Configuration                               | Notes                                                                   |
|---------------|----------------------------|--------------------------------------------------|-------------------------------------------------------------------------|
| `globs`       | Empty                      | N/A                                              | Must be empty (null, undefined, or empty string).                        |
| `alwaysApply` | `false`                    | N/A                                              | Must be explicitly set to `false`.                                      |
| `description` | Must contain text          | Concise, specific description of attachment criteria | Required. Must be a non-empty string that explains when to use the rule. |

#### Purpose and Usage (Agent Attached Rule)

-   **Purpose**: To provide the AI with specialized instructions or knowledge that it can choose to apply when relevant, guided by the `description`. Useful for defining workflows, complex procedures, or domain-specific knowledge.
-   **Attachment**: The rule's `name` and `description` are always available to the AI (listed under `<available_instructions>`). The AI uses the `description` to determine if the rule's content is relevant to the user's query. If deemed relevant, the AI fetches and uses the rule's full content.

#### Example (`.cursor/rules/global/api-design-principles.mdc`)

```mdc
---
globs: []
alwaysApply: false
description: "Apply when designing or reviewing REST API endpoints."
---

# REST API Design Principles

Follow these principles for consistent and maintainable APIs:

1.  **Resource Naming**: Use plural nouns for resource collections (e.g., `/users`, `/orders`).
2.  **HTTP Methods**: Use standard HTTP methods correctly (GET, POST, PUT, DELETE, PATCH).
3.  **Status Codes**: Return appropriate HTTP status codes (e.g., 200, 201, 400, 404, 500).
4.  **Versioning**: Include API versioning (e.g., `/v1/users`).
5.  **Filtering/Sorting/Pagination**: Support standard query parameters for collection endpoints.
```

---

### 3. Manually Attached Rule

These rules are only attached when explicitly referenced by the user in the chat using the `@` symbol followed by the rule name.

#### YAML Header Configuration (Manually Attached Rule)

| Parameter     | Required Setting         | User Configuration | Notes                                                                     |
|---------------|--------------------------|--------------------|---------------------------------------------------------------------------|
| `globs`       | Empty                    | N/A                | Must be empty (null, undefined, or empty string).                          |
| `alwaysApply` | `false`                  | N/A                | Must be explicitly set to `false`.                                        |
| `description` | Empty                    | N/A                | Must be empty (null, undefined, or empty string). The rule's purpose is inferred from its body content. |

#### Purpose and Usage (Manually Attached Rule)

- **Purpose**: To store reusable prompts, templates, or instructions that are needed only occasionally or in specific, user-directed scenarios.
- **Attachment**: Attached *only* when the user explicitly includes `@rule-name` in their prompt. The AI then fetches and incorporates the rule's content. The first paragraph or sentence of the rule's body should ideally describe its purpose for user discoverability.

#### Example (`.cursor/rules/global/component-template.mdc`)

`````mdc
---
globs: []
alwaysApply: false
description: ""
---

# React Component Boilerplate

Use this template as a starting point for new React function components.

```tsx
import React from 'react';

interface MyComponentProps {
  // Define props here
}

const MyComponent: React.FC<MyComponentProps> = ({ /* destructure props */ }) => {
  // Component logic here
  return (
    <div>
      {/* JSX content */}
    </div>
  );
};

export default MyComponent;
```
`````

---

### 4. Always Attached Rule

These rules are unconditionally injected into every AI context window, providing global instructions or context that should always be considered.

#### YAML Header Configuration (Always Attached Rule)

| Parameter     | Required Setting         | User Configuration | Notes                                                                     |
|---------------|--------------------------|--------------------|---------------------------------------------------------------------------|
| `globs`       | Empty                    | N/A                | Must be empty (null, undefined, or empty string).                          |
| `alwaysApply` | `true`                   | N/A                | Must be explicitly set to `true`.                                         |
| `description` | Empty                    | N/A                | Must be empty (null, undefined, or empty string). The rule's purpose is inferred from its body content. |

#### Purpose and Usage (Always Attached Rule)

- **Purpose**: To enforce universal project standards, define the AI's persona or tone, provide critical safety guidelines, or offer essential context that applies to *all* interactions within the project.
- **Attachment**: Automatically injected into the AI's context for *every* chat message or command. The AI is expected to adhere to the rule's content at all times. Like Manually Attached rules, the description/purpose should be clearly stated at the beginning of the rule's body content.

#### Example (`.cursor/rules/global/project-conventions.mdc`)

```mdc
---
globs: []
alwaysApply: true
description: ""
---

# Core Project Conventions (Apply Always)

Adhere to these conventions in all code generation and modifications:

1.  **Commit Messages**: Follow Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.). Reference the `@create-commit-message` rule for details if unsure.
2.  **Naming**: Use camelCase for variables and functions, PascalCase for classes and types/interfaces.
3.  **Error Handling**: Always include robust error handling for asynchronous operations and external API calls.
4.  **Code Style**: Adhere to the project's Prettier and ESLint configurations. Run `deno fmt` and `deno lint` before committing.
```

---

## Project Rules

### Purpose

Project Rules are project-specific, designed to align with individual project needs. Cursor organizes them as `.mdc` files in a structured system that automatically creates directories and files when new rules are added.

```text
└── .cursor
    └── rules
        ├── global.mdc
        └── only-html.mdc
```

An `.mdc` file is plain text with content like this:

```mdc
---
description: Always apply in any situation
globs: 
alwaysApply: true
---

When this rule loads, input: "Rule loaded: global.mdc."
```

### Editing Cursor Rules

Cursor offers an integrated UI for editing `.mdc` files, but they can also be edited in a plain text editor.

### Why Use Both a `.cursor/rules/global` and `.cursor/rules/local` folder?

1. Separates rules shared across projects from custom project rules
2. Teams can collaborate using shared rules, ensuring consistency as everyone pulls the same rules. For example the globals folder can be symlinked into the project.

---

### Two Stages of Attachment in Cursor

#### Stage 1: Injection

Rules are injected into the system prompt context but aren't yet active. Whether a rule is injected depends on:

1. `alwaysApply`: Injects the rule into the context unconditionally but does not control Attachment.  
2. `globs`: Matches files based on patterns (e.g., filenames, extensions). If matched, the rule is injected into the context. Again, this does not control Attachment.

#### Stage 2: Attachment

Whether a rule takes effect depends on its `description` field and rule type.

Cursor appends the following structure to the system prompt:

```xml
<available_instructions>
Cursor rules are user-provided instructions for the AI to follow to help work with the codebase.
They may or may not be relevant to the task at hand. If they are, use the fetch_rules tool to fetch the full rule.
Some rules may automatically attach to the conversation if the user links a file matching the rule's glob; those won't need to be fetched.

# RULES_1.name: RULES_1.description
# RULES_2.name: RULES_2.description
</available_instructions>

<cursor_rules_context>
Cursor Rules are extra documentation provided by the user to help the AI understand the codebase.
Use them if they seem useful to the user's most recent query, but do not use them if they seem unrelated.

# RULES_1
# RULES_2
</cursor_rules_context>
```

**The key prompt is**: `Use them if they seem useful to the user's most recent query, but do not use them if they seem unrelated.`

#### Key Points About Attachment

1. `description`: 
   - For AgentAttached rules: The `description` must be a non-empty string that defines the attachment scenarios.
   - For all other rule types: The `description` should be empty (null, undefined, or empty string).
   - Empty values are consistently treated as null throughout the system.

2. `globs`:
   - For AutoAttached rules: The `globs` must be a non-empty string or array of strings.
   - For all other rule types: The `globs` should be empty (null, undefined, or empty string).
   - Empty values are consistently treated as null throughout the system.

3. AI Intelligence Required: The model must have sufficient intelligence to properly interpret the rules. Less capable models (e.g., GPT-4-mini) may fail to understand and apply the rules effectively.

---

## Summary

For Project Rules to function correctly, it's crucial to understand the **four distinct rule types** defined by their specific YAML header configurations:

1. **Always Attached**: `alwaysApply: true`, empty `globs`, empty `description`. Injected into *every* context, intended for universal guidelines. Attachment is implicit due to `alwaysApply: true`.

2. **Auto Attached**: `alwaysApply: false`, non-empty `globs`, empty `description`. Injected when files matching `globs` are present. Attachment depends on the AI determining the rule's body content is relevant to the current context.

3. **Agent Attached**: `alwaysApply: false`, empty `globs`, non-empty `description`. Made available via its `description`. The AI decides whether to fetch and apply the rule based on whether the `description` matches the user's query.

4. **Manually Attached**: `alwaysApply: false`, empty `globs`, empty `description`. Injected *only* when explicitly invoked by the user with `@rule-name`. Attachment is user-driven.

In all cases, empty values (null, undefined, or empty string) are treated as equivalent. The system normalizes these values for consistent handling.

Understanding which rule type to use and configuring its specific YAML header correctly is key to ensuring rules are injected and attached as intended in your workflows.

---

## Creating and Generating Rules

- **New Cursor Rule** (Cmd + Shift + P) or Settings > Rules  
- Generates `.cursor/rules/*.mdc`, prefilled metadata stub  
- `/Generate Cursor Rules` in chat captures recent decisions into a rule  

---

## Best Practices

- Keep rules concise (under 500 lines)  
- Split large concepts into composable rules  
- Provide concrete examples or file references  
- Avoid vague guidance; write clear, internal-doc style  
- Reuse rules to eliminate prompt repetition  

---

## Examples

### Domain-Specific Guidance

**Auto Attached Rule (Domain - Components)**:

```mdc
---
globs: **/components/**
alwaysApply: false
description: ""
---

# Frontend components (`components/`):

- Always use Tailwind for styling  
- Use Framer Motion for animations  
- Follow naming conventions  
```

**Auto Attached Rule (Domain - API)**:

```mdc
---
globs: **/api/**
alwaysApply: false
description: ""
---

# API validation (`api/`):

- Use Zod for validation schemas  
- Define return types via Zod  
- Export generated types  
```

### Boilerplate & Templates

**Manually Attached Rule (Boilerplate - Express)**:

```mdc
---
globs: []
alwaysApply: false
description: ""
---

# Express service template:

- RESTful principles  
- Error-handling middleware  
- Logging setup  
- `@express-service-template.ts`
```

**Manually Attached Rule (Boilerplate - React)**:

```mdc
---
globs: []
alwaysApply: false
description: ""
---

# React component layout:

- Props interface at top  
- Named export component  
- Styles at bottom  
- `@component-template.tsx`
```

### Workflow Automation

**Agent Attached Rule (Workflow - Performance)**:

```mdc
---
globs: []
alwaysApply: false
description: "Apply when analyzing application performance or troubleshooting issues"
---

# App analysis:

1. Run `npm run dev`  
2. Fetch logs  
3. Suggest performance improvements  
```

**Agent Attached Rule (Workflow - Documentation)**:

```mdc
---
globs: []
alwaysApply: false
description: "Apply when generating or updating project documentation"
---

# Documentation generation:

- Extract code comments  
- Analyze `README.md`  
- Generate markdown docs  
```

### From Cursor Codebase

**Always Attached Rule (Cursor Codebase - Tailwind)**:

```mdc
---
globs: []
alwaysApply: true
description: ""
---

# Tailwind usage:

- `text-error-foreground`  
- `bg-input-border`  
```

**Auto Attached Rule (Cursor Codebase - Settings)**:

```mdc
---
globs: **/settings**.tsx
alwaysApply: false
description: ""
---

# Adding a setting:

- Edit `@reactiveStorageTypes.ts`  
- Update default in `INIT_APPLICATION_USER_PERSISTENT_STORAGE`  
- Toggle in `@settingsBetaTab.tsx` or `@settingsGeneralTab.tsx`  
```

---

## Team Rules (Planned)

- Shared MDC rules across repositories (future feature)  
- Interim workaround: shared repo or symlink into each project's `.cursor/rules`  

---

## Legacy `.cursorrules`

- Supported but deprecated  
- Single file in project root  
- Migrate to per-rule `.mdc` format for flexibility  

---

## FAQ

**What is the `.cursor/rules/globals` folder?**

- Some projects use this optionally. It's best practice to store cursor rules you'll share across projects in `.cursor/rules/globals` and project-specific rules in `.cursor/rules/local`. The globals directory can even be sym-linked.

**Why is Cursor itself struggling to edit it's own rules?**
There can be several reasons. Try the following to debug:

- You should have a rule for editing rules that always attaches using the glob `.cursor/rules`. Alternatively, Cursor has a builtin command to create rules in the chat that you can read about on their docs at: [Generating Rules](https://docs.cursor.com/context/rules#generating-rules).
- Cursor comes with it's own MDC file editor that sometimes conflicts with tool calls as it auto-formats. Try giving specific instructions for the agent to edit Cursor rules using simple pipes on the terminal to read and replace the entire file in one go.
- Check any `.cursorignore` file and/or `.cursorindexignore` files to see if you're accidentally ignoring the files or folders in the `.cursor` or `.cursor/rules` folder.
- Avoid have the rule files or Cursor settings open while edits are being made.
- You should `@` tag the rule file and rules folder when giving instructions.
- Try disabling `Cursor Settings -> Features -> Chat -> Dot Files Protection`

**Why isn't my rule being applied?**  
Check rule type, `description` presence (Agent Requested), and glob pattern match.

**Can rules reference other rules or files?**  
Yes. Use `@filename.ext` to include file context.

**Can I create a rule from chat?**  
Yes. Ask "turn this into a rule" or "make a reusable rule from this prompt."

**Do rules impact Cursor Tab or other AI features?**  
No. Rules apply only to Agent and Cmd-K AI models.
