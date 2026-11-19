import {
  analysisService,
  buildLocalAnalysisShapes,
  classifyLocalEngineLines,
  countBoardPieces,
  getLocalAnalysisSignature,
  type ClassifiedEngineLine,
  type EngineLoadingState,
  type EvaluatedLineWithSan,
  type LocalEngineLineInput,
} from '@/entities/analysis'
import { useBoardStore, useGameStore } from '@/entities/game'
import { usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

function toClassifierInput(line: EvaluatedLineWithSan): LocalEngineLineInput {
  const moverScore =
    line.initialTurn === 'black'
      ? { type: line.score.type, value: -line.score.value }
      : line.score
  return {
    id: line.id,
    depth: line.depth,
    moverScore,
    wdl: line.wdl,
    pvUci: line.pvUci,
    isTablebase: line.isTablebase,
  }
}

export const useAnalysisStore = defineStore('analysis', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const preferencesStore = usePreferencesStore()

  const isAnalysisActive = ref(false)
  const analysisLines = ref<EvaluatedLineWithSan[]>([])
  const highlightedLineId = ref<number | null>(null)

  // Options
  const multiPv = ref(3)
  const searchTime = ref(5) // 99 represents Infinity
  const showArrows = ref(true)

  // Engine WASM download & initialization state
  const engineLoadingState = ref<EngineLoadingState>(analysisService.getLoadingState())
  analysisService.onLoadingStateChange((state) => {
    engineLoadingState.value = state
  })

  const isTablebasePosition = computed(() => {
    const count = countBoardPieces(boardStore.fen)
    return count >= 2 && count <= 5
  })

  const isTablebaseMode = computed(
    () =>
      isAnalysisActive.value &&
      (isTablebasePosition.value || Boolean(analysisLines.value[0]?.isTablebase)),
  )

  const isEngineLoading = computed(
    () =>
      !isTablebasePosition.value &&
      (engineLoadingState.value.phase === 'downloading' ||
        engineLoadingState.value.phase === 'initializing'),
  )

  const classifiedLines = computed<ClassifiedEngineLine[]>(() => {
    const topLines = analysisLines.value.slice(0, multiPv.value)
    if (topLines.length === 0) return []
    const fen = topLines[0]?.startingFen || boardStore.fen
    if (!fen) return []
    return classifyLocalEngineLines(fen, topLines.map(toClassifierInput))
  })

  // Internal versioning to prevent race conditions
  let analysisVersion = 0
  let lastArrowsSignature = ''
  let lastRenderedDepth = 0
  let lastRenderedCount = 0
  let fenDebounceTimer: ReturnType<typeof setTimeout> | null = null

  // Watch FEN for debounced analysis restart
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (isAnalysisActive.value) {
        if (fenDebounceTimer) clearTimeout(fenDebounceTimer)
        fenDebounceTimer = setTimeout(() => {
          logger.debug(`[AnalysisStore] FEN changed (debounced). Restarting analysis.`)
          lastRenderedDepth = 0
          lastRenderedCount = 0
          void startAnalysis(newFen)
        }, 250)
      }
    },
  )

  // Reset when gamePhase leaves ANALYSIS
  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase !== 'ANALYSIS' && isAnalysisActive.value) {
        logger.info(`[AnalysisStore] Auto-resetting because gamePhase became ${phase}`)
        void stopAnalysis()
      }
      if (phase !== 'ANALYSIS') {
        boardStore.setAnalysisShapes([])
      }
    },
  )

  // Reset local engine analysis when a new puzzle strategy starts
  watch(
    () => gameStore.currentStrategy,
    (newStrategy) => {
      if (newStrategy && isAnalysisActive.value) {
        logger.info('[AnalysisStore] Stopping local engine analysis for new puzzle strategy.')
        void stopAnalysis()
      }
    },
  )

  // Watch lines to update board arrows, NAGs, and piece marches
  watch(analysisLines, (lines) => {
    if (isAnalysisActive.value && lines.length > 0) {
      const firstLine = lines[0]!
      const currentDepth = firstLine.depth
      const visibleCount = Math.min(lines.length, multiPv.value)
      if (
        firstLine.isTablebase ||
        visibleCount > lastRenderedCount ||
        shouldUpdateBoard(currentDepth)
      ) {
        if (showArrows.value) {
          drawAnalysisArrows(classifiedLines.value)
        } else {
          boardStore.setAnalysisShapes([])
        }
        lastRenderedDepth = currentDepth
        lastRenderedCount = visibleCount
      }
    }
  })

  watch(showArrows, (newVal) => {
    if (!newVal) {
      boardStore.setAnalysisShapes([])
      lastArrowsSignature = ''
    } else if (isAnalysisActive.value && classifiedLines.value.length > 0) {
      drawAnalysisArrows(classifiedLines.value)
    }
  })

  watch(highlightedLineId, () => {
    if (isAnalysisActive.value && showArrows.value && classifiedLines.value.length > 0) {
      drawAnalysisArrows(classifiedLines.value)
    }
  })

  function setHighlightedLine(lineId: number | null) {
    if (highlightedLineId.value === lineId) return
    highlightedLineId.value = lineId
  }

  function shouldUpdateBoard(depth: number): boolean {
    if (depth === 1) return true
    if (lastRenderedDepth < 6 && depth >= 6) return true
    if (lastRenderedDepth < 10 && depth >= 10) return true
    if (lastRenderedDepth < 15 && depth >= 15) return true
    if (lastRenderedDepth < 20 && depth >= 20) return true
    if (lastRenderedDepth >= 20 && depth > lastRenderedDepth) return true
    return false
  }

  function drawAnalysisArrows(classified: ClassifiedEngineLine[]) {
    if (gameStore.gamePhase !== 'ANALYSIS') {
      boardStore.setAnalysisShapes([])
      return
    }

    const signature = getLocalAnalysisSignature(classified, highlightedLineId.value)
    if (signature === lastArrowsSignature) {
      return
    }

    const shapes = buildLocalAnalysisShapes(classified, {
      highlightedLineId: highlightedLineId.value,
    })

    boardStore.setAnalysisShapes(shapes)
    lastArrowsSignature = signature
  }

  async function initialize() {
    // Load options from preferencesStore
    const prefs = preferencesStore.preferences.analysis
    multiPv.value = prefs.multiPv
    searchTime.value = prefs.searchTime
    showArrows.value = prefs.showArrows

    if (!isTablebasePosition.value) {
      await analysisService.initialize()
    } else {
      void analysisService.initialize().catch(() => {
        // Error state is tracked in engineLoadingState if needed later for >5 pieces
      })
    }

    logger.info(
      `[AnalysisStore] Initialized. MultiPV: ${multiPv.value}, SearchTime: ${searchTime.value}, ShowArrows: ${showArrows.value}`,
    )
  }

  async function retryEngineLoad() {
    await initialize()
    await startNewGame()
    if (boardStore.fen && gameStore.gamePhase === 'ANALYSIS') {
      await startAnalysis(boardStore.fen)
    }
  }

  async function triggerRestart() {
    if (isAnalysisActive.value) {
      const currentFen = analysisLines.value[0]?.startingFen
      if (currentFen) {
        await startAnalysis(currentFen)
      }
    }
  }

  async function setMultiPv(value: number) {
    const val = Math.max(1, Math.min(value, 5))
    if (multiPv.value === val) return
    multiPv.value = val
    await preferencesStore.updatePreferences({ analysis: { multiPv: val } })
    await triggerRestart()
  }

  async function setSearchTime(value: number) {
    if (searchTime.value === value) return
    searchTime.value = value
    await preferencesStore.updatePreferences({ analysis: { searchTime: value } })
    await triggerRestart()
  }

  function setShowArrows(value: boolean) {
    if (showArrows.value === value) return
    showArrows.value = value
    preferencesStore.updatePreferences({ analysis: { showArrows: value } })
  }

  async function startNewGame() {
    await analysisService.startNewGame()
  }

  async function startAnalysis(
    fen: string,
    onLinesUpdate?: (lines: EvaluatedLineWithSan[]) => void,
  ) {
    if (gameStore.gamePhase !== 'ANALYSIS') {
      logger.warn('[AnalysisStore] startAnalysis blocked: only allowed in ANALYSIS phase')
      return
    }

    analysisVersion++
    const currentVersion = analysisVersion
    isAnalysisActive.value = true
    highlightedLineId.value = null
    lastArrowsSignature = ''
    lastRenderedDepth = 0
    lastRenderedCount = 0

    await analysisService.stopAnalysis()

    if (analysisVersion !== currentVersion) return

    analysisLines.value = []

    const options = {
      multiPv: multiPv.value,
      movetime: (searchTime.value === 99 || searchTime.value <= 0) ? 0 : searchTime.value * 1000,
    }

    await analysisService.startAnalysis(fen, (lines) => {
      if (!isAnalysisActive.value || analysisVersion !== currentVersion) return

      const lineMap = new Map(analysisLines.value.map((l) => [l.id, l]))
      lines.forEach((l) => lineMap.set(l.id, l))
      const sortedLines = Array.from(lineMap.values()).sort((a, b) => a.id - b.id)

      analysisLines.value = sortedLines

      if (onLinesUpdate) {
        onLinesUpdate(sortedLines)
      }
    }, options)

    if (analysisVersion !== currentVersion) {
      logger.info(`[AnalysisStore] Aborted start for FEN: ${fen} due to version change.`)
      return
    }

    logger.info(`[AnalysisStore] Started for FEN: ${fen}`)
  }

  async function stopAnalysis() {
    analysisVersion++
    if (fenDebounceTimer) {
      clearTimeout(fenDebounceTimer)
      fenDebounceTimer = null
    }
    isAnalysisActive.value = false
    analysisLines.value = []
    highlightedLineId.value = null
    lastArrowsSignature = ''
    lastRenderedDepth = 0
    lastRenderedCount = 0
    boardStore.setAnalysisShapes([])
    await analysisService.stopAnalysis()
    logger.info('[AnalysisStore] Stopped.')
  }

  async function toggleAnalysis() {
    if (gameStore.gamePhase !== 'ANALYSIS') {
      logger.warn('[AnalysisStore] toggleAnalysis blocked outside ANALYSIS phase')
      return
    }

    if (!isAnalysisActive.value) {
      lastRenderedDepth = 0
      lastRenderedCount = 0
      await startNewGame()
      await startAnalysis(boardStore.fen)
    } else {
      await stopAnalysis()
    }
  }

  return {
    isAnalysisActive,
    analysisLines,
    classifiedLines,
    highlightedLineId,
    multiPv,
    searchTime,
    showArrows,
    engineLoadingState,
    isEngineLoading,
    isTablebasePosition,
    isTablebaseMode,
    initialize,
    retryEngineLoad,
    setMultiPv,
    setSearchTime,
    setShowArrows,
    setHighlightedLine,
    startNewGame,
    startAnalysis,
    stopAnalysis,
    toggleAnalysis,
  }
})
