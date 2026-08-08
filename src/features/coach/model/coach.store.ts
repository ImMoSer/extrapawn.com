import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

import { useBoardStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { parseVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'

export interface CoachVisualLayers {
  lastMoveNag: boolean
  candidateArrow: boolean
  tacticalPlans: boolean
}

export type CoachMood = 'neutral' | 'proud' | 'shocked' | 'thoughtful' | 'warning' | 'relieved' | 'celebrating'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const authStore = useAuthStore()

  // 1. Core State
  const isCoachEnabled = ref(true)
  const isAnalyzing = ref(false)
  const selectedMoveIndex = ref<number | null>(0)
  const posExplanation = ref<CoachExplanation | null>(null)
  const coachMood = ref<CoachMood>('neutral')

  // Cache FEN & UCI
  const lastFetchedFen = ref('')
  const lastFetchedUci = ref<string | null>(null)
  const latestAnalysisToken = ref(0)

  // Visuals State
  const showVisuals = ref(true)
  const visualLayers = ref<CoachVisualLayers>({
    lastMoveNag: true,
    candidateArrow: true,
    tacticalPlans: true,
  })

  function setCoachEnabled(enabled: boolean) {
    isCoachEnabled.value = enabled
    if (!enabled) {
      boardStore.setCoachShapes([])
    }
  }

  function toggleVisualLayer(layer: keyof CoachVisualLayers) {
    visualLayers.value[layer] = !visualLayers.value[layer]
  }

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    if (!showVisuals.value) {
      boardStore.setCoachShapes([])
    } else if (posExplanation.value?.action) {
      executeVisualCommands(posExplanation.value.action)
    }
  }

  function executeVisualCommands(actionStr: string) {
    if (!actionStr) return
    const parsed = parseVisualCommands(actionStr)
    if (parsed && parsed.length > 0) {
      boardStore.setCoachShapes(parsed as DrawShape[])
    }
  }

  // Derived Getters from posExplanation
  const topMoves = computed<CoachTopMove[]>(() => {
    const candidates = posExplanation.value?.engine_candidates || posExplanation.value?.engine_top_moves || []
    return candidates.map((c, index) => ({
      rank: c.rank || index + 1,
      san: c.san || '',
      uci: c.uci || '',
      move: c.uci || '',
      quality: c.quality,
      eval_pawns: typeof c.eval_pawns === 'number' ? c.eval_pawns : 0,
      isMate: !!(c.isMate ?? c.is_mate),
      mateIn: c.mateIn ?? c.mate_in ?? null,
      mate: c.mateIn ?? c.mate_in ?? null,
      motifs: Array.isArray(c.motifs) ? c.motifs : [],
      targetsKing: !!(c.targetsKing ?? c.targets_king),
      headline: c.headline || null,
      tagline: c.tagline || null,
      plan_theme: c.plan_theme || null,
      plan_brief: c.plan_brief || null,
      character: c.character || 'Solid',
      character_reason: c.character_reason || '',
      wdl: c.wdl,
      pvLine: (Array.isArray(c.pv_line) ? c.pv_line : c.pvLine || []) as CoachTopMove['pvLine'],
      explanation: c.explanation,
      visual_commands: c.visual_commands || null,
    }))
  })

  const lastMoveAnalysis = computed<CoachLastMoveAnalysis | null>(() => {
    const lma = posExplanation.value?.last_move_analysis
    if (!lma) return null
    const moveSan = lma.san || lma.move_san || ''
    const detailsStr = Array.isArray(lma.details) ? lma.details.join(' ') : lma.details || undefined
    return {
      ...lma,
      loading: isAnalyzing.value,
      san: moveSan,
      details: detailsStr,
    }
  })

  const sideToMove = computed<'w' | 'b'>(() => {
    const status = posExplanation.value?.position_status
    if (status?.side_to_move) {
      return status.side_to_move === 'b' ? 'b' : 'w'
    }
    return posExplanation.value?.side_to_move === 'black' ? 'b' : 'w'
  })

  const phase = computed<string>(() => {
    return posExplanation.value?.position_status?.phase || posExplanation.value?.game_phase || 'middlegame'
  })

  const materialDelta = computed<number>(() => {
    return posExplanation.value?.position_status?.material_delta ?? posExplanation.value?.material_imbalance ?? 0
  })

  const openingName = computed<string | null>(() => {
    return posExplanation.value?.opening_name || null
  })

  const lastMoveConsequence = computed<string | null>(() => {
    const exp = posExplanation.value
    if (!exp) return null
    const lma = exp.last_move_analysis
    return lma?.consequence || exp.strategic_summary || exp.key_imbalance || null
  })

  // EvalBar integration getters
  const evalCp = computed<number | null>(() => {
    const top = topMoves.value[0]
    if (!top || top.isMate) return null
    return Math.round((top.eval_pawns ?? 0) * 100)
  })

  const evalMate = computed<number | null>(() => {
    const top = topMoves.value[0]
    if (!top || !top.isMate) return null
    return top.mateIn ?? null
  })

  const gameResult = computed<string | null>(() => null)

  const topMovesLoading = computed(() => isAnalyzing.value)

  function getBrushForQuality(quality?: string | null): string {
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

  // 1. Last Move NAG Shape (Layer: lastMoveNag)
  const lastMoveNagShape = computed<DrawShape | null>(() => {
    if (!showVisuals.value || !visualLayers.value.lastMoveNag) return null
    const lma = posExplanation.value?.last_move_analysis
    const uci = lma?.move_uci || (lma as Record<string, unknown> | undefined)?.uci
    const quality = lma?.quality

    if (typeof uci !== 'string' || uci.length < 4 || !quality) return null

    const dest = uci.slice(2, 4) as Key
    return {
      orig: dest,
      customNag: quality,
    } as unknown as DrawShape
  })

  // 2. Candidate Move NAG Shape (Layer: candidateArrow)
  const candidateNagShape = computed<DrawShape | null>(() => {
    if (!showVisuals.value || !visualLayers.value.candidateArrow) return null
    const idx = selectedMoveIndex.value ?? 0
    const selectedMove = topMoves.value[idx] || topMoves.value[0]
    const moveUci = selectedMove?.uci || selectedMove?.move
    const quality = selectedMove?.quality

    if (!moveUci || moveUci.length < 4 || !quality) return null

    const dest = moveUci.slice(2, 4) as Key
    return {
      orig: dest,
      customNag: quality,
    } as unknown as DrawShape
  })

  // 3. Candidate Arrow Shape (draws selected or best candidate move arrow)
  const candidateArrowShape = computed<DrawShape | null>(() => {
    if (!showVisuals.value || !visualLayers.value.candidateArrow) return null
    const idx = selectedMoveIndex.value ?? 0
    const selectedMove = topMoves.value[idx] || topMoves.value[0]
    const moveUci = selectedMove?.uci || selectedMove?.move

    if (!moveUci || moveUci.length < 4) return null

    const orig = moveUci.slice(0, 2) as Key
    const dest = moveUci.slice(2, 4) as Key
    const brush = getBrushForQuality(selectedMove?.quality)

    return {
      orig,
      dest,
      brush,
      modifiers: { lineWidth: 8 },
    }
  })

  // 4. Tactical Plans Shapes from visual_commands
  const tacticalShapes = computed<DrawShape[]>(() => {
    if (!showVisuals.value || !visualLayers.value.tacticalPlans) return []
    const idx = selectedMoveIndex.value ?? 0
    const selectedMove = topMoves.value[idx] || topMoves.value[0]

    const vis = selectedMove?.visual_commands as Record<string, string> | string | undefined
    if (!vis) return []

    let cmdStr = ''
    if (typeof vis === 'string') {
      cmdStr = vis
    } else if (typeof vis === 'object' && vis !== null) {
      cmdStr = Object.values(vis).filter((v): v is string => typeof v === 'string' && !!v).join(';')
    }

    return parseVisualCommands(cmdStr) as DrawShape[]
  })

  const drawableShapes = computed<DrawShape[]>(() => {
    const shapes: DrawShape[] = []
    if (lastMoveNagShape.value) {
      shapes.push(lastMoveNagShape.value)
    }
    if (candidateArrowShape.value) {
      shapes.push(candidateArrowShape.value)
    }
    if (candidateNagShape.value) {
      shapes.push(candidateNagShape.value)
    }
    if (tacticalShapes.value.length > 0) {
      shapes.push(...tacticalShapes.value)
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

  // Reactive Board FEN Listener: Coach automatically analyzes any position on the board
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (isCoachEnabled.value && newFen) {
        runAnalysis(newFen)
      }
    },
  )

  // Primary API Analysis Action
  async function runAnalysis(
    currentFen: string,
    force = false,
    overrideLastMoveUci?: string | null,
    _overrideFenBefore?: string | null,
  ) {
    if (!currentFen || !isCoachEnabled.value) return

    if (_overrideFenBefore) {
      logger.info(`[CoachStore] Analysis called with overrideFenBefore: ${_overrideFenBefore}`)
    }

    const { startFen, moves } = pgnService.getAnalysisPayloadContext(overrideLastMoveUci)
    const lastMoveUci = moves.length > 0 ? moves[moves.length - 1] : null

    const payloadKeyUci = lastMoveUci || 'null'
    if (!force && currentFen === lastFetchedFen.value && payloadKeyUci === lastFetchedUci.value) {
      return
    }

    lastFetchedFen.value = currentFen
    lastFetchedUci.value = payloadKeyUci
    const analysisToken = ++latestAnalysisToken.value

    isAnalyzing.value = true
    posExplanation.value = null
    boardStore.setCoachShapes([])

    try {
      const userId = authStore.effectiveLichessUsername || authStore.userProfile?.username || authStore.userProfile?.id || 'default_user'

      const payload = {
        user_id: userId,
        start_fen: startFen,
        moves,
      }

      const response = await fetch('/api/coach-engine/uci_fen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error(`Server engine HTTP error: ${response.status}`)
      }

      const data = await response.json()
      if (analysisToken !== latestAnalysisToken.value) return

      posExplanation.value = data
      selectedMoveIndex.value = 0

      // Update Coach Mood
      const quality = data.last_move_analysis?.quality
      if (quality) {
        switch (quality) {
          case 'brilliant':
          case 'great':
            coachMood.value = 'proud'
            break
          case 'best':
          case 'excellent':
            coachMood.value = 'relieved'
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
      } else {
        coachMood.value = 'neutral'
      }

      logger.info(`[CoachStore] Analysis loaded for FEN: ${currentFen}`)
    } catch (err) {
      logger.warn('[CoachStore] Server-driven analysis request failed:', err)
    } finally {
      if (analysisToken === latestAnalysisToken.value) {
        isAnalyzing.value = false
      }
    }
  }

  async function analyzeCurrentPosition(targetFen?: string) {
    const fenToAnalyze = targetFen || boardStore.fen
    await runAnalysis(fenToAnalyze)
  }

  function selectMove(index: number) {
    selectedMoveIndex.value = index
  }

  function handleSettingsChange() {
    if (lastFetchedFen.value) {
      runAnalysis(lastFetchedFen.value, true)
    }
  }

  return {
    isCoachEnabled,
    setCoachEnabled,
    posExplanation,
    isAnalyzing,
    selectedMoveIndex,
    topMoves,
    lastMoveAnalysis,
    sideToMove,
    phase,
    materialDelta,
    openingName,
    lastMoveConsequence,
    evalCp,
    evalMate,
    gameResult,
    topMovesLoading,
    showVisuals,
    visualLayers,
    toggleVisualLayer,
    toggleVisuals,
    coachMood,
    drawableShapes,
    runAnalysis,
    analyzeCurrentPosition,
    selectMove,
    handleSettingsChange,
  }
})
