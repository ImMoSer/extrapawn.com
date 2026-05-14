// src/services/GameplayService.ts
import { serverEngineService } from '@/shared/lib/engine'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'

type EngineType = 'local' | 'server'

interface EngineConfig {
  type: EngineType
  // Для локального движка
  depth?: number
  // Для серверного движка
  model?: string
  fallback?: boolean // Используем ли локальный движок как фолбэк
}

// --- НОВАЯ КОНФИГУРАЦИЯ ДВИЖКОВ ---
export const engineConfigs: Record<EngineId, EngineConfig> = {
  SF_2200: { type: 'local', depth: 15 },
  'maia-1900': { type: 'server', model: 'maia-1900', fallback: true },
  'maia-2200': { type: 'server', model: 'maia-2200', fallback: true },
  'maia-2400': { type: 'server', model: 'maia-2400', fallback: true },
}

class GameplayServiceController {
  constructor() {
    logger.info('[GameplayService] Initialized with new local engine configurations.')
    // Asynchronously pre-load the engine in the background to avoid delay during first fallback
    coachEngineManager.ensureReady().catch((err) => {
      logger.warn('[GameplayService] Early engine pre-loading failed.', err)
    })
  }

  public async getBestMove(engineId: EngineId, fen: string): Promise<string | null> {
    const config = engineConfigs[engineId]
    if (!config) {
      logger.error(`[GameplayService] Unknown engineId: ${engineId}.`)
      return null
    }

    // --- ЛОГИКА ДЛЯ ЛОКАЛЬНЫХ ДВИЖКОВ ---
    if (config.type === 'local' && config.depth !== undefined) {
      logger.info(`[GameplayService] Using local engine for ${engineId} with depth ${config.depth}`)
      try {
        await coachEngineManager.ensureReady()
        return await coachEngineManager.getBestMoveOnly(fen, { depth: config.depth })
      } catch (error) {
        logger.error(`[GameplayService] Local engine failed for ${engineId}:`, error)
        return null // В случае ошибки локального движка, ход не будет сделан
      }
    }

    // --- ЛОГИКА ДЛЯ СЕРВЕРНОГО ДВИЖКА ---
    if (config.type === 'server' && config.model) {
      logger.info(`[GameplayService] Using server engine ${engineId} (model: ${config.model})`)
      return this.getMoveWithFallback(fen, config.model)
    }

    logger.error(`[GameplayService] Invalid configuration for engineId: ${engineId}`)
    return null
  }

  private async getMoveWithFallback(fen: string, modelId: string): Promise<string | null> {
    const HEDGE_DELAY_MS = 250
    const HARD_TIMEOUT_MS = 750

    const controllerA = new AbortController()
    const controllerB = new AbortController()
    let timerB: number | null = null
    let hardTimeout: number | null = null

    try {
      const startTime = performance.now()

      // Request A
      const promiseA = serverEngineService
        .getMoveFromServer(fen, modelId, controllerA.signal)
        .then((res) => ({ source: 'A', result: res }))
        .catch((err) => {
          if (err.name === 'AbortError') throw err
          logger.warn(`[GameplayService] Request A failed:`, err)
          throw err
        })

      // Request B (delayed)
      const promiseB = new Promise<{ source: string; result: string | null }>((resolve, reject) => {
        timerB = window.setTimeout(() => {
          logger.info(
            `[GameplayService] Request A takes >${HEDGE_DELAY_MS}ms. Firing Hedged Request B.`,
          )
          serverEngineService
            .getMoveFromServer(fen, modelId, controllerB.signal)
            .then((res) => resolve({ source: 'B', result: res }))
            .catch((err) => reject(err))
        }, HEDGE_DELAY_MS)
      })

      // Hard Timeout
      const timeoutPromise = new Promise<{ source: string; result: null }>((_, reject) => {
        hardTimeout = window.setTimeout(() => {
          reject(new Error('HARD_TIMEOUT'))
        }, HARD_TIMEOUT_MS)
      })

      const winner = await Promise.race([
        new Promise<{ source: string; result: string | null }>((resolve, reject) => {
          let errors = 0
          promiseA.then(resolve).catch(() => {
            errors++
            if (errors === 2) reject(new Error('All promises were rejected'))
          })
          promiseB.then(resolve).catch(() => {
            errors++
            if (errors === 2) reject(new Error('All promises were rejected'))
          })
        }),
        timeoutPromise,
      ])

      const elapsed = Math.round(performance.now() - startTime)
      logger.info(
        `[GameplayService] Server engine responded via Request ${winner.source} in ${elapsed}ms.`,
      )

      if (timerB) clearTimeout(timerB)
      if (hardTimeout) clearTimeout(hardTimeout)

      if (winner.source === 'A') controllerB.abort()
      if (winner.source === 'B') controllerA.abort()

      return winner.result
    } catch (error: unknown) {
      if (timerB) clearTimeout(timerB)
      if (hardTimeout) clearTimeout(hardTimeout)
      controllerA.abort()
      controllerB.abort()

      const errMsg = error instanceof Error ? error.message : String(error)
      if (errMsg === 'HARD_TIMEOUT') {
        logger.warn(
          `[GameplayService] Server engine hard timeout after ${HARD_TIMEOUT_MS}ms. Falling back.`,
        )
      } else {
        logger.error(`[GameplayService] Both hedged requests failed. Falling back. Error:`, error)
      }

      await coachEngineManager.ensureReady()
      return coachEngineManager.getBestMoveOnly(fen, { depth: 8 })
    }
  }
}

export const gameplayService = new GameplayServiceController()
