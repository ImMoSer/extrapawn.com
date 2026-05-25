import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService } from '@/entities/game'
import { useOpeningExplorerStore } from '@/features/opening-explorer'
import logger from '@/shared/lib/logger'

export class PlayCoachStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 100,
    playGameStatusSounds: true,
  }

  private readonly ENGINE_ID = 'maia-2400'

  onGameStart() {
    logger.info('[PlayCoachStrategy] Game started')
  }

  onDestroy() {
    logger.info('[PlayCoachStrategy] Strategy destroyed')
  }

  async requestBotMove(fen: string): Promise<string | null> {
    const explorerStore = useOpeningExplorerStore()

    // 1. Try Lichess Book from Explorer Store
    // Ensure the stats are for the current FEN to avoid using stale book moves
    const statsMatchFen = explorerStore.lastFetchedFen &&
                         explorerStore.lastFetchedFen.split(' ').slice(0, 4).join(' ') ===
                         fen.split(' ').slice(0, 4).join(' ')

    if (statsMatchFen && explorerStore.stats && explorerStore.stats.moves.length > 0) {
      const topMoves = explorerStore.stats.moves.slice(0, 5)
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

          logger.info(`[PlayCoachStrategy] Book move selected: ${selectedUci}`)
          return selectedUci
        }
      }
    }

    // 2. Fallback to Engine (Maia 2200 via EnginePlayService)
    logger.info(`[PlayCoachStrategy] Book empty. Using engine: ${this.ENGINE_ID}`)

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
