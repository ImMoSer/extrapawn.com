// src/features/analysis/model/analysis.store.ts
import { useAnalysisEngineStore, type EvaluatedLineWithSan } from '@/entities/analysis'
import { useBoardStore, useGameStore } from '@/entities/game'
import logger from '@/shared/lib/logger'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { defineStore, storeToRefs } from 'pinia'
import { ref, watch } from 'vue'

const ARROW_STYLES = [
  { brush: 'blue', lineWidth: 14 },
  { brush: 'blue', lineWidth: 10 },
  { brush: 'blue', lineWidth: 8 },
]

export const useAnalysisStore = defineStore('analysis', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const engineStore = useAnalysisEngineStore()

  // --- FEATURE STATE ---
  const isPanelVisible = ref(false)
  let lastArrowsSignature = ''
  let lastRenderedDepth = 0
  let fenDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // --- ENTITY STATE PROXIES ---
  const {
    isAnalysisActive,
    isLoading,
    analysisLines,
    isMultiThreadAvailable,
    maxThreads,
    numThreads,
    playerColor,
  } = storeToRefs(engineStore)

  // --- LOGIC ---
  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase === 'IDLE' && (isPanelVisible.value || isAnalysisActive.value)) {
        logger.info('[AnalysisFeature] Auto-resetting because gamePhase became IDLE')
        resetAnalysisState()
      }
    },
  )

  watch(
    () => boardStore.fen,
    (newFen) => {
      if (isAnalysisActive.value) {
        if (fenDebounceTimer) clearTimeout(fenDebounceTimer)
        fenDebounceTimer = setTimeout(() => {
          logger.debug(`[AnalysisFeature] FEN changed (debounced). Restarting analysis.`)
          lastRenderedDepth = 0
          // Delegate to engineStore
          engineStore.startAnalysis(newFen)
        }, 250)
      }
    },
  )

  watch(isPanelVisible, (isVisible) => {
    if (!isVisible && isAnalysisActive.value) {
      logger.info('[AnalysisFeature] Panel set to invisible. Hard-stopping engine.')
      engineStore.stopAnalysis()
    }
  })

  // Watch lines to update board arrows (Pure Feature Logic)
  watch(analysisLines, (lines) => {
    // Only draw arrows if this feature is "active" (panel visible or toggled on)
    if (isAnalysisActive.value && lines.length > 0) {
      const currentDepth = lines[0]!.depth
      if (shouldUpdateBoard(currentDepth)) {
        drawAnalysisArrows(lines)
        lastRenderedDepth = currentDepth
      }
    }
  })

  function shouldUpdateBoard(depth: number): boolean {
    // Render milestones: 1, 10, 15, 20, 21, 22, ...
    if (depth === 1) return true
    if (lastRenderedDepth < 10 && depth >= 10) return true
    if (lastRenderedDepth < 15 && depth >= 15) return true
    if (lastRenderedDepth < 20 && depth >= 20) return true
    if (lastRenderedDepth >= 20 && depth > lastRenderedDepth) return true
    return false
  }

  // --- ACTIONS ---
  async function showPanel(startActive = false) {
    isPanelVisible.value = true

    // Initialize Engine
    await engineStore.initialize()
    boardStore.setAnalysisMode(true)

    if (startActive) {
      await engineStore.startAnalysis(boardStore.fen)
    }
  }

  async function hidePanel() {
    await resetAnalysisState()
    logger.info('[AnalysisFeature] Panel hidden.')
  }

  async function toggleAnalysis() {
    if (!isAnalysisActive.value) {
      lastRenderedDepth = 0
      await engineStore.startNewGame()
      await engineStore.startAnalysis(boardStore.fen)
    } else {
      await engineStore.stopAnalysis()
      boardStore.setDrawableShapes([])
    }
  }

  async function setThreads(count: number) {
    await engineStore.setThreads(count)
    if (isAnalysisActive.value) {
      await engineStore.startAnalysis(boardStore.fen)
    }
  }

  function drawAnalysisArrows(lines: EvaluatedLineWithSan[]) {
    const topMoves = lines.slice(0, 3)
    const signature = topMoves.map((l) => l.pvUci[0] || '').join(',')

    if (signature === lastArrowsSignature) {
      return
    }

    lastArrowsSignature = signature

    const shapes: DrawShape[] = []
    topMoves.forEach((line, index) => {
      if (line.pvUci && line.pvUci.length > 0) {
        const uciMove = line.pvUci[0]
        if (typeof uciMove === 'string' && uciMove.length >= 4) {
          const orig = uciMove.substring(0, 2) as Key
          const dest = uciMove.substring(2, 4) as Key
          const style = ARROW_STYLES[index]
          if (style) {
            shapes.push({
              orig,
              dest,
              brush: style.brush,
              modifiers: { lineWidth: style.lineWidth },
            })
          }
        }
      }
    })
    boardStore.setDrawableShapes(shapes)
  }

  async function resetAnalysisState() {
    const wasActive = isAnalysisActive.value
    isPanelVisible.value = false
    lastArrowsSignature = ''
    lastRenderedDepth = 0

    if (wasActive) {
      await engineStore.stopAnalysis()
    }

    boardStore.setDrawableShapes([])
    boardStore.setAnalysisMode(false)
  }

  function setPlayerColor(color: 'white' | 'black' | null) {
    engineStore.setPlayerColor(color)
  }

  return {
    // Feature State
    isPanelVisible,

    // Entity State (Proxied)
    isAnalysisActive,
    isLoading,
    analysisLines,
    isMultiThreadAvailable,
    maxThreads,
    numThreads,
    playerColor,

    // Actions
    showPanel,
    hidePanel,
    toggleAnalysis,
    setThreads,
    resetAnalysisState,
    setPlayerColor,
  }
})
