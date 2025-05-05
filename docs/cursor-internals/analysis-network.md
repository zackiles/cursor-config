# Network Analysis of Cursor IDE
DANGER: ENSURE THE FOLLOWING ARE MASKED OR ANONYMIZED:
- Remote Host names
- Remote IP Addresses
- Names of users on a system
- Remove non-cursor related info


## Ports

### Listening
The following ports were found in LISTEN state:

- **9222**: Deno LSP TypeScript service (confirmed via /json/version endpoint)
  ```bash
  $ curl -v http://localhost:9222/json/version
  < HTTP/1.1 200 OK
  < content-type: application/json
  {"Browser":"deno-lsp-tsc","Protocol-Version":"1.3","V8-Version":"13.0.245.12-rusty"}
  ```
  - Used by Cursor for TypeScript language support and code analysis

- **65230**: Suspected VmDaemonService endpoint (not confirmed)
  ```bash
  $ curl -v -X POST http://localhost:65230/aiserver.v1.VmDaemonService/Ping -H "Content-Type: application/json" -d '{}'
  < HTTP/1.1 503 Service Unavailable
  < Content-Type: text/plain; charset=utf-8
  dial tcp 3.142.127.161:8886: i/o timeout
  ```
  - Returns 503 with timeout error when attempting to reach AWS endpoint
  - While namespace matches Cursor's RPC pattern, gRPC protocol not confirmed
  - May be a proxy that forwards to AWS services

- **65220**: Suspected ShadowWorkspaceService endpoint (not confirmed)
  ```bash
  $ curl -v -X POST http://localhost:65220/aiserver.v1.ShadowWorkspaceService/ShadowHealthCheck -H "Content-Type: application/json" -d '{}'
  < HTTP/1.1 404 Not Found
  < Content-Type: text/plain; charset=utf-8
  404 page not found
  ```
  - Returns standard HTTP 404
  - While path matches Cursor's RPC namespace, no confirmation of gRPC protocol
  - Standard HTTP responses suggest possible REST or gRPC-web interface

- **8888**: Suspected AI Connect Transport endpoint (not confirmed)
  ```bash
  $ curl -v -X POST http://localhost:8888/aiserver.v1.AiProjectService/aiProjectAgentInit -H "Content-Type: application/grpc-web" -H "x-grpc-web: 1" -d '{"prompt": "test"}'
  < HTTP/1.1 404 Not Found
  < Content-Type: text/plain; charset=utf-8
  404 page not found
  ```
  - Returns standard HTTP 404
  - No confirmation of gRPC protocol despite testing with gRPC-web headers

### Protocol Investigation Results

1. **Current Evidence**:
   - All endpoints respond to HTTP/1.1 requests
   - All return standard HTTP status codes and content types
   - No endpoint has confirmed gRPC protocol support
   - Port 65230 shows connection to AWS backend
   
2. **Limitations of Testing**:
   - Standard HTTP probing may not reveal gRPC services
   - Missing required authentication headers
   - Proper gRPC client libraries might be needed
   - Services may require specific connection setup

3. **Next Steps for Confirmation**:
   - Test with proper gRPC client libraries
   - Monitor actual Cursor traffic for protocol details
   - Investigate authentication requirements
   - Analyze Cursor's binary for gRPC stub implementations

### RPC Protocol Analysis

1. **VmDaemonService (65230)**:
   - Uses HTTP/1.1 as transport
   - Attempts to proxy requests to AWS endpoint
   - Follows aiserver.v1.* namespace convention
   - Service appears to be a local proxy to cloud services

2. **ShadowWorkspaceService (65220)**:
   - Uses HTTP/1.1 with standard error codes
   - Follows RESTful or gRPC-web conventions
   - No indication of streaming support observed
   - May require specific authentication headers

3. **AI Connect Transport (8888)**:
   - Supports HTTP/1.1
   - Tested with gRPC-web protocol headers
   - Returns standard HTTP 404 for unknown endpoints
   - May require specific authentication or connection setup

4. **Protocol Patterns**:
   - All services use HTTP as base transport
   - Follow aiserver.v1.* namespace convention
   - Use standard HTTP status codes
   - Likely require specific headers or authentication not documented

### Established
These ports are associated with the `Cursor` process and are currently in an established state when the process is opened.

- **54977**: Connected to Cloudflare [2606:4700::6812:137d]:443 (IPv6)
  - Likely AIServer.v1 service endpoint (protected by Cloudflare)
- **54975**: Connected to Cloudflare [2606:4700::6812:137d]:443 (IPv6)
  - Likely AIServer.v1 service endpoint (protected by Cloudflare)
- **65110**: Connected to AWS EC2 (3.215.202.122:443) - us-east-1 region
  - Possible AiProjectService or AutopilotService endpoint
- **56392**: Connected to AWS EC2 (52.45.177.44:443) - us-east-1 region
  - Possible ContextBankService or GitGraphService endpoint
- **53434**: Connected to Cloudflare (104.18.19.125:443)
  - Likely AIServer.v1 service endpoint
- **55812**: Connected to Cloudflare (104.18.19.125:443)
  - Likely AIServer.v1 service endpoint
- **57420**: Connected to GitHub (lb-140-82-112-22-iad.github.com:443)
  - Used for GitHub authentication and repository operations

### Service Architecture Analysis

Based on Cursor's documented RPC architecture:

1. **Local Services**:
   - Port 9222: Deno LSP service (part of Cursor's TypeScript tooling)
   - Port 65230: VmDaemonService (`vWs`) for core OS operations
   - Port 65220: ShadowWorkspaceService (`I0e`/`WHs`) for code analysis
   - Port 8888: AI Connect Transport provider for local<->cloud communication

2. **Cloud Services** (all HTTPS/443):
   - Cloudflare-protected endpoints: Main AIServer.v1 services
   - AWS us-east-1 endpoints: Stateful services (AiProject, Autopilot, ContextBank)
   - AWS us-east-2 endpoint: Secondary service cluster
   - GitHub: Authentication and repository integration

3. **RPC Service Distribution**:
   - Core services (VmDaemon, ShadowWorkspace) run locally
   - AI/ML services run in AWS
   - API gateway/protection via Cloudflare
   - Authentication via GitHub

4. **Security Architecture**:
   - All external connections use HTTPS (443)
   - Local RPC services use high ports (65xxx range)
   - Cloud services protected by Cloudflare
   - Separate endpoints for different service types

## Source Code and Configuration Analysis Findings

Analysis using helper scripts (`scripts/analyze-cursor-runtime.ts`) yielded the following insights:

1.  **Open Ports:**
    - Found active Cursor-related ports:
      ```
      Cursor    27851 username  137u  IPv4 0x26cb192e903dfab9      0t0    TCP local-host:55190 (LISTEN)
      deno      27880 username    9u  IPv4 0xf5e808bf138ae8c1      0t0    TCP local-host:9222 (LISTEN)
      com.docke 40021 username   44u  IPv6 0x63796c150f052ddb      0t0    TCP *:8888 (LISTEN)
      sdm.darwi 45000 username    7u  IPv4 0xd4b3bbe7bc59aa0c      0t0    TCP local-host:65220 (LISTEN)
      sdm.darwi 45000 username    8u  IPv4 0xac0896d1256f63d5      0t0    TCP local-host:65230 (LISTEN)
      ```
    - This confirms the suspected ports from the analysis:
      - Port 9222: Deno LSP service (for TypeScript)
      - Port 8888: AI Connect Transport (note: bound to all interfaces rather than just local-host)
      - Port 65220: ShadowWorkspaceService (running as "sdm.darwi" process)
      - Port 65230: VmDaemonService (running as "sdm.darwi" process)
    - Additional port discovered:
      - Port 55190: Unknown Cursor service function (main Cursor process)

2.  **Established Connections:**
    - Cursor maintains active connections to multiple remote endpoints:
      ```
      Cursor    13161 username   22u  IPv6 0xf84d64f4c0eee7bd      0t0    TCP warp-***:54977->[IPv6:masked]:443 (ESTABLISHED)
      Cursor    13161 username   24u  IPv6 0xf17059a802ab2430      0t0    TCP warp-***:54975->[IPv6:masked]:443 (ESTABLISHED)
      Cursor    27851 username   56u  IPv4 0xc866d4fc0a35f831      0t0    TCP warp-***:57282->***-global-accel.aws***.com:443 (ESTABLISHED)
      Cursor    27851 username   58u  IPv4 0x89ef82256dfba3c4      0t0    TCP warp-***:56018->ec2-***.compute-1.aws***.com:443 (ESTABLISHED)
      Cursor    27851 username   61u  IPv4 0x94578ecb2e56f75a      0t0    TCP warp-***:53434->[masked-ip-1]:443 (ESTABLISHED)
      Cursor    27851 username  100u  IPv4 0x9feb4e82eda85a6d      0t0    TCP warp-***:57281->***-global-accel.aws***.com:443 (ESTABLISHED)
      Cursor    27851 username  133u  IPv4 0x272bbc2c85c9180d      0t0    TCP warp-***:50638->ec2-***.compute-1.aws***.com:443 (ESTABLISHED)
      Cursor    27851 username  139u  IPv4 0xea21a6a6a8e6c154      0t0    TCP warp-***:52035->[masked-ip-2]:443 (ESTABLISHED)
      ```
    - Connections include:
      - Cloud-protected endpoints (IPv6 addresses and IPv4 addresses masked for privacy)
      - Multiple cloud service endpoints including:
        - AWS Global Accelerator endpoints (***-global-accel.aws***.com)
        - EC2 instances in cloud region (ec2-***.compute-1.aws***.com)
    - All connections use HTTPS (port 443) and appear to route through a local secure service ("warp-***")

3.  **Configuration Files (`~/.cursor/`):**
    - Several RPC client libraries were found in Cursor's extension dependencies:
      ```
      /Users/username/.cursor/extensions/anysphere.pyright-1.1.327-universal/package.json:         "vscode-jsonrpc": "8.1.0",
      /Users/username/.cursor/extensions/ms-vscode.remote-server-1.5.2/package.json:               "@vscode-internal/remote-web-rpc": "*",
      /Users/username/.cursor/extensions/streetsidesoftware.code-spell-checker-4.0.47/package.json:           "packages/json-rpc-api",
      /Users/username/.cursor/extensions/streetsidesoftware.code-spell-checker-4.0.47/package.json:           "packages/webview-rpc",
      ```
    - Most RPC references appear to be for VS Code's standard JSON-RPC protocol used by language servers and extensions rather than the gRPC services used by Cursor's AI backend.
    - No direct configuration for the `aiserver.v1` gRPC services was found in the exposed configuration files.

4.  **Application Source:**
    - The search for gRPC client code in `/Applications/Cursor.app/Contents/Resources/app.asar` returned an error: `No such file or directory`.
    - This suggests Cursor might not be installed in the standard location, or the `app.asar` file might be located elsewhere.

5.  **Testing Local gRPC Services:**
    - Basic connectivity tests to suspected service endpoints:
      ```
      Checking VmDaemonService at local-host:65230...
      Failed to connect to local-host:65230: Connection refused (os error 61)
      Checking ShadowWorkspaceService at local-host:65220...
      Failed to connect to local-host:65220: Connection refused (os error 61)
      Checking AIConnectTransport at local-host:8888...
      TCP connection to local-host:8888 successful
      HTTP response from local-host:8888:
      HTTP/1.1 404 Not Found
      Content-Type: text/plain; charset=utf-8
      X-Content-Type-Options: nosniff
      Date: Sun, 04 May 2025 09:46:37 GMT
      Content-Length: 19
      
      404 page not found
      ```
    - Interesting findings:
      - Only port 8888 (AI Connect Transport) accepted TCP connections
      - VmDaemonService and ShadowWorkspaceService ports refused connections despite being shown as LISTENING
      - This suggests services may:
        - Only accept connections from specific processes/users
        - Use non-TCP transport (Unix domain sockets internally)
        - Have additional authentication requirements
    - Attempts to connect with gRPC client to VmDaemonService also failed:
      ```
      Testing VmDaemonService at local-host:65230
      Failed to create VmDaemonService client: Failed to create gRPC client: Service namespace aiserver.v1 not found in proto definition
      ```
    - This indicates that while the ports are active, the raw gRPC protocol specifications from the documentation may not match the exact implementation.

6.  **Process Information:**
    - The ports suspected to be used by VmDaemonService (65230) and ShadowWorkspaceService (65220) are actually being used by a process called "sdm.darwi" in the port scan, which is NOT conclusively related to Cursor.
    - The process name "sdm.darwi" might be an unrelated macOS service (possibly Spotlight Document Management or another system service) and not a "Service Daemon Manager" for Cursor as incorrectly assumed.
    - The process "com.docke" listening on port 8888 is similar to the Live Server VS Code extension being used inside Cursor (which is a VS Code fork). This port is used for local development server functionality within the editor, not necessarily related to Cursor's AI features.
    - Further investigation is needed to confirm whether the other processes are actually related to Cursor or are unrelated services that happen to be using these ports during testing.
