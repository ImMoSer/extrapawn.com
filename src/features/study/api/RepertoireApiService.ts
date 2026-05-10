// src/services/RepertoireApiService.ts
import logger from '@/shared/lib/logger'
import { apiClient } from '@/shared/api/client'

export type RepertoireStyle = 'grossmaster' | 'hustler' | 'schuler'
export type OpponentData = 'MASTERS' | 'PL1000' | 'PL1500' | 'PL1800'

export interface RepertoireRequest {
  start_pgn: string
  color: 'white' | 'black'
  style: RepertoireStyle
  min_games: number
  opponent_coverage: number
  max_depth: number
  opponent_data: OpponentData
}

class RepertoireApiService {
  async generateRepertoire(request: RepertoireRequest): Promise<string | null> {
    try {
      logger.info(`[RepertoireApiService] Ordering ${request.style} repertoire:`, request)

      const data = await apiClient<{ pgn: string }>('/opening/repertoire', {
        method: 'POST',
        body: JSON.stringify(request),
      })

      return data.pgn
    } catch (error) {
      logger.error(`[RepertoireApiService] Error generating repertoire:`, error)
      throw error // Let the component handle the error message
    }
  }

  async checkHealth() {
    try {
      return await apiClient('/health')
    } catch (error) {
      return { status: 'error', error }
    }
  }
}

export const repertoireApiService = new RepertoireApiService()
