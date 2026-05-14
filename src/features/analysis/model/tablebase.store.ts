import { useBoardStore } from '@/entities/game'
import logger from '@/shared/lib/logger'
import { defineStore, storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { tablebaseService, type TablebaseResponse } from '../api/TablebaseService'
import { useAnalysisStore } from './analysis.store'

export const useTablebaseStore = defineStore('tablebase', () => {
  const boardStore = useBoardStore()
  const analysisStore = useAnalysisStore()
  const { isAnalysisActive } = storeToRefs(analysisStore)

  // --- STATE ---
  const result = ref<TablebaseResponse | null>(null)
  const isLoading = ref(false)
  const lastFetchedFen = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  // --- CONSTANTS ---
  const MIN_FETCH_INTERVAL = 1100
  const SHORT_DELAY = 250
  let lastFetchTimestamp = 0
  let pendingFen: string | null = null

  // --- COMPUTED ---
  const pieceCount = computed(() => {
    const fen = boardStore.fen || ''
    const position = fen.split(' ')[0] ?? ''
    return position.replace(/[^a-zA-Z]/g, '').length
  })

  const isTablebaseAvailable = computed(() => {
    return isAnalysisActive.value && pieceCount.value <= 7 && !boardStore.isGameOver
  })

  // --- LOGIC ---
  watch(
    () => boardStore.fen,
    (newFen) => {
      // Reset result immediately when FEN changes to avoid stale data UI flicker
      result.value = null

      if (debounceTimer) {
        clearTimeout(debounceTimer)
        debounceTimer = null
      }

      if (isTablebaseAvailable.value) {
        // --- OPTIMIZATION: Check Cache first ---
        const cachedData = tablebaseService.getCachedData(newFen)
        if (cachedData) {
          result.value = cachedData
          lastFetchedFen.value = newFen
          return // No need to fetch or wait
        }

        const now = Date.now()
        const timeSinceLast = now - lastFetchTimestamp

        // If we haven't fetched for a while, we can be faster (Leading edge)
        // We still use a short delay (250ms) to avoid fetching
        // if the user is just starting a fast sequence.
        const delay =
          timeSinceLast >= MIN_FETCH_INTERVAL
            ? SHORT_DELAY
            : Math.max(0, MIN_FETCH_INTERVAL - timeSinceLast)

        pendingFen = newFen
        debounceTimer = setTimeout(() => {
          if (pendingFen === newFen) {
            fetchTablebase(newFen)
            lastFetchTimestamp = Date.now()
            pendingFen = null
          }
        }, delay)
      } else {
        resetResult()
      }
    },
  )

  watch(isAnalysisActive, (active) => {
    if (!active) {
      resetResult()
    } else if (pieceCount.value <= 7) {
      fetchTablebase(boardStore.fen)
    }
  })

  async function fetchTablebase(fen: string) {
    if (fen === lastFetchedFen.value) return

    isLoading.value = true
    const data = await tablebaseService.fetchStandard(fen)

    if (data) {
      result.value = data
      lastFetchedFen.value = fen
      logger.info(`[TablebaseStore] Data received for FEN: ${fen.substring(0, 20)}...`)
    } else {
      if (fen !== lastFetchedFen.value) {
        resetResult()
      }
    }
    isLoading.value = false
  }

  function resetResult() {
    result.value = null
    lastFetchedFen.value = ''
    isLoading.value = false
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  return {
    result,
    isLoading,
    pieceCount,
    isTablebaseAvailable,
    lastFetchedFen,
    resetResult,
    fetchTablebase,
  }
})
