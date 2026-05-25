import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useBoardStore, useGameStore } from '@/entities/game'
import { theoryRepository, type LichessOpeningResponse } from '@/entities/opening'
import { serverEngineService } from '@/shared/lib/engine/ServerEngineService'
import logger from '@/shared/lib/logger'

const COACH_MOVE_DELAY = 200

export const usePlayCoachStore = defineStore('playCoach', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()

  const selectedRange = ref<'1000-1499' | '1500-1799' | '1800-2200'>('1000-1499')
  const userColor = ref<'white' | 'black'>('white')
  const coachStats = ref<LichessOpeningResponse | null>(null)
  const isLoading = ref(false)

  const ENGINE_NAME = 'maia-2200'

  async function updateStats() {
    isLoading.value = true
    try {
      const fen = boardStore.fen
      const stats = await theoryRepository.getLichessStats(fen, { ratingRange: selectedRange.value })
      coachStats.value = stats
    } catch (err) {
      logger.error('[PlayCoachStore] Failed to update stats:', err)
      coachStats.value = null
    } finally {
      isLoading.value = false
    }
  }

  async function makeCoachMove() {
    const fen = boardStore.fen
    
    // 1. Try Lichess Book (Top 5 weighted random)
    if (coachStats.value && coachStats.value.moves.length > 0) {
      const topMoves = coachStats.value.moves.slice(0, 5)
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

  // Explicit handler for user moves from UI
  async function onUserMove() {
    await updateStats()

    if (boardStore.turn !== userColor.value) {
      // Small delay for realism
      setTimeout(async () => {
        if (boardStore.turn !== userColor.value) {
          await makeCoachMove()
        }
      }, COACH_MOVE_DELAY)
    }
  }

  // Auto-respond when it's coach's turn or FEN changed (e.g. from PGN navigation)
  watch(() => boardStore.fen, async () => {
    await updateStats()

    if (boardStore.turn !== userColor.value) {
      // Small delay for realism
      setTimeout(async () => {
        if (boardStore.turn !== userColor.value) {
          await makeCoachMove()
        }
      }, COACH_MOVE_DELAY)
    }
  }, { immediate: true })

  // Re-update stats when rating range changes
  watch(selectedRange, () => {
    updateStats()
  })

  // Initialize game phase
  gameStore.setGamePhase('PLAYING')

  return {
    selectedRange,
    userColor,
    coachStats,
    isLoading,
    onUserMove,
    updateStats,
    makeCoachMove
  }
})
