import { useBoardStore } from '@/entities/game'
import { QUALITY_LABEL } from '@/shared/lib/engine/coach/coach.types'
import type { CoachLastMoveAnalysis, CoachTopMove } from '@/shared/lib/engine/coach/coach.types'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useCoachStore } from './coach.store'

export type CoachMood = 'neutral' | 'proud' | 'shocked' | 'thoughtful' | 'warning' | 'relieved' | 'celebrating'

export const useCoachFeedbackStore = defineStore('coach-feedback', () => {
  const coachStore = useCoachStore()
  const boardStore = useBoardStore()

  const coachMood = ref<CoachMood>('neutral')
  const isTakebackPending = ref(false)
  const takebackMessage = ref<string | null>(null)
  const pendingTakebackFen = ref<string | null>(null)

  watch(
    () => coachStore.isAnalyzing,
    (isAnalyzing) => {
      if (isAnalyzing) {
        coachMood.value = 'thoughtful'
        return
      }

      const analysis: CoachLastMoveAnalysis | null = coachStore.lastMoveAnalysis
      if (!analysis || analysis.loading) {
        coachMood.value = 'neutral'
        return
      }

      const currentFen = pgnService.getCurrentNavigatedFen()

      // Reset the takeback status if we have navigated away from the target FEN
      if (isTakebackPending.value && pendingTakebackFen.value && currentFen !== pendingTakebackFen.value) {
        isTakebackPending.value = false
        takebackMessage.value = null
        pendingTakebackFen.value = null
      }

      // Check if the move was played by the user (matches board orientation)
      const prevFen = analysis.fen
      const sideToMove = prevFen ? prevFen.split(' ')[1] : null
      const movingColor = sideToMove === 'w' ? 'white' : 'black'
      const isUserMove = movingColor === boardStore.orientation

      // 1. Determine the coach's mood based on move quality / game state
      if (boardStore.isGameOver) {
        coachMood.value = 'celebrating'
      } else if (isUserMove && analysis.quality) {
        if (
          analysis.quality === 'blunder' ||
          analysis.quality === 'missed_mate' ||
          analysis.quality === 'mistake' ||
          analysis.quality === 'inaccuracy'
        ) {
          // Trigger Auto-Takeback
          isTakebackPending.value = true
          pendingTakebackFen.value = prevFen || null

          if (analysis.quality === 'inaccuracy') {
            coachMood.value = 'warning'
            takebackMessage.value = 'Ungenauigkeit! Überleg noch mal, es gibt einen besseren Zug.'
          } else if (analysis.quality === 'mistake') {
            coachMood.value = 'warning'
            takebackMessage.value = 'Das war ein Fehler! Überleg noch mal, es gibt einen besseren Zug.'
          } else {
            coachMood.value = 'shocked'
            takebackMessage.value = 'Das war ein grober Patzer! Überleg noch mal, es gibt einen besseren Zug.'
          }

        } else {
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
            default:
              coachMood.value = 'neutral'
          }
        }
      } else if (!isTakebackPending.value) {
        // Opponent move: Keep coach neutral
        coachMood.value = 'neutral'
      }

      // 2. Format the winRateDrop and assemble the log object
      const winRateDrop = (typeof analysis.winRateLoss === 'number' && analysis.winRateLoss > 0)
        ? `−${analysis.winRateLoss.toFixed(1)}%`
        : null

      const logObj: {
        lastMove: Record<string, unknown> | null
        topMoves: Record<string, unknown>[]
      } = {
        lastMove: null,
        topMoves: []
      }

      if (analysis.quality) {
        logObj.lastMove = {
          move: analysis.san,
          quality: QUALITY_LABEL[analysis.quality] || analysis.quality,
          summary: analysis.summary || null,
          details: analysis.details || null,
          consequence: coachStore.lastMoveConsequence,
          betterMove: analysis.isBestMove ? null : (analysis.bestMoveSan || null),
          winRateDrop,
        }
      }

      if (coachStore.topMoves.length > 0 && coachStore.currentExplanation?.engine_top_moves) {
        logObj.topMoves = coachStore.topMoves.slice(0, 3).map((m: CoachTopMove) => {
          const enriched = coachStore.currentExplanation?.engine_top_moves.find(em => em.san === m.san)
          return {
            rank: m.rank,
            san: m.san,
            eval: m.isMate ? `M${m.mateIn}` : (m.eval_pawns > 0 ? `+${m.eval_pawns}` : `${m.eval_pawns}`),
            plan: enriched?.plan_brief || null,
            tagline: m.tagline || null,
            quality: enriched?.explanation?.quality ? (QUALITY_LABEL[enriched.explanation.quality] || enriched.explanation.quality) : null,
            summary: enriched?.explanation?.summary || null,
            details: enriched?.explanation?.details || null,
            character: enriched?.character || null,
          }
        })
      }

      if (logObj.lastMove || logObj.topMoves.length > 0) {
        logger.info('[CoachExplanation]', logObj)
      }
    },
    { flush: 'sync' }
  )

  return {
    coachMood,
    isTakebackPending,
    takebackMessage,
    pendingTakebackFen,
  }
})
