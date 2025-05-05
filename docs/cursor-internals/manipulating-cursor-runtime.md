# Manipulating the Cursor Runtime

The following document describes theorized approaches to interacting with or manipulating the Cursor IDE runtime programmatically. Please read the [Comprehensive Cursor Technical Reference](./index.md) for a broader understanding of the reversed engineered details on Cursor.

## Theorized Approaches Per-Vector

### VSCode Extension

TBD

### RPC

#### AIServer.v1 RPCs surfaced to `<tool_calling>`

This details the gRPC services defined under the `aiserver.v1` namespace, likely accessible via the AI Connect Transport layer and potentially exposed as tools within the Cascade framework.

**Important Disclaimer:** The underlying definitions reveal the *interface* (service names, method names, request/response message structures via Protobuf definitions) of these `aiserver.v1` services. However, they **do not explicitly state:**

1.  **The Network Endpoint:** Where these services are actually hosted (e.g., `localhost:PORT`, a cloud address, a Unix domain socket path).
2.  **The Transport Protocol:** While resembling gRPC, the heavy integration with the internal `AI Connect Transport` provider suggests it might use a custom transport layer abstraction over standard gRPC, gRPC-Web, or something else entirely, especially for communication proxied through the main Cursor application. Direct standard gRPC connections might not work without understanding this layer.
3.  **Authentication/Authorization:** How to authenticate requests programmatically (e.g., API keys, session tokens derived from a Cursor login). Many methods likely require an authenticated context.
4.  **Contextual Dependencies:** Many RPCs require arguments like `rootPath`, `workspaceId`, `sessionId`, encryption keys, or specific tokens (`ProvideTemporaryAccessToken`) that are typically established and managed *within* the Cursor application environment and would be difficult to replicate externally.

Therefore, achieving reliable programmatic access from an *external* script (like a standalone Deno script) is **highly speculative** based *only* on interface definitions and would likely require significant reverse engineering of the Cursor application's runtime behavior and network traffic to determine the endpoint, transport details, authentication, and necessary context. Direct programmatic access from external scripts requires finding the service endpoint and handling potential custom transport layers and authentication.

**Programmatic Endpoint Discovery Strategies (macOS Context)**

Finding the actual network address (IP:Port or Unix Domain Socket path) where these `aiserver.v1` services listen is crucial for external programmatic access. Based on Cursor being an Electron VS Code fork on macOS, here are potential reverse engineering approaches:

1.  **Static Analysis & Configuration Inspection:**
    *   **Techniques:**
        *   Unpack Cursor's application bundle (`Cursor.app/Contents/Resources/app.asar` using `npx asar extract`). Search the extracted JavaScript source (including the provided snippet and others) for hardcoded strings representing `localhost`, port numbers, socket paths (`/tmp/...`, `/var/run/...`), or configuration keys related to service addresses.
        *   Run `strings` on the main Cursor executable (`Cursor.app/Contents/MacOS/Cursor`) and any bundled helper executables (potential daemon processes) looking for plausible hostnames, ports, or socket paths.
        *   Inspect configuration files stored by Cursor (e.g., in `~/Library/Application Support/Cursor`, `~/Library/Preferences/`, or workspace storage `~/Library/Application Support/Code - OSS/User/workspaceStorage/` if it mimics VS Code structure closely) for relevant settings. Look for keys mentioned or implied related to `VmDaemonService` or `ShadowWorkspaceService`.
    *   **Rationale:** Configuration or defaults might be stored plaintext within the application's resources or settings files. The definitions specify service names but not endpoints.
    *   **Challenges:** Endpoints might be dynamically allocated or configured via IPC rather than static files. Obfuscation in the source code could hide direct references.

2.  **Runtime Network & Process Monitoring:**
    *   **Techniques:**
        *   While Cursor is running (especially after opening a project or using an AI feature), use command-line tools:
            *   `lsof -i -P | grep Cursor`: Lists open network files (TCP/UDP sockets) associated with Cursor processes, showing listening ports (`LISTEN`) or established connections.
            *   `lsof -U | grep Cursor`: Lists open Unix domain sockets associated with Cursor processes.
            *   `netstat -an | grep LISTEN`: Lists all listening TCP/UDP ports; identify ports opened by Cursor processes.
        *   Use GUI tools like `Activity Monitor` to inspect Cursor processes and their open files/ports.
        *   If communication is suspected to be non-local or encrypted local TCP, use a network proxy/sniffer like `mitmproxy` or `Wireshark` (requires setting up system proxy or intercepting traffic, potentially complex with Electron/localhost).
    *   **Rationale:** Active services must bind to a port or socket. These tools directly observe the OS state to find what Cursor processes are listening on or connected to. `VmDaemonService` or `ShadowWorkspaceService` might run as separate processes listening locally.
    *   **Challenges:** Identifying the *correct* port/socket among many used by Electron/VS Code can be difficult. Communication might use unnamed pipes or other IPC mechanisms not easily visible via standard network tools.

3.  **Dynamic Analysis & Instrumentation:**
    *   **Technique 1: VS Code Extension Development:**
        *   Create a minimal VS Code extension. Install and run it *within Cursor*.
        *   Use the standard VS Code extension API (available within Cursor as a fork) to:
            *   Access workspace configuration or potentially internal state (if Cursor exposes non-standard APIs).
            *   Use Node.js APIs available to extensions (like `child_process` to run `lsof` or `netstat`, or `os` to check standard socket locations).
            *   Log information that might hint at how Cursor sets up its internal communication (e.g., inspect arguments passed during activation).
    *   **Technique 2: Electron Debugging:**
        *   Launch Cursor with remote debugging enabled (e.g., `Cursor.app/Contents/MacOS/Cursor --remote-debugging-port=9222`).
        *   Connect Chrome DevTools to `localhost:9222`.
        *   Inspect the JavaScript environment of the main and renderer processes. Look for global variables, objects related to services (`VmDaemonService` client instances?), or configuration that might hold endpoint details. Examine Network tab for requests (might show internal IPC or gRPC-Web calls).
    *   **Technique 3: Memory Injection / Instrumentation (Frida):**
        *   Use Frida (`frida-trace`, or custom scripts) to attach to the running Cursor process(es).
        *   Hook potentially relevant functions:
            *   Node.js `net.createServer`, `server.listen`, `net.connect` to intercept TCP socket creation/connection and log addresses/ports.
            *   Node.js `fs` functions if socket paths or config files are read dynamically.
            *   Functions within Cursor's code related to service initialization or configuration loading (requires identifying these functions via static analysis or debugging first).
            *   Functions related to the `AI Connect Transport` provider setup (`$registerAiConnectTransportProvider`'s implementation details).
    *   **Rationale:** These methods inspect the application's live state or execute code within its context, providing direct access to runtime variables, configurations, and function arguments that contain the endpoint information. An extension is the "legitimate" way to run code inside. Frida offers the deepest level of introspection.
    *   **Challenges:** Requires significant technical expertise (Extension API, DevTools debugging, Frida scripting). Identifying the correct functions/variables to hook can be time-consuming. Anti-debugging or obfuscation techniques could hinder this.

4.  **Prompt Injection / Feature Hijacking (Experimental):**
    *   **Technique:**
        *   Leverage Cursor's chat interface and its potential access to tools.
        *   Craft prompts asking the AI to:
            *   Execute a command via the `VmDaemonService.Exec` tool (if exposed and not sandboxed) that reveals network configuration, e.g., "Use the Exec tool to run `lsof -i -P | grep LISTEN`" or "Run `echo $CURSOR_DAEMON_PORT`" (if such an environment variable exists).
            *   Describe its own configuration or the arguments it uses when connecting to backend services like `VmDaemonService` or `ShadowWorkspaceService`. "What host and port does the VmDaemonService typically run on in my environment?"
            *   Utilize a file reading tool (`VmDaemonService.ReadTextFile`) to read potential configuration files if their paths are known or guessable.
    *   **Rationale:** If the AI backend or the tool execution service has access to environment information or can run commands, it might be possible to trick it into revealing endpoint details through carefully constructed prompts.
    *   **Challenges:** Highly dependent on the AI's capabilities, the tools exposed to it, implemented security guardrails, and prompt filtering. Likely to fail or provide generic/sandboxed information. Very unreliable compared to technical analysis.

**Hypothetical Scenario: Targeting the Local VM Daemon Service (Assuming Endpoint Found)**

The `aiserver.v1.VmDaemonService` seems the *most plausible* candidate for any form of *local* programmatic interaction, given its methods involve direct OS/filesystem operations (`Exec`, `ReadTextFile`, `WriteTextFile`, `GetFileStats`) and setup (`WarmCursorServer`, `Upgrade`). This scenario assumes one of the discovery strategies above yielded the necessary endpoint details.

1.  **Locate the Service Endpoint:** Use one of the strategies above to find the listening address (e.g., `localhost:54321` or `/tmp/cursor-daemon.sock`) and any necessary connection token. Note that methods like `WarmCursorServer` (taking `port`, `connectionToken`) and `Upgrade` (returning `newPort`) suggest the endpoint might be dynamic or session-specific. This information **must be discovered externally**.
2.  **Obtain/Generate Protobuf Definitions:** Manually reconstruct the `.proto` file definitions based on the JavaScript class structures observed (mapping `fields` back to proto syntax). Use a Protobuf compiler (`protoc`) with a gRPC plugin for JavaScript/TypeScript (`protoc-gen-grpc-web`, `protoc-gen-ts`) to generate the necessary client stub code compatible with your chosen gRPC library.
3.  **Choose and Configure a gRPC Client Library (Deno):** Use a library like `@grpc/grpc-js` (potentially via Node compatibility layer/polyfills in Deno) or a native Deno gRPC library. Ensure compatibility with the likely transport protocol (which might not be standard HTTP/2 gRPC).
4.  **Implement the Client Call:**

    *   **Example (Conceptual Deno JS using `@grpc/grpc-js`):**

    ```typescript
    // main.ts (Deno)
    // NOTE: This is *highly* conceptual and assumes standard gRPC transport
    // and that you've found the endpoint, generated proto code, and handled compatibility.

    // Import Node compatibility layer if needed (may vary based on Deno version/setup)
    // import { createRequire } from "https://deno.land/std@0.XXX.0/node/module.ts";
    // const require = createRequire(import.meta.url);

    // Import generated gRPC client and messages (assuming generation in ./gen)
    // const { VmDaemonServiceClient } = require('./gen/aiserver/v1/VmDaemonService_grpc_pb.js');
    // const { PingRequest, ReadTextFileRequest } = require('./gen/aiserver/v1/VmDaemonService_pb.js');
    // const grpc = require('@grpc/grpc-js'); // Or native Deno equivalent

    // ---!!! Endpoint and Token Discovered via Reverse Engineering !!!---
    const DAEMON_ADDRESS = 'localhost:FOUND_PORT'; // <-- Replace with discovered value
    // const DAEMON_SOCKET = 'unix:///path/to/discovered/socket'; // Alternative
    const CONNECTION_TOKEN = 'TOKEN_IF_NEEDED'; // <-- Replace if discovered
    // ---!!!------------------------------------------------------!!! ---

    async function callDaemon() {
        // Placeholder: Actual credentials might involve TLS or other mechanisms.
        const creds = grpc.credentials.createInsecure(); // Likely needs real auth/creds

        // Add metadata if a connection token is needed (header name is assumed)
        const metadata = new grpc.Metadata();
        if (CONNECTION_TOKEN) {
             metadata.set('authorization', `Bearer ${CONNECTION_TOKEN}`); // Example, actual header unknown
        }

        const client = new VmDaemonServiceClient(DAEMON_ADDRESS /* or DAEMON_SOCKET */, creds);

        // Example 1: Ping
        console.log('Pinging Daemon...');
        const pingRequest = new PingRequest(); // Assuming PingRequest is an empty message
        try {
            const pingResponse = await new Promise((resolve, reject) => {
                // Pass metadata if applicable
                client.ping(pingRequest, metadata, (err, response) => {
                    if (err) return reject(err);
                    resolve(response);
                });
            });
            console.log('Ping successful!');
        } catch (error) {
            console.error('Ping failed:', error.message);
            // Decide if you can continue
        }

        // Example 2: ReadTextFile (Requires a valid absolute path known to the daemon)
        const filePathToRead = '/path/to/your/workspace/file.txt'; // <-- Needs context
        console.log(`Reading file: ${filePathToRead}...`);
        const readFileRequest = new ReadTextFileRequest();
        // Assuming generated code provides setter methods:
        readFileRequest.setAbsolutePath(filePathToRead);

        try {
            const fileResponse = await new Promise((resolve, reject) => {
                // Pass metadata if applicable
                client.readTextFile(readFileRequest, metadata, (err, response) => {
                     if (err) return reject(err);
                    resolve(response);
                });
            });

            // Access response fields using generated getter methods (names are hypothetical)
            // Check response status before accessing content
            if (fileResponse.getPathDoesNotExist()) {
                console.log(`File does not exist: ${filePathToRead}`);
            } else if (fileResponse.getIsNotAFile()) {
                 console.log(`Path is not a file: ${filePathToRead}`);
            } else {
                 console.log('File Content:');
                 console.log(fileResponse.getContents()); // Assumes getContents() returns string/bytes
                 if (fileResponse.getWasTruncated()){
                     console.warn("Warning: File content was truncated by the service.");
                 }
            }
        } catch (error) {
            console.error(`ReadTextFile failed for ${filePathToRead}:`, error.message);
        }

        // Clean up the client connection if applicable
        client.close();
    }

    callDaemon();
    ```

**Specific RPC Considerations:**

*   **`Exec`:** Requires `command` array and `cwd`. Returns `stdout`, `stderr`, `exitCode`. Useful for running tools or scripts within the daemon's environment.
*   **`CallClientSideV2Tool`:** Requires a complex `tool_call` message structure (not fully defined in snippets) and context (`rootPath`, `composerId`). Likely hard to call externally without knowing the tool schema and composer context.
*   **`ReadTextFile`/`WriteTextFile`/`GetFileStats`:** Need valid absolute paths *within the context the daemon is running*. Relative paths likely won't work. `WriteTextFile` can optionally return lint errors. Responses need careful checking (e.g., for existence, type, truncation).
*   **`GetExplicitContext`:** Needs `rootPath`. Returns a structured context message, the details of which aren't fully defined in snippets.
*   **`ProvideTemporaryAccessToken`:** Needs an `accessToken`. Purpose unclear without more context – maybe for authorizing subsequent calls within a short timeframe?
*   **`WarmCursorServer`:** Needs Git `commit`, `port`, `connectionToken`, `rootPath`. Suggests preparing a specific backend instance tied to a workspace state. Likely called internally by Cursor.
*   **`RefreshGitHubAccessToken`:** Needs a GitHub token. Used to update the backend's token.
*   **`SyncIndex`, `CompileRepoIncludeExcludePatterns`:** Need `rootPath` and potentially repo info or patterns. Trigger backend indexing/filtering logic.
*   **AI Services (Project, Autopilot, Debugger, GitGraph, Hallucinated):** These are complex and highly stateful/context-dependent. They often require session IDs, specific context messages (like conversation history, file contents, diffs, codebase information), or model details. Calling these externally would be extremely difficult without replicating the entire session context Cursor maintains. Many use Server-Streaming or BiDi-Streaming, requiring more complex client handling.
*   **ContextBankService:** Requires a persistent BiDi stream, encryption keys, and constant updates from the client reflecting user actions. Almost certainly not designed for external programmatic access.

**RPC Considerations (Summary):**

*   `VmDaemonService` methods (like `Exec`, `ReadTextFile`) are the most likely candidates for *local* interaction if the endpoint and authentication details can be discovered.
*   AI Services (`AiProjectService`, `AutopilotService`, `HallucinatedFunctionsService`, `ContextBankService`, etc.) are highly complex, stateful, and require deep integration with the application's runtime context (session IDs, encryption keys, conversation history, real-time file updates). External programmatic access is **extremely unlikely** to be feasible or stable without replicating a large part of Cursor's internal state management.
*   Authentication and the exact nature of the `AI Connect Transport` layer remain significant barriers for most services. Discovering and potentially bypassing or replicating these is essential.

**Conclusion:**

Finding the endpoint for services like `VmDaemonService` programmatically requires runtime inspection or instrumentation (network/process monitoring, debugging, Frida). Static analysis or prompt injection are less reliable but might offer clues. Once an endpoint and authentication mechanism are found, interacting with simpler services like `Ping` or `ReadTextFile` becomes *theoretically* possible by generating client code from the Protobuf definitions. However, authentication, the specific transport layer, and the need for correct contextual arguments remain significant hurdles. Accessing the complex, context-dependent AI services externally is likely impractical without deep reverse engineering or using officially supported APIs (if any exist). The available definitions reveal structure but lack the crucial implementation details needed for straightforward external interaction.
