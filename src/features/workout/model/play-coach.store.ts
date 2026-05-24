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

  const isActive = ref(false)
  const selectedRange = ref<'1000-1499' | '1500-1799' | '1800-2200'>('1000-1499')
  const userColor = ref<'white' | 'black'>('white')
  const coachStats = ref<LichessOpeningResponse | null>(null)
  const isLoading = ref(false)

  const maiaMapping = {
    '1000-1499': 'maia-1900',
    '1500-1799': 'maia-1900',
    '1800-2200': 'maia-2200'
  }

  async function start() {
    isActive.value = true
    const currentFen = boardStore.fen || 'start'
    boardStore.setupPosition(currentFen, userColor.value)
    await updateStats()
    
    // If it's coach's turn at the start, make a move
    if (isActive.value && boardStore.turn !== userColor.value) {
      await makeCoachMove()
    }
  }

  function stop() {
    isActive.value = false
    coachStats.value = null
    gameStore.resetGame()
  }

  async function updateStats() {
    if (!isActive.value) return
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
    if (!isActive.value) return

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

    // 2. Fallback to Engine (Maia)
    const engineName = maiaMapping[selectedRange.value]
    logger.info(`[PlayCoachStore] Book empty. Using engine: ${engineName}`)
    
    try {
      const moveUci = await serverEngineService.getMoveFromServer(fen, engineName)
      if (moveUci) {
        boardStore.applyUciMove(moveUci)
      }
    } catch (err) {
      logger.error('[PlayCoachStore] Engine move failed:', err)
    }
  }

  // Explicit handler for user moves from UI
  async function onUserMove() {
    if (!isActive.value) return
    
    await updateStats()

    if (boardStore.turn !== userColor.value) {
      // Small delay for realism
      setTimeout(async () => {
        if (isActive.value && boardStore.turn !== userColor.value) {
          await makeCoachMove()
        }
      }, COACH_MOVE_DELAY)
    }
  }

  // Auto-respond when it's coach's turn
  watch(() => boardStore.fen, async () => {
    if (!isActive.value) return
    
    await updateStats()

    if (boardStore.turn !== userColor.value) {
      // Small delay for realism
      setTimeout(async () => {
        if (isActive.value && boardStore.turn !== userColor.value) {
          await makeCoachMove()
        }
      }, COACH_MOVE_DELAY)
    }
  })

  return {
    isActive,
    selectedRange,
    userColor,
    coachStats,
    isLoading,
    start,
    stop,
    onUserMove
  }
})
