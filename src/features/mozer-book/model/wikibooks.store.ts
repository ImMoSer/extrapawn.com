// src/stores/wikibooks.store.ts
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { wikiBooksApiService, WikiUrlBuilder } from '@/shared/api/WikiBooksService'
import type { WikiPageExtract } from '@/shared/types/wikibooks.types'
import logger from '@/shared/lib/logger'

export const useWikiBooksStore = defineStore('wikibooks', () => {
  const wikiData = ref<WikiPageExtract | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentMoves = ref<string[]>([])

  const currentSlug = computed(() => WikiUrlBuilder.buildSlug(currentMoves.value))
  const hasTheory = computed(() => wikiData.value !== null)

  async function updateMoves(moves: string[]) {
    // Avoid redundant updates
    const isSameMoves = JSON.stringify(currentMoves.value) === JSON.stringify(moves)
    if (isSameMoves && (wikiData.value !== null || isLoading.value || error.value !== null)) return

    currentMoves.value = [...moves]
    isLoading.value = true
    error.value = null

    try {
      const data = await wikiBooksApiService.fetchWithFallback(moves)
      wikiData.value = data
    } catch (err) {
      logger.error('[WikiBooksStore] Update error:', err)
      error.value = err instanceof Error ? err.message : String(err)
      wikiData.value = null
    } finally {
      isLoading.value = false
    }
  }

  return {
    wikiData,
    isLoading,
    error,
    currentMoves,
    currentSlug,
    hasTheory,
    updateMoves,
  }
})
