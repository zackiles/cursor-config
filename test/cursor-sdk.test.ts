/**
 * Tests for the Cursor SDK module which provides HTTP client methods for interacting with the Cursor API.
 * @module cursorSdkTest
 * @see ../src/utils/cursor-sdk.ts
 */
import { assertEquals, assertRejects } from '@std/assert'
import {
  aiChat,
  aiComplete,
  chatClear,
  chatHistory,
  chatSend,
  indexQuery,
  status,
} from '../src/utils/cursor-sdk.ts'

// Store original fetch function
const originalFetch = globalThis.fetch

const TEST_CONFIG = {
  TEST_NAME: 'utils/cursor-sdk',
  DENO_ENV: 'test' as const,
} as const

// Mock response factory
function createMockResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Mock implementation of fetch for testing
 */
function mockFetch(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  // Extract URL string from various input types
  let url: string
  let requestInit = init ? { ...init } : {}

  if (typeof input === 'string') {
    url = input
  } else if (input instanceof URL) {
    url = input.toString()
  } else if (input instanceof Request) {
    url = input.url
    // Merge request options with init options if provided
    requestInit = {
      method: input.method,
      headers: input.headers,
      ...requestInit,
    }
  } else {
    return Promise.reject(new TypeError('Invalid input type'))
  }

  const apiPath = url.split('/api/')[1]

  // Status endpoint
  if (
    apiPath === 'status' &&
    (!requestInit || requestInit.method === undefined || requestInit.method === 'GET')
  ) {
    return Promise.resolve(createMockResponse(200, {
      running: true,
      version: '1.0.0',
      workspace: '/path/to/workspace',
      indexStatus: 'ready',
      aiStatus: 'connected',
    }))
  }

  // Index query endpoint
  if (apiPath === 'index/query' && requestInit?.method === 'POST') {
    const body = JSON.parse(requestInit.body as string)
    if (!body.query) {
      return Promise.resolve(createMockResponse(400, { error: 'Missing query parameter' }))
    }

    return Promise.resolve(createMockResponse(200, {
      results: [
        {
          id: '1',
          type: 'file',
          path: '/path/to/file.ts',
          relevance: 0.95,
          snippet: 'const example = "test"',
        },
      ],
    }))
  }

  // Chat send endpoint
  if (apiPath === 'chat/send' && requestInit?.method === 'POST') {
    const body = JSON.parse(requestInit.body as string)
    if (!body.message) {
      return Promise.resolve(createMockResponse(400, { error: 'Missing message parameter' }))
    }

    return Promise.resolve(createMockResponse(200, {
      id: 'chat-123',
      response: 'This is a test response',
    }))
  }

  // Chat history endpoint
  if (
    apiPath === 'chat/history' &&
    (!requestInit || requestInit.method === undefined || requestInit.method === 'GET')
  ) {
    return Promise.resolve(createMockResponse(200, {
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: '2023-01-01T00:00:00Z',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there!',
          timestamp: '2023-01-01T00:00:01Z',
        },
      ],
    }))
  }

  // Chat clear endpoint
  if (apiPath === 'chat/clear' && requestInit?.method === 'POST') {
    return Promise.resolve(createMockResponse(200, {
      success: true,
    }))
  }

  // AI complete endpoint
  if (apiPath === 'ai/complete' && requestInit?.method === 'POST') {
    const body = JSON.parse(requestInit.body as string)
    if (!body.prompt) {
      return Promise.resolve(createMockResponse(400, { error: 'Missing prompt parameter' }))
    }

    return Promise.resolve(createMockResponse(200, {
      completion: 'This is a test completion',
      model: 'test-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
    }))
  }

  // AI chat endpoint
  if (apiPath === 'ai/chat' && requestInit?.method === 'POST') {
    const body = JSON.parse(requestInit.body as string)
    if (!body.messages || !body.messages.length) {
      return Promise.resolve(createMockResponse(400, { error: 'Missing messages parameter' }))
    }

    return Promise.resolve(createMockResponse(200, {
      response: 'This is a test chat response',
      model: 'test-model',
      finishReason: 'stop',
      usage: {
        promptTokens: 15,
        completionTokens: 8,
        totalTokens: 23,
      },
    }))
  }

  // Default: return a 404 for unknown endpoints
  return Promise.resolve(createMockResponse(404, { error: 'Not found' }))
}

// Set up and teardown for tests
Deno.test(`[${TEST_CONFIG.TEST_NAME}]: Cursor SDK API Client Tests`, async (t) => {
  // Setup: replace global fetch with mock
  await t.step('setup', () => {
    globalThis.fetch = mockFetch as typeof fetch
  })

  // Test status() function
  await t.step('status() should fetch Cursor status', async () => {
    const result = await status()

    assertEquals(result.running, true)
    assertEquals(result.version, '1.0.0')
    assertEquals(result.workspace, '/path/to/workspace')
    assertEquals(result.indexStatus, 'ready')
    assertEquals(result.aiStatus, 'connected')
  })

  // Test indexQuery() function
  await t.step('indexQuery() should query the document index', async () => {
    const result = await indexQuery('test query')

    assertEquals(result.results.length, 1)
    assertEquals(result.results[0].id, '1')
    assertEquals(result.results[0].type, 'file')
    assertEquals(result.results[0].path, '/path/to/file.ts')
  })

  // Test indexQuery() with invalid params
  await t.step('indexQuery() should handle errors', async () => {
    // Temporarily override mock for this test
    globalThis.fetch = () => Promise.resolve(createMockResponse(500, { error: 'Server error' }))

    await assertRejects(
      async () => await indexQuery('test query'),
      Error,
      'Index query failed',
    )

    // Restore the mock
    globalThis.fetch = mockFetch as typeof fetch
  })

  // Test chatSend() function
  await t.step('chatSend() should send a message to chat', async () => {
    const result = await chatSend('Hello Cursor')

    assertEquals(result.id, 'chat-123')
    assertEquals(result.response, 'This is a test response')
  })

  // Test chatHistory() function
  await t.step('chatHistory() should get chat history', async () => {
    const result = await chatHistory()

    assertEquals(result.messages.length, 2)
    assertEquals(result.messages[0].role, 'user')
    assertEquals(result.messages[0].content, 'Hello')
    assertEquals(result.messages[1].role, 'assistant')
    assertEquals(result.messages[1].content, 'Hi there!')
  })

  // Test chatClear() function
  await t.step('chatClear() should clear chat history', async () => {
    const result = await chatClear()

    assertEquals(result.success, true)
  })

  // Test aiComplete() function
  await t.step('aiComplete() should get AI completion', async () => {
    const result = await aiComplete('Complete this sentence')

    assertEquals(result.completion, 'This is a test completion')
    assertEquals(result.model, 'test-model')
    assertEquals(result.finishReason, 'stop')
    assertEquals(result.usage.promptTokens, 10)
    assertEquals(result.usage.completionTokens, 5)
    assertEquals(result.usage.totalTokens, 15)
  })

  // Test aiChat() function
  await t.step('aiChat() should use AI chat API', async () => {
    const result = await aiChat([{ role: 'user', content: 'Hello AI' }])

    assertEquals(result.response, 'This is a test chat response')
    assertEquals(result.model, 'test-model')
    assertEquals(result.finishReason, 'stop')
    assertEquals(result.usage.promptTokens, 15)
    assertEquals(result.usage.completionTokens, 8)
    assertEquals(result.usage.totalTokens, 23)
  })

  // Teardown: restore original fetch
  await t.step('teardown', () => {
    globalThis.fetch = originalFetch
  })
})
