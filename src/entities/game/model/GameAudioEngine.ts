import { boardSoundService, coachSpeakService } from '@/shared/lib/sound'
import type { GameStatusInfo } from './strategy.types'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

class GameAudioEngineController {
  
  /**
   * Orchestrates the sound sequence for game endings.
   * Plays the board outcome voice line followed by user praise or blunder reaction.
   */
  public handleGameOutcome(outcome: NonNullable<GameStatusInfo['outcome']>, humanColor: ChessgroundColor | null) {
    if (!outcome) return

    // 1. Board Outcome Voice
    if (outcome.reason === 'checkmate') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'checkmate' })
    } else if (outcome.reason === 'stalemate') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'stalemate' })
    } else if (outcome.reason === 'insufficient_material') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'insufficient_material' })
    } else if (outcome.reason === 'fifty_move_rule') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'fifty_moves_no_progress' })
    } else if (outcome.reason === 'threefold_repetition') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'draw_by_repetition' })
    } else if (outcome.reason === 'draw') {
      coachSpeakService.speak({ category: 'chess_result', specificKey: 'draw' })
    }

    // 2. User Outcome Reaction
    if (humanColor && outcome.winner !== undefined) {
      if (outcome.winner === humanColor) {
        coachSpeakService.speak({ category: 'praise' })
      } else {
        coachSpeakService.speak({ category: 'blunder', severity: 'critical' })
      }
    }
  }

  /**
   * Interprets a SAN string to play the correct factual board sounds.
   * `isBotMove` indicates if the move was played by the bot/engine.
   */
  public playMoveSoundFromSan(san: string, isBotMove: boolean = false) {
    if (!san) return

    if (san.includes('O-O')) {
      boardSoundService.play('castle')
    } else if (san.includes('x')) {
      boardSoundService.play('capture')
    } else if (san.includes('=')) {
      boardSoundService.play('promote')
    } else {
      boardSoundService.play('move')
    }

    // Play check sound. (Checkmate sound is handled by handleGameOutcome)
    if (san.includes('+')) {
      if (isBotMove) {
        coachSpeakService.speak({ category: 'during_game', specificKey: 'coach_says_check' })
      } else {
        boardSoundService.play('check')
      }
    }
  }

  public playFeatureSuccess() {
    boardSoundService.play('tactics_success')
  }

  public playFeatureError() {
    boardSoundService.play('tactics_error')
  }

  public playTaskTodaySuccess() {
    boardSoundService.play('tactics_success')
  }

  public playTaskTodayError() {
    boardSoundService.play('tactics_error')
  }

  public playSpeedrunFinished() {
    boardSoundService.play('applause')
  }
}

export const GameAudioEngine = new GameAudioEngineController()
