import type { IGameplayStrategy } from '@/entities/game'
import { serverEngineService } from '@/shared/lib/engine/ServerEngineService'
import { useOpeningExplorerStore } from '@/features/opening-explorer'
import logger from '@/shared/lib/logger'

export class PlayCoachStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 400,
  }

  private readonly ENGINE_NAME = 'maia-2200'

  async requestBotMove(fen: string): Promise<string | null> {
    const explorerStore = useOpeningExplorerStore()

    // 1. Try Lichess Book from Explorer Store
    if (explorerStore.stats && explorerStore.stats.moves.length > 0) {
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

    // 2. Fallback to Engine (Maia 2200)
    logger.info(`[PlayCoachStrategy] Book empty. Using engine: ${this.ENGINE_NAME}`)
    
    try {
      const moveUci = await serverEngineService.getMoveFromServer(fen, this.ENGINE_NAME)
      return moveUci
    } catch (err) {
      logger.error('[PlayCoachStrategy] Engine move failed:', err)
      return null
    }
  }
}
