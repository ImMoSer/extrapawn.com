import { useCoachStore } from './coach.store'
import { useCoachFeedbackStore } from './coach-feedback.store'
import { useGameStore } from '@/entities/game'
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

  // 1. Actively trigger and wait for analysis to finish
  await coachStore.analyzeCurrentPosition()

  // 2. Perform takeback if the move was flagged
  const feedbackStore = useCoachFeedbackStore()
  if (feedbackStore.isTakebackPending) {
    const analysis = coachStore.lastMoveAnalysis
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

    // Delay for 1000ms synchronously to let user read the warning
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Perform the actual undo
    const gameStore = useGameStore()
    gameStore.undoLastUserMove()
    return true
  }

  return false
}
