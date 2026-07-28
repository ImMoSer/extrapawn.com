import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Chess } from 'chess.js'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

import { useBoardStore } from '@/entities/game'
import { analyzeMove, isReady as wasmIsReady, ensureReady as ensureWasmReady } from '@/shared/lib/engine/coach/analyzer-rs'
import { buildFullExplanation } from '@/shared/lib/engine/coach/full-explanation'
import { getRandomPuzzle } from '@/shared/lib/engine/coach/positions'
import { topConsequenceLine } from '@/shared/lib/engine/coach/connectors'
import { getTopMoves, explainMoveAt } from '@/shared/lib/engine/coach/analysis'
import { findOpeningFromHistory } from '@/shared/lib/engine/coach/openings'
import { parseVisualCommands, generateVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import logger from '@/shared/lib/logger'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'

export function getBrushForQuality(quality?: string | null): string {
  switch (quality) {
    case 'brilliant': return 'cyan'
    case 'great':
    case 'best':
    case 'excellent': return 'green'
    case 'good': return 'blue'
    case 'neutral': return 'gray'
    case 'inaccuracy': return 'yellow'
    case 'mistake': return 'orange'
    case 'blunder':
    case 'missed_mate': return 'red'
    default: return 'green'
  }
}

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()

  // Coach Enabled State
  const isCoachEnabled = ref(true)

  function setCoachEnabled(enabled: boolean) {
    isCoachEnabled.value = enabled
    if (!enabled) {
      boardStore.setCoachShapes([])
    } else {
      analyzeCurrentPosition()
    }
  }

  // Board & Navigation State
  const fen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const fenError = ref<string | null>(null)
  const orientation = ref<'white' | 'black'>('white')

  const stockfishReady = ref(true)
  const wasmReady = ref(wasmIsReady())
  const showLoadingBanner = ref(false)

  const moveHistory = ref<Array<{ fen: string; san: string | null }>>([
    { fen: fen.value, san: null },
  ])
  const historyIndex = ref(0)

  // Analysis State
  const evalCp = ref<number | null>(null)
  const evalMate = ref<number | null>(null)
  const gameResult = ref<string | null>(null)
  const topMoves = ref<CoachTopMove[]>([])
  const topMovesLoading = ref(false)

  const selectedMoveIndex = ref<number | null>(null)
  const explanation = ref<CoachLastMoveAnalysis | null>(null)
  const explanationLoading = ref(false)

  const posExplanation = ref<CoachExplanation | null>(null)
  const prevPosExplanation = ref<CoachExplanation | null>(null)

  const heatmapVisible = ref(false)
  const heatmapLoading = ref(false)
  const heatmapPieces = ref<Record<string, unknown> | null>(null)

  const lastFetchedFen = ref('')
  const latestAnalysisToken = ref(0)
  const lastMoveAnalysis = ref<CoachLastMoveAnalysis | null>(null)

  // Backward compatibility properties for other stores / components
  const currentExplanation = computed(() => posExplanation.value)
  const previousExplanation = computed(() => prevPosExplanation.value)
  const selectedMoveExplanation = computed(() => explanation.value)
  const selectedMoveExplanationLoading = computed(() => explanationLoading.value)
  const tablebaseBestMove = ref<Record<string, unknown> | null>(null)

  const showVisuals = ref(false)

  // LLM Coach State & Actions for Sparring / AI
  const isLlmThinking = ref(false)
  const llmMessage = ref<string | null>(null)
  const llmMood = ref<string | null>(null)

  function setLlmThinking(thinking: boolean) {
    isLlmThinking.value = thinking
  }

  function setLlmResponse(response: { message: string; mood?: string | null } | null) {
    if (response) {
      llmMessage.value = response.message
      llmMood.value = response.mood || null
    } else {
      llmMessage.value = null
      llmMood.value = null
    }
  }

  function resetLlmState() {
    isLlmThinking.value = false
    llmMessage.value = null
    llmMood.value = null
  }

  function executeVisualCommands(actionStr: string) {
    if (!actionStr) return
    const parsed = parseVisualCommands(actionStr)
    if (parsed && parsed.length > 0) {
      boardStore.setCoachShapes(parsed as DrawShape[])
    }
  }

  // Chess Instance
  const chess = computed(() => {
    try {
      return new Chess(fen.value)
    } catch {
      return new Chess()
    }
  })

  const turnColor = computed<'white' | 'black'>(() => (chess.value.turn() === 'w' ? 'white' : 'black'))
  const sideToMove = computed(() => chess.value.turn())

  // Phase & Material Delta
  const phase = computed(() => {
    try {
      const b = chess.value.board()
      let queens = 0, minors = 0, rooks = 0
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const p = b[r][f]
          if (!p) continue
          if (p.type === 'q') queens++
          else if (p.type === 'r') rooks++
          else if (p.type === 'b' || p.type === 'n') minors++
        }
      if (queens === 0 || (queens <= 2 && minors + rooks <= 4)) return 'endgame'
      const totalMoves = moveHistory.value.length
      if (totalMoves < 12) return 'opening'
      return 'middlegame'
    } catch {
      return 'middlegame'
    }
  })

  const materialDelta = computed(() => {
    try {
      const b = chess.value.board()
      const VALS: Record<string, number> = { p: 1, n: 3, b: 3.25, r: 5, q: 9 }
      let w = 0, bl = 0
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const p = b[r][f]
          if (!p || p.type === 'k') continue
          const v = VALS[p.type] || 0
          if (p.color === 'w') w += v
          else bl += v
        }
      return w - bl
    } catch {
      return 0
    }
  })

  // Opening Name
  const openingName = computed(() => {
    if (moveHistory.value.length <= 1) return null
    const sans = moveHistory.value.slice(1).map((m) => m.san).filter(Boolean) as string[]
    return findOpeningFromHistory(sans)
  })

  // Last Move Consequence
  const lastMoveConsequence = computed(() => {
    if (!prevPosExplanation.value || !posExplanation.value) return null
    return topConsequenceLine(prevPosExplanation.value, posExplanation.value)
  })

  // Dynamic Active Candidate Plan & Visual Commands
  const activeVisualCommands = computed(() => {
    if (!posExplanation.value) return null
    const baseBlob = posExplanation.value

    const activeIdx = selectedMoveIndex.value !== null ? selectedMoveIndex.value : 0
    const selMove = topMoves.value[activeIdx]
    const pvArray = selMove?.rawPv || (Array.isArray(selMove?.pv) ? selMove.pv : null)

    if (!selMove || !Array.isArray(pvArray) || pvArray.length === 0) {
      return baseBlob.visual_commands
    }

    let curFen = fen.value
    const planSteps: Array<{ uci: string; san: string; motifs: string[]; headline: string | null; to: string; from: string }> = []
    for (let i = 0; i < Math.min(pvArray.length, 8); i++) {
      const uci = pvArray[i]
      if (!uci || uci.length < 4) break
      const result = analyzeMove(curFen, uci)
      if (!result) break
      planSteps.push({
        uci,
        san: result.san,
        motifs: (result.motifs || []).map((m: { id: string }) => m.id),
        headline: (result.motifs?.[0]?.phrase || null) as string | null,
        to: uci.slice(2, 4),
        from: uci.slice(0, 2),
      })


      if (!result.fen_after) break
      curFen = result.fen_after
    }

    const stm = chess.value.turn() === 'w' ? 'white' : 'black'
    return generateVisualCommands(
      {
        ...baseBlob,
        lastMoveAnalysis: lastMoveAnalysis.value,
        lastMoveConsequence: lastMoveConsequence.value,
        selectedMoveExplanation: explanation.value,
      },
      fen.value,
      stm,
      planSteps,
      baseBlob.principal_plan?.key_squares || []
    )
  })

  const activePosExplanation = computed(() => {
    if (!posExplanation.value) return null
    const base = {
      ...posExplanation.value,
      lastMoveAnalysis: lastMoveAnalysis.value,
      lastMoveConsequence: lastMoveConsequence.value,
      selectedMoveExplanation: explanation.value,
    }
    if (!activeVisualCommands.value) return base
    return {
      ...base,
      visual_commands: activeVisualCommands.value,
    }
  })

  // SVG Shapes (arrows & NAGs) for Chessground
  const drawableShapes = computed<DrawShape[]>(() => {
    if (!isCoachEnabled.value) return []
    const shapes: DrawShape[] = []

    // 1. Visual commands generated for active candidate move plan
    if (activeVisualCommands.value) {
      const commandsStr = Object.values(activeVisualCommands.value).flat().join(';')
      const parsed = parseVisualCommands(commandsStr)
      shapes.push(...(parsed as DrawShape[]))
    }

    // 2. Active Candidate Move arrow & NAG badge
    const activeIdx = selectedMoveIndex.value !== null ? selectedMoveIndex.value : (topMoves.value.length > 0 ? 0 : null)
    if (activeIdx !== null && topMoves.value[activeIdx]) {
      const sel = topMoves.value[activeIdx]
      const moveUci = sel.move || sel.uci
      if (moveUci) {
        const orig = moveUci.slice(0, 2) as Key
        const dest = moveUci.slice(2, 4) as Key
        const rawQuality = sel.quality || (activeIdx === selectedMoveIndex.value && explanation.value?.quality)
        const quality = typeof rawQuality === 'string' ? rawQuality : null

        const brush = getBrushForQuality(quality)


        shapes.push({ orig, dest, brush })
        shapes.push({ orig: dest, brush })

        if (quality) {
          shapes.push({ orig: dest, customNag: quality } as unknown as DrawShape)
        }
      }
    }

    return shapes
  })

  // Keep boardStore shapes in sync with coach shapes
  watch(
    drawableShapes,
    (shapes) => {
      if (isCoachEnabled.value) {
        boardStore.setCoachShapes(shapes)
      } else {
        boardStore.setCoachShapes([])
      }
    },
    { immediate: true }
  )

  function getUciFromSan(prevFen: string, san: string): string | null {
    try {
      const c = new Chess(prevFen)
      const verboseMoves = c.moves({ verbose: true })
      const m = verboseMoves.find((m) => m.san === san)
      if (m) return m.from + m.to + (m.promotion || '')
    } catch {
      /* ignore */
    }
    return null
  }

  async function fetchLastMoveAnalysis() {
    if (!isCoachEnabled.value) return

    // 1. Try PGN Service node
    const lastNode = pgnService.getCurrentNode()
    if (lastNode && lastNode.parent) {
      const prevFen = lastNode.parent.fenAfter
      const uci = lastNode.uci || (lastNode.san ? getUciFromSan(prevFen, lastNode.san) : null)
      if (uci) {
        const sq = uci.slice(2, 4) as Key
        lastMoveAnalysis.value = { loading: true, san: lastNode.san, fen: prevFen, square: sq }
        try {
          const r = await explainMoveAt(prevFen, uci)
          lastMoveAnalysis.value = { ...r, loading: false, fen: prevFen, square: sq }
          return
        } catch {
          lastMoveAnalysis.value = null
        }
      }
    }

    // 2. Fall back to moveHistory & historyIndex
    const idx = historyIndex.value
    const history = moveHistory.value
    if (idx > 0 && history && history[idx] && history[idx - 1]) {
      const prev = history[idx - 1]
      const curr = history[idx]
      if (curr && curr.san && prev && prev.fen) {
        const uci = getUciFromSan(prev.fen, curr.san)
        if (uci) {
          const sq = uci.slice(2, 4) as Key
          lastMoveAnalysis.value = { loading: true, san: curr.san, fen: prev.fen, square: sq }
          try {
            const r = await explainMoveAt(prev.fen, uci)
            lastMoveAnalysis.value = { ...r, loading: false, fen: prev.fen, square: sq }
            return
          } catch {
            lastMoveAnalysis.value = null
          }
        }
      }
    }

    lastMoveAnalysis.value = null
  }

  // Last Move Analysis Effect
  watch(
    [historyIndex, moveHistory],
    () => {
      fetchLastMoveAnalysis()
    },
    { immediate: true }
  )

  // Sync lastMoveAnalysis quality to boardStore.lastNag for vector SVG rendering
  watch(
    lastMoveAnalysis,
    (val) => {
      const sq = (val?.square as Key) || (boardStore.lastMove ? (boardStore.lastMove[1] as Key) : null)
      if (val && !val.loading && val.quality && sq) {
        boardStore.lastNag = {
          square: sq,
          quality: val.quality,
        }
      } else if (!val) {
        boardStore.lastNag = null
      }
    },
    { immediate: true }
  )





  // Analysis Trigger
  async function runAnalysis(currentFen: string, force = false) {
    if (!currentFen) return
    if (!force && currentFen === lastFetchedFen.value) return
    lastFetchedFen.value = currentFen
    const analysisToken = ++latestAnalysisToken.value

    topMovesLoading.value = true
    explanationLoading.value = true
    selectedMoveIndex.value = null
    explanation.value = null

    try {
      stockfishReady.value = true
      showLoadingBanner.value = !wasmReady.value
      await ensureWasmReady()
      wasmReady.value = true

      const isSparringOrRepertoire = typeof window !== 'undefined' && (
        window.location.pathname.includes('/sparring') ||
        window.location.hash.includes('/sparring') ||
        window.location.pathname.includes('/repertoire') ||
        window.location.hash.includes('/repertoire')
      )

      const res = await getTopMoves(currentFen, 10, { check_book: isSparringOrRepertoire })
      stockfishReady.value = true
      showLoadingBanner.value = false
      if (analysisToken !== latestAnalysisToken.value) return

      topMoves.value = res.moves || []
      evalCp.value = res.eval_cp ?? null
      evalMate.value = res.mate ?? null
      gameResult.value = res.result ?? null
      topMovesLoading.value = false

      if (topMoves.value.length > 0) {
        selectedMoveIndex.value = 0
        const bestMoveUci = topMoves.value[0].move || topMoves.value[0].uci
        const exp = await explainMoveAt(currentFen, bestMoveUci)
        if (analysisToken === latestAnalysisToken.value) {
          explanation.value = exp
          explanationLoading.value = false
        }
      }
    } catch {
      topMovesLoading.value = false
      explanationLoading.value = false
    }

    try {
      prevPosExplanation.value = posExplanation.value
      const pExp = await buildFullExplanation(currentFen)
      if (analysisToken === latestAnalysisToken.value) {
        posExplanation.value = pExp
      }
    } catch {
      /* ignore */
    }
  }

  async function fetchTopMoves(fenToUse: string) {
    await runAnalysis(fenToUse, true)
  }



  async function explainTopMove(move: { uci: string; move?: string }, index: number) {
    await selectMove(index)
  }

  async function analyzeCurrentPosition(customFen?: string) {
    const fenToUse = customFen || pgnService.getCurrentNavigatedFen() || boardStore.fen || fen.value
    fen.value = fenToUse
    await runAnalysis(fenToUse, true)
  }

  async function selectMove(idx: number) {
    if (!topMoves.value[idx]) return
    selectedMoveIndex.value = idx
    explanationLoading.value = true
    const moveUci = topMoves.value[idx].move || topMoves.value[idx].uci
    try {
      explanation.value = await explainMoveAt(fen.value, moveUci)
    } catch {
      explanation.value = null
    } finally {
      explanationLoading.value = false
    }
  }

  function selectHistoryMove(payload: { fen: string; index: number }) {
    historyIndex.value = payload.index
    fen.value = payload.fen
  }

  function goBack() {
    if (historyIndex.value > 0) {
      const idx = historyIndex.value - 1
      historyIndex.value = idx
      fen.value = moveHistory.value[idx].fen
    }
  }

  function goForward() {
    if (historyIndex.value < moveHistory.value.length - 1) {
      const idx = historyIndex.value + 1
      historyIndex.value = idx
      fen.value = moveHistory.value[idx].fen
    }
  }

  async function loadRandomPosition() {
    const puzzle = await getRandomPuzzle()
    if (!puzzle || !puzzle.initialFen) return
    fen.value = puzzle.initialFen
    moveHistory.value = [{ fen: puzzle.initialFen, san: null }]
    historyIndex.value = 0
    fenError.value = null
  }

  function flipBoard() {
    orientation.value = orientation.value === 'white' ? 'black' : 'white'
  }

  function resetBoard() {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    fen.value = startFen
    moveHistory.value = [{ fen: startFen, san: null }]
    historyIndex.value = 0
    fenError.value = null
  }

  function handleFenSubmit(newFen: string) {
    try {
      const c = new Chess(newFen)
      const validatedFen = c.fen()
      fen.value = validatedFen
      moveHistory.value = [{ fen: validatedFen, san: null }]
      historyIndex.value = 0
      fenError.value = null
    } catch (err: unknown) {
      fenError.value = err instanceof Error ? err.message : 'Invalid FEN'
    }
  }


  function handleSettingsChange() {
    stockfishReady.value = true
    lastFetchedFen.value = ''
    runAnalysis(fen.value, true)
  }

  function reset() {
    logger.info('[CoachStore] Resetting coach state.')
    isCoachEnabled.value = false
    topMoves.value = []
    lastMoveAnalysis.value = null
    selectedMoveIndex.value = null
    explanation.value = null
    posExplanation.value = null
    prevPosExplanation.value = null
    boardStore.setCoachShapes([])
  }

  // Watch fen changes to run analysis
  watch(
    fen,
    async (currentFen) => {
      if (isCoachEnabled.value) {
        await runAnalysis(currentFen)
        await fetchLastMoveAnalysis()
      }
    },
    { immediate: true }
  )

  // Watch PGN Tree Version for navigation sync
  watch(
    () => pgnTreeVersion.value,
    async () => {
      if (!isCoachEnabled.value) return
      const navFen = pgnService.getCurrentNavigatedFen()
      if (navFen && navFen !== fen.value) {
        fen.value = navFen
      }
      await fetchLastMoveAnalysis()
    },
    { flush: 'sync' }
  )


  const isAnalyzing = computed(() => topMovesLoading.value || explanationLoading.value)
  const currentOpeningInfo = computed(() => null)

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
  }

  return {
    isCoachEnabled,
    isAnalyzing,
    setCoachEnabled,
    fen,
    fenError,
    orientation,
    moveHistory,
    historyIndex,
    turnColor,
    sideToMove,
    phase,
    materialDelta,
    openingName,
    topMoves,
    topMovesLoading,
    selectedMoveIndex,
    explanation,
    explanationLoading,
    posExplanation,
    prevPosExplanation,
    lastMoveAnalysis,
    lastMoveConsequence,
    activeVisualCommands,
    activePosExplanation,
    drawableShapes,
    heatmapVisible,
    heatmapLoading,
    heatmapPieces,
    evalCp,
    evalMate,
    gameResult,
    stockfishReady,
    wasmReady,
    showLoadingBanner,

    // Backward compatibility aliases
    currentExplanation,
    previousExplanation,
    currentOpeningInfo,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    tablebaseBestMove,
    showVisuals,
    toggleVisuals,

    // LLM Coach
    isLlmThinking,
    llmMessage,
    llmMood,
    setLlmThinking,
    setLlmResponse,
    resetLlmState,

    executeVisualCommands,
    fetchTopMoves,
    fetchLastMoveAnalysis,
    explainTopMove,

    runAnalysis,
    analyzeCurrentPosition,
    selectMove,
    selectHistoryMove,
    goBack,
    goForward,
    loadRandomPosition,
    flipBoard,
    resetBoard,
    handleFenSubmit,
    handleSettingsChange,
    reset,
  }
})

