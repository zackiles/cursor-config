# Cursor Cascade Comprehensive Technical Reference

### Definition

Cascade = Cursor IDE modular prompt-assembly framework merging VS Code extension state—tool schemas, taskDefinitions (with autoDetect, conditional when), remoteHelp, tunnel info, authentication, testing, embedding, shadow services, metrics, timeline, telemetry—into LLM chat. Orchestrates prompt partials, context injection, tool calls.

### Origins & Rationale

Cursor is a close-source fork of VS-Code. Finding ways to extending and integrate with it can be difficult as its internals are mostly undocumented. This technical reference includes a complete audit of known and unknown technical details of Cursor, in particular "Cascade" the heart of the Cursor IDE. Information in it was contained through online research, analysis and reverse engineering Cursor's Electron app and related code.

### Core Architecture & VS Code Interaction

*   **Modularity:** Via classes for services/providers/controllers.
*   **Dependency Injection:** Uses patterns like `Be(...)`/`et(...)` (likely `createDecorator`/`registerSingleton`) and decorators (`@param`, `__decorate`).
*   **Eventing:** Uses `$`-prefixed emitters (e.g., `$` class member representing an `Emitter`) and exposes `onDid…` events.
*   **Disposables:** Utilizes a base `H` class (likely `Disposable`) for resource management.
*   **RPC Separation:** Clear distinction between `MainThread` (`vo.MainThread...`) and `ExtHost` (`Bo.ExtHost...`). Services obtain proxies via `getProxy`. Methods prefixed with `$` (e.g., `$register…`, `$provide…`, `$callShadowServer`) represent RPC endpoints.
*   **Configuration:** Interacts with `IConfigurationService` (`pe`). Reads (`getValue`)/updates (`updateValue`) settings (e.g., `tasks`, `remote.*`, `window.*`, `workbench.*`, `testing`, `cursor-retrieval`). Reacts to changes via `onDidChangeConfiguration`.
*   **Context Keys:** Uses `ContextKey`/`ContextKeyExpr` (likely `he`/`T`). Defines keys like `taskRunning`, `testing.canRefresh`, `testing.isRunning`, `forwardedPortsViewEnabled`, `customExecutionSupported`.
*   **Logging:** Uses `ILogService` (`Mt`) for tracing and errors.
*   **Storage:** Interacts with `IStorageService` (`lt`). Uses a scoped wrapper (`LA`) with serialization. Persists data like `testingPreferredProfiles2`, `remote.tunnels.toRestore`.
*   **Localization:** Uses `d(...)` (likely `nls.localize`).

### Architecture

| Layer             | Elements                                                                                                                                                                                                                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompt partials   | `<tool_calling>`, `<memory>`, `<context>`, `<meta_instructions>`, `<conversation>`                                                                                                                                                                                                                                    |
| Server components | AIServer.v1 RPCs, Shadow Workspace proxy (via socket RPC), AI Connect transport (unary/stream, abort signals, chunked), Embedding Vector aggregator (parallel providers, 10 s timeout, cancellation tokens), TunnelService (privacy/protocol negotiation, candidate filtering), Port Attributes (config/provider merging), VM Daemon Service (Exec, file I/O, indexing, tokens) |
| Extension points  | taskDefinitions, remoteHelp, authentication, ExtHostTesting, DiffingProvider, EverythingProvider, MCP Server, AI Connect Transport, AiEmbeddingVector (parallel providers, timeout, cancellation), Secret-State, Share, Profile Content Handlers, AI Information Providers, Timeline, PortsAttributesProvider, Shadow Workspace     |
| Services          | MainThreadTask, MainThreadTunnelService, MainThreadInteractive, MainThreadAuthentication, MainThreadTesting, MainThreadSecretState, MainThreadShare, MainThreadProfileContentHandlers, MainThreadAiRelatedInformation, MainThreadAiEmbeddingVector, Edit-History provider, LSP Subgraph activator                  |

#### AIServer.v1 RPCs surfaced to `<tool_calling>`

This section details the gRPC services defined under the `aiserver.v1` namespace, accessible via the AI Connect Transport layer and exposed as tools within the Cascade framework.

##### Core Services Overview

| Service | Internal ID | Primary Purpose |
|---------|------------|-----------------|
| VmDaemonService | `vWs` | Core OS/environment interaction (file I/O, execution, indexing) |
| NetworkService | `bWs` | Network connectivity and public IP detection |
| AiProjectService | `KHs` | Complex, multi-step agentic AI workflows |
| AutopilotService | `tWs` | Autonomous agent control for environment interaction |
| DebuggerService | `lWs` | AI-assisted debugging and bug analysis |
| GitGraphService | `uWs` | Git history analysis for context enrichment |
| HallucinatedFunctionsService | `mWs` | Advanced code generation via "Opus Chains" |

<details>
<summary><strong>VmDaemonService (Core OS/Environment Interaction)</strong></summary>

| Method | Type | Purpose | 
|--------|------|---------|
| `Exec` | `Unary` | Execute shell commands in a specified directory |
| `ReadTextFile` | `Unary` | Read file content with status flags |
| `WriteTextFile` | `Unary` | Write content to files with optional linting |
| `GetFileStats` | `Unary` | Get existence/type stats for multiple paths |
| `CallClientSideV2Tool` | `Unary` | Execute predefined tool calls |
| `GetExplicitContext` | `Unary` | Retrieve structured context for a root path |
| `ProvideTemporaryAccessToken` | `Unary` | Provide temporary auth tokens |
| `WarmCursorServer` | `Unary` | Initialize backend services |
| `RefreshGitHubAccessToken` | `Unary` | Update GitHub access tokens |
| `SyncIndex` | `Unary` | Trigger repository indexing |
| `CompileRepoIncludeExcludePatterns` | `Unary` | Compile gitignore-style patterns |
| `Upgrade` | `Unary` | Trigger backend upgrades |
| `Ping` | `Unary` | Basic health check |

##### Method Details

- **`Exec`**
  - Args: `command` (repeated string), `cwd` (string)
  - Returns: `stdout` (string), `stderr` (string), `exitCode` (int32)

- **`ReadTextFile`**
  - Args: `absolutePath` (string)
  - Returns: `contents` (string), `pathDoesNotExist` (bool), `wasTruncated` (bool), `isNotAFile` (bool)

- **`WriteTextFile`**
  - Args: `absolutePath` (string), `newContents` (string), `getNewLinterErrors` (bool), `rootPath` (string)
  - Returns: `newLinterErrors` (repeated message containing lint error details)

- **`GetFileStats`**
  - Args: `absolutePaths` (repeated string)
  - Returns: `fileStats` (repeated message with `absolutePath`, `pathExists`, `isFile`)

- **`CallClientSideV2Tool`**
  - Args: `tool_call` (message), `rootPath` (string), `composerId` (string)
  - Returns: `tool_result` (message)

- **`GetExplicitContext`**
  - Args: `rootPath` (string)
  - Returns: `explicit_context` (message)

- **`SyncIndex`**
  - Args: `rootPath` (string), `repositoryInfo` (message), `pathEncryptionKey` (string)
  - Returns: Empty

- **`CompileRepoIncludeExcludePatterns`**
  - Args: `rootPath` (string), `request` (message with include/exclude patterns)
  - Returns: `response` (message with compiled patterns/results)

- **`Upgrade`**
  - Args: Empty
  - Returns: `version` (string), `newPort` (string)
</details>

<details>
<summary><strong>NetworkService (Network Utilities)</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `GetPublicIp` | `Unary` | Retrieve the public IP address |
| `IsConnected` | `Unary` | Check network connectivity |

##### Method Details

- **`GetPublicIp`**
  - Args: Empty
  - Returns: `ip` (string)

- **`IsConnected`**
  - Args: Empty
  - Returns: Empty
</details>

<details>
<summary><strong>AiProjectService (Complex AI Workflows)</strong></summary>

This service orchestrates multi-step AI tasks with a sequential workflow:

1. Initialize with a prompt (`aiProjectAgentInit`)
2. Ask clarifying questions (`aiProjectClarification`)
3. Generate plans (`aiProjectPlan`) and receive feedback (`aiProjectPlanFeedback`)
4. Break down plans into steps (`aiProjectBreakdown`) and receive feedback (`aiProjectBreakdownFeedback`)
5. Execute steps (`aiProjectStep`) and receive feedback (`aiProjectStepFeedback`)

All methods use `ServerStreaming` to support progressive responses and manage state between steps.

##### Workflow Features

- Typed step categories (Read/Write File, Run Terminal, Create/Remove Files)
- Complex state management via Protobuf messages
- Thought management and reasoning capture
- Conversation history between steps
- Feedback incorporation for plan/step revision
</details>

<details>
<summary><strong>AutopilotService (Autonomous Agent Control)</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `streamAutopilot` | `ServerStreaming` | Control an autonomous agent interaction |

##### Method Details

- **`streamAutopilot`**
  - Input: 
    - Start requests (`task`)
    - Action results (terminal output, user answers, web search results, file edits)
    - Control signals (`pause`, `continue`, `done`, `error`)
    - Context (`workingDirectory`, `currentDirectoryFiles`, `relatedFiles`)
  - Output:
    - Agent actions (`terminal_command`, `web_search`, `ask_user`, `ask_oracle`, `file_edit`, `open_file`)
    - Agent thoughts (`stream_thought`)
    - Status updates (`paused`, `done`, `start_sub_agent`, `done_sub_agent`)
    - Raw LLM responses
</details>

<details>
<summary><strong>DebuggerService (AI-Assisted Debugging)</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `gitFilter` | `ServerStreaming` | Find relevant commits based on bug description |
| `fileFilter` | `ServerStreaming` | Identify files related to a bug |
| `bugAnalysis` | `ServerStreaming` | Perform deep analysis of provided bug context |
</details>

<details>
<summary><strong>GitGraphService (Git History Analysis)</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `initGitGraph` | `Unary` | Initialize git graph representation |
| `initGitGraphChallenge` | `Unary` | Challenge/response for secure initialization |
| `batchedUploadCommitsIntoGitGraph` | `Unary` | Upload commit data in batches |
| `getPendingCommits` | `Unary` | Retrieve commits awaiting processing |
| `markPendingCommits` | `Unary` | Mark commits as processed |
| `getGitGraphRelatedFiles` | `Unary` | Find files related through commit history |
| `getGitGraphStatus` | `Unary` | Check indexing status |
| `deleteGitGraph` | `Unary` | Clean up git graph resources |
| `isGitGraphEnabled` | `Unary` | Check if git graph features are available |
</details>

<details>
<summary><strong>HallucinatedFunctionsService (Advanced Code Generation)</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `v0ChainRun` | `ServerStreaming` | Legacy chain execution |
| `opus2ChainPlan` | `ServerStreaming` | Plan code changes |
| `opus2ChainApplyPlan` | `ServerStreaming` | Apply planned changes |
| `opus2ChainReflect` | `ServerStreaming` | Evaluate and refine results |
| `sortUsefulTypesNaive` | `Unary` | Sort/rank types by usefulness |

The "Opus Chains" workflow involves:
1. Planning the code change
2. Applying the planned change
3. Reflecting on and evaluating the result
4. Potentially retrying or requesting more information
</details>

##### Additional Services

The `aiserver.v1` namespace contains other services not detailed above that handle various backend functions:

<details>
<summary><strong>AdminService - Administration functions</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `DeleteUser` | `Unary` | Delete a user account by authentication ID |
| `RunTailscaleSSH` | `Unary` | Trigger Tailscale SSH for administrative access |
| `AddAuthIdsToTeam` | `Unary` | Associate multiple authentication IDs with a specific team |

##### Method Details

- **`DeleteUser`**
  - Args: `authId` (string)
  - Returns: Empty
  
- **`RunTailscaleSSH`**
  - Args: Empty
  - Returns: Empty
  
- **`AddAuthIdsToTeam`**
  - Args: `teamId` (int32), `authIds` (repeated string), `workosIds` (repeated string)
  - Returns: Empty
</details>

<details>
<summary><strong>BidiService - Bidirectional communication</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `BidiAppend` | `Unary` | Append data in a bidirectional context |

##### Method Details

- **`BidiAppend`**
  - Args: Message with data to append
  - Returns: Status or result message
</details>

<details>
<summary><strong>FileSyncService - File synchronization</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `FSUploadFile` | `Unary` | Upload a file to the backend service |
| `FSSyncFile` | `Unary` | Synchronize a file's state with the backend |
| `FSIsEnabledForUser` | `Unary` | Check if file sync is enabled for a user |
| `FSConfig` | `Unary` | Retrieve file sync configuration parameters |
| `FSGetFileContents` | `Unary` | Retrieve content of a specific stored file |
| `FSGetMultiFileContents` | `Unary` | Retrieve contents for multiple files at once |
| `FSInternalSyncFile` | `Unary` | Internal sync operation for backend use |
| `FSInternalUploadFile` | `Unary` | Internal upload operation for backend use |
| `FSInternalHealthCheck` | `Unary` | Internal health check for backend use |
</details>

<details>
<summary><strong>LinterService - Code linting</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `LintFile` | `Unary` | Lint an entire file |
| `LintChunk` | `Unary` | Lint a specific portion of code |
| `LintFimChunk` | `Unary` | Lint code in fill-in-the-middle generation context |
| `LintExplanation` | `ServerStreaming` | Stream AI-generated explanation for a linting error |
| `LintExplanation2` | `Unary` | Get complete AI explanation for a linting error |

##### Method Details

- **`LintFile`**
  - Args: File content, path, language details
  - Returns: List of linting errors/warnings
  
- **`LintExplanation`**
  - Args: Lint error details
  - Returns: Streamed explanation text
</details>

<details>
<summary><strong>MetricsService - Usage metrics</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `ReportIncrement` | `Unary` | Report counter metric increment |
| `ReportDecrement` | `Unary` | Report counter metric decrement |
| `ReportDistribution` | `Unary` | Report distribution metric |
| `ReportGauge` | `Unary` | Report gauge metric |

##### Method Details

- Each method:
  - Args: Contains metric name, value, tags/dimensions
  - Returns: Empty (acknowledgement)
</details>

<details>
<summary><strong>ProfilingService - Performance profiling</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `SubmitProfile` | `Unary` | Upload performance profiling data |

##### Method Details

- **`SubmitProfile`**
  - Args: Performance profile data (e.g., pprof format)
  - Returns: Empty (acknowledgement)
</details>

<details>
<summary><strong>AnalyticsService - User analytics</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `TrackEvents` | `Unary` | Send batches of analytics events |

##### Method Details

- **`TrackEvents`**
  - Args: `events` (repeated message with `eventName`, `timestamp`, and `eventData`)
  - Returns: Empty (acknowledgement)
</details>

<details>
<summary><strong>ClientLoggerService - Debug logging</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `GetDebuggingDataUploadUrl` | `Unary` | Obtain URL for uploading debugging data |
| `LogWhenTabTurnsOff` | `Unary` | Log events when a tab closes |

##### Method Details

- **`GetDebuggingDataUploadUrl`**
  - Args: Empty
  - Returns: `url` (string)
  
- **`LogWhenTabTurnsOff`**
  - Args: `stackTrace` (string)
  - Returns: Empty
</details>

<details>
<summary><strong>ContextBankService - AI context management</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `CreateContextBankSession` | `BiDiStreaming` | Establish long-lived session for managing AI context |

##### Method Details

- **`CreateContextBankSession`**
  - Client Stream: Sends messages for session setup, updates, file content, changes
  - Server Stream: Requests files, provides status updates on context
  - Features: Encrypted paths, dynamic context management, activity tracking
</details>

<details>
<summary><strong>CursorPredictionService - Cursor movement prediction</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `CursorPredictionConfig` | `Unary` | Retrieve configuration for cursor prediction features |

##### Method Details

- **`CursorPredictionConfig`**
  - Args: Empty
  - Returns: Available models with parameters, default model, applicable heuristics
</details>

<details>
<summary><strong>ShadowWorkspaceService - Workspace analysis proxy</strong></summary>

| Method | Type | Purpose |
|--------|------|---------|
| `GetLintsForChange` | `Unary` | Get lint errors for a specific code modification |
| `ShadowHealthCheck` | `Unary` | Check health of shadow workspace service |
| `SwSyncIndex` | `Unary` | Manage index synchronization in shadow workspace |
| `SwProvideTemporaryAccessToken` | `Unary` | Provide access token to shadow workspace |
| `SwCompileRepoIncludeExcludePatterns` | `Unary` | Compile filtering patterns for workspace |
| `SwCallClientSideV2Tool` | `Unary` | Execute tool calls via shadow workspace |
| `SwGetExplicitContext` | `Unary` | Get structured context via shadow workspace |
| `SwWriteTextFileWithLints` | `Unary` | Write file and get immediate lint results |
</details>

<details>
<summary><strong>AiEmbeddingVectorService - Vector embeddings</strong></summary>

Vector embedding service that provides semantic code representation. While the gRPC endpoint is referenced in code, the implementation details are handled through Extension Host providers that register via `$provideAiEmbeddingVector`.
</details>

<details>
<summary><strong>AiRelatedInformationService - Related information retrieval</strong></summary>

Service for retrieving contextually related information. Like the embedding service, this is primarily implemented through Extension Host providers that register via `$provideAiRelatedInformation`.
</details>

These RPCs form a comprehensive backend infrastructure supporting Cursor's AI capabilities, from basic file operations to complex multi-step reasoning workflows, all integrated into the tool calling framework.

### Extension-Point Hooks

| Point                     | Purpose                                                                                             | Cascade Use                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| taskDefinitions           | Dynamic oneOf JSON schema; accepts when expressions; fires onDefinitionsChanged & onTaskType:<type> | Conditional tasks in `<context>`; autoDetect; default presentation options; activation events                 |
| remoteHelp                | Links getStarted/docs/feedback/reportIssue/issues                                                   | Injects docs & port info into `<memory>`/`<context>`                                                           |
| authentication            | Registers AuthenticationProviders; session/events management                                        | Session facts in `<context>`; OAuth flows via RPC; activation onAuthenticationRequest:{providerId}               |
| ExtHostTesting            | provideTestFollowups/executeTestFollowup/disposeTestFollowups; batching, profiles, results          | Test context + follow-up tool calls (`provideTestFollowups`, etc.); manages profiles, results                |
| DiffingProvider           | Word-level diff patches                                                                             | Diff tools + context attachments using *word-level* diffs                                                      |
| EverythingProvider        | Project-wide code actions                                                                           | Broad code harvesting via `runCommand`                                                                       |
| MCP Server                | Model Context Protocol retrieval                                                                    | External context enrichment                                                                                    |
| AI Connect Transport      | Unary/stream transports, abort signals, chunked streaming                                           | Routes all LLM service calls via unary/stream, handles abort signals, chunked streaming                      |
| AiEmbeddingVector         | `$registerAiEmbeddingVectorProvider`; parallel providers; 10 s default timeout; cancels via tokens  | Embedding calls via `<call>`; handles parallel providers, default timeout, cancellation tokens               |
| Shadow Workspace          | Proxy socket; `callShadowServer`; code-analysis services                                            | Deep code context via proxy socket and `callShadowServer`                                                      |
| Edit-History/LSP Subgraph | Compile edit history; activate LSP subgraph                                                         | Historical code context via `compile edit history` and `activate LSP subgraph`                               |
| Secret-State              | Secure storage; onDidChangeSecret                                                                   | Keys & secrets surfaced securely; reacts to `onDidChangeSecret`                                                |
| Share                     | registerShareProvider; AI-driven share flows                                                        | Share tool calls via `registerShareProvider`                                                                 |
| Profile Content Handlers  | Save/read user profiles                                                                             | Memory enrichment via save/read profile handlers                                                             |
| AI Information Providers  | Symbols/commands/search/settings                                                                    | Rich hints (symbols, commands, search, settings) in `<context>`                                              |
| Timeline                  | registerTimelineProvider, change events                                                             | File-history attachments via `registerTimelineProvider`, reacts to change events                             |
| PortsAttributesProvider   | providePortAttributes API; filterable by portRange/commandPattern                                   | Merges config rules, provider outputs (via `providePortAttributes`), built-ins; supports filtering          |

### Port Attributes & TunnelService

*   Settings `remote.portsAttributes`/`remote.otherPortsAttributes`: target ports/ranges/host:port patterns; define onAutoForward, label, protocol, elevateIfNeeded, requireLocalPort.
*   `ForwardedPorts` model (`wbt` class): tracks forwarded, detected, candidate ports.
*   Supports privacy (`private`, `public`, `constantPrivate`), protocol (`http`, `https`) negotiation.
*   Supports candidate filtering mechanism.
*   `isPortPrivileged` flags ports < 1024 for elevation.
*   Default bind address configurable via `remote.localPortHost`.
*   Resolution merges config rules, `PortsAttributesProvider` outputs, built-ins in override order.
*   Persistence: stores `remote.tunnels.toRestore` with expiration (`remote.tunnels.toRestoreExpiration`) via storage service.
*   Auto-forwarding logic based on settings and detected processes exists.

### Prompt Section Details

| Tag                   | Source & Build Logic                                                                                           | Payload                            | Agent Function        |
| --------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------- |
| `<tool_calling>`      | AIServer.v1 RPCs + extension schemas                                                                           | Aliases, param keys, demo `<call>` | Select & format calls |
| `<memory>`            | Facts from authentication, remoteHelp, profile handlers                                                        | User/project/session memory        | Recall                |
| `<context>`           | IDE state: editors, cursor pos, notebooks, ports, tasks, sessions, tests, diffs, embeddings, timeline, secrets | `<attachment>` blobs               | Grounding             |
| `<conversation>`      | Turn history                                                                                                   | `<turn><user…>`/`<assistant…>`     | Continuity            |
| `<meta_instructions>` | Static rules                                                                                                   | Tone, format, safety               | Style control         |

### Behaviors

*   Idempotent partial updates
*   XML delimiters → tokenizer efficiency
*   Few-shot `<call>` demos for schema adherence
*   Explicit `<user>`/`<assistant>` roles save tokens
*   Streaming RPC outputs injected as `<system><tool_output>…</tool_output></system>`

### Model Compatibility

Anthropic Claude 3.x, OpenAI GPT-4/o4, Google Gemini 2.x

### Workflow Coverage

Analysis → diff → test run → embedding → commit-share; orchestrated via multi-tool chaining, long-term memory, auth flows, shadow analysis, timeline, telemetry

### Search & Reverse Engineering Tips

Search minified dist for: registerExtensionPoint, callClientSideV2Tool, AiEmbeddingVectorProvider, onDidRegisterAuthenticationProvider, registerTimelineProvider, provideTestFollowups, callShadowServer

### Feature Modules

#### Tasks

*   Providers: `registerTaskProvider`, `$provideTasks`, `$resolveTask`; supports `shell`, `process`, `customExecution`.
*   Execution: `executeTask`, `terminateTask`, `run`.
*   Models: `nbt` (base), `kf` (customized?), `Vy` (contributed?), `NP` (composite?).
*   Context: `taskRunning`, `customExecutionSupported`, `shellExecutionSupported`.
*   RPC: `MainThreadTask` (`AHs`), `ExtHostTask` (`Bo.ExtHostTask`).

#### Tunnels & Port Forwarding

*   Services: `ITunnelService` (`Hb`/`dri`), `IRemoteExplorerService` (`xg`/`bri`), `ExtHostTunnelService` (`$Hs`), `MainThreadTunnelService` (`BHs`).
*   Ops: `openTunnel`, `closeTunnel`, `forwardPort`, `getTunnels`.
*   Models: `M5r`, `O5r` (tunnel representations), `wbt` (forwarded/detected/candidate port model).
*   Context: `forwardedPortsViewEnabled`, `forwardedPortsViewOnlyEnabled`.
*   RPC: `$openTunnel`, `$closeTunnel`, `$forwardPort`, `$registerPortsAttributesProvider`, `$providePortAttributes`, `$onDidTunnelsChange`.

#### Authentication

*   Service: `IAuthenticationService` (`Ov`/`yri`).
*   Providers: `j5r` instances with `id`/`label`; manage `getSessions`/`createSession`/`removeSession`; Specific `github` provider mentioned.
*   UI: `IDialogService` (`E9`) for consent prompts ("Allow", "Don't Ask Again").
*   Sessions: Model with `id`, `accessToken`, `account`, `scopes`; multiple accounts via `getAccounts`.
*   Persistence: Stores preferences (`bJ` likely); may retrieve stored sessions (`vri` function).
*   Context: Activation via `onAuthenticationRequest:{providerId}`.
*   RPC: `MainThreadAuthentication` (`VHs`), `ExtHostAuthentication` (`Bo.ExtHostAuthentication`).

#### Testing

*   Services: `ITestService` (`Rc`), `ITestProfileService` (`Up`/`Dri`), `ITestResultService` (`wm`/`Fri`), `ITestResultStorage` (`$Ws`/`Mri` or `$ri`).
*   Controllers: `registerTestController`; Hierarchical IDs via `Nc`.
*   Profiles: `add`/`update`/`remove`/`configureRunProfile`; groups (Run, Debug, Coverage); defaults persisted (`testingPreferredProfiles2`).
*   Results: `createLiveResult`, `updateState`, `appendOutput`, `appendMessage`, `markComplete`; Models `Hy` (live), `f9r` (stored); output streams via `c9r`; coverage via `s9r`.
*   Context: `testing.canRefresh`, `testing.isRunning`, `testing.hasRunnableTests`, `testing.isTestCoverageOpen`, etc.
*   RPC: `MainThreadTesting` (`_Ws`), `ExtHostTesting` (`Bo.ExtHostTesting`).

#### Secret Storage

*   Service: `ISecretStorageService` (`gne`/`_ri`); uses `Ori` (encryption service) if available, falls back to in-memory; tracks type `persisted`/`in-memory`.
*   Backends: Mentions `kwallet`, `gnome-libsecret`, `basic`, `keychainAccess`.
*   RPC: `MainThreadSecretState` (`VWs`), `ExtHostSecretState` (`Bo.ExtHostSecretState`) provide extension-scoped view.

#### Window Title

*   Service: `Pbt`; reads `window.title`, `window.titleSeparator` settings; supports variables like `${activeEditorShort}`, `${rootName}`, `${profileName}`, `${remoteName}`, `${dirty}`, `${focusedView}`.
*   Updates: Dynamically based on editor, workspace, remote, profile, focus; adds prefixes/suffixes (`[Extension Development]`, `[ADMIN]`).

#### Cursor AI / Backend Communication

*   **Transport:** `MainThreadCursor` (`CWs`); registers `IConnectTransportProvider` (`$fe`); handles unary (`$callAiConnectTransportProviderUnary`) and streaming (`$callAiConnectTransportProviderStream`) calls; Connect-Web style errors (`Vf`).
*   **gRPC Services & Protobuf Classes (extending `R`):** (Extensive list defining backend interactions)
    *   `AdminService` (`qHs`)
    *   `AiProjectService` (`KHs`) - Agent-based multi-step tasks.
    *   `BidiService` (`YHs`)
    *   `FileSyncService` (`XHs`) - Upload/sync files.
    *   `LinterService` (`QHs`)
    *   `MetricsService` (`ZHs`)
    *   `ProfilingService` (`wri`)
    *   `AnalyticsService` (`Cri`)
    *   `AutopilotService` (`tWs`) - Autonomous agent actions.
    *   `ClientLoggerService` (`Sri`) - Debug data upload.
    *   `ContextBankService` (`aWs`) - Manages AI context (history, files, changes).
    *   `CursorPredictionService` (`xri`)
    *   `DebuggerService` (`lWs`) - AI Debugging assistance.
    *   `GitGraphService` (`uWs`) - Git history graph for context.
    *   `HallucinatedFunctionsService` (`mWs`) - Advanced code gen (Opus chains).
    *   `NetworkService` (`bWs`)
    *   `VmDaemonService` (`vWs`) - Filesystem, process exec, indexing bridge?
    *   `ShadowWorkspaceService` (`I0e`/`WHs`) - Workspace analysis proxy.
    *   `AiEmbeddingVectorService` (`jWs`)
    *   `AiRelatedInformationService` (`M0e`)

#### Indexing

*   Service: `IIndexingService` (`Eb`); `registerIndexProvider`; ops: get status, progress, jobs, embeddable files, path encryption/decryption; RPC via `ExtHostCursor`.
*   Integration: Feeds `ContextBankService`; controlled by `indexRepository` setting.

#### Other Services

*   Edit History: `IEditHistoryService` (`HHs`)
*   LSP Subgraph: `ILspSubgraphService` (`$w`/`zlt`)
*   Diffing: `IDiffingService` (`cbe`)
*   Everything: `IEverythingService` (`zlt`)
*   Share: `IShareService` (`Dbt`/`HWs`)
*   Profile Content: `IProfileImportExportService` (`ibe`/`WWs`)
*   Cursor Ignore: `ICursorIgnoreService` (`hbe`)

### Terminology

| Term                       | Definition                                                                        |
| -------------------------- | --------------------------------------------------------------------------------- |
| AiConnectTransportProvider | Pluggable HTTP/WS transport for LLM gRPC calls (unary/stream, errors, chunks)     |
| Shadow Workspace           | Headless code analysis service accessed via socket RPC (`callShadowServer`)       |
| EmbeddingVectorProvider    | Returns vector embeddings of text/code; aggregated service handles multiple       |
| Timeline entry             | File or symbol history node                                                       |
| Secret-State key           | Securely stored token/password via RPC, scoped by extension                       |
| PortsAttributesProvider    | Hook (`providePortAttributes`) for dynamic per-port metadata (label, autoForward) |
| VM Daemon Service          | Process providing core OS interactions: Exec, file I/O, indexing, token management  |

### Key Variables/Classes

*   **Base:** `H` (Disposable)
*   **DI/Registration:** `Be`, `et`
*   **Localization:** `d`
*   **Core VS Code Services (Inferred):** `pe` (Config), `lt` (Storage), `Mt` (Log), `kt` (Workspace), `Le` (ContextKey), `E9` (Dialog), `At` (Telemetry), `Hs` (Label), `Bl` (Profiles), `ds` (Environment), `Bs` (Host)
*   **Cursor Services (Inferred):** `_c` (Session), `Vi` (StorageMgmt), `Eb` (Indexing), `qL` (Metrics), `cbe` (Diffing), `HHs` (EditHistory), `$w`/`zlt` (LspSubgraph/Everything), `CYt` (ConnectTransport), `WHs`/`Ylt` (ShadowWorkspace Server/Client), `$fe` (ConnectTransportProvider), `V0` (Analytics), `D0e` (Tracing), `ost` (ScopedProcess), `qx` (MachineInfo), `k0` (ServerConfig), `Hf`/`hbe` (CursorIgnore Internal/Public), `hR` (MCP Server)
*   **Window Title:** `Pbt` (Implementation)
*   **MainThread Handlers:** `CWs` (Cursor), `AHs` (Task), `BHs` (Tunnel), `VHs` (Auth), `_Ws` (Testing), `VWs` (SecretState), `HWs` (Share), `WWs` (ProfileContent), `qWs` (AiRelatedInfo), `zWs` (AiEmbeddingVector)
*   **RPC/Protobuf:** `yWs` (gRPC Service Map), Classes extending `R` (Protobuf Messages)

### Resource Links

| Resource                                | URL                                                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| SegmentFault "Cursor Cascade Deep Dive" | [https://segmentfault.com/a/1190000044039575](https://segmentfault.com/a/1190000044039575)                              |
| Cursor IDE                              | [https://www.cursor.so/](https://www.cursor.so/)                                                                        |
| Windsurf IDE                            | [https://windsurf.ai](https://windsurf.ai)                                                                              |
| Anthropic Tool Use docs                 | [https://docs.anthropic.com/claude/docs/tool-use](https://docs.anthropic.com/claude/docs/tool-use)                      |
| Anthropic function-calling              | [https://docs.anthropic.com/claude/reference/messages_post](https://docs.anthropic.com/claude/reference/messages_post) |
| VS Code taskDefinitions point           | dc.registerExtensionPoint({extensionPoint:"taskDefinitions",…})                                                         |
| VS Code remoteHelp point                | dc.registerExtensionPoint({extensionPoint:"remoteHelp",…})                                                              |
| VS Code authentication point            | dc.registerExtensionPoint({extensionPoint:"authentication",…})                                                          |
| VS Code timeline API                    | registerTimelineProvider()                                                                                              |

---
