import { buildFullExplanation } from '@/shared/lib/engine/coach/full-explanation'
import engine, { setEngineDefaults } from '@/shared/lib/engine/coach/engine'
import { ensureReady as ensureWasmReady } from '@/shared/lib/engine/coach/analyzer-rs'
import logger from '@/shared/lib/logger'
import type { CoachExplanation } from './coach.types'

export class CoachEngineManager {
  private isInitializing = false
  private initPromise: Promise<void> | null = null
  private explanationCache = new Map<string, Promise<CoachExplanation | null>>()

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
  public async getExplanation(
    fen: string,
    options?: { depth?: number; multipv?: number },
  ): Promise<CoachExplanation | null> {
    const key = `${fen}_d${options?.depth ?? ''}_m${options?.multipv ?? ''}`
    const cached = this.explanationCache.get(key)
    if (cached) {
      logger.info(`[CoachEngineManager] Explanation cache hit for key: ${key}`)
      return cached
    }

    const promise = (async (): Promise<CoachExplanation | null> => {
      await this.ensureReady()
      try {
        const explanation = (await buildFullExplanation(fen, options)) as CoachExplanation | null
        return explanation
      } catch (error) {
        logger.error('[CoachEngineManager] Failed to build full explanation:', error)
        this.explanationCache.delete(key)
        return null
      }
    })()

    this.explanationCache.set(key, promise)

    // Limit cache size to 50 entries
    if (this.explanationCache.size > 50) {
      const firstKey = this.explanationCache.keys().next().value
      if (firstKey) {
        this.explanationCache.delete(firstKey)
      }
    }

    return promise
  }

  /**
   * Backward compatibility / fallback for EnginePlayService.
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
  public setDefaults(options: { depth?: number; multipv?: number; threads?: number }) {
    setEngineDefaults(options)
  }

  /**
   * Stop analysis/evaluation (if running)
   */
  public stop() {
    try {
      engine._send('stop') // Internal method access to force stop
    } catch {
      // Ignore
    }
  }

  public terminate() {
    try {
      engine.shutdown()
      this.initPromise = null
    } catch {
      // Ignore
    }
  }
}

export const coachEngineManager = new CoachEngineManager()
