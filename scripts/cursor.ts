#!/usr/bin/env -S deno run -A

/**
 * @module cursor
 * @description A simple script to demonstrate the usage of the Cursor SDK
 * by calling various methods in sequence to interact with the Cursor API.
 * @see ../src/utils/cursor-sdk.ts
 */

import { chatHistory, indexQuery, status } from '../src/utils/cursor-sdk.ts'

// Default Cursor API host
const CURSOR_API_HOST = 'localhost'
// Common ports to check for the Cursor API
const PORTS_TO_CHECK = [8888, 8765, 9222, 3000, 3001, 5000, 9000, 9876, 8000, 9999, 8080, 4200]

/**
 * Check if a TCP port is open and accessible
 *
 * @param host - The hostname to check
 * @param port - The port number to check
 * @param _timeout - Timeout in milliseconds (unused for now)
 * @returns Promise that resolves to true if port is open, false otherwise
 */
async function isPortOpen(host: string, port: number, _timeout = 1000): Promise<boolean> {
  try {
    // Create a connection to check if port is open
    const conn = await Deno.connect({
      hostname: host,
      port: port,
      transport: 'tcp',
    })

    // If we get here, connection was successful
    conn.close()
    return true
  } catch (error) {
    // Check what type of error we got
    if (error instanceof Deno.errors.ConnectionRefused) {
      // Connection refused usually means nothing is listening on that port
      return false
    }

    // For other errors (like timeout), log and return false
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error checking port:', errorMessage)
    return false
  }
}

/**
 * Try to detect if an API endpoint is available on a given port
 *
 * @param host - The hostname to check
 * @param port - The port number to check
 * @returns Promise that resolves to true if the API endpoint is detected, false otherwise
 */
async function detectApiEndpoint(host: string, port: number): Promise<boolean> {
  try {
    // First check if port is open
    const isOpen = await isPortOpen(host, port)
    if (!isOpen) {
      return false
    }

    // Try to access the status API endpoint
    const url = `http://${host}:${port}/api/status`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)

    try {
      const response = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      // If we get a response (even an error), it might be the API
      return response.status !== 404 // Assume if it's not a 404, it could be the API
    } catch (error) {
      clearTimeout(timeoutId)
      // If it's not an abort error, the port might be open but not serving HTTP
      return !(error instanceof DOMException && error.name === 'AbortError')
    }
  } catch (_error) {
    return false
  }
}

/**
 * Scan common ports to find the Cursor API
 *
 * @param host - The hostname to scan
 * @param ports - Array of ports to check
 * @returns Promise with the detected port, or null if none found
 */
async function scanForCursorApi(host: string, ports: number[]): Promise<number | null> {
  console.log(`Scanning for Cursor API on ${host} across ${ports.length} ports...`)

  // Check each port in parallel
  const results = await Promise.all(
    ports.map(async (port) => {
      const isOpen = await isPortOpen(host, port)
      if (isOpen) {
        const mightBeApi = await detectApiEndpoint(host, port)
        return { port, isOpen, mightBeApi }
      }
      return { port, isOpen: false, mightBeApi: false }
    }),
  )

  // Filter for open ports
  const openPorts = results.filter((result) => result.isOpen)
  console.log(`Found ${openPorts.length} open ports:`)

  // Display open ports
  for (const { port, mightBeApi } of openPorts) {
    console.log(`  - Port ${port}: ${mightBeApi ? 'Possibly Cursor API' : 'Other service'}`)
  }

  // Check if any ports might be the API
  const possibleApiPorts = openPorts.filter((result) => result.mightBeApi)
  if (possibleApiPorts.length > 0) {
    return possibleApiPorts[0].port
  }

  // If we have open ports but none look like the API, suggest the first one
  if (openPorts.length > 0) {
    return openPorts[0].port
  }

  return null
}

/**
 * Diagnose connection issues and provide helpful feedback
 *
 * @param host - The hostname
 * @param port - The port number
 */
async function diagnoseConnection(host: string, port: number): Promise<void> {
  console.log(`Checking if Cursor API is running on ${host}:${port}...`)

  const isOpen = await isPortOpen(host, port)

  if (isOpen) {
    console.log(`✅ Port ${port} is open on ${host}. The Cursor API server appears to be running.`)
    console.log("If you're still seeing connection errors, the server might be:")
    console.log('- Starting up and not ready to accept connections yet')
    console.log('- Running but refusing connections for authentication/authorization reasons')
    console.log('- Listening on a different endpoint path')
  } else {
    console.log(
      `❌ Port ${port} is closed on ${host}. The Cursor API server is likely not running.`,
    )
    console.log("\nLet's scan for other possible ports where the Cursor API might be running...")

    // Scan for the API on other ports
    const detectedPort = await scanForCursorApi(host, PORTS_TO_CHECK.filter((p) => p !== port))

    if (detectedPort) {
      console.log(`\n✅ Detected a possible Cursor API port: ${detectedPort}`)
      console.log('To use this port in your SDK, update your code with:')
      console.log(`const API_BASE_URL = 'http://${host}:${detectedPort}/api'`)
    } else {
      console.log('\n❌ Could not detect any running Cursor API service.')
      console.log('\nPossible solutions:')
      console.log('1. Make sure Cursor is running')
      console.log('2. Check if the API server is configured to use a different port')
      console.log('3. Verify there are no firewall rules blocking the connection')
    }
  }
}

/**
 * Main function that runs the Cursor SDK methods in sequence
 */
async function main() {
  const args = Deno.args

  // Handle port specification
  let port = 8888 // Default port
  const portArgIndex = args.findIndex((arg) => arg === '--port' || arg === '-p')
  if (portArgIndex >= 0 && portArgIndex < args.length - 1) {
    const portValue = Number.parseInt(args[portArgIndex + 1], 10)
    if (!Number.isNaN(portValue)) {
      port = portValue
    }
  }

  // Check if --scan flag is provided
  if (args.includes('--scan') || args.includes('-s')) {
    const detectedPort = await scanForCursorApi(CURSOR_API_HOST, PORTS_TO_CHECK)
    if (detectedPort) {
      console.log(`\n✅ Detected a possible Cursor API port: ${detectedPort}`)
      console.log('To use this port in your SDK, update your code with:')
      console.log(`const API_BASE_URL = 'http://${CURSOR_API_HOST}:${detectedPort}/api'`)

      // Ask if the user wants to try this port
      console.log('\nWould you like to try using this port? (y/n)')
      const buf = new Uint8Array(1)
      await Deno.stdin.read(buf)
      const answer = new TextDecoder().decode(buf)

      if (answer.toLowerCase() === 'y') {
        port = detectedPort
      } else {
        return
      }
    } else {
      console.log('\n❌ Could not detect any running Cursor API service.')
      return
    }
  }

  // Check if --diagnose flag is provided
  if (args.includes('--diagnose') || args.includes('-d')) {
    await diagnoseConnection(CURSOR_API_HOST, port)
    return
  }

  // Always check port before attempting API calls
  const isOpen = await isPortOpen(CURSOR_API_HOST, port)
  if (!isOpen) {
    console.error(
      `❌ Error: Cursor API server does not appear to be running on ${CURSOR_API_HOST}:${port}`,
    )
    console.error(
      'Run with --scan flag to find the correct port: deno run -A scripts/cursor.ts --scan',
    )
    console.error(
      'Or run with --diagnose flag for more information: deno run -A scripts/cursor.ts --diagnose',
    )
    Deno.exit(1)
  }

  try {
    // Update the API base URL to use the detected port
    const API_BASE_URL = `http://${CURSOR_API_HOST}:${port}/api`
    console.log(`Using Cursor API at: ${API_BASE_URL}`)

    console.log('Fetching Cursor status...')
    const statusResult = await status()
    console.log('Status Result:', JSON.stringify(statusResult, null, 2))

    console.log('\nFetching chat history...')
    const historyResult = await chatHistory()
    console.log('Chat History Result:', JSON.stringify(historyResult, null, 2))

    console.log('\nQuerying document index...')
    const queryResult = await indexQuery('example query')
    console.log('Index Query Result:', JSON.stringify(queryResult, null, 2))

    console.log('\nAll operations completed successfully!')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error('Error occurred:', errorMessage)

    // Provide more helpful context for common errors
    if (errorMessage.includes('Connection refused')) {
      console.error('\nThe connection was refused, which typically means:')
      console.error('1. The Cursor API server suddenly stopped running')
      console.error('2. The server is running but not accepting connections on this port')
      console.error(
        '\nRun with --scan flag to find the correct port: deno run -A scripts/cursor.ts --scan',
      )
    }

    Deno.exit(1)
  }
}

// Display usage information if --help flag is provided
if (Deno.args.includes('--help') || Deno.args.includes('-h')) {
  console.log('Usage: deno run -A scripts/cursor.ts [options]')
  console.log('\nOptions:')
  console.log('  --scan, -s         Scan for Cursor API across common ports')
  console.log('  --port, -p PORT    Specify a custom port (default: 8888)')
  console.log('  --diagnose, -d     Run connection diagnostics')
  console.log('  --help, -h         Show this help message')
  Deno.exit(0)
}

// Run the main function
main()
