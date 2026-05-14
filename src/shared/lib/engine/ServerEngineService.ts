// src/services/ServerEngineService.ts
import logger from '@/shared/lib/logger'

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL as string
const SERVER_ENGINE_ENDPOINT = `${BACKEND_API_URL}/bestmove`

export interface EvalLine {
  move_uci: string
  move_san?: string
  cp?: number
  win_prob?: number
  depth: number
}

export interface AnalysisResponse {
  quality: {
    nag: string
    chaos_index: number
    is_bestmove: boolean
    was_forced: boolean
    only_move: boolean
    is_trivial: boolean
    trivial_move_uci?: string
    trivial_move_san?: string
    is_sacrifice: boolean
    delta_wp: number
    delta_cp: number
  }
  eval_before: EvalLine[]
  eval_after: EvalLine[]
  fen_before: string
  move_uci: string
  move_san?: string
  next_move_could_be_brilliant: boolean
  next_move_is_only: boolean
}

export class ServerEngineServiceController {
  private isThinking = false

  constructor() {
    logger.info(
      `[ServerEngineService] Initialized to work with Backend at: ${SERVER_ENGINE_ENDPOINT}`,
    )
  }

  public async getMoveFromServer(
    fen: string,
    engine: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (this.isThinking) {
      logger.warn(
        '[ServerEngineService] getMoveFromServer called while already thinking. Request rejected.',
      )
      return Promise.reject(new Error('ServerEngineService is already processing a request.'))
    }

    this.isThinking = true
    logger.info(`[ServerEngineService] Requesting move for FEN: ${fen} using engine: ${engine}`)
    const startTime = performance.now()

    try {
      const internalController = new AbortController()
      const timeoutId = setTimeout(() => internalController.abort(), 10000)

      const params = new URLSearchParams({
        fen: fen,
        engine: engine,
      })
      const url = `${SERVER_ENGINE_ENDPOINT}?${params.toString()}`

      // Combine signals if both exist
      const combinedSignal = signal
        ? (AbortSignal as unknown as { any: (signals: AbortSignal[]) => AbortSignal }).any([
            internalController.signal,
            signal,
          ])
        : internalController.signal

      const response = await fetch(url, {
        method: 'GET',
        signal: combinedSignal,
        credentials: 'include',
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server engine returned an error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      const bestMove = data.bestMove || null

      logger.info(`[ServerEngineService] Received best move: ${bestMove}`)
      return bestMove
    } catch (error: unknown) {
      const elapsed = Math.round(performance.now() - startTime)
      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn(`[ServerEngineService] Request aborted after ${elapsed}ms.`)
      } else {
        logger.error(
          `[ServerEngineService] Failed to fetch move from server after ${elapsed}ms:`,
          error,
        )
      }
      throw error
    } finally {
      this.isThinking = false
    }
  }

  public async analyzeMove(
    fen_before: string,
    move_uci: string,
    pgn: string,
    eval_before?: EvalLine[],
  ): Promise<AnalysisResponse> {
    const url = `${BACKEND_API_URL}/engine-eval/analyze`
    logger.debug(`[ServerEngineService] Requesting analysis for move: ${move_uci}`)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fen_before,
          move_uci,
          pgn,
          eval_before,
        }),
        credentials: 'include',
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Analysis service returned an error: ${response.status} - ${errorText}`)
      }

      return (await response.json()) as AnalysisResponse
    } catch (error) {
      logger.error('[ServerEngineService] Failed to fetch analysis from server:', error)
      throw error
    }
  }

  public terminate(): void {
    logger.info('[ServerEngineService] Terminate called (no-op for server implementation).')
  }
}

export const serverEngineService = new ServerEngineServiceController()
