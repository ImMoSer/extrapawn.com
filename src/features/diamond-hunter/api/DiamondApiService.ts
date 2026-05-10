import { theoryRepository } from '@/entities/opening'
import logger from '@/shared/lib/logger'
import { apiClient } from '@/shared/api/client'

export interface GravityMove {
  uci: string
  san: string
  weight: number
  rating: number
  dist: number
  nag: number
  nag_str: string
}

export interface GravityResponse {
  moves: GravityMove[]
}

class DiamondApiService {
  private toCleanFen(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ')
  }

  async getWhiteGravity(fen: string): Promise<GravityResponse | null> {
    return this.fetchGravity('white', fen)
  }

  async getBlackGravity(fen: string): Promise<GravityResponse | null> {
    return this.fetchGravity('black', fen)
  }

  private async fetchGravity(
    color: 'white' | 'black',
    fen: string,
  ): Promise<GravityResponse | null> {
    const cleanFen = this.toCleanFen(fen)
    const cacheKey = `gravity:${color}:${cleanFen}`

    const cached = await theoryRepository.getCachedStats<GravityResponse>(
      cacheKey,
      'diamondGravity',
    )
    if (cached) {
      return cached
    }

    try {
      const params = new URLSearchParams({ fen: cleanFen })
      const data = await apiClient<GravityResponse>(`/diamond/${color}?${params.toString()}`, {
        method: 'GET',
      })

      // 2. Save to Cache
      await theoryRepository.cacheStats(cacheKey, [], data, 'diamondGravity')

      return data
    } catch (error) {
      logger.error(`[DiamondApiService] Error fetching ${color} gravity:`, error)
      return null
    }
  }

  async startSession(): Promise<{ status: string } | null> {
    try {
      return await apiClient<{ status: string }>('/diamond/start', {
        method: 'POST',
      })
    } catch (error) {
      logger.error(`[DiamondApiService] Error starting session:`, error)
      throw error
    }
  }
}

export const diamondApiService = new DiamondApiService()
