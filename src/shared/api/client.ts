import { z } from 'zod'

import { ApiError, RateLimitError } from './errors'
export { ApiError, RateLimitError }

export const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL as string

if (!BACKEND_API_URL) {
  console.error(
    '[API Client] Critical Configuration Error: VITE_BACKEND_API_URL is not defined in your .env file.',
  )
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim().length > 0) {
    return data
  }
  if (data && typeof data === 'object') {
    const rec = data as Record<string, unknown>
    if (typeof rec.error === 'string' && rec.error.trim().length > 0) {
      return rec.error
    }
    if (typeof rec.message === 'string' && rec.message.trim().length > 0) {
      return rec.message
    }
  }
  return fallback
}

/**
 * Perform a generic fetch request
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
  schema?: z.ZodSchema<T>,
): Promise<T> {
  const url = `${BACKEND_API_URL}${endpoint}`

  const defaultHeaders: Record<string, string> = {}
  if (options.body !== undefined) {
    defaultHeaders['Content-Type'] = 'application/json'
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    credentials: options.credentials || 'include',
  })

  if (!response.ok) {
    let errorData: unknown
    const rawText = await response.text()
    if (rawText) {
      try {
        errorData = JSON.parse(rawText) as unknown
      } catch {
        errorData = rawText
      }
    }

    if (response.status === 401) {
      throw new ApiError(401, extractErrorMessage(errorData, 'Unauthorized'), errorData)
    }

    if (response.status === 403) {
      throw new ApiError(403, extractErrorMessage(errorData, 'Forbidden'), errorData)
    }

    throw new ApiError(
      response.status,
      extractErrorMessage(errorData, response.statusText || `HTTP ${response.status}`),
      errorData,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  const data: unknown = await response.json()

  if (schema) {
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      console.error('[API Client] Zod Validation Failed:', parsed.error)
      throw new Error('Invalid data schema')
    }
    return parsed.data
  }

  return data as T
}
