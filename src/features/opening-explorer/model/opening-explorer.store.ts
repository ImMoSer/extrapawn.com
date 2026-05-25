import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { theoryRepository, type LichessOpeningResponse } from '@/entities/opening'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import logger from '@/shared/lib/logger'

export const useOpeningExplorerStore = defineStore('openingExplorer', () => {
  const stats = ref<LichessOpeningResponse | null>(null)
  const isLoading = ref(false)
  const ratingRange = ref<'1000-1499' | '1500-1799' | '1800-2200'>('1800-2200')

  async function fetchStats() {
    isLoading.value = true
    try {
      const fen = pgnService.getCurrentNavigatedFen()
      const data = await theoryRepository.getLichessStats(fen, { ratingRange: ratingRange.value })
      stats.value = data
    } catch (e) {
      logger.error('[OpeningExplorerStore] Failed to fetch stats:', e)
      stats.value = null
    } finally {
      isLoading.value = false
    }
  }

  // Auto-update when FEN or rating range changes
  watch(
    [pgnTreeVersion, ratingRange],
    () => {
      fetchStats()
    },
    { immediate: true }
  )

  return {
    stats,
    isLoading,
    ratingRange,
    fetchStats
  }
})
