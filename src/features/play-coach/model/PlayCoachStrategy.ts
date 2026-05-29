import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService } from '@/entities/game'
import { theoryRepository } from '@/entities/opening'
import { useOpeningExplorerStore } from '@/features/opening-explorer'
import logger from '@/shared/lib/logger'

export class PlayCoachStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 100,
    playGameStatusSounds: true,
  }

  private readonly ENGINE_ID: import('@/shared/types/api.types').EngineId = 'maia-2200'
  private isBookExhausted = false

  onGameStart() {
    logger.info('[PlayCoachStrategy] Game started')
  }

  onDestroy() {
    logger.info('[PlayCoachStrategy] Strategy destroyed')
  }

  async requestBotMove(fen: string): Promise<string | null> {
    const explorerStore = useOpeningExplorerStore()

    // 1. Try Lichess Book directly from Repository (bypass UI store delay/debounce)
    if (!this.isBookExhausted) {
      try {
        const stats = await theoryRepository.getLichessStats(
          fen,
          { ratingRange: explorerStore.ratingRange },
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

              logger.info(`[PlayCoachStrategy] Book move selected: ${selectedUci} (from ${totalPlays} games)`)
              return selectedUci
            }
          }
        } else if (stats) {
          logger.info('[PlayCoachStrategy] Book stats returned empty. Marking book as exhausted.')
          this.isBookExhausted = true
        }
      } catch (err) {
        logger.error('[PlayCoachStrategy] Failed to fetch book stats:', err)
      }
    }

    // 2. Fallback to Engine (Maia)
    logger.info(`[PlayCoachStrategy] Book empty or failed. Using engine: ${this.ENGINE_ID}`)

    try {
      const moveUci = await enginePlayService.getBestMove(this.ENGINE_ID, fen)
      return moveUci
    } catch (err) {
      logger.error('[PlayCoachStrategy] Engine move failed:', err)
      return null
    }
  }

  onUserMoveUndone() {
    logger.info('[PlayCoachStrategy] Move undone')
  }

  forcePlayoutMode() {
    // Already in playout mode (against engine)
  }

  onGameOver(status: import('@/entities/game').GameStatusInfo) {
    logger.info('[PlayCoachStrategy] Game over:', status)
  }

  checkWinCondition(status: import('@/entities/game').GameStatusInfo): boolean {
    // Default chess rules
    return status.isGameOver
  }
}
