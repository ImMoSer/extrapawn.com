import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Chess } from '@/shared/lib/engine/coach/chess'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

import { useBoardStore } from '@/entities/game'
import { parseVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
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
  const activeTab = ref<'analysis' | 'console' | 'book' | 'wiki' | 'sf'>('analysis')

  function toggleTab(tab: 'console' | 'book' | 'wiki' | 'sf') {
    activeTab.value = activeTab.value === tab ? 'analysis' : tab
  }

  function setCoachEnabled(enabled: boolean) {
    isCoachEnabled.value = enabled
    if (!enabled) {
      boardStore.setCoachShapes([])
    }
  }

  // Board & Navigation State
  const fen = ref('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
  const fenError = ref<string | null>(null)
  const orientation = ref<'white' | 'black'>('white')

  const stockfishReady = ref(true)
  const wasmReady = ref(true)
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
  const lastFetchedUci = ref<string | null>(null)
  const latestAnalysisToken = ref(0)
  const lastMoveAnalysis = ref<CoachLastMoveAnalysis | null>(null)

  // Backward compatibility properties for other stores / components
  const currentExplanation = computed(() => posExplanation.value)
  const previousExplanation = computed(() => prevPosExplanation.value)
  const selectedMoveExplanation = computed(() => explanation.value)
  const selectedMoveExplanationLoading = computed(() => explanationLoading.value)
  const tablebaseBestMove = ref<Record<string, unknown> | null>(null)

  const showVisuals = ref(false)
  const autoOpenedForBlunder = ref(false)

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

  const turnColor = computed<'white' | 'black'>(() => ((chess.value.turn() as string) === 'w' ? 'white' : 'black'))
  const sideToMove = computed<'w' | 'b'>(() => chess.value.turn())

  // Phase & Material Delta
  const phase = computed(() => {
    try {
      const b = chess.value.board()
      let queens = 0, minors = 0, rooks = 0
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const p = b[r][f]
          if (!p) continue
          if (p.type === 'queen' || (p.type as string) === 'q') queens++
          else if (p.type === 'rook' || (p.type as string) === 'r') rooks++
          else if (p.type === 'bishop' || p.type === 'knight' || (p.type as string) === 'b' || (p.type as string) === 'n') minors++
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
      const VALS: Record<string, number> = { pawn: 1, knight: 3, bishop: 3.25, rook: 5, queen: 9, p: 1, n: 3, b: 3.25, r: 5, q: 9 }
      let w = 0, bl = 0
      for (let r = 0; r < 8; r++)
        for (let f = 0; f < 8; f++) {
          const p = b[r][f]
          if (!p || p.type === 'king' || (p.type as string) === 'k') continue
          const v = VALS[p.type] || 0
          if ((p.color as string) === 'w') w += v
          else bl += v
        }
      return w - bl
    } catch {
      return 0
    }
  })

  // Opening Name
  const openingName = computed(() => null)

  // Last Move Consequence
  const lastMoveConsequence = computed(() => {
    return (lastMoveAnalysis.value?.consequence as string | null) || null
  })

  // Dynamic Active Candidate Plan & Visual Commands (Server-Driven Vision)
  const activeVisualCommands = computed(() => {
    const activeIdx = selectedMoveIndex.value !== null ? selectedMoveIndex.value : 0
    const selMove = topMoves.value[activeIdx] as (CoachTopMove & { visual_commands?: Record<string, unknown> }) | undefined
    return selMove?.visual_commands || null
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
    if (!isCoachEnabled.value || !showVisuals.value) return []
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
      if (isCoachEnabled.value && showVisuals.value) {
        boardStore.setCoachShapes(shapes)
      } else {
        boardStore.setCoachShapes([])
      }
    },
    { immediate: true }
  )

  // Keep coachStore.fen in sync with boardStore.fen
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (isCoachEnabled.value && newFen && newFen !== fen.value) {
        fen.value = newFen
      }
    },
    { immediate: true }
  )

  function getUciFromSan(prevFen: string, san: string): string | null {
    try {
      const c = new Chess(prevFen)
      const verboseMoves = c.moves({ verbose: true })
      const m = verboseMoves.find((move) => move.san === san)
      if (m) return m.from + m.to + (m.promotion || '')
    } catch {
      /* ignore */
    }
    return null
  }



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





  async function runAnalysis(
    currentFen: string,
    force = false,
    overrideLastMoveUci?: string | null,
    overrideFenBefore?: string | null
  ) {
    if (!currentFen) return

    let lastMoveUci: string | null = overrideLastMoveUci ?? null
    const idx = historyIndex.value
    const history = moveHistory.value
    if (lastMoveUci === null && idx > 0 && history && history[idx] && history[idx - 1]) {
      const prev = history[idx - 1]
      const curr = history[idx]
      if (curr && curr.san && prev && prev.fen) {
        lastMoveUci = getUciFromSan(prev.fen, curr.san)
      }
    }

    const reqUci = lastMoveUci || 'null'
    if (!force && currentFen === lastFetchedFen.value && reqUci === lastFetchedUci.value) {
      logger.info(`[UCI_FEN_REQUEST] SKIPPED (Duplicate) | FEN: ${currentFen} | UCI: ${reqUci}`)
      return
    }

    fen.value = currentFen
    lastFetchedFen.value = currentFen
    lastFetchedUci.value = reqUci
    const analysisToken = ++latestAnalysisToken.value

    topMovesLoading.value = true
    explanationLoading.value = true
    selectedMoveIndex.value = null
    explanation.value = null

    try {
      stockfishReady.value = true
      showLoadingBanner.value = false

      const reqFenBefore = overrideFenBefore || ((idx > 0 && history && history[idx - 1]?.fen) ? history[idx - 1].fen : currentFen)
      const payload = { fen_before: reqFenBefore, last_move_uci: reqUci }

      const startTime = performance.now()

      const response = await fetch('/api/coach-engine/uci_fen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const durationMs = (performance.now() - startTime).toFixed(1)

      logger.info(
        `[UCI_FEN_REQUEST] POST /api/coach-engine/uci_fen | Duration: ${durationMs}ms | Status: ${response.status} | Payload: ${JSON.stringify(payload)} | Force: ${force}`
      )

      if (!response.ok) {
        throw new Error(`Server engine HTTP error: ${response.status}`)
      }

      const data = await response.json()
      if (analysisToken !== latestAnalysisToken.value) return

      const rawCandidates = data.engine_candidates || []
      topMoves.value = rawCandidates.map((c: Record<string, unknown>, index: number) => ({
        rank: c.rank || index + 1,
        san: c.san || '',
        uci: c.uci || '',
        move: c.uci || '',
        quality: c.quality || null,
        eval_pawns: typeof c.eval_pawns === 'number' ? c.eval_pawns : 0,
        isMate: !!c.is_mate,
        mateIn: (c.mate_in as number | null) ?? null,
        character: String(c.character || 'Solid'),
        tagline: (c.tagline as string | null) || null,
        plan_brief: (c.plan_brief as string | null) || null,
        wdl: (c.wdl as CoachTopMove['wdl']) || undefined,
        winP: (c.wdl as Record<string, number>)?.win_p ?? null,
        drawP: (c.wdl as Record<string, number>)?.draw_p ?? null,
        lossP: (c.wdl as Record<string, number>)?.loss_p ?? null,
        popularity: (c.wdl as Record<string, number>)?.popularity ?? null,
        totalGames: (c.wdl as Record<string, number>)?.total_games ?? null,
        pvLine: Array.isArray(c.pv_line) ? c.pv_line : [],
        explanation: (c.explanation as CoachTopMove['explanation']) || undefined,
        visual_commands: c.visual_commands || null,
      }))

      if (data.last_move_analysis) {
        const lma = data.last_move_analysis
        const sq = lastMoveUci && lastMoveUci.length >= 4 ? (lastMoveUci.slice(2, 4) as Key) : undefined
        lastMoveAnalysis.value = {
          loading: false,
          san: lma.san || lma.move_san || '',
          quality: lma.quality || undefined,
          summary: lma.summary || undefined,
          details: Array.isArray(lma.details) ? lma.details.join(' ') : lma.details || undefined,
          consequence: lma.consequence || undefined,
          square: sq,
        }
      } else {
        lastMoveAnalysis.value = null
      }

      posExplanation.value = data

      if (topMoves.value.length > 0) {
        selectedMoveIndex.value = 0
        explanation.value = (topMoves.value[0].explanation as unknown as CoachLastMoveAnalysis) || null
      }
    } catch (err) {
      logger.warn('[CoachStore] Server-driven analysis request failed:', err)
    } finally {
      topMovesLoading.value = false
      explanationLoading.value = false
    }
  }

  async function fetchTopMoves(fenToUse: string) {
    await runAnalysis(fenToUse, true)
  }

  async function explainTopMove(move: { uci: string; move?: string }, index: number) {
    selectMove(index)
  }

  async function analyzeCurrentPosition(
    customFen?: string,
    overrideLastMoveUci?: string | null,
    overrideFenBefore?: string | null
  ) {
    const fenToUse = customFen || pgnService.getCurrentNavigatedFen() || boardStore.fen || fen.value
    fen.value = fenToUse
    await runAnalysis(fenToUse, true, overrideLastMoveUci, overrideFenBefore)
  }

  function selectMove(idx: number) {
    if (!topMoves.value[idx]) return
    selectedMoveIndex.value = idx
    explanation.value = (topMoves.value[idx].explanation as unknown as CoachLastMoveAnalysis) || null
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

  function loadRandomPosition() {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    fen.value = startFen
    moveHistory.value = [{ fen: startFen, san: null }]
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
    lastFetchedFen.value = ''
    lastFetchedUci.value = null
    boardStore.setCoachShapes([])
  }




  const isAnalyzing = computed(() => topMovesLoading.value || explanationLoading.value)
  const currentOpeningInfo = computed(() => null)

  function enableVisualsForBlunder() {
    if (!showVisuals.value) {
      autoOpenedForBlunder.value = true
      showVisuals.value = true
      logger.info('[CoachStore] Auto-enabled board visuals for blunder position')
    }
  }

  function resetVisualsAfterBlunderDecision() {
    if (autoOpenedForBlunder.value) {
      showVisuals.value = false
      autoOpenedForBlunder.value = false
      logger.info('[CoachStore] Reset board visuals (eye OFF) after blunder decision')
    }
  }

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    autoOpenedForBlunder.value = false
  }

  return {
    isCoachEnabled,
    activeTab,
    toggleTab,
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
    autoOpenedForBlunder,
    enableVisualsForBlunder,
    resetVisualsAfterBlunderDecision,
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

