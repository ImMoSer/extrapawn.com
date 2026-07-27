// src/entities/game/lib/EnginePlayService.ts
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'

const BACKEND_API_URL = (import.meta.env.VITE_BACKEND_API_URL as string) || 'http://localhost:3000/api'

class EnginePlayServiceController {
  constructor() {
    logger.info(`[EnginePlayService] Initialized with Maia Engine Hub API service (Backend: ${BACKEND_API_URL}).`)
  }

  /**
   * Compatibility helper for pre-loading engine.
   */
  public async ensureReady(engineId: EngineId): Promise<void> {
    logger.debug(`[EnginePlayService] Engine ready: ${engineId}`)
  }

  /**
   * Generates the best move for the given engineId and position FEN via Fastify backend API (/api/bestmove).
   *
   * @throws {Error} Fail-Fast principle: throws immediately if engineId is invalid or network fails.
   */
  public async getBestMove(
    engineId: EngineId,
    fen: string,
    _historyFens: string[] = [],
    _providedLegalMoves?: string[],
  ): Promise<string | null> {
    const url = `${BACKEND_API_URL}/bestmove?engine=${encodeURIComponent(engineId)}&fen=${encodeURIComponent(fen)}`

    try {
      logger.info(`[EnginePlayService] Requesting move from Maia Hub via Fastify for ${engineId}...`)
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`[EnginePlayService] Server HTTP ${response.status}: ${errorText}`)
      }

      const data = (await response.json()) as { bestMove?: string }
      if (!data || !data.bestMove) {
        logger.warn(`[EnginePlayService] Engine Hub returned empty bestMove for FEN: ${fen}`)
        return null
      }

      logger.info(`[EnginePlayService] Move received for ${engineId}: ${data.bestMove}`)
      return data.bestMove
    } catch (error) {
      logger.error(`[EnginePlayService] Fail-Fast: Failed to fetch move for ${engineId}:`, error)
      throw error
    }
  }
}

export const enginePlayService = new EnginePlayServiceController()
