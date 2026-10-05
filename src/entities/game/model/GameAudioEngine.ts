import { soundService } from '@/shared/lib/sound'
import type { GameStatusInfo } from './strategy.types'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

class GameAudioEngineController {
  /**
   * Orchestrates the sound sequence for game endings.
   * Plays the chess outcome sound effect followed by user praise if won.
   */
  public handleGameOutcome(outcome: NonNullable<GameStatusInfo['outcome']>, humanColor?: ChessgroundColor | null) {
    void humanColor
    if (!outcome) return

    // 1. Board Outcome Sound
    if (outcome.reason === 'checkmate') {
      soundService.play('checkmate')
    } else if (outcome.reason === 'stalemate' || outcome.reason === 'draw') {
      soundService.play('stalemate')
    } else if (outcome.reason === 'insufficient_material') {
      soundService.play('insufficient_material')
    } else if (outcome.reason === 'fifty_move_rule') {
      soundService.play('fifty_moves_no_progress')
    } else if (outcome.reason === 'threefold_repetition') {
      soundService.play('draw_by_repetition')
    }
  }

  /**
   * Interprets a SAN string to play the correct factual board sounds.
   */
  public playMoveSoundFromSan(san: string) {
    if (!san) return

    if (san.includes('O-O')) {
      soundService.play('castle')
    } else if (san.includes('x')) {
      soundService.play('capture')
    } else if (san.includes('=')) {
      soundService.play('promote')
    } else {
      soundService.play('move')
    }

    // Play check sound symmetrically for both human and bot
    if (san.includes('+')) {
      soundService.play('check')
    }
  }

  public playFeatureSuccess() {
    soundService.play('tactics_success')
  }

  public playFeatureError() {
    soundService.play('tactics_error')
  }

  public playTaskTodaySuccess() {
    soundService.play('tactics_success')
  }

  public playTaskTodayError() {
    soundService.play('tactics_error')
  }

  public playSpeedrunFinished() {
    soundService.play('applause')
  }
}

export const GameAudioEngine = new GameAudioEngineController()
