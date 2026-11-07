// src/entities/game/lib/EnginePlayService.ts
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { EngineId } from '@/shared/types/api.types'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'

class EnginePlayServiceController {
  /**
   * Generates the best move for the given engineId and position FEN via backend API (POST /api/bestmove).
   * Sends start_fen and move history from pgnService for native threefold repetition protection.
   *
   * @throws {Error} Fail-Fast principle: throws immediately if FEN is invalid, PGN is out of sync, or network fails.
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

    const chessPos = parsedPos.unwrap()
    const outcome = chessPos.outcome()
    if (outcome) {
      logger.info(
        `[EnginePlayService] Skipping move fetch: position is terminal (winner: ${outcome.winner}).`,
      )
      return null
    }

    const normalizedFen = makeFen(chessPos.toSetup())
    const navigatedFen = pgnService.getCurrentNavigatedFen()
    if (navigatedFen !== normalizedFen) {
      throw new Error(
        `[EnginePlayService] PGN state desynchronized from requested FEN: expected "${normalizedFen}", got "${navigatedFen}". Fail-Fast!`,
      )
    }

    const { startFen, moves } = pgnService.getAnalysisPayloadContext()
    const retryDelaysMs = [250, 600]
    let lastError: unknown = null

    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
      try {
        logger.info(
          `[EnginePlayService] Requesting move from Engine Hub for ${engineId} (moves: ${moves.length})...`,
        )
        const data = await apiClient<{ bestMove?: string | null }>('/bestmove', {
          method: 'POST',
          body: JSON.stringify({
            engine: engineId,
            start_fen: startFen,
            moves,
          }),
        })
        if (!data || !data.bestMove) {
          logger.warn(`[EnginePlayService] Engine Hub returned empty bestMove for FEN: ${fen}`)
          return null
        }

        logger.info(`[EnginePlayService] Move received for ${engineId}: ${data.bestMove}`)
        return data.bestMove
      } catch (error) {
        lastError = error
        if (attempt >= retryDelaysMs.length) {
          logger.error(`[EnginePlayService] Fail-Fast: Failed to fetch move for ${engineId}:`, error)
          throw error
        }
        const waitMs = retryDelaysMs[attempt] ?? 250
        logger.warn(
          `[EnginePlayService] Transient error fetching move for ${engineId} (attempt ${attempt + 1}). Retrying in ${waitMs}ms...`,
          error,
        )
        await new Promise((resolve) => setTimeout(resolve, waitMs))
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Failed to fetch best move')
  }
}

export const enginePlayService = new EnginePlayServiceController()
