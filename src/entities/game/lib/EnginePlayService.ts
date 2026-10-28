// src/entities/game/lib/EnginePlayService.ts
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'
import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'

class EnginePlayServiceController {
  /**
   * Generates the best move for the given engineId and position FEN via Fastify backend API (/api/bestmove).
   *
   * @throws {Error} Fail-Fast principle: throws immediately if FEN is invalid, engineId is invalid, or network fails.
   */
  public async getBestMove(engineId: EngineId, fen: string): Promise<string | null> {
    const parsedSetup = parseFen(fen)
    if (parsedSetup.isErr) {
      throw new Error(`[EnginePlayService] Invalid FEN provided: "${fen}". Fail-Fast!`)
    }
    const parsedPos = Chess.fromSetup(parsedSetup.unwrap())
    if (parsedPos.isErr) {
      throw new Error(`[EnginePlayService] Invalid chess position from FEN: "${fen}". Fail-Fast!`)
    }

    const outcome = parsedPos.unwrap().outcome()
    if (outcome) {
      logger.info(
        `[EnginePlayService] Skipping move fetch: position is terminal (winner: ${outcome.winner}).`,
      )
      return null
    }

    const endpoint = `/bestmove?engine=${encodeURIComponent(engineId)}&fen=${encodeURIComponent(fen)}`

    try {
      logger.info(`[EnginePlayService] Requesting move from Maia Hub via Fastify for ${engineId}...`)
      const data = await apiClient<{ bestMove?: string }>(endpoint)
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
