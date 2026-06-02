import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService } from '@/entities/game'
import { theoryRepository } from '@/entities/opening'
import logger from '@/shared/lib/logger'
import { usePreferencesStore } from '@/features/settings'

export class SparringStrategy implements IGameplayStrategy {
  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: true,
    }
  }

  private readonly ENGINE_ID: import('@/shared/types/api.types').EngineId = 'maia-2200'
  private isBookExhausted = false

  onGameStart() {
    logger.info('[SparringStrategy] Game started')
  }

  onDestroy() {
    logger.info('[SparringStrategy] Strategy destroyed')
  }

  async requestBotMove(fen: string): Promise<string | null> {
    try {
      const { useCoachFeedbackStore } = await import('@/features/coach/model/coach-feedback.store')
      const feedbackStore = useCoachFeedbackStore()
      if (feedbackStore.isTakebackPending) {
        logger.info('[SparringStrategy] requestBotMove returned null due to pending coach takeback.')
        return null
      }
    } catch (err) {
      logger.error('[SparringStrategy] Failed to import coach feedback store:', err)
    }

    // 1. Try MozerBook directly from Repository (bypass UI store delay/debounce)
    if (!this.isBookExhausted) {
      try {
        const stats = await theoryRepository.getMozerBookStats(
          fen,
          { skipDebounce: true }
        )

        if (stats && stats.moves && stats.moves.length > 0) {
          // Only use book if there is a significant amount of games or it's early game
          // For now, follow the user's request: use theory moves from Lichess Players stats
          const topMoves = stats.moves.slice(0, 5)
          const firstMove = topMoves[0]

          if (firstMove) {
            const totalPlays = topMoves.reduce((sum, m) => sum + m.total, 0)

            if (totalPlays > 0) {
              let random = Math.random() * totalPlays
              let selectedUci = firstMove.uci

              for (const move of topMoves) {
                random -= move.total
                if (random <= 0) {
                  selectedUci = move.uci
                  break
                }
              }

              logger.info(`[SparringStrategy] Book move selected: ${selectedUci} (from ${totalPlays} games)`)
              return selectedUci
            }
          }
        } else if (stats) {
          logger.info('[SparringStrategy] Book stats returned empty. Marking book as exhausted.')
          this.isBookExhausted = true
        }
      } catch (err) {
        logger.error('[SparringStrategy] Failed to fetch book stats:', err)
      }
    }

    // 2. Fallback to Engine (Maia)
    logger.info(`[SparringStrategy] Book empty or failed. Using engine: ${this.ENGINE_ID}`)

    try {
      const moveUci = await enginePlayService.getBestMove(this.ENGINE_ID, fen)
      return moveUci
    } catch (err) {
      logger.error('[SparringStrategy] Engine move failed:', err)
      return null
    }
  }

  async onUserMoveExecuted() {
    try {
      const { waitForCoachAndCheckTakeback } = await import('@/features/coach/model/coach-gameplay')
      await waitForCoachAndCheckTakeback()
    } catch (err) {
      logger.error('[SparringStrategy] Error waiting for coach analysis:', err)
    }
  }

  onUserMoveUndone() {
    logger.info('[SparringStrategy] Move undone')
  }

  forcePlayoutMode() {
    // Already in playout mode (against engine)
  }

  onGameOver(status: import('@/entities/game').GameStatusInfo) {
    logger.info('[SparringStrategy] Game over:', status)
  }

  checkWinCondition(status: import('@/entities/game').GameStatusInfo): boolean {
    // Default chess rules
    return status.isGameOver
  }
}
