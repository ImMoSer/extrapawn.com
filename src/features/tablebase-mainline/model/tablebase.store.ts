import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useBoardStore, useGameStore } from '@/entities/game'
import logger from '@/shared/lib/logger'

export interface TablebaseMove {
  uci: string
  san: string
  dtz?: number
  precise_dtz?: number
}

export interface TablebaseMainlineResponse {
  mainline?: TablebaseMove[]
  winner?: string
  dtz?: number
  precise_dtz?: number
}

export const useTablebaseStore = defineStore('tablebaseMainline', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()

  const isPlaybackInProgress = ref(false)

  // Helper to count pieces in FEN
  function getPieceCount(fen: string): number {
    const boardPart = fen.split(' ')[0] || ''
    return (boardPart.match(/[prnbqkPRNBQK]/g) || []).length
  }

  // Tablebase is available if we have 7 or fewer pieces
  const isTablebaseAvailable = computed(() => {
    return getPieceCount(boardStore.fen) <= 7 && gameStore.gamePhase === 'PLAYING'
  })

  // Fetch mainline from Lichess Tablebase API
  async function fetchMainline(fen: string): Promise<TablebaseMainlineResponse | null> {
    try {
      const url = `https://tablebase.lichess.ovh/standard/mainline?fen=${encodeURIComponent(fen)}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return (await response.json()) as TablebaseMainlineResponse
    } catch (error) {
      logger.error('[TablebaseStore] Failed to fetch mainline from Lichess Tablebase:', error)
      return null
    }
  }

  let playbackTimeoutId: number | null = null

  async function playMainline() {
    if (isPlaybackInProgress.value) return
    isPlaybackInProgress.value = true
    gameStore.isTablebasePlaybackActive = true

    logger.info('[TablebaseStore] Fetching tablebase mainline...')
    const data = await fetchMainline(boardStore.fen)

    if (!data || !data.mainline || data.mainline.length === 0) {
      logger.warn('[TablebaseStore] No mainline moves returned.')
      stopPlayback()
      return
    }

    const moves = [...data.mainline]
    logger.info(`[TablebaseStore] Starting playback for ${moves.length} moves.`)

    async function executeNextStep() {
      if (!isPlaybackInProgress.value || gameStore.gamePhase !== 'PLAYING') {
        stopPlayback()
        return
      }

      if (moves.length === 0) {
        logger.info('[TablebaseStore] Playback finished: no more moves.')
        stopPlayback()
        return
      }

      const nextMove = moves.shift()
      if (!nextMove) {
        stopPlayback()
        return
      }

      logger.info(`[TablebaseStore] Executing playback move: ${nextMove.uci} (${nextMove.san})`)
      await gameStore.executePlaybackMove(nextMove.uci)

      // Schedule next move in 750ms
      playbackTimeoutId = window.setTimeout(() => {
        executeNextStep()
      }, 750)
    }

    // Start loop
    await executeNextStep()
  }

  function stopPlayback() {
    isPlaybackInProgress.value = false
    gameStore.isTablebasePlaybackActive = false
    if (playbackTimeoutId !== null) {
      window.clearTimeout(playbackTimeoutId)
      playbackTimeoutId = null
    }
    logger.info('[TablebaseStore] Playback stopped/cleaned up.')
  }

  // Automatically cancel playback if game is reset or terminated
  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase !== 'PLAYING' && isPlaybackInProgress.value) {
        stopPlayback()
      }
    }
  )

  return {
    isPlaybackInProgress,
    isTablebaseAvailable,
    playMainline,
    stopPlayback,
    getPieceCount,
  }
})
