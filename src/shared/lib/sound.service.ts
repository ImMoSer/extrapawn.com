import { boardSoundService, registerBoardVolumeProvider } from './sound/boardSound.service'
import { coachSpeakService, registerCoachVolumeProvider } from './sound/coachSpeak.service'

export * from './sound/boardSound.service'
export * from './sound/coachSpeak.service'

export type SoundTrack = 'voice' | 'background'

export interface SoundVolumeProvider {
  getVoiceVolume(): number
  getBoardVolume(): number
  setVoiceVolume(vol: number): void
  setBoardVolume(vol: number): void
}

export function registerVolumeProvider(provider: SoundVolumeProvider): void {
  registerBoardVolumeProvider({
    getBoardVolume: provider.getBoardVolume,
    setBoardVolume: provider.setBoardVolume,
  })
  registerCoachVolumeProvider({
    getVoiceVolume: provider.getVoiceVolume,
    setVoiceVolume: provider.setVoiceVolume,
  })
}

export type SoundEvent =
  | 'app_game_entry'
  | 'board_move'
  | 'board_capture'
  | 'board_castle'
  | 'board_promote'
  | 'board_load_position'
  | 'board_check'
  | 'board_bot_checks_player'
  | 'board_checkmate'
  | 'board_draw_stalemate'
  | 'board_draw_repetition'
  | 'board_draw_fifty_moves'
  | 'board_draw_insufficient_material'
  | 'board_timer_10s'
  | 'board_timer_8s'
  | 'board_timer_times_up'
  | 'game_user_won'
  | 'game_user_lost'
  | 'game_draw'
  | 'game_play_out_start'
  | 'game_tacktics_error'
  | 'game_tacktics_success'
  | 'game_training_error'
  | 'game_you_move'
  | 'game_speedrun_finished'
  | 'task_today_success'
  | 'task_today_error'
  | 'blunder'
  | 'blunder_sound'
  | 'blunder_takeback'
  | 'blunder_insist'

class UnifiedSoundServiceFacade {
  public async playSound(event: SoundEvent, reason?: string): Promise<void> {
    const callerReason = reason || `soundService.playSound('${event}')`
    switch (event) {
      // --- Board SFX ---
      case 'board_move':
        return boardSoundService.play('move', callerReason)
      case 'board_capture':
        return boardSoundService.play('capture', callerReason)
      case 'board_castle':
        return boardSoundService.play('castle', callerReason)
      case 'board_promote':
        return boardSoundService.play('promote', callerReason)
      case 'board_check':
        return boardSoundService.play('check', callerReason)
      case 'board_load_position':
        return boardSoundService.play('load_position', callerReason)
      case 'blunder_sound':
      case 'game_training_error':
        return boardSoundService.play('chpock', callerReason)
      case 'game_tacktics_error':
      case 'task_today_error':
        return boardSoundService.play('tactics_error', callerReason)
      case 'game_tacktics_success':
      case 'task_today_success':
        return boardSoundService.play('tactics_success', callerReason)
      case 'game_speedrun_finished':
        return boardSoundService.play('applause', callerReason)
      case 'board_timer_10s':
        return boardSoundService.play('timer_10s', callerReason)
      case 'board_timer_8s':
        return boardSoundService.play('timer_8s', callerReason)
      case 'board_timer_times_up':
        return boardSoundService.play('timer_times_up', callerReason)

      // --- Coach Voice ---
      case 'app_game_entry':
        return coachSpeakService.speak({ category: 'entry', reason: callerReason })
      case 'board_bot_checks_player':
        return coachSpeakService.speak({ category: 'during_game', specificKey: 'coach_says_check', reason: callerReason })
      case 'game_you_move':
        return coachSpeakService.speak({ category: 'during_game', specificKey: 'your_move', reason: callerReason })
      case 'game_play_out_start':
        return coachSpeakService.speak({ category: 'during_game', reason: callerReason })
      case 'game_user_won':
        return coachSpeakService.speak({ category: 'praise', reason: callerReason })
      case 'game_user_lost':
        return coachSpeakService.speak({ category: 'blunder', severity: 'critical', reason: callerReason })
      case 'blunder':
        return coachSpeakService.speak({ category: 'blunder', severity: 'critical', reason: callerReason })
      case 'blunder_takeback':
        return coachSpeakService.speak({ category: 'blunder', severity: 'takeback', reason: callerReason })
      case 'blunder_insist':
        return coachSpeakService.speak({ category: 'blunder', severity: 'insist', reason: callerReason })
      case 'board_checkmate':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'checkmate', reason: callerReason })
      case 'board_draw_stalemate':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'stalemate', reason: callerReason })
      case 'board_draw_repetition':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'draw_by_repetition', reason: callerReason })
      case 'board_draw_fifty_moves':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'fifty_moves_no_progress', reason: callerReason })
      case 'board_draw_insufficient_material':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'insufficient_material', reason: callerReason })
      case 'game_draw':
        return coachSpeakService.speak({ category: 'chess_result', specificKey: 'draw', reason: callerReason })

      default:
        return Promise.resolve()
    }
  }

  public async playSequence(events: SoundEvent[], reason?: string): Promise<void> {
    for (const event of events) {
      await this.playSound(event, reason)
    }
  }

  public stopAllBackgroundSounds(): void {
    boardSoundService.stopAll()
  }

  public stopAllVoiceSounds(): void {
    coachSpeakService.stop()
  }

  public stopAll(): void {
    boardSoundService.stopAll()
    coachSpeakService.stop()
  }

  public setVoiceVolume(vol: number): void {
    coachSpeakService.setVolume(vol)
  }

  public setBoardVolume(vol: number): void {
    boardSoundService.setVolume(vol)
  }

  public getVoiceVolume(): number {
    return coachSpeakService.volume
  }

  public getBoardVolume(): number {
    return boardSoundService.volume
  }

  public async ensureInitialized(): Promise<void> {
    return Promise.resolve()
  }
}

export const soundService = new UnifiedSoundServiceFacade()
