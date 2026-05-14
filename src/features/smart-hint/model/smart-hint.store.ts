import { analysisService } from '@/entities/analysis'
import { useBoardStore } from '@/entities/game'
import { type Key } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useSmartHintStore = defineStore('smartHint', () => {
  const hintsLeft = ref(0)
  const isLoading = ref(false)
  const boardStore = useBoardStore()

  // Track the FEN for which the hint was requested to avoid race conditions
  const lastRequestedFen = ref<string | null>(null)

  function resetHints(count = 3) {
    hintsLeft.value = count
    isLoading.value = false
    lastRequestedFen.value = null
  }

  async function requestHint() {
    if (hintsLeft.value <= 0 || isLoading.value) return

    const fen = boardStore.fen
    lastRequestedFen.value = fen
    isLoading.value = true

    try {
      const lines = await analysisService.calculateFixedDepth(fen, 12, 3)

      // Check for race condition: did the user move while we were calculating?
      if (boardStore.fen !== fen || lastRequestedFen.value !== fen) {
        return
      }

      if (lines && lines.length > 0) {
        hintsLeft.value -= 1

        const shapes = lines
          .map((line) => {
            const moveUci = line.pvUci[0]
            if (!moveUci) return null
            return {
              orig: moveUci.substring(0, 2) as Key,
              dest: moveUci.substring(2, 4) as Key,
              brush: 'blue', // a neutral color
            }
          })
          .filter((shape): shape is NonNullable<typeof shape> => shape !== null)

        boardStore.setDrawableShapes(shapes)

        // Clear shapes after 3 seconds if the user doesn't move
        setTimeout(() => {
          // Only clear if the FEN is still the same (meaning they haven't moved yet)
          if (boardStore.fen === fen) {
            boardStore.setDrawableShapes([])
          }
        }, 3000)
      }
    } finally {
      // Only unset loading if we haven't started another request
      if (lastRequestedFen.value === fen) {
        isLoading.value = false
      }
    }
  }

  // Watch for board FEN changes to clear hints and cancel active requests
  watch(
    () => boardStore.fen,
    (newFen, oldFen) => {
      if (newFen !== oldFen) {
        if (lastRequestedFen.value !== null) {
          if (lastRequestedFen.value === oldFen) {
            lastRequestedFen.value = null // Cancel active request logically
          }
          boardStore.setDrawableShapes([]) // Clear any visible hint shapes
        }
      }
    },
  )

  return {
    hintsLeft,
    isLoading,
    resetHints,
    requestHint,
  }
})
