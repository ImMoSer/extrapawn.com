import { defineStore } from 'pinia'
import { watch } from 'vue'
import { useBoardStore } from '@/entities/game'
import { serverEngineService } from '@/shared/lib/engine/ServerEngineService'
import { useOpeningExplorerStore } from '@/features/opening-explorer'
import logger from '@/shared/lib/logger'

const COACH_MOVE_DELAY = 400

export const usePlayCoachStore = defineStore('playCoach', () => {
  const boardStore = useBoardStore()
  const explorerStore = useOpeningExplorerStore()

  const ENGINE_NAME = 'maia-2200'
  let coachTimeout: ReturnType<typeof setTimeout> | null = null

  async function makeCoachMove() {
    const fen = boardStore.fen
    
    // 1. Try Lichess Book from Explorer Store
    if (explorerStore.stats && explorerStore.stats.moves.length > 0) {
      const topMoves = explorerStore.stats.moves.slice(0, 5)
      const firstMove = topMoves[0]
      if (!firstMove) return

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
        
        logger.info(`[PlayCoachStore] Book move selected: ${selectedUci}`)
        boardStore.applyUciMove(selectedUci)
        return
      }
    }

    // 2. Fallback to Engine (Maia 2200)
    logger.info(`[PlayCoachStore] Book empty. Using engine: ${ENGINE_NAME}`)
    
    try {
      const moveUci = await serverEngineService.getMoveFromServer(fen, ENGINE_NAME)
      if (moveUci) {
        boardStore.applyUciMove(moveUci)
      }
    } catch (err) {
      logger.error('[PlayCoachStore] Engine move failed:', err)
    }
  }

  // Auto-respond when it's coach's turn
  // Coach turn is when current turn != board orientation
  watch([() => boardStore.fen, () => boardStore.orientation], () => {
    const isCoachTurn = boardStore.turn !== boardStore.orientation

    if (coachTimeout) {
      clearTimeout(coachTimeout)
      coachTimeout = null
    }

    if (isCoachTurn && !boardStore.isGameOver) {
      // Small delay for realism
      coachTimeout = setTimeout(async () => {
        // Re-check turn after delay to avoid race conditions
        if (boardStore.turn !== boardStore.orientation) {
          await makeCoachMove()
        }
        coachTimeout = null
      }, COACH_MOVE_DELAY)
    }
  }, { immediate: true })

  return {
    makeCoachMove
  }
})
