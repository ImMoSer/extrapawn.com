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

  // Reactive Fetchers (For UI)
  async function fetchMozerStats(fen: string): Promise<MozerBookResponse | null> {
    isMozerLoading.value = true
    try {
      const data = await theoryRepository.getMozerBookStats(fen, {
        skipDebounce: forceSkipDebounceGlobal.value,
      })
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
    return await theoryRepository.getMozerBookStats(fen, { skipDebounce })
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
