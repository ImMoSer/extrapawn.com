// src/entities/game/lib/EnginePlayService.ts
import { leelaOnnxEngine } from '@/shared/lib/engine/leelaOnnx/workerInterface'
import { LEELA_ONNX_NETWORKS } from '@/shared/lib/engine/leelaOnnx/networks'
import type { LeelaOnnxNetworkInfo } from '@/shared/lib/engine/leelaOnnx/types'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'
import { Chess } from 'chess.js'

class EnginePlayServiceController {
  private activeEngineId: EngineId | null = null

  constructor() {
    logger.info('[EnginePlayService] Initialized with 100% local ONNX bot engines.')
    // Pre-load saved or default ONNX model asynchronously on startup
    const savedEngine = this.getSavedEngineId()
    this.ensureReady(savedEngine).catch((err) => {
      logger.warn(`[EnginePlayService] Background pre-loading of ${savedEngine} failed:`, err)
    })
  }

  private getSavedEngineId(): EngineId {
    try {
      const saved = localStorage.getItem('user_selected_engine')
      if (saved && LEELA_ONNX_NETWORKS.some((net) => net.id === saved)) {
        return saved as EngineId
      }
    } catch {
      // Fallback to default
    }
    return 'maia-2200'
  }

  /**
   * Pre-load & initialize the requested ONNX bot network, returning a Promise that resolves when ready.
   */
  public async ensureReady(engineId: EngineId): Promise<void> {
    const netInfo: LeelaOnnxNetworkInfo | undefined = LEELA_ONNX_NETWORKS.find(
      (net) => net.id === engineId,
    )

    if (!netInfo) {
      const errMsg = `[EnginePlayService] Fail-Fast: Unknown or unsupported engineId "${engineId}".`
      logger.error(errMsg)
      throw new Error(errMsg)
    }

    if (this.activeEngineId !== engineId || !leelaOnnxEngine.getState().isReady) {
      logger.info(
        `[EnginePlayService] Pre-loading local ONNX bot network: ${netInfo.name} (${netInfo.id})`,
      )
      this.activeEngineId = engineId
      await leelaOnnxEngine.init(netInfo)
      logger.info(`[EnginePlayService] Local ONNX bot network ready: ${netInfo.name}`)
    }
  }

  /**
   * Compute legal UCI moves for a position using chess.js.
   */
  private computeLegalMoves(fen: string): string[] {
    try {
      const chess = new Chess(fen)
      return chess.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ''))
    } catch (err) {
      logger.error(`[EnginePlayService] Failed to generate legal moves for FEN: ${fen}`, err)
      return []
    }
  }

  /**
   * Generates the best move for the given engineId and position FEN using local ONNX neural network inference.
   *
   * @throws {Error} Fail-Fast principle: throws immediately if engineId is invalid or network fails.
   */
  public async getBestMove(
    engineId: EngineId,
    fen: string,
    historyFens: string[] = [],
    providedLegalMoves?: string[],
  ): Promise<string | null> {
    // Ensure the model is loaded and ready before requesting a move
    await this.ensureReady(engineId)

    const legalMoves = providedLegalMoves ?? this.computeLegalMoves(fen)
    if (legalMoves.length === 0) {
      logger.warn(`[EnginePlayService] No legal moves available for FEN: ${fen}`)
      return null
    }

    const history = historyFens.length > 0 ? historyFens : [fen]

    try {
      const result = await leelaOnnxEngine.getBestMove(fen, history, legalMoves, 0)
      if (!result || !result.move) {
        throw new Error(
          `[EnginePlayService] Local ONNX engine returned empty move for FEN: ${fen}`,
        )
      }
      logger.info(
        `[EnginePlayService] Local ONNX move for ${engineId}: ${result.move} (confidence: ${(result.confidence * 100).toFixed(1)}%)`,
      )
      return result.move
    } catch (error) {
      logger.error(
        `[EnginePlayService] Fail-Fast: Local ONNX engine failed for ${engineId}:`,
        error,
      )
      throw error
    }
  }
}

export const enginePlayService = new EnginePlayServiceController()
