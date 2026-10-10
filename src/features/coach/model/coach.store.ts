import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

import { useBoardStore, useGameStore, type IUserMoveInspector, type MoveInspectionDecision } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { parseVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'
import { usePreferencesStore } from '@/features/settings'

export interface CoachVisualLayers {
  lastMoveNag: boolean
  candidateArrow: boolean
  tacticalPlans: boolean
}

export type CoachMood = 'neutral' | 'proud' | 'shocked' | 'thoughtful' | 'warning' | 'relieved' | 'celebrating'

export interface CoachPendingDecision {
  moveUci: string
  quality: 'mistake' | 'blunder'
  resolve: (decision: MoveInspectionDecision) => void
}

export interface CoachSettingsDto {
  coachSpy: boolean
  autoTakeback: boolean
  autoTakebackDelay: number
  showVisuals: boolean
  visualLayers: CoachVisualLayers
}

const COACH_SETTINGS_STORAGE_KEY = 'extrapawn_coach_settings'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const authStore = useAuthStore()

  // 1. Core State
  const isCoachEnabled = ref(true)
  const isAnalyzing = ref(false)
  const selectedMoveIndex = ref<number | null>(0)
  const posExplanation = ref<CoachExplanation | null>(null)
  const coachMood = ref<CoachMood>('neutral')

  // 2. Settings (Coach Spy, Auto Takeback & Delay)
  const preferencesStore = usePreferencesStore()
  const coachSpy = ref(true)
  const isCoachSpyActive = computed(() => coachSpy.value || preferencesStore.preferences.gameplay.global_crashtest)
  const autoTakeback = ref(true)
  const autoTakebackDelay = ref(1000)

  // 3. Interactive Decision State (when autoTakeback is false)
  const pendingDecision = ref<CoachPendingDecision | null>(null)
  let takebackTimer: number | null = null

  // Cache FEN & UCI & in-flight analysis deduplication
  const lastFetchedFen = ref('')
  const lastFetchedUci = ref<string | null>(null)
  const latestAnalysisToken = ref(0)
  let inFlightAnalysisPromise: Promise<CoachExplanation | null> | null = null
  let inFlightAnalysisKey: string | null = null

  // Visuals State
  const showVisuals = ref(true)
  const visualLayers = ref<CoachVisualLayers>({
    lastMoveNag: true,
    candidateArrow: true,
    tacticalPlans: true,
  })

  // Load persisted settings
  function loadSettings() {
    try {
      const raw = localStorage.getItem(COACH_SETTINGS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CoachSettingsDto>
        if (typeof parsed.coachSpy === 'boolean') coachSpy.value = parsed.coachSpy
        if (typeof parsed.autoTakeback === 'boolean') autoTakeback.value = parsed.autoTakeback
        if (typeof parsed.autoTakebackDelay === 'number') {
          autoTakebackDelay.value = Math.min(3000, Math.max(100, Math.round(parsed.autoTakebackDelay)))
        }
        if (typeof parsed.showVisuals === 'boolean') showVisuals.value = parsed.showVisuals
        if (parsed.visualLayers) {
          visualLayers.value = { ...visualLayers.value, ...parsed.visualLayers }
        }
      }
    } catch (err) {
      logger.error('[CoachStore] Failed to load coach settings:', err)
    }
  }

  function saveSettings() {
    try {
      const data: CoachSettingsDto = {
        coachSpy: coachSpy.value,
        autoTakeback: autoTakeback.value,
        autoTakebackDelay: autoTakebackDelay.value,
        showVisuals: showVisuals.value,
        visualLayers: visualLayers.value,
      }
      localStorage.setItem(COACH_SETTINGS_STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      logger.error('[CoachStore] Failed to save coach settings:', err)
    }
  }

  loadSettings()

  function toggleCoachSpy() {
    coachSpy.value = !coachSpy.value
    saveSettings()
    if (!coachSpy.value) {
      boardStore.setCoachShapes([])
      posExplanation.value = null
      cancelPendingDecision()
    } else if (boardStore.fen) {
      runAnalysis(boardStore.fen, true)
    }
  }

  function toggleAutoTakeback() {
    autoTakeback.value = !autoTakeback.value
    saveSettings()
  }

  function setAutoTakebackDelay(delay: number) {
    autoTakebackDelay.value = Math.min(3000, Math.max(100, Math.round(delay)))
    saveSettings()
  }

  function cancelPendingDecision() {
    if (takebackTimer !== null) {
      clearTimeout(takebackTimer)
      takebackTimer = null
    }
    if (pendingDecision.value) {
      const cb = pendingDecision.value.resolve
      pendingDecision.value = null
      cb('proceed')
    }
  }

  function confirmTakeback() {
    if (pendingDecision.value) {
      const cb = pendingDecision.value.resolve
      pendingDecision.value = null
      soundService.play('chpock')
      cb('takeback')
    }
  }

  function confirmPlayOn() {
    if (pendingDecision.value) {
      const cb = pendingDecision.value.resolve
      pendingDecision.value = null
      cb('proceed')
    }
  }

  // 4. Move Inspector implementation for GameStore
  async function inspectUserMove(uci: string, fen: string): Promise<MoveInspectionDecision> {
    if (
      gameStore.gamePhase === 'FAIRPLAY' ||
      !isCoachEnabled.value ||
      !coachSpy.value ||
      preferencesStore.preferences.gameplay.global_crashtest
    ) {
      return 'proceed'
    }

    cancelPendingDecision()

    const explanation = await runAnalysis(fen, false, uci)
    if (!explanation) {
      return 'proceed'
    }

    const quality = explanation.last_move_analysis?.quality
    const isMistakeOrBlunder = quality === 'mistake' || quality === 'blunder'

    if (!isMistakeOrBlunder) {
      return 'proceed'
    }

    logger.info(`[CoachStore] Move ${uci} flagged as ${quality}. Takeback initiated.`)
    soundService.play('tactics_error')

    if (autoTakeback.value) {
      return new Promise<MoveInspectionDecision>((resolve) => {
        takebackTimer = window.setTimeout(() => {
          takebackTimer = null
          soundService.play('chpock')
          resolve('takeback')
        }, autoTakebackDelay.value)
      })
    } else {
      return new Promise<MoveInspectionDecision>((resolve) => {
        pendingDecision.value = {
          moveUci: uci,
          quality: quality as 'mistake' | 'blunder',
          resolve: (decision) => {
            pendingDecision.value = null
            resolve(decision)
          },
        }
      })
    }
  }

  const coachInspector: IUserMoveInspector = {
    inspectUserMove,
  }

  function setCoachEnabled(enabled: boolean) {
    isCoachEnabled.value = enabled
    if (!enabled) {
      boardStore.setCoachShapes([])
      cancelPendingDecision()
      gameStore.unregisterMoveInspector(coachInspector)
    } else {
      gameStore.registerMoveInspector(coachInspector)
    }
  }

  // Register move inspector if coach is enabled
  if (isCoachEnabled.value) {
    gameStore.registerMoveInspector(coachInspector)
  }

  function toggleVisualLayer(layer: keyof CoachVisualLayers) {
    visualLayers.value[layer] = !visualLayers.value[layer]
    saveSettings()
  }

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    saveSettings()
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
    if (gameStore.gamePhase === 'FAIRPLAY') return 0
    if (!isCoachSpyActive.value) return null
    const top = topMoves.value[0]
    if (!top || top.isMate) return null
    return Math.round((top.eval_pawns ?? 0) * 100)
  })

  const evalMate = computed<number | null>(() => {
    if (gameStore.gamePhase === 'FAIRPLAY') return null
    if (!isCoachSpyActive.value) return null
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
    if (!isCoachSpyActive.value || !visualLayers.value.lastMoveNag) return null
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
    if (!isCoachSpyActive.value || !visualLayers.value.candidateArrow) return null
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
    if (!isCoachSpyActive.value || !visualLayers.value.candidateArrow) return null
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
    if (!isCoachSpyActive.value || !visualLayers.value.tacticalPlans) return []
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
    if (gameStore.gamePhase === 'FAIRPLAY') return []
    if (!isCoachSpyActive.value) return []
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

  // Reactive Board FEN Listener: Coach automatically analyzes board when coachSpy is enabled
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (gameStore.gamePhase === 'FAIRPLAY') return
      if (isCoachEnabled.value && isCoachSpyActive.value && newFen) {
        runAnalysis(newFen)
      }
    },
  )

  // Watch for game phase changes (reset/cancel on gameOver or idle, celebrate on win, analyze on PLAYING/ANALYSIS)
  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase === 'FAIRPLAY') {
        cancelPendingDecision()
        boardStore.setCoachShapes([])
        posExplanation.value = null
        isAnalyzing.value = false
      } else if (phase === 'PLAYING' || phase === 'ANALYSIS') {
        if (boardStore.fen) {
          runAnalysis(boardStore.fen, true)
        }
      } else if (phase === 'GAMEOVER') {
        cancelPendingDecision()
        const status = gameStore.getGameStatus()
        if (status.outcome?.winner === gameStore.playerColor) {
          coachMood.value = 'celebrating'
        }
      } else if (phase === 'IDLE') {
        cancelPendingDecision()
      }
    },
  )

  // Primary API Analysis Action
  async function runAnalysis(
    currentFen: string,
    force = false,
    overrideLastMoveUci?: string | null,
    _overrideFenBefore?: string | null,
  ): Promise<CoachExplanation | null> {
    if (gameStore.gamePhase === 'FAIRPLAY') {
      isAnalyzing.value = false
      posExplanation.value = null
      return null
    }
    if (!currentFen || !isCoachEnabled.value || !isCoachSpyActive.value) return null

    if (_overrideFenBefore) {
      logger.info(`[CoachStore] Analysis called with overrideFenBefore: ${_overrideFenBefore}`)
    }

    const { startFen, moves } = pgnService.getAnalysisPayloadContext(overrideLastMoveUci)
    const lastMoveUci = moves.length > 0 ? moves[moves.length - 1] : null

    const payloadKeyUci = lastMoveUci || 'null'
    const requestKey = `${currentFen}_${payloadKeyUci}`

    if (!force && inFlightAnalysisKey === requestKey && inFlightAnalysisPromise) {
      return inFlightAnalysisPromise
    }

    if (!force && currentFen === lastFetchedFen.value && payloadKeyUci === lastFetchedUci.value && posExplanation.value) {
      return posExplanation.value
    }

    lastFetchedFen.value = currentFen
    lastFetchedUci.value = payloadKeyUci
    const analysisToken = ++latestAnalysisToken.value

    isAnalyzing.value = true
    posExplanation.value = null
    boardStore.setCoachShapes([])

    inFlightAnalysisKey = requestKey
    inFlightAnalysisPromise = (async () => {
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

        const data: CoachExplanation = await response.json()
        if (analysisToken !== latestAnalysisToken.value) return null

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
        return data
      } catch (err) {
        logger.warn('[CoachStore] Server-driven analysis request failed:', err)
        return null
      } finally {
        if (analysisToken === latestAnalysisToken.value) {
          isAnalyzing.value = false
        }
        inFlightAnalysisPromise = null
        inFlightAnalysisKey = null
      }
    })()

    return inFlightAnalysisPromise
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
    coachSpy,
    toggleCoachSpy,
    autoTakeback,
    toggleAutoTakeback,
    autoTakebackDelay,
    setAutoTakebackDelay,
    pendingDecision,
    confirmTakeback,
    confirmPlayOn,
    cancelPendingDecision,
    inspectUserMove,
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
