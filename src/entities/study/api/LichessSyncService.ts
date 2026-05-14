// src/features/study/api/LichessSyncService.ts
import logger from '@/shared/lib/logger'
import { apiClient } from '@/shared/api/client'

export class LichessApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'LichessApiError'
  }
}

export interface LichessImportPgnRequest {
  pgn: string
  name?: string
  orientation?: 'white' | 'black'
  variant?: string
}

class RequestQueue {
  private queue: (() => Promise<void>)[] = []
  private isProcessing = false
  private lastRequestTime = 0
  private readonly minDelayMs = 500 // Generic throttle between requests to be safe

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const now = Date.now()
          const timeSinceLast = now - this.lastRequestTime
          if (timeSinceLast < this.minDelayMs) {
            await new Promise((r) => setTimeout(r, this.minDelayMs - timeSinceLast))
          }
          const result = await task()
          this.lastRequestTime = Date.now()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    this.isProcessing = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        await task()
      }
    }

    this.isProcessing = false
  }
}

class LichessSyncService {
  private readonly BASE_URL = 'https://lichess.org/api'
  private readonly READY_KEY = 'lichess_study_ready'
  private readonly queue = new RequestQueue()

  /**
   * Checks if the user is authorized for study access.
   */
  async ensureToken(): Promise<boolean> {
    const isReady = sessionStorage.getItem(this.READY_KEY)
    if (isReady === 'true') {
      return true
    }

    try {
      // Just ping to see if ready
      const data = await apiClient<{ study_ready: boolean }>('/auth/lichess/study-token')
      if (data && data.study_ready) {
        sessionStorage.setItem(this.READY_KEY, 'true')
        return true
      }
    } catch (error) {
      logger.error('[LichessSyncService] Failed to check study token readiness:', error)
    }

    return false
  }

  private async getDecodedToken(): Promise<string> {
    const isReady = sessionStorage.getItem(this.READY_KEY)
    if (isReady !== 'true') {
      throw new Error('Lichess study token is missing. Please ensureToken() first.')
    }

    try {
      const data = await apiClient<{ token: string | null; study_ready: boolean }>(
        '/auth/lichess/study-token',
      )
      if (!data || !data.token) {
        sessionStorage.removeItem(this.READY_KEY)
        throw new Error('No encoded token received.')
      }

      const keyData = await apiClient<{ key: string | null }>('/auth/lichess/master-key')
      if (!keyData || !keyData.key) {
        throw new Error('No master key received.')
      }

      const tokenStr = data.token
      const keyStr = keyData.key

      const encBytes = Uint8Array.from(atob(tokenStr!), (c) => c.charCodeAt(0))
      const keyBytes = Uint8Array.from(atob(keyStr!), (c) => c.charCodeAt(0))
      const result = new Uint8Array(encBytes.length)

      for (let i = 0; i < encBytes.length; i++) {
        result[i] = (encBytes[i] as number) ^ (keyBytes[i % keyBytes.length] as number)
      }

      return new TextDecoder().decode(result)
    } catch (error) {
      logger.error('[LichessSyncService] Failed to fetch or decode token:', error)
      throw error
    }
  }

  private async getHeaders(tokenOverride?: string): Promise<Record<string, string>> {
    const token = tokenOverride || (await this.getDecodedToken())
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    }
  }

  async fetchCommunityStudyInfo(): Promise<{ token: string; lichessId: string }> {
    return await apiClient<{ token: string; lichessId: string }>('/auth/lichess/community-study-r')
  }

  async fetchUserStudies(
    username: string,
    tokenOverride?: string,
  ): Promise<{ id: string; name: string; updatedAt: number }[]> {
    return this.queue.enqueue(async () => {
      try {
        const headers = await this.getHeaders(tokenOverride)
        const response = await fetch(`${this.BASE_URL}/study/by/${username}`, {
          method: 'GET',
          headers: {
            ...headers,
            Accept: 'application/x-ndjson',
          },
        })

        if (!response.ok) {
          throw new LichessApiError(response.status, `Failed to fetch studies for ${username}`)
        }

        const text = await response.text()
        const lines = text.split('\n').filter((line) => line.trim().length > 0)

        const studies: { id: string; name: string; updatedAt: number }[] = []
        for (const line of lines) {
          try {
            const study = JSON.parse(line)
            studies.push({
              id: study.id,
              name: study.name,
              updatedAt: study.updatedAt,
            })
          } catch {
            // Ignore parse errors on corrupted lines
          }
        }
        return studies
      } catch (error) {
        logger.error(`[LichessSyncService] Error fetching user studies for ${username}:`, error)
        throw error
      }
    })
  }

  async importPgnIntoStudy(studyId: string, request: LichessImportPgnRequest): Promise<string> {
    return this.queue.enqueue(async () => {
      try {
        const body = new URLSearchParams()
        body.append('pgn', request.pgn)
        if (request.name) body.append('name', request.name)
        if (request.orientation) body.append('orientation', request.orientation)
        if (request.variant) body.append('variant', request.variant)

        const headers = await this.getHeaders()
        const response = await fetch(`${this.BASE_URL}/study/${studyId}/import-pgn`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new LichessApiError(
            response.status,
            error.error || `Failed to import PGN: ${response.statusText}`,
          )
        }

        const data = await response.json()
        if (data.chapters && data.chapters.length > 0) {
          return data.chapters[0].id // Return the new chapter ID
        }
        throw new Error('No chapter was created from the PGN import.')
      } catch (error) {
        logger.error(`[LichessSyncService] Error importing PGN to study ${studyId}:`, error)
        throw error
      }
    })
  }

  async deleteChapter(studyId: string, chapterId: string): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const headers = await this.getHeaders()
        const response = await fetch(`${this.BASE_URL}/study/${studyId}/${chapterId}`, {
          method: 'DELETE',
          headers: headers,
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new LichessApiError(
            response.status,
            error.error || `Failed to delete chapter: ${response.statusText}`,
          )
        }
      } catch (error) {
        logger.error(`[LichessSyncService] Error deleting chapter ${chapterId}:`, error)
        throw error
      }
    })
  }

  async updateChapterTags(studyId: string, chapterId: string, pgn: string): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const body = new URLSearchParams()
        body.append('pgn', pgn)

        const headers = await this.getHeaders()
        const response = await fetch(`${this.BASE_URL}/study/${studyId}/${chapterId}/tags`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new LichessApiError(
            response.status,
            error.error || `Failed to update tags: ${response.statusText}`,
          )
        }
      } catch (error) {
        logger.error(
          `[LichessSyncService] Error updating tags for study ${studyId} chapter ${chapterId}:`,
          error,
        )
        throw error
      }
    })
  }

  async updateChapterMoves(studyId: string, chapterId: string, pgn: string): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const body = new URLSearchParams()
        body.append('pgn', pgn)

        const headers = await this.getHeaders()
        const response = await fetch(`${this.BASE_URL}/study/${studyId}/${chapterId}/moves`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new LichessApiError(
            response.status,
            error.error || `Failed to update moves: ${response.statusText}`,
          )
        }
      } catch (error) {
        logger.error(
          `[LichessSyncService] Error updating moves for study ${studyId} chapter ${chapterId}:`,
          error,
        )
        throw error
      }
    })
  }

  async fetchStudyPgn(studyId: string, tokenOverride?: string): Promise<string> {
    return this.queue.enqueue(async () => {
      if (!/^[a-zA-Z0-9]{8}$/.test(studyId)) {
        throw new Error(`Invalid Lichess Study ID: ${studyId}. Expected 8 alphanumeric characters.`)
      }
      try {
        // Now using token to fetch PGN since we enforce ownership
        const token = tokenOverride || (await this.getDecodedToken())
        const headers: Record<string, string> = {
          Accept: 'application/x-chess-pgn',
          Authorization: `Bearer ${token}`,
        }

        const response = await fetch(
          `${this.BASE_URL}/study/${studyId}.pgn?orientation=true&clocks=false&t=${Date.now()}`,
          {
            headers,
          },
        )

        if (!response.ok) {
          // Attempt to parse JSON error even if content-type isn't explicitly JSON
          const error = await response.json().catch(() => ({}))
          throw new LichessApiError(
            response.status,
            error.error || `Failed to fetch study PGN. (${response.statusText})`,
          )
        }

        return await response.text()
      } catch (error) {
        logger.error(`[LichessSyncService] Error fetching study ${studyId}:`, error)
        throw error
      }
    })
  }
}

export const lichessSyncService = new LichessSyncService()
