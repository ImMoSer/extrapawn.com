import { buildFullExplanation } from '@/features/coach/lib/engine/full-explanation'
import engine, { setEngineDefaults } from '@/features/coach/lib/engine/engine'
import { ensureReady as ensureWasmReady } from '@/features/coach/lib/engine/analyzer-rs'
import logger from '@/shared/lib/logger'

export class CoachEngineManager {
  private isInitializing = false
  private initPromise: Promise<void> | null = null

  constructor() {
    logger.info('[CoachEngineManager] Created.')
  }

  public async ensureReady(): Promise<void> {
    if (this.initPromise) return this.initPromise

    this.isInitializing = true
    this.initPromise = (async () => {
      try {
        logger.info('[CoachEngineManager] Initializing Stockfish Worker...')
        await engine.init()

        logger.info('[CoachEngineManager] Initializing Rust WASM Analyzer...')
        await ensureWasmReady()

        logger.info('[CoachEngineManager] Both engines initialized successfully.')
      } catch (error) {
        logger.error('[CoachEngineManager] Initialization failed:', error)
        throw error
      } finally {
        this.isInitializing = false
      }
    })()

    return this.initPromise
  }

  /**
   * Generates a full explanation blob for the given FEN using the coach logic.
   */
  public async getExplanation(fen: string, options?: { depth?: number; multipv?: number }) {
    await this.ensureReady()
    try {
      const explanation = await buildFullExplanation(fen, options)
      return explanation
    } catch (error) {
      logger.error('[CoachEngineManager] Failed to build full explanation:', error)
      return null
    }
  }

  /**
   * Backward compatibility / fallback for GameplayService.
   */
  public async getBestMoveOnly(
    fen: string,
    options: { depth?: number } = {},
  ): Promise<string | null> {
    await this.ensureReady()
    try {
      const result = await engine.getBestMove(fen, options.depth)
      return result?.bestMove || null
    } catch (error) {
      logger.error('[CoachEngineManager] getBestMoveOnly failed:', error)
      return null
    }
  }

  /**
   * Update engine settings
   */
  public setDefaults(options: { depth?: number; multipv?: number }) {
    setEngineDefaults(options)
  }

  /**
   * Stop analysis/evaluation (if running)
   */
  public stop() {
    try {
      engine._send('stop') // Internal method access to force stop
    } catch (e) {
      // Ignore
    }
  }

  public terminate() {
    try {
      engine.shutdown()
      this.initPromise = null
    } catch (e) {
      // Ignore
    }
  }
}

export const coachEngineManager = new CoachEngineManager()
