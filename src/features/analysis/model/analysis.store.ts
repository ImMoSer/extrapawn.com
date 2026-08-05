import { analysisService, type EvaluatedLineWithSan } from '@/entities/analysis'
import { useBoardStore, useGameStore } from '@/entities/game'
import logger from '@/shared/lib/logger'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const ARROW_STYLES = [
  { brush: 'blue', lineWidth: 14 },
  { brush: 'blue', lineWidth: 10 },
  { brush: 'blue', lineWidth: 8 },
  { brush: 'blue', lineWidth: 6 },
  { brush: 'blue', lineWidth: 4 },
]

export const useAnalysisStore = defineStore('analysis', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()

  const isAnalysisActive = ref(false)
  const analysisLines = ref<EvaluatedLineWithSan[]>([])

  // Options
  const multiPv = ref(3)
  const searchTime = ref(5) // 99 represents Infinity
  const showArrows = ref(true)
  const engineVersion = ref<'lite' | 'full'>('lite')

  // Internal versioning to prevent race conditions
  let analysisVersion = 0
  let lastArrowsSignature = ''
  let lastRenderedDepth = 0
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
          void startAnalysis(newFen)
        }, 250)
      }
    },
  )

  // Reset when gamePhase becomes IDLE
  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase === 'IDLE' && isAnalysisActive.value) {
        logger.info('[AnalysisStore] Auto-resetting because gamePhase became IDLE')
        void stopAnalysis()
      }
    },
  )

  // Watch lines to update board arrows
  watch(analysisLines, (lines) => {
    if (isAnalysisActive.value && lines.length > 0) {
      const currentDepth = lines[0]!.depth
      if (shouldUpdateBoard(currentDepth)) {
        if (showArrows.value) {
          drawAnalysisArrows(lines)
        } else {
          boardStore.setDrawableShapes([])
        }
        lastRenderedDepth = currentDepth
      }
    }
  })

  watch(showArrows, (newVal) => {
    if (!newVal) {
      boardStore.setDrawableShapes([])
      lastArrowsSignature = ''
    } else if (isAnalysisActive.value && analysisLines.value.length > 0) {
      drawAnalysisArrows(analysisLines.value)
    }
  })

  function shouldUpdateBoard(depth: number): boolean {
    if (depth === 1) return true
    if (lastRenderedDepth < 10 && depth >= 10) return true
    if (lastRenderedDepth < 15 && depth >= 15) return true
    if (lastRenderedDepth < 20 && depth >= 20) return true
    if (lastRenderedDepth >= 20 && depth > lastRenderedDepth) return true
    return false
  }

  function drawAnalysisArrows(lines: EvaluatedLineWithSan[]) {
    const topMoves = lines.slice(0, multiPv.value)
    const signature = topMoves.map((l) => (l.pvUci && l.pvUci[0]) || '').join(',')

    if (signature === lastArrowsSignature) {
      return
    }

    const shapes: DrawShape[] = []
    topMoves.forEach((line, index) => {
      if (line.pvUci && line.pvUci.length > 0) {
        const firstMove = line.pvUci[0]
        if (firstMove && firstMove.length >= 4) {
          const orig = firstMove.slice(0, 2) as Key
          const dest = firstMove.slice(2, 4) as Key
          const style = ARROW_STYLES[index] || ARROW_STYLES[ARROW_STYLES.length - 1]

          shapes.push({
            orig,
            dest,
            brush: style!.brush,
            modifiers: { lineWidth: style!.lineWidth },
          })
        }
      }
    })

    boardStore.setDrawableShapes(shapes)
    lastArrowsSignature = signature
  }

  async function initialize() {
    await analysisService.initialize()

    // Load options
    const savedMultiPv = localStorage.getItem('analysis_multi_pv')
    multiPv.value = savedMultiPv ? parseInt(savedMultiPv, 10) : 3

    const savedSearchTime = localStorage.getItem('analysis_search_time')
    searchTime.value = savedSearchTime ? parseInt(savedSearchTime, 10) : 5

    const savedShowArrows = localStorage.getItem('analysis_show_arrows')
    showArrows.value = savedShowArrows !== 'false'

    const savedVersion = localStorage.getItem('analysis_engine_version') as 'lite' | 'full' | null
    if (savedVersion === 'full' || savedVersion === 'lite') {
      engineVersion.value = savedVersion
    }
    await analysisService.setEngineVariant(engineVersion.value)

    logger.info(
      `[AnalysisStore] Initialized. EngineVersion: ${engineVersion.value}, MultiPV: ${multiPv.value}, SearchTime: ${searchTime.value}, ShowArrows: ${showArrows.value}`,
    )
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
    localStorage.setItem('analysis_multi_pv', String(val))
    await triggerRestart()
  }

  async function setSearchTime(value: number) {
    if (searchTime.value === value) return
    searchTime.value = value
    localStorage.setItem('analysis_search_time', String(value))
    await triggerRestart()
  }

  function setShowArrows(value: boolean) {
    if (showArrows.value === value) return
    showArrows.value = value
    localStorage.setItem('analysis_show_arrows', String(value))
  }

  async function setEngineVersion(version: 'lite' | 'full') {
    if (engineVersion.value === version) return
    engineVersion.value = version
    localStorage.setItem('analysis_engine_version', version)
    await analysisService.setEngineVariant(version)
    await triggerRestart()
  }

  async function startNewGame() {
    await analysisService.startNewGame()
  }

  async function startAnalysis(
    fen: string,
    onLinesUpdate?: (lines: EvaluatedLineWithSan[]) => void,
  ) {
    analysisVersion++
    const currentVersion = analysisVersion

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

    isAnalysisActive.value = true
    logger.info(`[AnalysisStore] Started for FEN: ${fen}`)
  }

  async function stopAnalysis() {
    analysisVersion++
    isAnalysisActive.value = false
    analysisLines.value = []
    boardStore.setDrawableShapes([])
    await analysisService.stopAnalysis()
    logger.info('[AnalysisStore] Stopped.')
  }

  async function toggleAnalysis() {
    if (!isAnalysisActive.value) {
      lastRenderedDepth = 0
      await startNewGame()
      await startAnalysis(boardStore.fen)
    } else {
      await stopAnalysis()
    }
  }

  return {
    isAnalysisActive,
    analysisLines,
    multiPv,
    searchTime,
    showArrows,
    engineVersion,
    initialize,
    setMultiPv,
    setSearchTime,
    setShowArrows,
    setEngineVersion,
    startNewGame,
    startAnalysis,
    stopAnalysis,
    toggleAnalysis,
  }
})
