/**
 * Cursor SDK - Client for Cursor API
 *
 * A simple HTTP client for interacting with the Cursor API endpoints.
 * This module provides type-safe methods for each confirmed API.
 */

// Base URL for Cursor API
const API_BASE_URL = 'http://localhost:8888/api'

/**
 * Response from the Cursor status API
 */
interface StatusResponse {
  running: boolean
  version: string
  workspace: string
  indexStatus: string
  aiStatus: string
}

/**
 * Response from index query API
 */
interface IndexQueryResult {
  id: string
  type: string
  path: string
  range?: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  relevance: number
  snippet?: string
}

interface IndexQueryResponse {
  results: IndexQueryResult[]
}

/**
 * Index query options
 */
interface IndexQueryOptions {
  maxResults?: number
  includeTypes?: string[]
  excludePaths?: string[]
  caseSensitive?: boolean
  symbolKinds?: string[]
}

/**
 * Chat message context
 */
interface ChatContext {
  activePath?: string
  selection?: {
    start: { line: number; character: number }
    end: { line: number; character: number }
  }
  visibleFiles?: string[]
  [key: string]: unknown
}

/**
 * Response from chat send API
 */
interface ChatSendResponse {
  id: string
  response: string
  actions?: {
    type: string
    data: unknown
  }[]
}

/**
 * Chat history message
 */
interface ChatMessage {
  id: string
  role: string
  content: string
  timestamp: string
}

/**
 * Response from chat history API
 */
interface ChatHistoryResponse {
  messages: ChatMessage[]
}

/**
 * Response from chat clear API
 */
interface ChatClearResponse {
  success: boolean
}

/**
 * AI model completion options
 */
interface AICompletionOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  stopSequences?: string[]
  context?: unknown
}

/**
 * Response from AI completion API
 */
interface AICompletionResponse {
  completion: string
  model: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Chat message format for AI chat API
 */
interface AIMessage {
  role: string
  content: string
}

/**
 * AI chat options
 */
interface AIChatOptions {
  model?: string
  maxTokens?: number
  temperature?: number
  context?: unknown
}

/**
 * Response from AI chat API
 */
interface AIChatResponse {
  response: string
  model: string
  finishReason: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Get the status of the Cursor IDE
 *
 * @returns Promise with Cursor status information
 */
async function status(): Promise<StatusResponse> {
  const response = await fetch(`${API_BASE_URL}/status`)

  if (!response.ok) {
    throw new Error(`Failed to get Cursor status: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Query the document index
 *
 * @param query - The search query
 * @param options - Optional query parameters
 * @returns Promise with query results
 */
async function indexQuery(
  query: string,
  options?: IndexQueryOptions,
): Promise<IndexQueryResponse> {
  const response = await fetch(`${API_BASE_URL}/index/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      options: options || {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Index query failed: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Send a message to the Cursor chat
 *
 * @param message - The message to send
 * @param context - Optional context information
 * @returns Promise with chat response
 */
async function chatSend(
  message: string,
  context?: ChatContext,
): Promise<ChatSendResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      context: context || {},
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send chat message: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Get the chat history
 *
 * @returns Promise with chat history
 */
async function chatHistory(): Promise<ChatHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/history`)

  if (!response.ok) {
    throw new Error(`Failed to get chat history: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Clear the chat history
 *
 * @returns Promise with result of clear operation
 */
async function chatClear(): Promise<ChatClearResponse> {
  const response = await fetch(`${API_BASE_URL}/chat/clear`, {
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`Failed to clear chat history: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Get an AI completion
 *
 * @param prompt - The prompt for the AI
 * @param options - Optional parameters for the completion
 * @returns Promise with AI completion
 */
async function aiComplete(
  prompt: string,
  options?: AICompletionOptions,
): Promise<AICompletionResponse> {
  const params = {
    prompt,
    model: options?.model,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    stopSequences: options?.stopSequences,
    context: options?.context,
  }

  const response = await fetch(`${API_BASE_URL}/ai/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`AI completion failed: ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Use the AI chat API
 *
 * @param messages - Array of chat messages
 * @param options - Optional parameters for the chat
 * @returns Promise with AI chat response
 */
async function aiChat(
  messages: AIMessage[],
  options?: AIChatOptions,
): Promise<AIChatResponse> {
  const params = {
    messages,
    model: options?.model,
    maxTokens: options?.maxTokens,
    temperature: options?.temperature,
    context: options?.context,
  }

  const response = await fetch(`${API_BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })

  if (!response.ok) {
    throw new Error(`AI chat failed: ${response.statusText}`)
  }

  return await response.json()
}

// Export all functions at the bottom of the file
export { aiChat, aiComplete, chatClear, chatHistory, chatSend, indexQuery, status }
