import { useAnalysisEngineStore } from '@/entities/analysis'
import { useBoardStore } from '@/entities/game'
import { explainMoveAt, getTopMoves } from '@/shared/lib/engine/coach/analysis'
import type { CoachExplanation, CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { topConsequenceLine } from '@/shared/lib/engine/coach/connectors'
import { getPieceCount } from '@/shared/lib/engine/coach/engine'
import logger from '@/shared/lib/logger'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const analysisEngineStore = useAnalysisEngineStore()

  const isCoachEnabled = ref(false)
  const isAnalyzing = ref(false)

  watch(
    () => isCoachEnabled.value,
    (val) => {
      coachEngineManager.isCoachEnabled = val
    },
    { immediate: true }
  )

  // State for "About Position"
  const currentExplanation = ref<CoachExplanation | null>(null)
  const previousExplanation = ref<CoachExplanation | null>(null)

  // State for Visuals
  const showVisuals = ref(true)

  function toggleVisuals() {
    showVisuals.value = !showVisuals.value
    if (showVisuals.value && currentExplanation.value?.visual_commands) {
      const commands = Object.values(currentExplanation.value.visual_commands).flat().join(';')
      if (commands) {
        executeVisualCommands(commands)
      }
    } else if (!showVisuals.value) {
      boardStore.setCoachShapes([])
    }
  }

  function executeVisualCommands(actionStr: string) {
    if (!actionStr) return

    const subActions = actionStr.split(';')
    const allShapes: DrawShape[] = []

    // Chessground standard brushes + safety (11 colors)
    const VALID_BRUSHES = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'gray', 'bestmove']

    for (const sub of subActions) {
      if (!sub.trim()) continue

      // Remove any brackets to prevent matching issues, then split
      const cleanSub = sub.replace(/[\[\]]/g, '').trim()
      const parts = cleanSub.split(':')
      const cmd = parts[0]?.trim()
      const data = parts[1]?.trim()

      let brush = parts[2]?.trim() || 'green'

      // Validation & Debugging
      if (!VALID_BRUSHES.includes(brush)) {
        logger.warn(`[CoachStore] Unknown brush detected: "${brush}" in command "${sub}". Falling back to green.`)
        brush = 'green'
      }

      // Map standard brushes to thin coach-specific brushes
      const coachBrush = brush === 'bestmove' ? 'bestmove' : `coach${brush}`

      if (cmd === 'clear') {
        boardStore.setCoachShapes([])
        return
      }

      if (!data) continue

      if (cmd === 'arrow' || cmd === 'route' || cmd === 'root') {
        const squares = data.split('->')
        for (let i = 0; i < squares.length - 1; i++) {
          const orig = squares[i]?.trim()
          const dest = squares[i + 1]?.trim()

          // Coordinate validation (must be e.g. "e4")
          if (orig && dest && orig.length === 2 && dest.length === 2) {
            allShapes.push({
              orig: orig as Key,
              dest: dest as Key,
              brush: coachBrush,
              modifiers: { lineWidth: 3 }
            })
          } else {
            logger.warn(`[CoachStore] Invalid coordinates for route: "${orig}" -> "${dest}"`)
          }
        }
      } else if (cmd === 'mark') {
        const squares = data.split(',')
        squares.forEach(sq => {
          const cleanSq = sq.trim()
          if (cleanSq && cleanSq.length === 2) {
            allShapes.push({
              orig: cleanSq as Key,
              brush: coachBrush
            })
          } else {
            logger.warn(`[CoachStore] Invalid coordinate for mark: "${cleanSq}"`)
          }
        })
      }
    }

    if (allShapes.length > 0) {
      // Sort shapes by color priority so the highest priority renders on top.
      const COLOR_PRIORITY: Record<string, number> = {
        coachgray: 0, coachbrown: 1, coachyellow: 2, coachgreen: 3, coachcyan: 4, coachblue: 5, coachpurple: 6, coachpink: 7, coachorange: 8, coachred: 9, bestmove: 10
      }
      allShapes.sort((a, b) => {
        const pA = COLOR_PRIORITY[a.brush as string] ?? -1
        const pB = COLOR_PRIORITY[b.brush as string] ?? -1
        return pA - pB
      })

      boardStore.setCoachShapes(allShapes)
    }
  }

  // State for "Top Moves"
  const topMoves = ref<CoachTopMove[]>([])
  const topMovesLoading = ref(false)
  const tablebaseBestMove = ref<{
    san: string
    uci: string
    winner: string
    mateIn: number
    wdl: 'win' | 'loss'
  } | null>(null)

  // State for "Last Move"
  const lastMoveAnalysis = ref<CoachLastMoveAnalysis | null>(null)

  function toggleCoach() {
    isCoachEnabled.value = !isCoachEnabled.value
    if (!isCoachEnabled.value) {
      coachEngineManager.stop()
      currentExplanation.value = null
      previousExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setCoachShapes([])
    } else {
      triggerAnalysis(boardStore.fen)
    }
  }

  function setCoachEnabled(enabled: boolean) {
    if (isCoachEnabled.value === enabled) return

    isCoachEnabled.value = enabled
    if (!enabled) {
      coachEngineManager.stop()
      currentExplanation.value = null
      previousExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setCoachShapes([])
    } else {
      triggerAnalysis(boardStore.fen)
    }
  }

  async function triggerAnalysis(fen: string) {
    if (!fen) return
    isAnalyzing.value = true
    boardStore.setCoachShapes([])

    const topMovesPromise = fetchTopMoves(fen)
    const lastMovePromise = fetchLastMoveAnalysis()

    try {
      previousExplanation.value = currentExplanation.value || previousExplanation.value
      const explanation = await coachEngineManager.getExplanation(fen)
      currentExplanation.value = explanation

      if (showVisuals.value && explanation?.visual_commands) {
        const commands = Object.values(explanation.visual_commands).flat().join(';')
        if (commands) {
          executeVisualCommands(commands)
        } else {
          boardStore.setCoachShapes([])
        }
      } else if (!showVisuals.value) {
        boardStore.setCoachShapes([])
      }

      // Finalize and Log
      await Promise.all([topMovesPromise, lastMovePromise])
    } catch {
      logger.error('[CoachStore] Error generating explanation')
    } finally {
      isAnalyzing.value = false
    }
  }



  async function fetchTopMoves(fen: string) {
    topMovesLoading.value = true
    tablebaseBestMove.value = null
    try {
      const result = await getTopMoves(fen, 10)
      topMoves.value = result.moves || []

      // Populate tablebaseBestMove directly from the Gaviota server response
      if (topMoves.value.length > 0 && getPieceCount(fen) <= 5) {
        const best = topMoves.value[0]
        if (best && best.isMate && best.mateIn !== null && best.mateIn !== undefined) {
          const sideToMove = fen.split(' ')[1] // 'w' or 'b'
          const winner = best.mateIn > 0 ? 'White' : 'Black'
          const mateIn = Math.abs(best.mateIn)
          const isWin = (sideToMove === 'w' && best.mateIn > 0) || (sideToMove === 'b' && best.mateIn < 0)

          tablebaseBestMove.value = {
            san: best.san,
            uci: best.uci,
            winner,
            mateIn,
            wdl: isWin ? 'win' : 'loss'
          }
        }
      }
    } catch {
      logger.error('[CoachStore] Top moves failed')
    } finally {
      topMovesLoading.value = false
    }
  }

  async function fetchLastMoveAnalysis() {
    const lastNode = pgnService.getCurrentNode()

    if (!lastNode || !lastNode.parent || !lastNode.uci) {
      lastMoveAnalysis.value = null
      return
    }

    // We need the FEN *before* the move was played.
    const prevFen = lastNode.parent.fenAfter

    lastMoveAnalysis.value = { loading: true, san: lastNode.san, fen: prevFen }
    try {
      const r = await explainMoveAt(prevFen, lastNode.uci)
      lastMoveAnalysis.value = { ...r, loading: false, fen: prevFen }
    } catch {
      lastMoveAnalysis.value = null
    }
  }

  // Handle click on a top move in the UI to explain it
  const selectedMoveIndex = ref<number | null>(null)
  const selectedMoveExplanation = ref<CoachLastMoveAnalysis | null>(null)
  const selectedMoveExplanationLoading = ref(false)

  async function explainTopMove(move: { uci: string }, index: number) {
    if (selectedMoveIndex.value === index) {
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      return
    }
    selectedMoveIndex.value = index
    selectedMoveExplanationLoading.value = true
    try {
      const result = await explainMoveAt(boardStore.fen, move.uci)
      selectedMoveExplanation.value = result
    } catch {
      logger.error('[CoachStore] Top Move Explanation failed')
    } finally {
      selectedMoveExplanationLoading.value = false
    }
  }

  async function analyzeCurrentPosition() {
    if (!isCoachEnabled.value) return
    const newFen = pgnService.getCurrentNavigatedFen()

    selectedMoveIndex.value = null
    selectedMoveExplanation.value = null
    await triggerAnalysis(newFen)
  }

  function reset() {
    logger.info('[CoachStore] Resetting coach state.')
    isCoachEnabled.value = false
    isAnalyzing.value = false
    currentExplanation.value = null
    previousExplanation.value = null
    topMoves.value = []
    lastMoveAnalysis.value = null
    selectedMoveIndex.value = null
    selectedMoveExplanation.value = null
    boardStore.setCoachShapes([])
    coachEngineManager.stop()
  }

  watch(
    () => pgnTreeVersion.value,
    () => {
      if (!isCoachEnabled.value) return

      analyzeCurrentPosition()
    },
    { flush: 'sync' }
  )

  // Watch deep analysis and handle potential resource management if needed,
  // but do not disable the coach automatically as per "no restrictions" policy.
  watch(
    () => analysisEngineStore.isAnalysisActive,
    (isActive) => {
      if (isActive && isCoachEnabled.value) {
        logger.info('[CoachStore] Deep analysis active alongside Coach.')
        // We keep the coach enabled. Both can run in parallel if resources allow.
      }
    },
  )

  const lastMoveConsequence = computed(() => {
    if (!previousExplanation.value || !currentExplanation.value || !lastMoveAnalysis.value) return null
    if (lastMoveAnalysis.value.loading) return null

    return topConsequenceLine(previousExplanation.value, currentExplanation.value, {
      movingSide: previousExplanation.value.side_to_move,
      motifs: lastMoveAnalysis.value.motifs || [],
      evalSwingCp: (currentExplanation.value.eval_cp || 0) - (previousExplanation.value.eval_cp || 0),
    })
  })

  return {
    isCoachEnabled,
    isAnalyzing,
    currentExplanation,
    previousExplanation,
    topMoves,
    topMovesLoading,
    tablebaseBestMove,
    lastMoveAnalysis,
    lastMoveConsequence,
    selectedMoveIndex,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    toggleCoach,
    setCoachEnabled,
    explainTopMove,
    showVisuals,
    toggleVisuals,
    executeVisualCommands,
    fetchLastMoveAnalysis,
    fetchTopMoves,

    analyzeCurrentPosition,
    reset,
  }
})
