import logger from '@/shared/lib/logger'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { analysisService, type EvaluatedLineWithSan } from '../api/AnalysisService'

export const useAnalysisEngineStore = defineStore('analysis-engine', () => {
  const isAnalysisActive = ref(false)
  const isLoading = ref(false)
  const analysisLines = ref<EvaluatedLineWithSan[]>([])
  const isLocalEngineAvailable = ref(false)
  const maxThreads = ref(1)
  const numThreads = ref(1)
  const playerColor = ref<'white' | 'black' | null>(null)

  // Internal versioning to prevent race conditions
  let analysisVersion = 0

  async function initialize() {
    await analysisService.initialize()
    isLocalEngineAvailable.value = analysisService.isLocalEngineAvailable()
    maxThreads.value = analysisService.getMaxThreads()

    // Load threads preference
    const savedThreads = localStorage.getItem('analysis_threads')
    const defaultThreads = maxThreads.value > 2 ? 2 : 1
    numThreads.value = savedThreads
      ? Math.min(parseInt(savedThreads, 10), maxThreads.value)
      : defaultThreads

    logger.info(
      `[AnalysisEngineStore] Initialized. Threads: ${numThreads.value}/${maxThreads.value}`,
    )
  }

  async function setThreads(count: number) {
    const newCount = Math.max(1, Math.min(count, maxThreads.value))
    if (numThreads.value === newCount) return

    numThreads.value = newCount
    localStorage.setItem('analysis_threads', String(newCount))

    if (isAnalysisActive.value) {
      // First stop the engine properly
      await analysisService.stopAnalysis()
      // Then set the option (which now internally waits for readyok)
      await analysisService.setThreads(newCount)
      // The consumer or a higher-level watch will likely trigger startAnalysis again
      // with the current FEN to resume.
    } else {
      // If not active, just pre-set the option for the next start
      await analysisService.setThreads(newCount)
    }
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

    // Check if interrupted by stopAnalysis during the await above
    if (analysisVersion !== currentVersion) return

    isLoading.value = true
    analysisLines.value = []

    // REMOVED redundant setThreads call. Threads are now set only during init or manual change.

    await analysisService.startAnalysis(fen, (lines) => {
      if (!isAnalysisActive.value || analysisVersion !== currentVersion) return

      isLoading.value = false

      // Merge lines strategy
      const lineMap = new Map(analysisLines.value.map((l) => [l.id, l]))
      lines.forEach((l) => lineMap.set(l.id, l))
      const sortedLines = Array.from(lineMap.values()).sort((a, b) => a.id - b.id)

      analysisLines.value = sortedLines

      if (onLinesUpdate) {
        onLinesUpdate(sortedLines)
      }
    })

    // RACE CONDITION GUARD: If stopAnalysis or another startAnalysis was called
    // while we were waiting for the asyc operations above, we must abort and
    // NOT set the active flag back to true.
    if (analysisVersion !== currentVersion) {
      logger.info(`[AnalysisEngineStore] Aborted start for FEN: ${fen} due to version change.`)
      return
    }

    isAnalysisActive.value = true
    logger.info(`[AnalysisEngineStore] Started for FEN: ${fen}`)
  }

  async function stopAnalysis() {
    analysisVersion++
    isAnalysisActive.value = false
    isLoading.value = false
    analysisLines.value = []
    await analysisService.stopAnalysis()
    logger.info('[AnalysisEngineStore] Stopped.')
  }

  function setPlayerColor(color: 'white' | 'black' | null) {
    playerColor.value = color
  }

  return {
    isAnalysisActive,
    isLoading,
    analysisLines,
    isLocalEngineAvailable,
    maxThreads,
    numThreads,
    playerColor,
    initialize,
    setThreads,
    startNewGame,
    startAnalysis,
    stopAnalysis,
    setPlayerColor,
  }
})
