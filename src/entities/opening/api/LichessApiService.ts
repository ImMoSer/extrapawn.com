// src/services/LichessApiService.ts
import logger from '@/shared/lib/logger'

export interface LichessMove {
  uci: string
  san: string
  total: number
  win_p: number
  draw_p: number
  loss_p: number
  averageRating: number
  w_trap?: number
  b_trap?: number
  nag?: number
}

export interface LichessOpeningResponse {
  summary: {
    total: number
    win_p: number
    draw_p: number
    loss_p: number
    avgElo?: number
  } | null
  moves: LichessMove[]
  opening?: {
    eco: string
    name: string
  }
}

export interface LichessParams {
  ratingRange: '1000-1499' | '1500-1799' | '1800-2200'
}

class LichessApiService {
  private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000/api'

  async fetchStats(
    cleanFen: string,
    params?: LichessParams,
  ): Promise<LichessOpeningResponse | null> {
    try {
      const ratingRange = params?.ratingRange || '1000-1499'

      const queryParams = new URLSearchParams({
        fen: cleanFen,
        rating_range: ratingRange,
      })
      const response = await fetch(`${this.BACKEND_URL}/opening/player?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) throw new Error(`Player API Error: ${response.statusText}`)

      const data: LichessOpeningResponse = await response.json()
      return data
    } catch (error) {
      logger.error(`[LichessApiService] Error:`, error)
      return null
    }
  }
}

export const lichessApiService = new LichessApiService()
