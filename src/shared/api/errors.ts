/**
 * Base error class for API requests
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class RateLimitError extends Error {
  public cooldownSeconds: number
  constructor(message: string, cooldownSeconds: number = 60) {
    super(message)
    this.name = 'RateLimitError'
    this.cooldownSeconds = cooldownSeconds
  }
}
