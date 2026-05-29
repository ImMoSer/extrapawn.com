import { z } from 'zod'

import { ApiError, InsufficientPawnCoinsError, RateLimitError } from './errors'
export { ApiError, InsufficientPawnCoinsError, RateLimitError }

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

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
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
    if (response.status === 429) {
      const r = response.headers.get('Retry-After')
      throw new RateLimitError('Rate limit exceeded', r ? parseInt(r, 10) : 60)
    }

    if (response.status === 403) {
      const errorData = await response.json()
      throw new InsufficientPawnCoinsError(
        errorData.message || 'Forbidden',
        errorData.required || 0,
        errorData.available !== undefined ? errorData.available : (errorData.limit || 0),
      )
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
