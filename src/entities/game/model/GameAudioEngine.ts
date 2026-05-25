import { soundService, type SoundEvent } from '@/shared/lib/sound.service'
import type { GameStatusInfo } from './strategy.types'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

class GameAudioEngineController {
  
  /**
   * Orchestrates the sound sequence for game endings.
   * Plays the raw board outcome (e.g. Checkmate) followed by the interpretative outcome (e.g. User Won).
   */
  public handleGameOutcome(outcome: NonNullable<GameStatusInfo['outcome']>, humanColor: ChessgroundColor | null) {
    if (!outcome) return
    
    const sequence: SoundEvent[] = []

    // 1. Board Fact Sound
    if (outcome.reason === 'checkmate') {
      sequence.push('board_checkmate')
    } else if (outcome.reason === 'stalemate') {
      sequence.push('board_draw_stalemate')
    } else if (outcome.reason === 'insufficient_material') {
      sequence.push('board_draw_insufficient_material')
    } else if (outcome.reason === 'fifty_move_rule') {
      sequence.push('board_draw_fifty_moves')
    } else if (outcome.reason === 'threefold_repetition') {
      sequence.push('board_draw_repetition')
    } else if (outcome.reason === 'draw') {
      sequence.push('game_draw')
    }

    // 2. Emotional/Narrative Sound
    if (humanColor && outcome.winner !== undefined) {
       if (outcome.winner === humanColor) {
         sequence.push('game_user_won')
       } else {
         sequence.push('game_user_lost')
       }
    } else if (humanColor && !outcome.winner && outcome.reason !== 'resign' && outcome.reason !== 'wrong_move') {
       // Optional: Add a specific drawn sound for the user here if needed
       // Currently handled by the board_draw_... sounds
    }

    soundService.playSequence(sequence)
  }

  /**
   * Interprets a SAN string to play the correct factual board sounds.
   * `isBotMove` indicates if the move was played by the bot/engine.
   */
  public playMoveSoundFromSan(san: string, isBotMove: boolean = false) {
    if (!san) return

    if (san.includes('O-O')) {
      soundService.playSound('board_castle')
    } else if (san.includes('x')) {
      soundService.playSound('board_capture')
    } else if (san.includes('=')) {
      soundService.playSound('board_promote')
    } else {
      soundService.playSound('board_move')
    }

    // Play check sound. (Checkmate sound is handled by handleGameOutcome)
    if (san.includes('+')) {
      if (isBotMove) {
        soundService.playSound('board_bot_checks_player')
      } else {
        soundService.playSound('board_check')
      }
    }
  }

  public playFeatureSuccess() {
    soundService.playSound('game_tacktics_success')
  }

  public playFeatureError() {
    soundService.playSound('game_tacktics_error')
  }

  public playSpeedrunFinished() {
    soundService.playSound('game_speedrun_finished')
  }
}

export const GameAudioEngine = new GameAudioEngineController()
