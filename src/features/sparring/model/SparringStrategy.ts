import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService, useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { theoryRepository } from '@/entities/opening'
import logger from '@/shared/lib/logger'
import { usePreferencesStore } from '@/features/settings'

export class SparringStrategy implements IGameplayStrategy {
  readonly strategyId = 'sparring'

  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: true,
    }
  }

  private readonly ENGINE_ID: import('@/shared/types/api.types').EngineId = 'maia-2200'
  private isBookExhausted = false
  private restartTimeout: number | null = null

  onGameStart() {
    logger.info('[SparringStrategy] Game started')
  }

  onDestroy() {
    logger.info('[SparringStrategy] Strategy destroyed')
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout)
      this.restartTimeout = null
    }
  }

  async requestBotMove(fen: string): Promise<string | null> {
    try {
      const { useCoachFeedbackStore } = await import('@/features/coach')
      const feedbackStore = useCoachFeedbackStore()
      if (feedbackStore.isTakebackPending) {
        logger.info('[SparringStrategy] requestBotMove returned null due to pending coach takeback.')
        return null
      }
    } catch (err) {
      logger.error('[SparringStrategy] Failed to import coach feedback store:', err)
    }

    // 0. Check for pending n8n new_game response
    try {
      const { useSparringStore } = await import('./sparring.store')
      const sparringStore = useSparringStore()
      if (sparringStore.pendingNewGamePromise) {
        const response = await sparringStore.pendingNewGamePromise
        sparringStore.pendingNewGamePromise = null
        if (response && response.bot_move) {
          logger.info(`[SparringStrategy] Using bot move from n8n new_game response: ${response.bot_move}`)
          return response.bot_move
        }
      }
    } catch (err) {
      logger.error('[SparringStrategy] Failed to check n8n pending new_game response:', err)
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
      const { waitForCoachAndCheckTakeback } = await import('@/features/coach')
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

    const preferencesStore = usePreferencesStore()
    const isCrashtest = preferencesStore.preferences.gameplay.global_crashtest
    const isDemoplay = preferencesStore.isDemoplayEnabled
    const authStore = useAuthStore()
    const profile = authStore.userProfile
    const isMo3ep = profile && (profile.id === 'mo3ep' || profile.username === 'MO3EP')

    if ((isCrashtest || isDemoplay) && isMo3ep) {
      const delay = isCrashtest
        ? preferencesStore.preferences.delays.crashtestDelayMs
        : preferencesStore.preferences.delays.demoStayBeforNextMs

      logger.info(`[SparringStrategy] Auto-restart triggered (isCrashtest=${isCrashtest}, isDemoplay=${isDemoplay}). Restarting in ${delay}ms.`)

      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout)
      }

      this.restartTimeout = window.setTimeout(() => {
        const boardStore = useBoardStore()
        const gameStore = useGameStore()
        const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        gameStore.startWithStrategy(
          initialFen,
          new SparringStrategy(),
          boardStore.orientation,
          false
        )
      }, delay)
    }
  }

  checkWinCondition(status: import('@/entities/game').GameStatusInfo): boolean {
    // Default chess rules
    return status.isGameOver
  }
}
