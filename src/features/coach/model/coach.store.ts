import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { Chess, uciToSan } from '@/shared/lib/engine/coach/chess'
import { parseVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import { sendCoachWebhook } from '@/shared/api/n8nCoachApi'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'
import { QUALITY_LABEL } from '@/shared/lib/engine/coach/coach.types'

export interface CoachVisualLayers {
  lastMoveNag: boolean
  candidateArrow: boolean
  tacticalPlans: boolean
}

export type CoachMood = 'neutral' | 'proud' | 'shocked' | 'thoughtful' | 'warning' | 'relieved' | 'celebrating'

export type MoveState = 'IDLE' | 'USER_PENDING_EVAL' | 'DECISION_REQUIRED' | 'COMMITTED'

export interface PendingMoveInfo {
  uci: string
  san: string
  fenBefore: string
  fenAfter: string
  quality: string | null
  winRateLoss: number | null
  bestMoveSan: string | null
  nag: string | null
  summary: string | null
}

export type BotMoveHandler = (fen: string) => Promise<void>

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
  const authStore = useAuthStore()
  const gameStore = useGameStore()

  // Coach Enabled State
  const isCoachEnabled = ref(true)

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

  // Backward compatibility properties
  const currentExplanation = computed(() => posExplanation.value)
  const previousExplanation = computed(() => prevPosExplanation.value)
  const selectedMoveExplanation = computed(() => explanation.value)
  const selectedMoveExplanationLoading = computed(() => explanationLoading.value)
  const tablebaseBestMove = ref<Record<string, unknown> | null>(null)

  const showVisuals = ref(false)
  const autoOpenedForBlunder = ref(false)

  const visualLayers = ref<CoachVisualLayers>({
    lastMoveNag: true,
    candidateArrow: true,
    tacticalPlans: true,
  })

  function toggleVisualLayer(layer: keyof CoachVisualLayers) {
    visualLayers.value[layer] = !visualLayers.value[layer]
  }

  // LLM Coach State & Actions
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

  // Analysis Triggering
  const isAnalyzing = computed(() => topMovesLoading.value || explanationLoading.value)

  function enableVisualsForBlunder() {
    if (!showVisuals.value) {
      showVisuals.value = true
      autoOpenedForBlunder.value = true
    }
    visualLayers.value.candidateArrow = true
    visualLayers.value.tacticalPlans = true
  }

  function resetVisualsAfterBlunderDecision() {
    if (autoOpenedForBlunder.value) {
      showVisuals.value = false
      autoOpenedForBlunder.value = false
    }
  }

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    if (!showVisuals.value) {
      autoOpenedForBlunder.value = false
      boardStore.setCoachShapes([])
    } else if (posExplanation.value?.action) {
      executeVisualCommands(posExplanation.value.action)
    }
  }

  const sideToMove = computed<'w' | 'b'>(() => {
    const parts = fen.value.split(' ')
    return parts[1] === 'b' ? 'b' : 'w'
  })

  const phase = computed<string>(() => {
    const exp = posExplanation.value
    return exp?.game_phase || 'middlegame'
  })

  const materialDelta = computed<number>(() => {
    const exp = posExplanation.value
    return exp?.material_imbalance ?? 0
  })

  const openingName = computed<string | null>(() => {
    const exp = posExplanation.value
    return exp?.opening_name || null
  })

  const activePosExplanation = computed(() => posExplanation.value)

  const currentOpeningInfo = computed(() => {
    const exp = posExplanation.value
    if (!exp?.opening_eco && !exp?.opening_name) return null
    return {
      eco: exp.opening_eco || '',
      name: exp.opening_name || '',
      wiki_url: exp.wikibooks_url || null,
    }
  })

  const lastMoveConsequence = computed<string | null>(() => {
    const exp = posExplanation.value
    if (!exp) return null
    return exp.strategic_summary || exp.key_imbalance || null
  })

  const candidateArrowShape = computed<DrawShape | null>(() => {
    if (!showVisuals.value || !visualLayers.value.candidateArrow) return null
    const exp = posExplanation.value
    if (!exp?.engine_best_move || exp.engine_best_move.length < 4) return null

    const orig = exp.engine_best_move.slice(0, 2) as Key
    const dest = exp.engine_best_move.slice(2, 4) as Key

    return {
      orig,
      dest,
      brush: 'green',
      modifiers: { lineWidth: 10 },
    }
  })

  const drawableShapes = computed<DrawShape[]>(() => {
    const shapes: DrawShape[] = []
    if (candidateArrowShape.value) {
      shapes.push(candidateArrowShape.value)
    }
    return shapes
  })

  watch(
    drawableShapes,
    (shapes) => {
      if (isCoachEnabled.value) {
        boardStore.setCoachShapes(shapes)
      }
    },
    { immediate: true },
  )

  async function runAnalysis(
    currentFen: string,
    force = false,
    overrideLastMoveUci?: string | null,
    overrideFenBefore?: string | null,
  ) {
    if (!currentFen) return
    if (overrideFenBefore) {
      logger.info(`[UCI_FEN_REQUEST] overrideFenBefore: ${overrideFenBefore}`)
    }

    const { startFen, moves } = pgnService.getAnalysisPayloadContext(overrideLastMoveUci)
    const lastMoveUci = moves.length > 0 ? moves[moves.length - 1] : null

    const payloadKeyUci = lastMoveUci || 'null'
    if (!force && currentFen === lastFetchedFen.value && payloadKeyUci === lastFetchedUci.value) {
      logger.info(`[UCI_FEN_REQUEST] SKIPPED (Duplicate) | FEN: ${currentFen} | UCI: ${payloadKeyUci}`)
      return
    }

    fen.value = currentFen
    lastFetchedFen.value = currentFen
    lastFetchedUci.value = payloadKeyUci
    const analysisToken = ++latestAnalysisToken.value

    topMovesLoading.value = true
    explanationLoading.value = true
    selectedMoveIndex.value = null
    explanation.value = null
    topMoves.value = []
    posExplanation.value = null
    lastMoveAnalysis.value = null

    try {
      stockfishReady.value = true
      const userId = authStore.effectiveLichessUsername || authStore.userProfile?.username || authStore.userProfile?.id || 'default_user'

      const payload = {
        user_id: userId,
        start_fen: startFen,
        moves,
      }

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
      logger.info(`[CoachStore:Analysis] runAnalysis RECEIVED RESPONSE | engine_candidates count: ${rawCandidates.length}`)
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
        whiteP: (c.wdl as Record<string, number>)?.white ?? (c.wdl as Record<string, number>)?.win_p ?? null,
        drawP: (c.wdl as Record<string, number>)?.draw ?? (c.wdl as Record<string, number>)?.draw_p ?? null,
        blackP: (c.wdl as Record<string, number>)?.black ?? (c.wdl as Record<string, number>)?.loss_p ?? null,
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
        const topMove = topMoves.value[0]
        if (topMove.isMate) {
          evalMate.value = topMove.mateIn
          evalCp.value = null
        } else {
          evalMate.value = null
          evalCp.value = Math.round(topMove.eval_pawns * 100)
        }
      }
    } catch (err) {
      logger.warn('[CoachStore] Server-driven analysis request failed:', err)
    } finally {
      topMovesLoading.value = false
      explanationLoading.value = false
    }
  }

  async function analyzeCurrentPosition() {
    await runAnalysis(fen.value)
  }

  function fetchTopMoves() {
    runAnalysis(fen.value)
  }

  function explainTopMove(index: number) {
    selectedMoveIndex.value = index
  }

  function selectMove(index: number) {
    selectedMoveIndex.value = index
  }

  function selectHistoryMove(param: number | { fen?: string; index: number }) {
    const index = typeof param === 'number' ? param : param.index
    if (index >= 0 && index < moveHistory.value.length) {
      historyIndex.value = index
      const item = moveHistory.value[index]
      if (item) {
        fen.value = item.fen
        runAnalysis(item.fen, true)
      }
    }
  }

  function goBack() {
    if (historyIndex.value > 0) {
      selectHistoryMove(historyIndex.value - 1)
    }
  }

  function goForward() {
    if (historyIndex.value < moveHistory.value.length - 1) {
      selectHistoryMove(historyIndex.value + 1)
    }
  }

  function loadRandomPosition() {
    const randomFens = [
      'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5',
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4',
      'rnbqk2r/pppp1ppp/4pn2/8/2PP4/2P5/P3PPPP/R1BQKBNR w KQkq - 0 5',
    ]
    const nextFen = randomFens[Math.floor(Math.random() * randomFens.length)]!
    fen.value = nextFen
    moveHistory.value = [{ fen: nextFen, san: null }]
    historyIndex.value = 0
    runAnalysis(nextFen)
  }

  function flipBoard() {
    orientation.value = orientation.value === 'white' ? 'black' : 'white'
  }

  function resetBoard() {
    const defaultFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    fen.value = defaultFen
    moveHistory.value = [{ fen: defaultFen, san: null }]
    historyIndex.value = 0
    selectedMoveIndex.value = null
    explanation.value = null
    posExplanation.value = null
    prevPosExplanation.value = null
    topMoves.value = []
    boardStore.setCoachShapes([])
    resetLlmState()
    resetSession(null)
    runAnalysis(defaultFen)
  }

  function handleFenSubmit(newFen: string) {
    try {
      new Chess(newFen)
      fen.value = newFen
      fenError.value = null
      moveHistory.value = [{ fen: newFen, san: null }]
      historyIndex.value = 0
      runAnalysis(newFen)
    } catch {
      fenError.value = 'Invalid FEN string'
    }
  }

  function handleSettingsChange() {
    runAnalysis(fen.value)
  }

  function reset() {
    resetBoard()
  }

  // --- COACH FEEDBACK STATE & LOGIC ---
  const coachMood = ref<CoachMood>('neutral')
  const isTakebackPending = ref(false)
  const takebackMessage = ref<string | null>(null)
  const pendingTakebackFen = ref<string | null>(null)

  // Watch isAnalyzing and lastMoveAnalysis for feedback & blunder takebacks
  watch(
    isAnalyzing,
    (analyzing) => {
      if (analyzing) {
        coachMood.value = 'thoughtful'
        return
      }

      const analysis: CoachLastMoveAnalysis | null = lastMoveAnalysis.value
      if (!analysis || analysis.loading) {
        coachMood.value = 'neutral'
        return
      }

      const currentFen = pgnService.getCurrentNavigatedFen()

      if (isTakebackPending.value && pendingTakebackFen.value && currentFen !== pendingTakebackFen.value) {
        isTakebackPending.value = false
        takebackMessage.value = null
        pendingTakebackFen.value = null
        resetVisualsAfterBlunderDecision()
      }

      const prevFen = analysis.fen
      const sideToMove = prevFen ? prevFen.split(' ')[1] : null
      const movingColor = sideToMove === 'w' ? 'white' : 'black'
      const isUserMove = movingColor === boardStore.orientation

      const hasHighWinRateLoss = isUserMove && analysis.quality && typeof analysis.winRateLoss === 'number' && analysis.winRateLoss >= 20

      if (hasHighWinRateLoss) {
        isTakebackPending.value = true
        pendingTakebackFen.value = prevFen || null
        enableVisualsForBlunder()

        if (analysis.quality === 'inaccuracy') {
          coachMood.value = 'warning'
          takebackMessage.value = 'Ungenauigkeit! Überleg noch mal, es gibt einen besseren Zug.'
        } else if (analysis.quality === 'mistake') {
          coachMood.value = 'warning'
          takebackMessage.value = 'Das war ein Fehler! Überleg noch mal, es gibt einen besseren Zug.'
        } else if (analysis.quality === 'missed_mate') {
          coachMood.value = 'shocked'
          takebackMessage.value = 'Du hast ein Matt verpasst! Überleg noch mal, es gibt einen besseren Zug.'
        } else {
          coachMood.value = 'shocked'
          takebackMessage.value = 'Das war ein grober Patzer! Überleg noch mal, es gibt einen besseren Zug.'
        }
      } else if (boardStore.isGameOver) {
        coachMood.value = 'celebrating'
      } else if (isUserMove && analysis.quality) {
        switch (analysis.quality) {
          case 'brilliant':
          case 'great':
            coachMood.value = 'proud'
            break
          case 'best':
          case 'excellent':
            coachMood.value = 'relieved'
            break
          case 'good':
          case 'neutral':
            coachMood.value = 'neutral'
            break
          case 'inaccuracy':
          case 'missed_mate':
            coachMood.value = 'thoughtful'
            break
          case 'mistake':
            coachMood.value = 'warning'
            break
          case 'blunder':
            coachMood.value = 'shocked'
            break
          default:
            coachMood.value = 'neutral'
        }
      } else if (!isTakebackPending.value) {
        coachMood.value = 'neutral'
      }

      const winRateDrop = (typeof analysis.winRateLoss === 'number' && analysis.winRateLoss > 0)
        ? `−${analysis.winRateLoss.toFixed(1)}%`
        : null

      const logObj: {
        lastMove: Record<string, unknown> | null
        topMoves: Record<string, unknown>[]
      } = {
        lastMove: null,
        topMoves: [],
      }

      if (analysis.quality) {
        logObj.lastMove = {
          move: analysis.san,
          quality: QUALITY_LABEL[analysis.quality] || analysis.quality,
          summary: analysis.summary || null,
          details: analysis.details || null,
          consequence: lastMoveConsequence.value,
          betterMove: analysis.isBestMove ? null : (analysis.bestMoveSan || null),
          winRateDrop,
        }
      }

      const candidates = posExplanation.value?.engine_candidates || posExplanation.value?.engine_top_moves
      if (topMoves.value.length > 0) {
        logObj.topMoves = topMoves.value.slice(0, 3).map((m: CoachTopMove) => {
          const enriched = (candidates as CoachTopMove[] | undefined)?.find((em: CoachTopMove) => em.san === m.san || em.uci === m.uci)
          return {
            rank: m.rank,
            san: m.san,
            eval: m.isMate ? `M${m.mateIn}` : (m.eval_pawns > 0 ? `+${m.eval_pawns}` : `${m.eval_pawns}`),
            plan: m.plan_brief || enriched?.plan_brief || null,
            tagline: m.tagline || enriched?.tagline || null,
            quality: m.explanation?.quality ? (QUALITY_LABEL[m.explanation.quality] || m.explanation.quality) : (enriched?.explanation?.quality ? (QUALITY_LABEL[enriched.explanation.quality] || enriched.explanation.quality) : null),
            summary: m.explanation?.summary || enriched?.explanation?.summary || null,
            details: m.explanation?.details || enriched?.explanation?.details || null,
            character: m.character || enriched?.character || null,
          }
        })
      }

      if (logObj.lastMove || logObj.topMoves.length > 0) {
        logger.info('[CoachExplanation]', logObj)
      }
    },
    { flush: 'sync' },
  )

  // --- COACH ORCHESTRATOR STATE & LOGIC ---
  const activeSessionId = ref<string | null>(null)
  const moveState = ref<MoveState>('IDLE')
  const pendingMove = ref<PendingMoveInfo | null>(null)
  const n8nLastPayload = ref<Record<string, unknown> | null>(null)
  const botMoveHandler = ref<BotMoveHandler | null>(null)

  const isPendingEval = computed(() => moveState.value === 'USER_PENDING_EVAL')
  const isDecisionRequired = computed(() => moveState.value === 'DECISION_REQUIRED')
  const isCommitted = computed(() => moveState.value === 'COMMITTED')

  // Register orchestrator handlers with GameStore
  gameStore.registerUserMoveHandler(handleUserMove)
  gameStore.registerStopHandler(() => resetSession(null))

  registerBotMoveHandler(async () => {
    await gameStore.triggerBotMove()
  })

  function registerBotMoveHandler(handler: BotMoveHandler | null) {
    botMoveHandler.value = handler
  }

  function resetSession(newSessionId: string | null = null) {
    logger.info(`[ORCHESTRATOR] Resetting session. Old: ${activeSessionId.value} -> New: ${newSessionId}`)
    activeSessionId.value = newSessionId
    moveState.value = 'IDLE'
    pendingMove.value = null
    n8nLastPayload.value = null
    boardStore.lastNag = null
    lastMoveAnalysis.value = null
    resetVisualsAfterBlunderDecision()
  }

  function _qualityToNag(quality?: string | null): string {
    switch (quality) {
      case 'inaccuracy': return '?!'
      case 'mistake': return '?'
      case 'blunder': return '??'
      case 'missed_mate': return '??'
      default: return '!'
    }
  }

  async function handleUserMove(uciMove: string): Promise<boolean> {
    const currentSessionId = gameStore.currentStrategy?.sessionId || null
    if (activeSessionId.value !== currentSessionId || gameStore.gamePhase === 'ANALYSIS') {
      resetSession(currentSessionId)
    }

    if (gameStore.gamePhase !== 'ANALYSIS' && (moveState.value === 'USER_PENDING_EVAL' || moveState.value === 'DECISION_REQUIRED')) {
      logger.warn('[ORCHESTRATOR] Move submission rejected: previous move evaluation pending.')
      return false
    }

    const fenBefore = boardStore.fen
    const san = uciToSan(fenBefore, uciMove)
    const destSquare = uciMove.slice(2, 4) as Key

    logger.info(`[USER_MOVE] User played ${san} (UCI: ${uciMove}) | FEN before: ${fenBefore} | Session: ${currentSessionId}`)

    const moveOk = boardStore.applyUciMove(uciMove)
    if (!moveOk) {
      logger.error('[ORCHESTRATOR] Failed to execute move on boardStore:', uciMove)
      return false
    }

    const fenAfter = boardStore.fen
    moveState.value = 'USER_PENDING_EVAL'
    logger.info(`[ORCHESTRATOR] State -> USER_PENDING_EVAL | Analyzing user move ${san}...`)

    pendingMove.value = {
      uci: uciMove,
      san,
      fenBefore,
      fenAfter,
      quality: null,
      winRateLoss: null,
      bestMoveSan: null,
      nag: null,
      summary: null,
    }

    const activeStrategy = gameStore.currentStrategy
    const scenarioValidation = activeStrategy?.getScenarioValidation?.(uciMove, fenAfter)

    if (scenarioValidation?.isScenario) {
      if (scenarioValidation.isCorrect) {
        logger.info(`[UserMoveEval] Scenario move ${san} is CORRECT!`)
        pendingMove.value.quality = 'best'
        pendingMove.value.winRateLoss = 0
        pendingMove.value.nag = '!'
      } else {
        logger.info(`[UserMoveEval] Scenario deviation! Move ${san} is a BLUNDER. Expected: ${scenarioValidation.expectedMove}`)
        pendingMove.value.quality = 'blunder'
        pendingMove.value.winRateLoss = 40
        pendingMove.value.bestMoveSan = scenarioValidation.expectedMove || null
        pendingMove.value.summary = `Abweichung von der taktischen Lösung! Erwartet: ${scenarioValidation.expectedMove || ''}`
        pendingMove.value.nag = '??'

        boardStore.lastNag = {
          square: destSquare,
          quality: 'blunder',
        }

        lastMoveAnalysis.value = {
          san,
          quality: 'blunder',
          summary: pendingMove.value.summary,
          fen: fenBefore,
          square: destSquare,
        }

        if (isCoachEnabled.value) {
          try {
            await runAnalysis(fenAfter, true)
          } catch (err) {
            logger.error('[ORCHESTRATOR] Error running position analysis for scenario fenAfter:', err)
          }
        }
      }
    } else if (isCoachEnabled.value) {
      try {
        if (boardStore.isGameOver) {
          logger.info(`[UserMoveEval] Move ${san} ended the game (Checkmate/Draw). Setting terminal analysis locally.`)
          const isCheckmate = san.includes('#') || boardStore.isCheck
          const terminalQuality = isCheckmate ? 'best' : 'good'
          const terminalSummary = isCheckmate ? 'Schachmatt!' : 'Remis!'

          pendingMove.value.quality = terminalQuality
          pendingMove.value.winRateLoss = 0
          pendingMove.value.bestMoveSan = san
          pendingMove.value.summary = terminalSummary
          pendingMove.value.nag = _qualityToNag(terminalQuality)

          lastMoveAnalysis.value = {
            loading: false,
            san,
            quality: terminalQuality,
            summary: terminalSummary,
            fen: fenBefore,
            square: destSquare,
          }

          boardStore.lastNag = {
            square: destSquare,
            quality: terminalQuality,
          }
        } else {
          await runAnalysis(fenAfter, true, uciMove, fenBefore)
          const analysis = lastMoveAnalysis.value

          logger.info(
            `[UserMoveEval] Move: ${uciMove} (${san}) | Quality: ${analysis?.quality || 'N/A'} | WinRateLoss: ${analysis?.winRateLoss ?? 'N/A'}% | BestMove: ${analysis?.bestMoveSan || 'N/A'}`
          )

          if (analysis) {
            pendingMove.value.quality = analysis.quality || null
            pendingMove.value.winRateLoss = typeof analysis.winRateLoss === 'number' ? analysis.winRateLoss : null
            pendingMove.value.bestMoveSan = analysis.bestMoveSan || null
            pendingMove.value.summary = analysis.summary || null
            pendingMove.value.nag = _qualityToNag(analysis.quality)

            lastMoveAnalysis.value = {
              ...analysis,
              loading: false,
              fen: fenBefore,
              square: destSquare,
            }

            if (analysis.quality) {
              boardStore.lastNag = {
                square: destSquare,
                quality: analysis.quality,
              }
            }
          }
        }
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error evaluating move:', err)
      }
    }

    const isBlunder =
      pendingMove.value.quality === 'inaccuracy' ||
      pendingMove.value.quality === 'mistake' ||
      pendingMove.value.quality === 'blunder' ||
      pendingMove.value.quality === 'missed_mate' ||
      (typeof pendingMove.value.winRateLoss === 'number' && pendingMove.value.winRateLoss >= 20)

    if (isBlunder && isCoachEnabled.value) {
      moveState.value = 'DECISION_REQUIRED'
      enableVisualsForBlunder()
      soundService.playSound('blunder_sound')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const puzzleObj = (activeStrategy as any)?.puzzle
      const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'

      n8nLastPayload.value = {
        user_id: userId,
        session_id: currentSessionId,
        mode: activeStrategy?.strategyId || puzzleObj?.puzzle_type || 'chess',
        event: 'user_blunder',
        user_color: boardStore.orientation,
        puzzle_metadata: puzzleObj ? {
          puzzle_id: puzzleObj.puzzle_id,
          puzzle_type: puzzleObj.puzzle_type,
          category: puzzleObj.category,
          difficulty: puzzleObj.difficulty,
          strategy: puzzleObj.strategy,
          first_move: puzzleObj.first_move,
          initial_fen: puzzleObj.initial_fen,
          tactical_solution: puzzleObj.tactical_solution,
          rating: puzzleObj.rating,
        } : null,
        fen_before: fenBefore,
        fen_after: fenAfter,
        last_user_move: {
          uci: uciMove,
          san,
          quality: pendingMove.value.quality,
          win_rate_loss: pendingMove.value.winRateLoss,
          best_move_san: pendingMove.value.bestMoveSan,
        },
        timestamp: Date.now(),
      }

      if (n8nLastPayload.value) {
        setLlmThinking(true)
        sendCoachWebhook(n8nLastPayload.value)
          .then((response) => {
            setLlmThinking(false)
            if (response) {
              setLlmResponse(response)
            }
          })
          .catch((err) => {
            setLlmThinking(false)
            logger.error('[ORCHESTRATOR] Error sending n8n blunder webhook:', err)
          })
      }

      logger.info(
        `[ORCHESTRATOR] Blunder detected on ${san} (quality: ${pendingMove.value.quality}, winrate_loss: ${pendingMove.value.winRateLoss}%). State -> DECISION_REQUIRED. Bot execution BLOCKED until user decision (B1/B2).`
      )
      return false
    }

    logger.info(`[ORCHESTRATOR] Move ${san} is good/acceptable. Committing to mainline.`)
    await _commitUserMoveMainline()
    return true
  }

  async function acceptTakeback(): Promise<void> {
    if (!pendingMove.value) return

    const { uci, san, fenBefore, fenAfter, nag, quality } = pendingMove.value
    logger.info(`[USER_DECISION] Option B1 chosen (Takeback accepted). Reverting board to ${fenBefore}. Saving side variation ${san}${nag || '??'} to PGN.`)

    soundService.playSound('blunder_takeback')
    const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'
    const currentSessionId = gameStore.currentStrategy?.sessionId || null

    void sendCoachWebhook({
      user_id: userId,
      session_id: currentSessionId,
      event: 'user_decision',
      decision: 'takeback_accepted',
      option: 'B1',
      user_move_uci: uci,
      user_move_san: san,
      fen_before: fenBefore,
    })

    boardStore.setupPosition(fenBefore)
    boardStore.lastNag = null
    lastMoveAnalysis.value = null

    pgnService.addBlunderVariation({
      uci,
      san,
      fenBefore,
      fenAfter,
      nag: nag || '??',
      quality: quality || 'blunder',
    })

    pendingMove.value = null
    moveState.value = 'IDLE'
    resetVisualsAfterBlunderDecision()

    if (isCoachEnabled.value) {
      try {
        await runAnalysis(fenBefore, true)
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error restoring analysis for fenBefore:', err)
      }
    }

    logger.info('[ORCHESTRATOR] State -> IDLE | Board reverted. Candidate arrows restored for fenBefore.')
  }

  async function insistUserMove(): Promise<void> {
    if (!pendingMove.value) return

    logger.info(`[USER_DECISION] Option B2 chosen (Insist on move). Committing ${pendingMove.value.san}${pendingMove.value.nag || ''} to mainline.`)
    soundService.playSound('blunder_insist')

    const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'
    const currentSessionId = gameStore.currentStrategy?.sessionId || null

    void sendCoachWebhook({
      user_id: userId,
      session_id: currentSessionId,
      event: 'user_decision',
      decision: 'insist_played',
      option: 'B2',
      user_move_uci: pendingMove.value.uci,
      user_move_san: pendingMove.value.san,
      fen_before: pendingMove.value.fenBefore,
    })

    await _commitUserMoveMainline()
  }

  async function _commitUserMoveMainline(): Promise<void> {
    if (!pendingMove.value) return

    const { uci, san, fenBefore, fenAfter, nag } = pendingMove.value

    const node = pgnService.addNode({
      uci,
      san,
      fenBefore,
      fenAfter,
    })

    if (node && nag) {
      node.metadata = {
        ...node.metadata,
        nag,
      }
    }

    const committedFen = fenAfter
    pendingMove.value = null
    moveState.value = 'COMMITTED'
    logger.info(`[ORCHESTRATOR] Move ${san} COMMITTED to mainline. Current FEN: ${committedFen}`)

    if (gameStore.currentStrategy?.onUserMoveExecuted) {
      try {
        await gameStore.currentStrategy.onUserMoveExecuted(uci, committedFen)
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error in strategy onUserMoveExecuted:', err)
      }
    }

    if (boardStore.isGameOver || gameStore.gamePhase !== 'PLAYING' || boardStore.fen !== committedFen) {
      logger.info('[ORCHESTRATOR] Bot move trigger skipped: game over, non-playing phase, or position changed.')
    } else if (botMoveHandler.value) {
      logger.info('[BOT_MOVE] Triggering bot response...')
      try {
        await botMoveHandler.value(committedFen)
      } catch (err) {
        logger.error('[BOT_MOVE] Error executing bot move handler:', err)
      }
    }

    moveState.value = 'IDLE'
    resetVisualsAfterBlunderDecision()
  }

  async function handleBotMove(uciMove: string): Promise<boolean> {
    const fenBefore = boardStore.fen
    const san = uciToSan(fenBefore, uciMove)
    const destSquare = uciMove.slice(2, 4) as Key

    logger.info(`[BOT_MOVE] Bot played ${san} (UCI: ${uciMove}) | FEN before: ${fenBefore}`)

    const moveOk = boardStore.applyUciMove(uciMove)
    if (!moveOk) {
      logger.error('[BOT_MOVE] Failed to execute bot move on boardStore:', uciMove)
      return false
    }

    const fenAfter = boardStore.fen

    pgnService.addNode({
      uci: uciMove,
      san,
      fenBefore,
      fenAfter,
    })

    if (isCoachEnabled.value) {
      try {
        await runAnalysis(fenAfter, true, uciMove, fenBefore)
        const analysis = lastMoveAnalysis.value

        if (analysis) {
          lastMoveAnalysis.value = {
            ...analysis,
            loading: false,
            fen: fenBefore,
            square: destSquare,
          }

          if (analysis.quality) {
            boardStore.lastNag = {
              square: destSquare,
              quality: analysis.quality,
            }
          }
        }

        if (analysis && (analysis.quality === 'blunder' || analysis.quality === 'mistake')) {
          const currentSessionId = gameStore.currentStrategy?.sessionId || null
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const puzzleObj = (gameStore.currentStrategy as any)?.puzzle

          n8nLastPayload.value = {
            session_id: currentSessionId,
            mode: gameStore.currentStrategy?.strategyId || puzzleObj?.puzzle_type || 'chess',
            event: 'bot_blunder',
            game_id: currentSessionId,
            user_color: boardStore.orientation,
            fen_before: fenBefore,
            fen_after: fenAfter,
            bot_move_uci: uciMove,
            bot_move_san: san,
            quality: analysis.quality,
            best_move: analysis.bestMoveSan,
            timestamp: Date.now(),
          }
          logger.info(`[BOT_MOVE] Bot blunder detected on ${san} (quality: ${analysis.quality}). Dispatching bot_blunder event.`)
        }
      } catch (err) {
        logger.error('[BOT_MOVE] Error analyzing bot move:', err)
      }
    }

    return true
  }

  return {
    // Coach Core & UI
    isCoachEnabled,
    setCoachEnabled,
    fen,
    fenError,
    orientation,
    chess,
    moveHistory,
    historyIndex,
    topMoves,
    topMovesLoading,
    selectedMoveIndex,
    explanation,
    explanationLoading,
    posExplanation,
    prevPosExplanation,
    lastFetchedFen,
    lastFetchedUci,
    lastMoveAnalysis,
    lastMoveConsequence,
    isAnalyzing,

    // Visuals
    candidateArrowShape,
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

    // Aliases & Visuals
    sideToMove,
    phase,
    materialDelta,
    openingName,
    activePosExplanation,
    currentExplanation,
    previousExplanation,
    currentOpeningInfo,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    tablebaseBestMove,
    showVisuals,
    visualLayers,
    toggleVisualLayer,
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

    // Feedback State
    coachMood,
    isTakebackPending,
    takebackMessage,
    pendingTakebackFen,

    // Orchestrator State & Actions
    activeSessionId,
    moveState,
    pendingMove,
    n8nLastPayload,
    isPendingEval,
    isDecisionRequired,
    isCommitted,
    registerBotMoveHandler,
    resetSession,
    handleUserMove,
    acceptTakeback,
    insistUserMove,
    handleBotMove,

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
