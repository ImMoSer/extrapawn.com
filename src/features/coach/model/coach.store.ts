import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useBoardStore } from '@/entities/game'
import { useAnalysisEngineStore } from '@/entities/analysis'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import { getTopMoves, explainMoveAt } from '@/shared/lib/engine/coach/analysis'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import logger from '@/shared/lib/logger'
import type { Key } from '@lichess-org/chessground/types'

export const useCoachStore = defineStore('coach', () => {
  const boardStore = useBoardStore()
  const analysisEngineStore = useAnalysisEngineStore()

  const isCoachEnabled = ref(false)
  const isAnalyzing = ref(false)

  // State for "About Position"
  const currentExplanation = ref<Record<string, unknown> | null>(null)

  // State for "Top Moves"
  const topMoves = ref<Record<string, unknown>[]>([])
  const topMovesLoading = ref(false)

  // State for "Last Move"
  const lastMoveAnalysis = ref<Record<string, unknown> | null>(null)

  function toggleCoach() {
    isCoachEnabled.value = !isCoachEnabled.value
    if (!isCoachEnabled.value) {
      coachEngineManager.stop()
      currentExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setAutoShapes([])
    } else {
      if (analysisEngineStore.isAnalysisActive) {
        logger.info('[CoachStore] Stopping deep analysis to start coach.')
        analysisEngineStore.stopAnalysis()
      }
      triggerAnalysis(boardStore.fen)
    }
  }

  function setCoachEnabled(enabled: boolean) {
    if (isCoachEnabled.value === enabled) return

    isCoachEnabled.value = enabled
    if (!enabled) {
      coachEngineManager.stop()
      currentExplanation.value = null
      topMoves.value = []
      lastMoveAnalysis.value = null
      boardStore.setAutoShapes([])
    } else {
      if (analysisEngineStore.isAnalysisActive) {
        logger.info('[CoachStore] Stopping deep analysis to start coach.')
        analysisEngineStore.stopAnalysis()
      }
      triggerAnalysis(boardStore.fen)
    }
  }

  async function triggerAnalysis(fen: string) {
    if (!fen) return
    isAnalyzing.value = true

    // We launch Top Moves and the Full Explanation concurrently.
    fetchTopMoves(fen)
    fetchLastMoveAnalysis()

    try {
      const explanation = await coachEngineManager.getExplanation(fen)
      currentExplanation.value = explanation

      if (
        explanation &&
        (explanation.principal_plan as any) &&
        (explanation.principal_plan as any).moves?.length > 0
      ) {
        const bestMove = (explanation.principal_plan as any).moves[0]
        if (bestMove.from && bestMove.to) {
          boardStore.setAutoShapes([
            {
              orig: bestMove.from as Key,
              dest: bestMove.to as Key,
              brush: 'green',
              modifiers: { lineWidth: 10 },
            },
          ])
        }
      } else {
        boardStore.setAutoShapes([])
      }
    } catch {
      logger.error('[CoachStore] Error generating explanation')
    } finally {
      isAnalyzing.value = false
    }
  }

  async function fetchTopMoves(fen: string) {
    topMovesLoading.value = true
    try {
      const result = await getTopMoves(fen, 10)
      topMoves.value = (result as any).moves || []
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

    lastMoveAnalysis.value = { loading: true, san: lastNode.san }
    try {
      const r = await explainMoveAt(prevFen, lastNode.uci)
      lastMoveAnalysis.value = { ...r, loading: false }
    } catch {
      lastMoveAnalysis.value = null
    }
  }

  // Handle click on a top move in the UI to explain it
  const selectedMoveIndex = ref<number | null>(null)
  const selectedMoveExplanation = ref<Record<string, unknown> | null>(null)
  const selectedMoveExplanationLoading = ref(false)

  async function explainTopMove(move: { move: string }, index: number) {
    if (selectedMoveIndex.value === index) {
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      return
    }
    selectedMoveIndex.value = index
    selectedMoveExplanationLoading.value = true
    try {
      const result = await explainMoveAt(boardStore.fen, move.move)
      selectedMoveExplanation.value = result as Record<string, unknown>
    } catch {
      logger.error('[CoachStore] Top Move Explanation failed')
    } finally {
      selectedMoveExplanationLoading.value = false
    }
  }

  // Watch the board's FEN and automatically ask the coach for insights if enabled.
  watch(
    () => boardStore.fen,
    (newFen) => {
      if (!isCoachEnabled.value) return
      selectedMoveIndex.value = null
      selectedMoveExplanation.value = null
      triggerAnalysis(newFen)
    },
  )

  // Watch deep analysis and disable coach if analysis starts
  watch(
    () => analysisEngineStore.isAnalysisActive,
    (isActive) => {
      if (isActive && isCoachEnabled.value) {
        logger.info('[CoachStore] Toggling off Coach because deep analysis started.')
        setCoachEnabled(false)
      }
    },
  )

  return {
    isCoachEnabled,
    isAnalyzing,
    currentExplanation,
    topMoves,
    topMovesLoading,
    lastMoveAnalysis,
    selectedMoveIndex,
    selectedMoveExplanation,
    selectedMoveExplanationLoading,
    toggleCoach,
    setCoachEnabled,
    explainTopMove,
  }
})
