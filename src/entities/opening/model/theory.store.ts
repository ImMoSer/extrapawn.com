import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { theoryRepository } from '../api/TheoryRepository'
import type { MozerBookResponse } from '../api/MozerBookService'
import type { LichessOpeningResponse, LichessParams } from '../api/LichessApiService'
import logger from '@/shared/lib/logger'

export const useTheoryStore = defineStore('openingTheory', () => {
  // Memos of the latest data fetched via standard reactivity
  const currentMozerStats = ref<MozerBookResponse | null>(null)
  const currentLichessStats = ref<LichessOpeningResponse | null>(null)

  const isMozerLoading = ref(false)
  const isLichessLoading = ref(false)

  const forceSkipDebounceGlobal = ref(false)

  // Current Lichess settings (these can be driven by the feature that needs them)
  const activeLichessParams = ref<LichessParams>({ ratingRange: '1000-1499' })

  // Ensure computed tracking picks up changes from PGN navigation
  const currentFen = computed(() => {
    void pgnTreeVersion.value
    return pgnService.getCurrentNavigatedFen()
  })

  // Expose this so features can set it before triggering reactive fetches
  function setLichessParams(params: LichessParams) {
    activeLichessParams.value = params
  }

  function setForceSkipDebounceGlobal(val: boolean) {
    forceSkipDebounceGlobal.value = val
  }

  const emptyMozerResponse: MozerBookResponse = {
    summary: null,
    moves: [],
    styles: undefined,
    wiki: null,
  }

  // Check if FEN is known to be out of book based on PGN parent state
  function checkIfFenIsOutOfBook(fen: string): boolean {
    const currentNode = pgnService.getCurrentNode()
    if (currentNode && currentNode.fenAfter === fen) {
      const parentEmptyCount = currentNode.parent?.metadata?.consecutiveEmptyMoves || 0
      if (currentNode.parent && parentEmptyCount >= 3) {
        currentNode.metadata = { 
          ...currentNode.metadata, 
          consecutiveEmptyMoves: parentEmptyCount + 1 
        }
        return true
      }
    }
    return false
  }

  // Reactive Fetchers (For UI)
  async function fetchMozerStats(fen: string): Promise<MozerBookResponse | null> {
    if (checkIfFenIsOutOfBook(fen)) {
      if (fen === currentFen.value) {
        currentMozerStats.value = emptyMozerResponse
      }
      return emptyMozerResponse
    }

    isMozerLoading.value = true
    try {
      const data = await theoryRepository.getMozerBookStats(fen, {
        skipDebounce: forceSkipDebounceGlobal.value,
      })
      
      // Update consecutiveEmptyMoves counter on the node
      const currentNode = pgnService.getCurrentNode()
      if (currentNode && currentNode.fenAfter === fen) {
        const parentEmptyCount = currentNode.parent?.metadata?.consecutiveEmptyMoves || 0
        const currentEmptyCount = (data && data.moves && data.moves.length > 0) ? 0 : parentEmptyCount + 1
        currentNode.metadata = { 
          ...currentNode.metadata, 
          consecutiveEmptyMoves: currentEmptyCount 
        }
      }

      // Only set to state if the FEN hasn't changed while we were fetching
      if (fen === currentFen.value) {
        currentMozerStats.value = data
      }
      return data
    } catch (error) {
      logger.error('[TheoryStore] Failed to fetch Mozer stats', error)
      return null
    } finally {
      if (fen === currentFen.value) {
        isMozerLoading.value = false
      }
    }
  }

  async function fetchLichessStats(fen: string): Promise<LichessOpeningResponse | null> {
    isLichessLoading.value = true
    try {
      const data = await theoryRepository.getLichessStats(fen, activeLichessParams.value, {
        skipDebounce: forceSkipDebounceGlobal.value,
      })
      if (fen === currentFen.value) {
        currentLichessStats.value = data
      }
      return data
    } catch (error) {
      logger.error('[TheoryStore] Failed to fetch Lichess stats', error)
      return null
    } finally {
      if (fen === currentFen.value) {
        isLichessLoading.value = false
      }
    }
  }

  // Imperative fetchers (For Game Loops / Bots) that strictly return data
  // These guarantee data for the requested FEN.
  async function awaitMozerStatsForFen(
    fen: string,
    skipDebounce = false,
  ): Promise<MozerBookResponse | null> {
    if (checkIfFenIsOutOfBook(fen)) {
      return emptyMozerResponse
    }
    const data = await theoryRepository.getMozerBookStats(fen, { skipDebounce })
    
    const currentNode = pgnService.getCurrentNode()
    if (currentNode && currentNode.fenAfter === fen) {
      const parentEmptyCount = currentNode.parent?.metadata?.consecutiveEmptyMoves || 0
      const currentEmptyCount = (data && data.moves && data.moves.length > 0) ? 0 : parentEmptyCount + 1
      currentNode.metadata = { 
        ...currentNode.metadata, 
        consecutiveEmptyMoves: currentEmptyCount 
      }
    }
    return data
  }

  async function awaitLichessStatsForFen(
    fen: string,
    params?: LichessParams,
    skipDebounce = false,
  ): Promise<LichessOpeningResponse | null> {
    return await theoryRepository.getLichessStats(fen, params || activeLichessParams.value, {
      skipDebounce,
    })
  }

  // Reset internal state
  function reset() {
    currentMozerStats.value = null
    currentLichessStats.value = null
    isMozerLoading.value = false
    isLichessLoading.value = false
  }

  return {
    currentFen,
    currentMozerStats,
    currentLichessStats,
    isMozerLoading,
    isLichessLoading,
    activeLichessParams,
    forceSkipDebounceGlobal,
    setLichessParams,
    setForceSkipDebounceGlobal,
    fetchMozerStats,
    fetchLichessStats,
    awaitMozerStatsForFen,
    awaitLichessStatsForFen,
    reset,
  }
})
