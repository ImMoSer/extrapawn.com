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

  // Options
  const multiPv = ref(3)
  const searchTime = ref(5) // 99 represents Infinity
  const showArrows = ref(true)
  const engineVersion = ref<'lite' | 'full'>('lite')

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
      `[AnalysisEngineStore] Initialized. EngineVersion: ${engineVersion.value}, Threads: ${numThreads.value}/${maxThreads.value}, MultiPV: ${multiPv.value}, SearchTime: ${searchTime.value}, ShowArrows: ${showArrows.value}`,
    )
  }

  async function setThreads(count: number) {
    const newCount = Math.max(1, Math.min(count, maxThreads.value))
    if (numThreads.value === newCount) return

    numThreads.value = newCount
    localStorage.setItem('analysis_threads', String(newCount))

    if (isAnalysisActive.value) {
      await analysisService.stopAnalysis()
      await analysisService.setThreads(newCount)
    } else {
      await analysisService.setThreads(newCount)
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
    isLoading.value = true
    await analysisService.setEngineVariant(version)
    isLoading.value = false
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

    // Check if interrupted by stopAnalysis during the await above
    if (analysisVersion !== currentVersion) return

    isLoading.value = true
    analysisLines.value = []

    const options = {
      multiPv: multiPv.value,
      movetime: (searchTime.value === 99 || searchTime.value <= 0) ? 0 : searchTime.value * 1000,
    }

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
    }, options)

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
    multiPv,
    searchTime,
    showArrows,
    engineVersion,
    initialize,
    setThreads,
    setMultiPv,
    setSearchTime,
    setShowArrows,
    setEngineVersion,
    startNewGame,
    startAnalysis,
    stopAnalysis,
    setPlayerColor,
  }
})
