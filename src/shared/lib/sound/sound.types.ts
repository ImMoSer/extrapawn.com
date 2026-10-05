export type SoundEffect =
  // Board & Move SFX
  | 'move'
  | 'capture'
  | 'castle'
  | 'promote'
  | 'check'
  | 'load_position'
  // Chess Results
  | 'checkmate'
  | 'stalemate'
  | 'draw_by_repetition'
  | 'fifty_moves_no_progress'
  | 'insufficient_material'
  | 'draw'
  // Feedback & SFX
  | 'chpock'
  | 'tactics_error'
  | 'tactics_success'
  | 'applause'
  // Timer SFX
  | 'timer_10s'
  | 'timer_8s'
  | 'timer_times_up'

export type BoardSoundEvent = SoundEffect

export interface SoundVolumeProvider {
  getVolume?(): number
  setVolume?(vol: number): void
  getBoardVolume?(): number
  setBoardVolume?(vol: number): void
}

export type BoardVolumeProvider = SoundVolumeProvider
