import { useCoachStore } from './coach.store'
import { useGameStore } from '@/entities/game'
import { usePreferencesStore } from '@/features/settings'
import { soundService } from '@/shared/lib/sound.service'
import logger from '@/shared/lib/logger'

/**
 * Centrally waits for the coach analysis to complete (if coach is enabled).
 * Performs an automatic takeback if the move was analyzed as a mistake/blunder/inaccuracy.
 * Returns true if a takeback was performed, false otherwise.
 */
export async function waitForCoachAndCheckTakeback(): Promise<boolean> {
  const coachStore = useCoachStore()
  if (!coachStore.isCoachEnabled) {
    return false
  }

  // 1. Check takeback status from completed move analysis
  const preferencesStore = usePreferencesStore()

  if (coachStore.isTakebackPending) {
    const gameStore = useGameStore()
    const isSparring = gameStore.currentStrategy?.strategyId === 'sparring'
    const analysis = coachStore.lastMoveAnalysis

    if (isSparring && analysis && analysis.fen && analysis.move) {
      try {
        const { mozerBookService } = await import('@/entities/opening')
        const cleanFen = analysis.fen.split(' ').slice(0, 4).join(' ')
        const stats = await mozerBookService.fetchStats(cleanFen)
        const isTheoryMove = stats?.moves?.some((m) => m.uci === analysis.move) ?? false

        if (isTheoryMove) {
          logger.info(`[CoachGameplay] Move ${analysis.san || analysis.move} is a theory book move. Bypassing blunder takeback.`)
          coachStore.isTakebackPending = false
          coachStore.pendingTakebackFen = null
          coachStore.takebackMessage = null
          return false
        }
      } catch (err) {
        logger.error('[CoachGameplay] Failed to check theory book stats:', err)
      }
    }

    if (!preferencesStore.coachTakebackEnabled) {
      // Clear takeback status so it doesn't block sparring bot or other strategies
      coachStore.isTakebackPending = false
      coachStore.pendingTakebackFen = null
      coachStore.takebackMessage = null
      return false
    }

    if (analysis) {
      const winRateDrop = (typeof analysis.winRateLoss === 'number' && analysis.winRateLoss > 0)
        ? `−${analysis.winRateLoss.toFixed(1)}%`
        : '0.0%'
      const qualityStr = analysis.quality
        ? (analysis.quality.charAt(0).toUpperCase() + analysis.quality.slice(1))
        : 'Unknown'
      
      logger.info(
        `[CoachGameplay] Takeback due to Coach analysis:\n` +
        `Last move: ${analysis.san || 'unknown'}\n` +
        `Quality: ${qualityStr}\n` +
        `wp_drop: ${winRateDrop}\n` +
        `Summary: ${analysis.summary || 'No summary available'}\n` +
        `Consequence: ${coachStore.lastMoveConsequence || 'No consequence details'}\n` +
        `Better was: ${analysis.bestMoveSan || 'none'}`
      )
    } else {
      logger.info('[CoachGameplay] Move flagged as blunder/mistake/inaccuracy. Performing takeback (No analysis details available).')
    }

    // Play training error sound
    soundService.playSound('game_training_error')

    // Show visuals for the blunder position during the warning delay
    if (coachStore.currentExplanation?.visual_commands) {
      const commands = Object.values(coachStore.currentExplanation.visual_commands).flat().join(';')
      if (commands) {
        coachStore.executeVisualCommands(commands)
      }
    }

    // Delay for configurable ms (default 1000ms) synchronously to let user read the warning
    const delay = preferencesStore.coachTakebackDelay ?? 1000
    await new Promise((resolve) => setTimeout(resolve, delay))

    // Perform the actual undo
    gameStore.undoLastUserMove()
    coachStore.resetVisualsAfterBlunderDecision()
    return true
  }

  return false
}
