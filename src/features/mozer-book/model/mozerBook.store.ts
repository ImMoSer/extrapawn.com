// src/stores/mozerBook.store.ts
import { useTheoryStore, type MozerBookResponse } from '@/entities/opening'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export const useMozerBookStore = defineStore('mozerBook', () => {
  const theoryStore = useTheoryStore()

  const currentStats = computed(() => theoryStore.currentMozerStats)
  const isLoading = computed(() => theoryStore.isMozerLoading)
  // error removed or map from theoryStore if we add it there, but null is fine for UI usually
  const error = computed<string | null>(() => null)

  const currentFen = computed(() => theoryStore.currentFen)

  // fetchStats now just delegates to the Theory Store
  async function fetchStats(): Promise<MozerBookResponse | null> {
    return theoryStore.fetchMozerStats(currentFen.value)
  }

  async function getStatsForFen(fen: string): Promise<MozerBookResponse | null> {
    return theoryStore.awaitMozerStatsForFen(fen)
  }

  function reset() {
    theoryStore.reset()
  }

  return {
    currentStats,
    isLoading,
    error,
    currentFen,
    fetchStats,
    getStatsForFen,
    reset,
  }
})
