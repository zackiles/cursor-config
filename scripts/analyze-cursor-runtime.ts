// Script for running runtime analysis of Cursor.
//
// This script is used to run runtime analysis of Cursor.
// It is used to collect data from the system and the application.
// The data is collected from the system and the application.
// The data is then used to generate a report.

import { credentials, loadPackageDefinition, Metadata } from '@grpc/grpc-js'
import type { ChannelOptions, GrpcObject, ServiceClientConstructor } from '@grpc/grpc-js'
import { loadSync } from '@grpc/proto-loader'
import type { PackageDefinition } from '@grpc/proto-loader'
import * as path from 'https://deno.land/std@0.220.1/path/mod.ts'

// All static configuration constants for running the analysis tests are defined here.
const CONFIG = {
  // Output directory for analysis reports
  OUTPUT_DIR: path.join(Deno.cwd(), 'reports'),
  // Cursor RPC endpoints to test
  CURSOR_RPC_ENDPOINTS: [
    { port: 65230, name: 'VmDaemonService' as const, host: 'localhost' },
    { port: 65220, name: 'ShadowWorkspaceService' as const, host: 'localhost' },
    { port: 8888, name: 'AIConnectTransport' as const, host: 'localhost' },
  ],
  // Cursor gRPC service namespace
  CURSOR_SERVICE_NAMESPACE: 'aiserver.v1',
  // gRPC timeouts in milliseconds
  GRPC_TIMEOUT: 3000,
  // RPC authentication options to try
  AUTH_OPTIONS: [
    { name: 'No Auth', metadata: {} },
    { name: 'Bearer Token', metadata: { 'authorization': 'Bearer test_token' } },
    { name: 'Custom Auth', metadata: { 'x-cursor-auth': 'test_token' } },
  ],
  // Channel options for gRPC clients
  GRPC_CHANNEL_OPTIONS: {
    'grpc.keepalive_time_ms': 1000,
    'grpc.keepalive_timeout_ms': 500,
    'grpc.keepalive_permit_without_calls': 1,
    'grpc.http2.min_time_between_pings_ms': 1000,
    'grpc.http2.max_pings_without_data': 0,
    'grpc.max_receive_message_length': 1024 * 1024 * 100, // 100MB
    'grpc.enable_retries': 0,
  },
}

// All tests used for analysis are defined here.
// Mandatory test groups: generalTerminal, network, appSourceCode, appConfigurationFiles
const testGroups = {
  generalTerminal: {
    /**
    listOpenPorts: {
      test: listOpenPorts,
      description: 'List all open ports to identify potential RPC endpoints',
    },
    checkProcessConnections: {
      test: checkProcessConnections,
      description: 'Check connections established by the Cursor process',
    },
    */
  },
  network: {
    checkGrpcEndpoints: {
      test: checkGrpcEndpoints,
      description: 'Check if suspected gRPC endpoints are reachable',
    },
    /**
    testVmDaemonService: {
      test: testVmDaemonService,
      description: 'Test VmDaemonService with gRPC client',
    },
    testShadowWorkspaceService: {
      test: testShadowWorkspaceService,
      description: 'Test ShadowWorkspaceService with gRPC client',
    },
    testAiConnectTransport: {
      test: testAiConnectTransport,
      description: 'Test AIConnectTransport with gRPC client',
    },
    testGrpcAuthentication: {
      test: testGrpcAuthentication,
      description: 'Test gRPC authentication methods',
    },
    captureNetworkTraffic: {
      test: captureNetworkTraffic,
      description: 'Capture and analyze Cursor network traffic patterns',
    },
    discoverLocalSockets: {
      test: discoverLocalSockets,
      description: 'Find and analyze local IPC sockets used by Cursor',
    },
    probeInternalEndpoints: {
      test: probeInternalEndpoints,
      description: 'Probe for internal HTTP/HTTPS endpoints and analyze responses',
    },
    analyzeWebsocketEndpoints: {
      test: analyzeWebsocketEndpoints,
      description: 'Analyze any websocket endpoints used by Cursor',
    },
    */
  },
  appSourceCode: {
    /**
    findGrpcServiceDefinitions: {
      test: findGrpcServiceDefinitions,
      description: 'Find gRPC service definitions in source code',
    },
    findGrpcClientCode: {
      test: findGrpcClientCode,
      description: 'Find gRPC client code in source code',
    },
    analyzeProductJson: {
      test: analyzeProductJson,
      description: 'Deep analysis of product.json for endpoints and feature flags',
    },
    extractEmbeddedResources: {
      test: extractEmbeddedResources,
      description: 'Find embedded API resources and endpoints in binaries',
    },
    findCryptoFunctions: {
      test: findCryptoFunctions,
      description: 'Locate cryptographic functions and secure storage mechanisms',
    },
    findEncryptionMechanisms: {
      test: findEncryptionMechanisms,
      description: 'Look for encryption/decryption code in the application',
    },
    findHiddenAPIFeatures: {
      test: findHiddenAPIFeatures,
      description: 'Discover hidden or undocumented API features',
    },
    findCommandInjectionPoints: {
      test: findCommandInjectionPoints,
      description: 'Identify potential command injection points in the app',
    },
    analyzeInternalStateStorage: {
      test: analyzeInternalStateStorage,
      description: 'Analyze how Cursor stores and manages internal state',
    },
    analyzeEnvironmentAndStartupFlags: {
      test: analyzeEnvironmentAndStartupFlags,
      description: 'Analyze environment variables and startup flags used by Cursor',
    },
    discoverUndocumentedApis: {
      test: discoverUndocumentedApis,
      description: 'Discover undocumented APIs and extension points',
    },
    analyzeAiIntegrationMechanisms: {
      test: analyzeAiIntegrationMechanisms,
      description: 'Analyze AI integration mechanisms and configuration',
    },
    */
  },
  appConfigurationFiles: {
    /**
    findGrpcConfigurations: {
      test: findGrpcConfigurations,
      description: 'Find gRPC configurations in configuration files',
    },
    extractEndpointConfigs: {
      test: extractEndpointConfigs,
      description: 'Extract endpoint configurations from configuration files',
    },
    extractAuthTokens: {
      test: extractAuthTokens,
      description: 'Find authentication tokens and mechanisms in configuration',
    },
    mapFeatureFlags: {
      test: mapFeatureFlags,
      description: 'Map feature flags and toggle mechanisms',
    },
    analyzeCommandLineArgs: {
      test: analyzeCommandLineArgs,
      description: 'Analyze command line arguments and their effects',
    },
    analyzeSettingsDatabase: {
      test: analyzeSettingsDatabase,
      description: 'Analyze Cursor settings database structure',
    },
    */
  },
  systemLogs: {
    /**
    examineLogFiles: {
      test: examineLogFiles,
      description: 'Examine Cursor log files for gRPC related information',
    },
    analyzeStartupSequence: {
      test: analyzeStartupSequence,
      description: 'Analyze startup sequence for service initialization',
    },
    findAuthenticationFlows: {
      test: findAuthenticationFlows,
      description: 'Track authentication flows and token exchange in logs',
    },
    */
  },
  extensionPoints: {
    /**
    findExtensionMechanisms: {
      test: findExtensionMechanisms,
      description: 'Discover extension and plugin mechanisms',
    },
    analyzeCommandStructure: {
      test: analyzeCommandStructure,
      description: 'Analyze command structure and injection points',
    },
    discoverCommandInjectionPoints: {
      test: discoverCommandInjectionPoints,
      description: 'Find points where custom commands can be injected',
    },
    */
  },
}

// Proto definitions for gRPC services
const PROTO_DEFINITIONS = {
  VmDaemonService: `
    syntax = "proto3";
    package aiserver.v1;
    service VmDaemonService {
      rpc Ping(PingRequest) returns (PingResponse);
      rpc GetExplicitContext(ContextRequest) returns (ContextResponse);
      rpc ReadTextFile(FileRequest) returns (FileResponse);
    }
    message PingRequest {}
    message PingResponse {}
    message ContextRequest {
      string rootPath = 1;
    }
    message ContextResponse {
      string context = 1;
    }
    message FileRequest {
      string absolutePath = 1;
    }
    message FileResponse {
      string contents = 1;
      bool pathDoesNotExist = 2;
      bool wasTruncated = 3;
      bool isNotAFile = 4;
    }
  `,
  ShadowWorkspaceService: `
    syntax = "proto3";
    package aiserver.v1;
    service ShadowWorkspaceService {
      rpc ShadowHealthCheck(ShadowHealthCheckRequest) returns (ShadowHealthCheckResponse);
      rpc SwSyncIndex(SyncIndexRequest) returns (SyncIndexResponse);
    }
    message ShadowHealthCheckRequest {}
    message ShadowHealthCheckResponse {}
    message SyncIndexRequest {
      string rootPath = 1;
    }
    message SyncIndexResponse {}
  `,
  AIConnectTransport: `
    syntax = "proto3";
    package aiserver.v1;
    service AiProjectService {
      rpc aiProjectAgentInit(aiProjectAgentInitRequest) returns (aiProjectAgentInitResponse);
    }
    message aiProjectAgentInitRequest {
      string prompt = 1;
    }
    message aiProjectAgentInitResponse {}
  `,
}

interface GrpcClient {
  [method: string]: unknown
  close: () => void
}

// Helper to load proto definition and create gRPC client
function createGrpcClient(
  serviceName: string,
  protoDefinition: string,
  address: string,
): { client: GrpcClient; packageDefinition: PackageDefinition } {
  try {
    // Create temp proto file
    const tempFile = Deno.makeTempFileSync({ prefix: 'grpc-', suffix: '.proto' })
    Deno.writeTextFileSync(tempFile, protoDefinition)

    // Load proto definition
    const packageDefinition = loadSync(tempFile, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    })

    // Clean up temp file
    Deno.removeSync(tempFile)

    // Create the client
    const loadedPackage = loadPackageDefinition(packageDefinition) as GrpcObject
    const servicePackage = loadedPackage[CONFIG.CURSOR_SERVICE_NAMESPACE] as GrpcObject

    if (!servicePackage) {
      throw new Error(
        `Service namespace ${CONFIG.CURSOR_SERVICE_NAMESPACE} not found in proto definition`,
      )
    }

    if (!Object.prototype.hasOwnProperty.call(servicePackage, serviceName)) {
      throw new Error(`Service ${serviceName} not found in proto definition`)
    }

    // Create the gRPC client
    const ServiceClass = servicePackage[serviceName] as ServiceClientConstructor
    const client = new ServiceClass(
      address,
      credentials.createInsecure(),
      CONFIG.GRPC_CHANNEL_OPTIONS as ChannelOptions,
    )

    return { client: client as unknown as GrpcClient, packageDefinition }
  } catch (error) {
    throw new Error(
      `Failed to create gRPC client: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// Helper for gRPC unary call with timeout
function callGrpcUnary<T, R>(
  client: GrpcClient,
  method: string,
  request: T,
  metadata: Metadata = new Metadata(),
): Promise<R> {
  return new Promise((resolve, reject) => {
    // Set up timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`gRPC call timed out after ${CONFIG.GRPC_TIMEOUT}ms`))
    }, CONFIG.GRPC_TIMEOUT)

    if (!Object.prototype.hasOwnProperty.call(client, method)) {
      clearTimeout(timeoutId)
      reject(new Error(`Method ${method} not found on client`))
      return
    }

    // Make the call
    const clientMethod = client[method] as (
      request: T,
      metadata: Metadata,
      callback: (error: Error | null, response: R) => void,
    ) => void

    clientMethod(request, metadata, (error: Error | null, response: R) => {
      clearTimeout(timeoutId)
      if (error) {
        reject(error)
      } else {
        resolve(response)
      }
    })
  })
}

// Helper to run terminal commands
async function runTerminalCommand(
  command: string,
  _args: string[] = [],
  _captureOutput = false,
): Promise<string> {
  try {
    const cmd = new Deno.Command('sh', {
      args: ['-c', command],
      stdout: 'piped',
      stderr: 'piped',
    })

    const { stdout, stderr } = await cmd.output()
    const output = new TextDecoder().decode(stdout)
    const error = new TextDecoder().decode(stderr)

    if (error) {
      throw new Error(error)
    }

    return output
  } catch (error) {
    throw new Error(
      `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// General Terminal Tests
async function listOpenPorts() {
  return await runTerminalCommand('lsof -i -P | grep LISTEN', [], true)
}

async function checkProcessConnections() {
  return await runTerminalCommand('lsof -i -P | grep Cursor', [], true)
}

// Network Tests
async function checkGrpcEndpoints() {
  const results: string[] = []

  for (const endpoint of CONFIG.CURSOR_RPC_ENDPOINTS) {
    const address = `${endpoint.host}:${endpoint.port}`
    try {
      results.push(`Checking ${endpoint.name} at ${address}...`)

      // Try to establish a socket connection first (basic connectivity)
      const conn = await Deno.connect({
        hostname: endpoint.host,
        port: endpoint.port,
        transport: 'tcp',
      })
      conn.close()
      results.push(`TCP connection to ${address} successful`)

      // Now try HTTP GET to see if we can get any response
      const httpResponse = await runTerminalCommand(
        `curl -s -i http://${endpoint.host}:${endpoint.port}`,
        [],
        true,
      )
      results.push(`HTTP response from ${address}:\n${httpResponse}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`Failed to connect to ${address}: ${errorMessage}`)
    }
  }

  return results.join('\n')
}

async function testVmDaemonService() {
  const results: string[] = []
  const endpoint = CONFIG.CURSOR_RPC_ENDPOINTS.find((e) => e.name === 'VmDaemonService')

  if (!endpoint) {
    return 'VmDaemonService endpoint not found in configuration'
  }

  const address = `${endpoint.host}:${endpoint.port}`
  results.push(`Testing VmDaemonService at ${address}`)

  try {
    const { client } = createGrpcClient(
      'VmDaemonService',
      PROTO_DEFINITIONS.VmDaemonService,
      address,
    )

    // Test Ping method
    try {
      results.push('Calling Ping method...')
      const response = await callGrpcUnary(client, 'ping', {})
      results.push(`Ping response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`Ping failed: ${errorMessage}`)
    }

    // Test GetExplicitContext method
    try {
      results.push('Calling GetExplicitContext method...')
      const response = await callGrpcUnary(client, 'getExplicitContext', { rootPath: '.' })
      results.push(`GetExplicitContext response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`GetExplicitContext failed: ${errorMessage}`)
    }

    // Test ReadTextFile method
    try {
      results.push('Calling ReadTextFile method...')
      const response = await callGrpcUnary(client, 'readTextFile', {
        absolutePath: `${Deno.cwd()}/deno.json`,
      })
      results.push(`ReadTextFile response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`ReadTextFile failed: ${errorMessage}`)
    }

    if (client.close) {
      client.close()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.push(`Failed to create VmDaemonService client: ${errorMessage}`)
  }

  return results.join('\n')
}

async function testShadowWorkspaceService() {
  const results: string[] = []
  const endpoint = CONFIG.CURSOR_RPC_ENDPOINTS.find((e) => e.name === 'ShadowWorkspaceService')

  if (!endpoint) {
    return 'ShadowWorkspaceService endpoint not found in configuration'
  }

  const address = `${endpoint.host}:${endpoint.port}`
  results.push(`Testing ShadowWorkspaceService at ${address}`)

  try {
    const { client } = createGrpcClient(
      'ShadowWorkspaceService',
      PROTO_DEFINITIONS.ShadowWorkspaceService,
      address,
    )

    // Test ShadowHealthCheck method
    try {
      results.push('Calling ShadowHealthCheck method...')
      const response = await callGrpcUnary(client, 'shadowHealthCheck', {})
      results.push(`ShadowHealthCheck response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`ShadowHealthCheck failed: ${errorMessage}`)
    }

    // Test SwSyncIndex method
    try {
      results.push('Calling SwSyncIndex method...')
      const response = await callGrpcUnary(client, 'swSyncIndex', { rootPath: Deno.cwd() })
      results.push(`SwSyncIndex response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`SwSyncIndex failed: ${errorMessage}`)
    }

    if (client.close) {
      client.close()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.push(`Failed to create ShadowWorkspaceService client: ${errorMessage}`)
  }

  return results.join('\n')
}

async function testAiConnectTransport() {
  const results: string[] = []
  const endpoint = CONFIG.CURSOR_RPC_ENDPOINTS.find((e) => e.name === 'AIConnectTransport')

  if (!endpoint) {
    return 'AIConnectTransport endpoint not found in configuration'
  }

  const address = `${endpoint.host}:${endpoint.port}`
  results.push(`Testing AIConnectTransport at ${address}`)

  try {
    const { client } = createGrpcClient(
      'AiProjectService',
      PROTO_DEFINITIONS.AIConnectTransport,
      address,
    )

    // Test aiProjectAgentInit method
    try {
      results.push('Calling aiProjectAgentInit method...')
      const response = await callGrpcUnary(client, 'aiProjectAgentInit', {
        prompt: 'Test message from cursor-runtime-analysis',
      })
      results.push(`aiProjectAgentInit response: ${JSON.stringify(response)}`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      results.push(`aiProjectAgentInit failed: ${errorMessage}`)
    }

    if (client.close) {
      client.close()
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    results.push(`Failed to create AIConnectTransport client: ${errorMessage}`)
  }

  return results.join('\n')
}

async function testGrpcAuthentication() {
  const results: string[] = []

  for (const endpoint of CONFIG.CURSOR_RPC_ENDPOINTS) {
    const address = `${endpoint.host}:${endpoint.port}`
    results.push(`Testing authentication for ${endpoint.name} at ${address}`)

    for (const auth of CONFIG.AUTH_OPTIONS) {
      results.push(`\nTrying ${auth.name}...`)

      try {
        const { client } = createGrpcClient(
          endpoint.name === 'AIConnectTransport' ? 'AiProjectService' : endpoint.name,
          PROTO_DEFINITIONS[endpoint.name],
          address,
        )

        // Create metadata with authentication
        const metadata = new Metadata()
        for (const [key, value] of Object.entries(auth.metadata)) {
          metadata.add(key, value as string)
        }

        // Try a simple method call with auth
        try {
          let response: unknown
          switch (endpoint.name) {
            case 'VmDaemonService':
              response = await callGrpcUnary(client, 'ping', {}, metadata)
              break
            case 'ShadowWorkspaceService':
              response = await callGrpcUnary(client, 'shadowHealthCheck', {}, metadata)
              break
            case 'AIConnectTransport':
              response = await callGrpcUnary(
                client,
                'aiProjectAgentInit',
                { prompt: 'Auth test' },
                metadata,
              )
              break
          }
          results.push(`Success with ${auth.name}`)
          results.push(`Response: ${JSON.stringify(response)}`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          results.push(`Failed with ${auth.name}: ${errorMessage}`)
        }

        if (client.close) {
          client.close()
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        results.push(`Failed to create client for ${endpoint.name}: ${errorMessage}`)
      }

      results.push('') // Add blank line between endpoints
    }
  }

  return results.join('\n')
}

// App Source Code Tests
async function findGrpcServiceDefinitions() {
  try {
    // Search the main binary and other binaries for embedded proto definitions
    const cursorBinaryOutput = await runTerminalCommand(
      "strings /Applications/Cursor.app/Contents/MacOS/Cursor | grep -E 'service |rpc |message |aiserver|VmDaemon|ShadowWorkspace'",
      [],
      true,
    )

    // Search other potential binaries for service definitions
    const cursorTunnelOutput = await runTerminalCommand(
      "strings /Applications/Cursor.app/Contents/Resources/app/bin/cursor-tunnel | grep -E 'service |rpc |message |aiserver|VmDaemon|ShadowWorkspace'",
      [],
      true,
    )

    // Combine results
    return [
      '=== CURSOR BINARY ANALYSIS ===',
      cursorBinaryOutput || 'No proto definitions found in Cursor binary',
      '=== CURSOR TUNNEL BINARY ANALYSIS ===',
      cursorTunnelOutput || 'No proto definitions found in cursor-tunnel binary',
    ].join('\n\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error searching for gRPC service definitions in binaries: ${errorMessage}`
  }
}

async function findGrpcClientCode() {
  try {
    // Search in app directory for JS code related to gRPC
    const mainJsOutput = await runTerminalCommand(
      "grep -aE 'grpc|rpc|aiserver|VmDaemon|ShadowWorkspace|AIConnect' /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -100",
      [],
      true,
    )

    // Search in other critical JS files
    const packageJsonOutput = await runTerminalCommand(
      "grep -E 'grpc|rpc' /Applications/Cursor.app/Contents/Resources/app/package.json",
      [],
      true,
    )

    // Search for Node.js gRPC modules
    const nodeModulesOutput = await runTerminalCommand(
      "find /Applications/Cursor.app/Contents/Resources/app/node_modules -name '*grpc*' -o -name '*rpc*' | grep -v 'README'",
      [],
      true,
    )

    // Combine results
    return [
      '=== MAIN.JS ANALYSIS ===',
      mainJsOutput || 'No gRPC client code found in main.js',
      '=== PACKAGE.JSON ANALYSIS ===',
      packageJsonOutput || 'No gRPC dependencies found in package.json',
      '=== NODE MODULES ANALYSIS ===',
      nodeModulesOutput || 'No gRPC modules found in node_modules',
    ].join('\n\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error searching for gRPC client code: ${errorMessage}`
  }
}

// App Configuration Files Tests
async function findGrpcConfigurations() {
  try {
    // Search user config directories for gRPC/AI-related keywords
    const pathsToSearch = [
      `${Deno.env.get('HOME')}/.cursor`, // Main user config
      `${Deno.env.get('HOME')}/Library/Application Support/Cursor`, // App support files
    ].join(' ')

    const configFilesOutput = await runTerminalCommand(
      `grep -rE 'grpc|rpc|aiserver|VmDaemon|ShadowWorkspace|AIConnect' --include='*.json' --include='*.config.*' ${pathsToSearch} || true`, // Use || true to prevent grep error exit code if nothing found
      [],
      true,
    )

    // Examine ~/.cursor/mcp.json
    const mcpJsonOutput = await runTerminalCommand(
      `cat ${Deno.env.get('HOME')}/.cursor/mcp.json 2>/dev/null || echo "File not found"`,
      [],
      true,
    )

    // Examine ~/.cursor/argv.json
    const argvJson = await runTerminalCommand(
      'cat ' + Deno.env.get('HOME') + '/.cursor/argv.json 2>/dev/null || echo "File not found"',
      [],
      true,
    )

    // Combine results
    return [
      '=== CONFIG FILES SEARCH ===',
      configFilesOutput || 'No gRPC configurations found in config files',
      '=== MCP.JSON CONTENT ===',
      mcpJsonOutput,
      '=== ARGV.JSON CONTENT ===',
      argvJson,
    ].join('\n\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error searching for gRPC configurations: ${errorMessage}`
  }
}

async function extractEndpointConfigs() {
  try {
    // Search user config directories for endpoint keywords
    const pathsToSearch = [
      `${Deno.env.get('HOME')}/.cursor`, // Main user config
      `${Deno.env.get('HOME')}/Library/Application Support/Cursor`, // App support files
    ].join(' ')

    const endpointConfigsOutput = await runTerminalCommand(
      `grep -rE 'endpoint|port|host|connection|socket|url|address' --include='*.json' --include='*.config.*' ${pathsToSearch} || true`,
      [],
      true,
    )

    // Check for socket files
    const socketFilesOutput = await runTerminalCommand(
      `find ${Deno.env.get('HOME')}/Library/Application\\ Support/Cursor -type s || true`,
      [],
      true,
    )

    // Examine current running processes with gRPC endpoints
    const runningPortsOutput = await runTerminalCommand(
      `lsof -i -P | grep -E "Cursor|65230|65220|8888"`,
      [],
      true,
    )

    // Check workspace storage for potential gRPC configuration
    const workspaceStorageOutput = await runTerminalCommand(
      `find ${
        Deno.env.get('HOME')
      }/Library/Application\\ Support/Cursor/User/workspaceStorage -type f -name '*.json' -exec grep -l -E 'endpoint|port|host|connection|socket|url|address|rpc|grpc' {} \\; | head -10`,
      [],
      true,
    )

    // Combine results
    return [
      '=== ENDPOINT CONFIGURATIONS ===',
      endpointConfigsOutput || 'No endpoint configurations found',
      '=== SOCKET FILES ===',
      socketFilesOutput || 'No socket files found',
      '=== RUNNING PORTS ===',
      runningPortsOutput || 'No relevant running ports found',
      '=== WORKSPACE STORAGE ===',
      workspaceStorageOutput || 'No relevant workspace storage files found',
    ].join('\n\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error extracting endpoint configurations: ${errorMessage}`
  }
}

// Add new test for examining Cursor log files
async function examineLogFiles() {
  try {
    // Find the most recent log directory
    const logDirOutput = await runTerminalCommand(
      `ls -td ${Deno.env.get('HOME')}/Library/Application\\ Support/Cursor/logs/* | head -1`,
      [],
      true,
    )

    const logDir = logDirOutput.trim()

    if (!logDir) {
      return 'No log directories found'
    }

    // Check shared process logs for gRPC related info
    const sharedProcessLogsOutput = await runTerminalCommand(
      `grep -E "grpc|rpc|aiserver|VmDaemon|ShadowWorkspace|AIConnect|endpoint|port" "${logDir}/sharedprocess.log" 2>/dev/null | tail -100 || echo "No matches found"`,
      [],
      true,
    )

    // Check main process logs
    const mainProcessLogsOutput = await runTerminalCommand(
      `grep -E "grpc|rpc|aiserver|VmDaemon|ShadowWorkspace|AIConnect|endpoint|port" "${logDir}/main.log" 2>/dev/null | tail -100 || echo "No matches found"`,
      [],
      true,
    )

    return [
      '=== SHARED PROCESS LOGS ===',
      sharedProcessLogsOutput,
      '=== MAIN PROCESS LOGS ===',
      mainProcessLogsOutput,
    ].join('\n\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error examining log files: ${errorMessage}`
  }
}

// Ensure output directory exists
async function ensureOutputDir() {
  try {
    await Deno.mkdir(CONFIG.OUTPUT_DIR, { recursive: true })
  } catch (error) {
    if (!(error instanceof Deno.errors.AlreadyExists)) {
      throw error
    }
  }
}

async function main() {
  const testResults = new Map<string, string>()
  console.log('Starting Cursor gRPC runtime analysis...')

  // Ensure output directory exists
  await ensureOutputDir()

  // Iterate over all test groups
  for (const [groupName, testGroup] of Object.entries(testGroups)) {
    console.log(`\nRunning ${groupName} tests...`)

    // Iterate over all tests in the test group
    for (const [testName, testObject] of Object.entries(testGroup)) {
      console.log(`  - Running: ${testObject.description}`)
      try {
        const result = await testObject.test()
        testResults.set(`${groupName}.${testName}`, result)
        console.log('    ✓ Complete')
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`    ✗ Failed: ${errorMessage}`)
        testResults.set(`${groupName}.${testName}`, `ERROR: ${errorMessage}`)
      }
    }
  }

  console.log('\n\nTest Results:')

  // Generate output file name with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outputFile = path.join(CONFIG.OUTPUT_DIR, `cursor-rpc-analysis-${timestamp}.json`)

  // Write results to file
  try {
    await Deno.writeTextFile(
      outputFile,
      JSON.stringify(
        {
          timestamp,
          results: Object.fromEntries(testResults),
        },
        null,
        2,
      ),
    )
    console.log(`\nResults written to: ${outputFile}`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`Failed to write results: ${errorMessage}`)
    Deno.exit(1)
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fatal error:', error)
    Deno.exit(1)
  })
}

// Extract and analyze product.json in depth
async function analyzeProductJson() {
  try {
    // Read and parse product.json
    const productJsonPath = '/Applications/Cursor.app/Contents/Resources/app/product.json'
    const productJsonOutput = await runTerminalCommand(`cat ${productJsonPath}`, [], true)

    let productJson = {}
    try {
      productJson = JSON.parse(productJsonOutput)
    } catch (error) {
      return `Error parsing product.json: ${
        error instanceof Error ? error.message : String(error)
      }\n\nRaw content:\n${productJsonOutput}`
    }

    // Search for specific keys of interest
    const extractedKeys = await runTerminalCommand(
      `grep -E "endpoint|url|host|port|token|auth|key|secret|rpc|grpc|aiserver|daemon|shadow|api|server|service|connection|feature|flag|enable|disable" ${productJsonPath}`,
      [],
      true,
    )

    // Check for dataSources configurations
    const dataSourcesOutput = await runTerminalCommand(
      `grep -A 20 "dataSources" ${productJsonPath}`,
      [],
      true,
    )

    // Check for extensionPoints and extensionKinds
    const extensionsOutput = await runTerminalCommand(
      `grep -A 20 "extension" ${productJsonPath}`,
      [],
      true,
    )

    return [
      '=== PRODUCT.JSON FULL ANALYSIS ===',
      `File exists: ${productJsonOutput ? 'Yes' : 'No'}`,
      `Keys found: ${Object.keys(productJson).join(', ')}`,
      '\n=== INTERESTING CONFIGURATIONS ===',
      extractedKeys || 'No interesting configurations found',
      '\n=== DATA SOURCES CONFIGURATION ===',
      dataSourcesOutput || 'No data sources configuration found',
      '\n=== EXTENSION CONFIGURATION ===',
      extensionsOutput || 'No extension configuration found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error analyzing product.json: ${errorMessage}`
  }
}

// Extract embedded resources from binaries
async function extractEmbeddedResources() {
  try {
    // Find all potential binary executable files
    const binaries = await runTerminalCommand(
      `find /Applications/Cursor.app -type f -name "*.node" -o -perm +111 -type f | grep -v "\\.o\\|\\.ts\\|\\.js\\|\\.json\\|\\.png\\|\\.icns\\|\\.css\\|\\.html"`,
      [],
      true,
    )

    const binaryList = binaries.split('\n').filter(Boolean)
    const results = []

    for (const binary of binaryList.slice(0, 5)) { // Limit to first 5 binaries to avoid too much output
      results.push(`\n=== ANALYZING BINARY: ${binary} ===`)

      // Search for API endpoints
      const endpoints = await runTerminalCommand(
        `strings "${binary}" | grep -E "http:\\/\\/|https:\\/\\/|ws:\\/\\/|wss:\\/\\/" | grep -v "schema" | head -20`,
        [],
        true,
      )
      results.push('API ENDPOINTS:')
      results.push(endpoints || 'No API endpoints found')

      // Search for authentication keywords
      const authStrings = await runTerminalCommand(
        `strings "${binary}" | grep -E "auth|token|key|secret|credential|password" | grep -v "author|authority" | head -20`,
        [],
        true,
      )
      results.push('AUTH STRINGS:')
      results.push(authStrings || 'No auth strings found')

      // Search for interesting function and method names
      const functionNames = await runTerminalCommand(
        `strings "${binary}" | grep -E "connect|initialize|authenticate|register|listen|handle|process|execute|load|start|launch" | head -20`,
        [],
        true,
      )
      results.push('INTERESTING FUNCTION NAMES:')
      results.push(functionNames || 'No interesting function names found')
    }

    return results.join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error extracting embedded resources: ${errorMessage}`
  }
}

// Discover and analyze feature flags
async function mapFeatureFlags() {
  try {
    // Check for feature flags in product.json
    const productJsonFlags = await runTerminalCommand(
      `grep -E "feature|flag|enabled|disabled|toggle" /Applications/Cursor.app/Contents/Resources/app/product.json`,
      [],
      true,
    )

    // Check for feature flags in user configs
    const userConfigFlags = await runTerminalCommand(
      `grep -r -E "feature|flag|enabled|disabled|toggle" --include="*.json" ${
        Deno.env.get('HOME')
      }/.cursor/ ${Deno.env.get('HOME')}/Library/Application\\ Support/Cursor/User/`,
      [],
      true,
    )

    // Check for experimental features
    const experimentalFlags = await runTerminalCommand(
      `grep -r -E "experimental|preview|beta|alpha" --include="*.json" /Applications/Cursor.app/Contents/Resources/app/ ${
        Deno.env.get('HOME')
      }/.cursor/`,
      [],
      true,
    )

    return [
      '=== FEATURE FLAGS IN PRODUCT.JSON ===',
      productJsonFlags || 'No feature flags found in product.json',
      '\n=== FEATURE FLAGS IN USER CONFIGS ===',
      userConfigFlags || 'No feature flags found in user configs',
      '\n=== EXPERIMENTAL FEATURES ===',
      experimentalFlags || 'No experimental features found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error mapping feature flags: ${errorMessage}`
  }
}

// Extract authentication tokens and mechanisms
async function extractAuthTokens() {
  try {
    // Search for tokens in user config files
    const userTokens = await runTerminalCommand(
      `grep -r -E "token|key|secret|auth|credential|password" --include="*.json" ${
        Deno.env.get('HOME')
      }/.cursor/ ${
        Deno.env.get('HOME')
      }/Library/Application\\ Support/Cursor/User/ | grep -v "schema" | grep -v "author" | head -50`,
      [],
      true,
    )

    // Check storage.json files specifically as they often contain tokens
    const storageFiles = await runTerminalCommand(
      `find ${
        Deno.env.get('HOME')
      }/Library/Application\\ Support/Cursor/ -name "storage.json" -o -name "state.json" -o -name "tokens.json" | head -5`,
      [],
      true,
    )

    const storageResults = []
    const storageFileList = storageFiles.split('\n').filter(Boolean)

    for (const file of storageFileList) {
      storageResults.push(`\n--- ${file} ---`)
      const content = await runTerminalCommand(
        `grep -E "token|auth|key|secret" "${file}" || echo "No auth-related content found"`,
        [],
        true,
      )
      storageResults.push(content)
    }

    // Check for keychain entries
    const keychainEntries = await runTerminalCommand(
      `security find-generic-password -l "Cursor" -D "metadata" 2>&1 || echo "No keychain entries found"`,
      [],
      true,
    )

    return [
      '=== AUTH TOKENS IN USER CONFIGS ===',
      userTokens || 'No auth tokens found in user configs',
      '\n=== STORAGE FILES ANALYSIS ===',
      storageResults.join('\n') || 'No storage files found',
      '\n=== KEYCHAIN ENTRIES ===',
      keychainEntries || 'No keychain entries found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error extracting auth tokens: ${errorMessage}`
  }
}

// Capture and analyze network traffic
async function captureNetworkTraffic() {
  try {
    // Check if tcpdump is available
    const tcpdumpAvailable = await runTerminalCommand(
      `which tcpdump || echo "tcpdump not available"`,
      [],
      true,
    )

    if (!tcpdumpAvailable || tcpdumpAvailable.includes('not available')) {
      return 'tcpdump not available - cannot capture network traffic'
    }

    // Get Cursor process IDs
    const cursorPids = await runTerminalCommand(
      `pgrep -f Cursor`,
      [],
      true,
    )

    if (!cursorPids) {
      return 'No running Cursor processes found'
    }

    // Use lsof to check connections for those PIDs
    const connections = await runTerminalCommand(
      `lsof -i -P -n -a -p ${cursorPids.split('\n').join(',')}`,
      [],
      true,
    )

    // Extract unique connection patterns
    const domains = await runTerminalCommand(
      `lsof -i -P -n -a -p ${
        cursorPids.split('\n').join(',')
      } | grep -Eo '([0-9]{1,3}\\.){3}[0-9]{1,3}|\\[[0-9a-f:]+\\]|[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}' | sort | uniq`,
      [],
      true,
    )

    return [
      '=== CURSOR NETWORK CONNECTIONS ===',
      connections || 'No active connections found',
      '\n=== UNIQUE DOMAINS/IPS CONTACTED ===',
      domains || 'No domains or IPs found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error capturing network traffic: ${errorMessage}`
  }
}

// Discover local IPC sockets and analyze
async function discoverLocalSockets() {
  try {
    // Find Unix domain sockets
    const unixSockets = await runTerminalCommand(
      'lsof -U | grep -E "Cursor|VSCode|Code" | head -30',
      [],
      true,
    )

    // Search for socket files in app directories
    const homeDir = Deno.env.get('HOME')
    const socketFiles = await runTerminalCommand(
      `find /Applications/Cursor.app ${homeDir}/Library/Application\\ Support/Cursor -type s 2>/dev/null || echo "No socket files found"`,
      [],
      true,
    )

    // Look for pipe names in main.js
    const pipeNames = await runTerminalCommand(
      'grep -E "pipe|socket|ipc|channel|connect" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -20',
      [],
      true,
    )

    return [
      '=== ACTIVE UNIX DOMAIN SOCKETS ===',
      unixSockets || 'No active Unix domain sockets found',
      '\n=== SOCKET FILES ===',
      socketFiles || 'No socket files found',
      '\n=== IPC CHANNEL REFERENCES ===',
      pipeNames || 'No IPC channel references found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error discovering local sockets: ${errorMessage}`
  }
}

// Analyze startup sequence
async function analyzeStartupSequence() {
  try {
    // Get the latest log directory
    const homeDir = Deno.env.get('HOME')
    const logDirOutput = await runTerminalCommand(
      `ls -td ${homeDir}/Library/Application\\ Support/Cursor/logs/* | head -1`,
      [],
      true,
    )
    const logDir = logDirOutput.trim()

    if (!logDir) {
      return 'No log directories found'
    }

    // Extract startup sequence from main logs
    const startupLogs = await runTerminalCommand(
      `grep -E "start|init|launch|load|boot|service|daemon|rpc|connect" "${logDir}/main.log" | head -100`,
      [],
      true,
    )

    // Extract service initialization sequence
    const serviceInit = await runTerminalCommand(
      `grep -E "service|daemon|server|start|init" "${logDir}/main.log" | head -50`,
      [],
      true,
    )

    // Get startup flags from the process
    const startupFlags = await runTerminalCommand(
      'ps aux | grep Cursor | grep -v grep | head -1',
      [],
      true,
    )

    return [
      '=== STARTUP SEQUENCE ===',
      startupLogs || 'No startup logs found',
      '\n=== SERVICE INITIALIZATION ===',
      serviceInit || 'No service initialization logs found',
      '\n=== STARTUP FLAGS ===',
      startupFlags || 'No startup flags found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error analyzing startup sequence: ${errorMessage}`
  }
}

// Discover extension and plugin mechanisms
async function findExtensionMechanisms() {
  try {
    // Check for extension directories
    const extensionDirs = await runTerminalCommand(
      `find /Applications/Cursor.app ${
        Deno.env.get('HOME')
      }/Library/Application\\ Support/Cursor -type d -name "extensions" -o -name "plugins"`,
      [],
      true,
    )

    // Check extension configuration in product.json
    const extensionConfig = await runTerminalCommand(
      `grep -A 20 -E "extension|contrib|plugin" /Applications/Cursor.app/Contents/Resources/app/product.json | head -50`,
      [],
      true,
    )

    // Look for extension API in main.js
    const extensionApi = await runTerminalCommand(
      `grep -E "extension|plugin|contribute|register|activate" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30`,
      [],
      true,
    )

    // Check installed extensions
    const installedExtensions = await runTerminalCommand(
      `find ${
        Deno.env.get('HOME')
      }/Library/Application\\ Support/Cursor/User/extensions -type d -maxdepth 1 2>/dev/null || echo "No extensions directory found"`,
      [],
      true,
    )

    return [
      '=== EXTENSION DIRECTORIES ===',
      extensionDirs || 'No extension directories found',
      '\n=== EXTENSION CONFIGURATION ===',
      extensionConfig || 'No extension configuration found',
      '\n=== EXTENSION API ===',
      extensionApi || 'No extension API found',
      '\n=== INSTALLED EXTENSIONS ===',
      installedExtensions || 'No installed extensions found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error finding extension mechanisms: ${errorMessage}`
  }
}

// Analyze command structure
async function analyzeCommandStructure() {
  try {
    // Find command registrations in main.js
    const commandRegistrations = await runTerminalCommand(
      `grep -E "registerCommand|addCommand|CommandRegistry|registerEditor" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30`,
      [],
      true,
    )

    // Find registered commands in keybindings
    const keybindingCommands = await runTerminalCommand(
      `grep -r "command" /Applications/Cursor.app/Contents/Resources/app/resources/app/keybindings | head -20`,
      [],
      true,
    )

    // Check for IPC commands
    const ipcCommands = await runTerminalCommand(
      `grep -E "ipc\\.handle|ipcMain\\.on|ipcRenderer\\.send" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30`,
      [],
      true,
    )

    return [
      '=== COMMAND REGISTRATIONS ===',
      commandRegistrations || 'No command registrations found',
      '\n=== KEYBINDING COMMANDS ===',
      keybindingCommands || 'No keybinding commands found',
      '\n=== IPC COMMANDS ===',
      ipcCommands || 'No IPC commands found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error analyzing command structure: ${errorMessage}`
  }
}

// Find all cryptographic functions and secure storage
async function findCryptoFunctions() {
  try {
    // Look for cryptographic imports in main.js
    const cryptoImports = await runTerminalCommand(
      'grep -E "crypto|cipher|hash|encrypt|decrypt|sign|verify" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check for Node crypto module usage
    const nodeCryptoUsage = await runTerminalCommand(
      'grep -E "require\\(.crypto.\\)|import.*from .crypto." /Applications/Cursor.app/Contents/Resources/app/out/*.js | head -30',
      [],
      true,
    )

    // Look for key/token storage mechanisms
    const storagePatterns = await runTerminalCommand(
      'grep -E "store|save|load|persist|credentials|keychain|keytar|secret" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check for native binary calls that might handle crypto
    const nativeCrypto = await runTerminalCommand(
      'strings /Applications/Cursor.app/Contents/Resources/app/bin/* | grep -E "encrypt|decrypt|cipher|key|token|sign|verify|auth" | head -30',
      [],
      true,
    )

    return [
      '=== CRYPTO IMPORTS ===',
      cryptoImports || 'No cryptographic imports found',
      '\n=== NODE CRYPTO USAGE ===',
      nodeCryptoUsage || 'No Node crypto usage found',
      '\n=== STORAGE MECHANISMS ===',
      storagePatterns || 'No storage mechanisms found',
      '\n=== NATIVE CRYPTO ===',
      nativeCrypto || 'No native crypto functions found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error finding cryptographic functions: ${errorMessage}`
  }
}

// Probe for internal HTTP/HTTPS endpoints
async function probeInternalEndpoints() {
  try {
    const results = []
    // Define common internal endpoint patterns to check
    const endpointPatterns = [
      // Extract potential endpoints from main.js
      await runTerminalCommand(
        'grep -Eo "(https?|wss?)://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/[a-zA-Z0-9_./-]*)?[^\\s\\"\']*" /Applications/Cursor.app/Contents/Resources/app/out/main.js | sort | uniq',
        [],
        true,
      ),
    ]

    // Flatten and clean endpoint list
    const endpoints = endpointPatterns
      .join('\n')
      .split('\n')
      .filter(Boolean)
      .filter((ep) => !ep.includes('schema') && !ep.includes('license'))
      .slice(0, 20) // Limit to 20 endpoints

    results.push('=== DISCOVERED ENDPOINTS ===')
    results.push(endpoints.join('\n') || 'No endpoints discovered')

    // Probe the local endpoints with curl
    results.push('\n=== PROBING LOCAL ENDPOINTS ===')
    for (const port of [65230, 65220, 8888, 9000, 9229, 49152, 3000, 4000, 41283]) {
      try {
        results.push(`\nProbing localhost:${port}...`)
        // Try HTTP
        const httpResponse = await runTerminalCommand(
          `curl -s -i -m 2 -X OPTIONS http://localhost:${port}`,
          [],
          true,
        )
        results.push(`HTTP response: ${httpResponse.trim() || 'Empty response'}`)

        // Try gRPC reflection
        const grpcReflectionResponse = await runTerminalCommand(
          `curl -s -i -m 2 -X POST http://localhost:${port}/grpc.reflection.v1alpha.ServerReflection/ServerReflectionInfo`,
          [],
          true,
        )
        results.push(`gRPC reflection: ${grpcReflectionResponse.trim() || 'Empty response'}`)
      } catch (error) {
        results.push(
          `Error probing localhost:${port}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    return results.join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error probing internal endpoints: ${errorMessage}`
  }
}

// Analyze command line arguments and environment variables
async function analyzeCommandLineArgs() {
  try {
    // Get current Cursor process command line
    const processArgs = await runTerminalCommand(
      'ps aux | grep Cursor.app | grep -v grep | head -1',
      [],
      true,
    )

    // Find all command line flags supported
    const supportedFlags = await runTerminalCommand(
      'strings /Applications/Cursor.app/Contents/MacOS/Cursor | grep "^--[a-zA-Z-]*" | sort | uniq | head -50',
      [],
      true,
    )

    // Check if there are any environment variables that affect behavior
    const envVarsCheck = await runTerminalCommand(
      'grep -E "process\\.env\\.|getEnv\\(|Deno\\.env\\.get" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -v "NODE_ENV" | head -30',
      [],
      true,
    )

    // Check CLI argument handling in code
    const argHandling = await runTerminalCommand(
      'grep -E "process\\.argv|yargs|minimist|commander|args\\[|parseArgs" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check argv.json contents
    const argvJson = await runTerminalCommand(
      'cat ' + Deno.env.get('HOME') + '/.cursor/argv.json 2>/dev/null || echo "File not found"',
      [],
      true,
    )

    return [
      '=== CURRENT PROCESS ARGUMENTS ===',
      processArgs || 'No Cursor process found',
      '\n=== SUPPORTED COMMAND LINE FLAGS ===',
      supportedFlags || 'No supported flags found',
      '\n=== ENVIRONMENT VARIABLE USAGE ===',
      envVarsCheck || 'No environment variable usage found',
      '\n=== ARGUMENT HANDLING ===',
      argHandling || 'No argument handling found',
      '\n=== ARGV.JSON CONTENTS ===',
      argvJson || 'No argv.json file found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error analyzing command line arguments: ${errorMessage}`
  }
}

// Find authentication flows and token exchange patterns
async function findAuthenticationFlows() {
  try {
    // Examine log files for authentication patterns
    const homeDir = Deno.env.get('HOME')
    const logDirOutput = await runTerminalCommand(
      `ls -td ${homeDir}/Library/Application\\ Support/Cursor/logs/* | head -1`,
      [],
      true,
    )
    const logDir = logDirOutput.trim()

    if (!logDir) {
      return 'No log directories found'
    }

    // Look for authentication patterns in logs
    const authLogs = await runTerminalCommand(
      `grep -E "auth|token|sign|login|authenticate|bearer|credential|key|secret" "${logDir}/main.log" "${logDir}/sharedprocess.log" 2>/dev/null | grep -v "author" | head -100`,
      [],
      true,
    )

    // Check for refresh token logic
    const refreshTokens = await runTerminalCommand(
      `grep -E "refresh.*token|token.*refresh" "${logDir}/main.log" "${logDir}/sharedprocess.log" 2>/dev/null | head -30`,
      [],
      true,
    )

    // Look for authentication-related network traffic
    const authNetworkLogs = await runTerminalCommand(
      'ps aux | grep Cursor | grep -v grep | awk \'{print $2}\' | xargs -I{} lsof -p {} | grep -E "TCP|UDP" | grep -E ":443|:80|:8888"',
      [],
      true,
    )

    // Examine credential storage files
    const credentialFiles = await runTerminalCommand(
      `find ${homeDir}/Library/Application\\ Support/Cursor/User/ -type f -name "*token*" -o -name "*credential*" -o -name "*auth*" | head -20`,
      [],
      true,
    )

    // Check electron-store files which often contain auth tokens
    const electronStoreFiles = await runTerminalCommand(
      `find ${homeDir}/Library/Application\\ Support/Cursor/ -name "*.json" -size +20c -exec grep -l -E "token|auth|key|secret" {} \\; | head -10`,
      [],
      true,
    )

    return [
      '=== AUTHENTICATION LOGS ===',
      authLogs || 'No authentication logs found',
      '\n=== REFRESH TOKEN LOGIC ===',
      refreshTokens || 'No refresh token logic found',
      '\n=== AUTH-RELATED NETWORK TRAFFIC ===',
      authNetworkLogs || 'No auth-related network traffic found',
      '\n=== CREDENTIAL FILES ===',
      credentialFiles || 'No credential files found',
      '\n=== ELECTRON STORE AUTH DATA ===',
      electronStoreFiles || 'No electron store auth data found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error finding authentication flows: ${errorMessage}`
  }
}

// Discover command injection points
async function discoverCommandInjectionPoints() {
  try {
    // Find electron IPC handlers
    const ipcHandlers = await runTerminalCommand(
      'grep -E "ipcMain\\.handle|ipcMain\\.on|ipc\\.handle" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -50',
      [],
      true,
    )

    // Check the VS Code command registry patterns
    const commandRegistry = await runTerminalCommand(
      'grep -E "registerCommand|commands\\.register|CommandRegistry" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -50',
      [],
      true,
    )

    // Look for custom URL protocol handlers
    const protocolHandlers = await runTerminalCommand(
      'grep -E "registerProtocolHandler|setAsDefaultProtocolClient|app\\.setAsDefaultProtocolClient" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check for API endpoints that accept commands
    const apiEndpoints = await runTerminalCommand(
      'grep -E "/api/|/v1/|/command" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check for extension APIs that could be hooked
    const extensionApis = await runTerminalCommand(
      'grep -E "registerExtensionPoint|contributes\\.|extensionPoint|registerExtensionContribution" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    return [
      '=== IPC HANDLERS ===',
      ipcHandlers || 'No IPC handlers found',
      '\n=== COMMAND REGISTRY ===',
      commandRegistry || 'No command registry patterns found',
      '\n=== PROTOCOL HANDLERS ===',
      protocolHandlers || 'No protocol handlers found',
      '\n=== API ENDPOINTS ===',
      apiEndpoints || 'No API endpoints found',
      '\n=== EXTENSION APIS ===',
      extensionApis || 'No extension APIs found',
    ].join('\n')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error discovering command injection points: ${errorMessage}`
  }
}

// Check for websocket endpoints used by Cursor
async function analyzeWebsocketEndpoints() {
  try {
    // Search for websocket URLs in main.js
    const wsMainJs = await runTerminalCommand(
      'grep -E "ws://|wss://|WebSocket|createWebSocket" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    // Search for websocket URLs in renderer code
    const wsRendererCode = await runTerminalCommand(
      'grep -E "ws://|wss://|WebSocket|createWebSocket" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js',
      [],
      true,
    )

    // Check if there are any active websocket connections
    const activeWsConnections = await runTerminalCommand(
      'lsof -i | grep -E "Cursor.*ESTABLISHED.*TCP" | grep -v "->127.0.0"',
      [],
      true,
    )

    return [
      {
        name: 'Websocket endpoints in main process',
        result: wsMainJs,
      },
      {
        name: 'Websocket endpoints in renderer',
        result: wsRendererCode,
      },
      {
        name: 'Active websocket connections',
        result: activeWsConnections,
      },
    ]
  } catch (error) {
    return [{ name: 'Error analyzing websocket endpoints', result: String(error) }]
  }
}

// Find encryption/decryption mechanisms in the code
async function findEncryptionMechanisms() {
  try {
    // Look for encryption-related code in the application
    const encryptionCode = await runTerminalCommand(
      'grep -E "encrypt|decrypt|cipher|aes|rsa|crypto|key|secret|password|hash|token" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    // Look for encryption libraries
    const encryptionLibraries = await runTerminalCommand(
      'find /Applications/Cursor.app -name "*.node" | xargs strings | grep -E "openssl|crypto|cipher|encrypt|decrypt" | head -50',
      [],
      true,
    )

    // Check for stored keys or certificates
    const storedKeysSearch = await runTerminalCommand(
      'find ~/Library/Application\\ Support/Cursor/ -name "*.pem" -o -name "*.key" -o -name "*.crt" -o -name "*.cer" -o -name "storage.json"',
      [],
      true,
    )

    // Check for environment variables being used for secrets
    const envVarUsage = await runTerminalCommand(
      'grep -E "process.env|Deno.env" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -E "key|token|secret|password|auth"',
      [],
      true,
    )

    return [
      {
        name: 'Encryption code in main process',
        result: encryptionCode,
      },
      {
        name: 'Encryption libraries used',
        result: encryptionLibraries,
      },
      {
        name: 'Stored keys or certificates',
        result: storedKeysSearch,
      },
      {
        name: 'Environment variables for secrets',
        result: envVarUsage,
      },
    ]
  } catch (error) {
    return [{ name: 'Error finding encryption mechanisms', result: String(error) }]
  }
}

// Discover hidden or undocumented API features
async function findHiddenAPIFeatures() {
  try {
    // Search for feature flags
    const featureFlags = await runTerminalCommand(
      'grep -E "featureFlag|enableFeature|disableFeature|isFeatureEnabled|experimentalFeatures" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    // Search for disabled or hidden commands
    const hiddenCommands = await runTerminalCommand(
      'grep -E "registerCommand|CommandRegistry|hiddenCommand|internalCommand" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -v "vscode"',
      [],
      true,
    )

    // Check for debug modes or developer tools
    const debugModes = await runTerminalCommand(
      'grep -E "debugMode|developerMode|isInternal|isDev|__CURSOR_DEV__|devtools" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    // Check for command line flags that enable hidden features
    const commandLineFlags = await runTerminalCommand(
      'grep -E "parseArgs|process.argv|Deno.args" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -A 3 -B 3 "parse"',
      [],
      true,
    )

    // Check for undocumented endpoints
    const undocumentedEndpoints = await runTerminalCommand(
      'grep -E "app.get\\(|app.post\\(|router.get\\(|router.post\\(|createServer\\(|listen\\(" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -v "vscode"',
      [],
      true,
    )

    return [
      {
        name: 'Feature flags',
        result: featureFlags,
      },
      {
        name: 'Hidden commands',
        result: hiddenCommands,
      },
      {
        name: 'Debug modes',
        result: debugModes,
      },
      {
        name: 'Command line flags for hidden features',
        result: commandLineFlags,
      },
      {
        name: 'Undocumented endpoints',
        result: undocumentedEndpoints,
      },
    ]
  } catch (error) {
    return [{ name: 'Error finding hidden API features', result: String(error) }]
  }
}

// Find potential command injection points in the app
async function findCommandInjectionPoints() {
  try {
    // Look for places where shell commands are executed
    const shellExecPoints = await runTerminalCommand(
      'grep -E "spawn|exec|execFile|fork|child_process" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    // Look for places where user input might be used in commands
    const userInputToCommands = await runTerminalCommand(
      'grep -E "spawn|exec|execFile|fork|child_process" -A 3 -B 3 /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -E "args|input|param|config|option"',
      [],
      true,
    )

    // Check for dynamic imports or requires
    const dynamicImports = await runTerminalCommand(
      'grep -E "import\\(|require\\(" /Applications/Cursor.app/Contents/Resources/app/out/main.js | grep -E "variable|param|arg|input|config"',
      [],
      true,
    )

    // Check for eval or Function constructor usage
    const evalUsage = await runTerminalCommand(
      'grep -E "eval\\(|new Function\\(|Function\\(" /Applications/Cursor.app/Contents/Resources/app/out/main.js',
      [],
      true,
    )

    return [
      {
        name: 'Shell execution points',
        result: shellExecPoints,
      },
      {
        name: 'User input used in commands',
        result: userInputToCommands,
      },
      {
        name: 'Dynamic imports/requires',
        result: dynamicImports,
      },
      {
        name: 'Eval/Function constructor usage',
        result: evalUsage,
      },
    ]
  } catch (error) {
    return [{ name: 'Error finding command injection points', result: String(error) }]
  }
}

// Analyze Cursor settings database structure
async function analyzeSettingsDatabase() {
  try {
    // Find settings database files
    const settingsDbFiles = await runTerminalCommand(
      'find ~/Library/Application\\ Support/Cursor/ -name "*.db" -o -name "state.json" -o -name "settings.json" -o -name "storage.json"',
      [],
      true,
    )

    // Check if SQLite is used and examine schema if possible
    const sqliteCheck = await runTerminalCommand(
      'find ~/Library/Application\\ Support/Cursor/ -name "*.db" -exec file {} \\; | grep "SQLite"',
      [],
      true,
    )

    const sqliteSchema = sqliteCheck
      ? await runTerminalCommand(
        'find ~/Library/Application\\ Support/Cursor/ -name "*.db" -exec echo "{}:" \\; -exec sqlite3 {} ".tables" \\; -exec echo "" \\; 2>/dev/null || echo "Failed to read SQLite schema"',
        [],
        true,
      )
      : 'No SQLite databases found'

    // Look at some of the JSON settings files
    const settingsJson = await runTerminalCommand(
      'find ~/Library/Application\\ Support/Cursor/ -name "settings.json" -exec cat {} \\; 2>/dev/null | grep -E "token|endpoint|auth|secret|key|password|url" || echo "No sensitive settings found"',
      [],
      true,
    )

    // Check for local storage contents
    const localStorage = await runTerminalCommand(
      'find ~/Library/Application\\ Support/Cursor/ -name "Local Storage" -type d -exec find {} -type f -exec strings {} \\; \\; 2>/dev/null | grep -E "token|endpoint|auth|secret|key|password|url" | head -50',
      [],
      true,
    )

    return [
      {
        name: 'Settings database files',
        result: settingsDbFiles,
      },
      {
        name: 'SQLite database check',
        result: sqliteCheck,
      },
      {
        name: 'SQLite schema (if any)',
        result: sqliteSchema,
      },
      {
        name: 'Settings JSON sensitive data',
        result: settingsJson,
      },
      {
        name: 'Local storage sensitive data',
        result: localStorage,
      },
    ]
  } catch (error) {
    return [{ name: 'Error analyzing settings database', result: String(error) }]
  }
}

// Analyze internal state storage mechanisms
async function analyzeInternalStateStorage() {
  try {
    // Search for state serialization/deserialization patterns
    const stateStoragePatterns = await runTerminalCommand(
      'grep -E "store|state|persist|serializ|deserializ|hydrat" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -50',
      [],
      true,
    )

    // Look for IndexedDB or localStorage usage
    const browserStorageUsage = await runTerminalCommand(
      'grep -E "indexedDB|localStorage|sessionStorage" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -20',
      [],
      true,
    )

    // Check for SQLite or other database files
    const homeDir = Deno.env.get('HOME')
    const dbFiles = await runTerminalCommand(
      'find ' + homeDir + '/Library/Application\\ Support/Cursor -name "*.db" -o -name "*.sqlite"',
      [],
      true,
    )

    return [
      { name: 'State Storage Patterns', output: stateStoragePatterns },
      { name: 'Browser Storage APIs', output: browserStorageUsage },
      { name: 'Database Files', output: dbFiles },
    ]
  } catch (error) {
    return [{ name: 'Error', output: String(error) }]
  }
}

// Analyze environment variables and startup flags
async function analyzeEnvironmentAndStartupFlags() {
  try {
    // Extract environment variables used by Cursor
    const envVarsPatterns = await runTerminalCommand(
      'grep -E "process.env" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -50',
      [],
      true,
    )

    // Look for command line arguments parsing
    const cmdArgsPatterns = await runTerminalCommand(
      'grep -E "process.argv|parseArgs|yargs|commander|options|flags" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -30',
      [],
      true,
    )

    // Check for any hardcoded default values
    const defaultValuesPatterns = await runTerminalCommand(
      'grep -E "default:|defaultValue|DEFAULT_" /Applications/Cursor.app/Contents/Resources/app/out/main.js | head -20',
      [],
      true,
    )

    return [
      { name: 'Environment Variables', output: envVarsPatterns },
      { name: 'Command Line Arguments', output: cmdArgsPatterns },
      { name: 'Default Values', output: defaultValuesPatterns },
    ]
  } catch (error) {
    return [{ name: 'Error', output: String(error) }]
  }
}

// Discover undocumented APIs and hooks
async function discoverUndocumentedApis() {
  try {
    // Look for experimental features
    const experimentalFeatures = await runTerminalCommand(
      'grep -E "experimental|feature|enablement|toggle" /Applications/Cursor.app/Contents/Resources/app/product.json',
      [],
      true,
    )

    // Find internal APIs that might be accessible
    const internalApis = await runTerminalCommand(
      'grep -E "registerAPI|exposeAPI|provide|registerService" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -30',
      [],
      true,
    )

    // Look for extension API hooks
    const extensionApiHooks = await runTerminalCommand(
      'grep -E "extensionAPI|extension.api|registerExtensionPoint" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -20',
      [],
      true,
    )

    return [
      { name: 'Experimental Features', output: experimentalFeatures },
      { name: 'Internal APIs', output: internalApis },
      { name: 'Extension API Hooks', output: extensionApiHooks },
    ]
  } catch (error) {
    return [{ name: 'Error', output: String(error) }]
  }
}

// Analyze AI integration mechanisms
async function analyzeAiIntegrationMechanisms() {
  try {
    // Search for AI service integration points
    const aiServiceIntegration = await runTerminalCommand(
      'grep -E "aiService|openai|anthropic|claude|llm|completion|embedding" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -30',
      [],
      true,
    )

    // Look for AI model loading or configuration
    const aiModelConfig = await runTerminalCommand(
      'grep -E "model|weights|parameters|tokenizer|encoder|prompt|context" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -30',
      [],
      true,
    )

    // Check for AI credentials or auth mechanisms
    const aiCredentials = await runTerminalCommand(
      'grep -E "apiKey|token|auth|credential|secret" /Applications/Cursor.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js | head -20',
      [],
      true,
    )

    return [
      { name: 'AI Service Integration', output: aiServiceIntegration },
      { name: 'AI Model Configuration', output: aiModelConfig },
      { name: 'AI Authentication', output: aiCredentials },
    ]
  } catch (error) {
    return [{ name: 'Error', output: String(error) }]
  }
}
