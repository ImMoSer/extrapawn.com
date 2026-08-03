import { z } from 'zod'

import { ApiError, RateLimitError } from './errors'
export { ApiError, RateLimitError }

export const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL as string

if (!BACKEND_API_URL) {
  console.error(
    '[API Client] Critical Configuration Error: VITE_BACKEND_API_URL is not defined in your .env file.',
  )
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
    // by default always include credentials if interacting with our backend, as seen in AuthService.
    credentials: options.credentials || 'include',
  })

  if (!response.ok) {
    if (response.status === 401) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { message: 'Unauthorized' }
      }
      throw new ApiError(401, typeof errorData === 'string' ? errorData : (errorData.message || 'Unauthorized'))
    }

    if (response.status === 403) {
      let errorData
      try {
        errorData = await response.json()
      } catch {
        errorData = { message: 'Forbidden' }
      }
      throw new ApiError(403, errorData.message || 'Forbidden')
    }

    let errorData
    try {
      errorData = await response.json()
    } catch {
      // Not JSON
      errorData = await response.text()
    }
    throw new ApiError(response.status, response.statusText, errorData)
  }

  const data = await response.json()

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
