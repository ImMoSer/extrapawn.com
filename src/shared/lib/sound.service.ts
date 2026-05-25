// src/shared/lib/sound.service.ts
import logger from '@/shared/lib/logger'

// --- SETTINGS ---
const VOICE_VOLUME_KEY = 'user_voice_volume'
const BOARD_VOLUME_KEY = 'user_board_volume'

// --- TYPES ---
export type SoundTrack = 'voice' | 'background'

export type SoundEvent =
  // --- App ---
  | 'app_game_entry'

  // --- Board Store / Game Mechanics ---
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

  // --- Game Result / Personal ---
  | 'game_user_won'
  | 'game_user_lost'
  | 'game_draw'

  // --- Feature Specific ---
  | 'game_play_out_start'
  | 'game_tacktics_error'
  | 'game_tacktics_success'
  | 'game_training_error'
  | 'game_you_move'
  | 'game_speedrun_finished'
  | 'blunder'

// --- DYNAMIC POOL LOADING ---
// This uses Vite's glob import to find all mp3 files in the public/sounds folder.
const soundModules = import.meta.glob('/public/sounds/**/*.mp3')
const allSoundPaths = Object.keys(soundModules).map((path) => path.replace('/public', ''))

/**
 * Creates a pool of sound paths based on a prefix.
 * If the prefix points to a specific file, it returns just that file.
 * If it points to a directory, it returns all files within that directory (recursively).
 */
const createPool = (pathPrefix: string): string[] => {
  // Check if it's a direct file first (to be safe)
  if (allSoundPaths.includes(pathPrefix)) return [pathPrefix]
  
  // Otherwise filter by prefix (folder structure)
  const pool = allSoundPaths.filter((path) => path.startsWith(pathPrefix))
  
  if (pool.length === 0) {
    logger.warn(`[SoundService] No sounds found for prefix: ${pathPrefix}`)
  }
  return pool
}

// --- SOUND DEFINITIONS ---
const soundDefinitions: Record<SoundEvent, { track: SoundTrack; path: string | string[] }> = {
  // --- App ---
  app_game_entry: { track: 'voice', path: createPool('/sounds/app/gameModusEntry') },

  // --- Board Store ---
  board_move: { track: 'background', path: '/sounds/boarStore/board_move.mp3' },
  board_capture: { track: 'background', path: '/sounds/boarStore/board_capture.mp3' },
  board_castle: { track: 'background', path: '/sounds/boarStore/board_castle.mp3' },
  board_promote: { track: 'background', path: '/sounds/boarStore/board_promote.mp3' },
  board_load_position: { track: 'background', path: '/sounds/boarStore/board_load_position.mp3' },
  board_check: { track: 'background', path: '/sounds/boarStore/board_check.mp3' },
  board_bot_checks_player: { track: 'voice', path: createPool('/sounds/boarStore/checks_by_bot') },
  board_checkmate: { track: 'voice', path: createPool('/sounds/boarStore/chessGameResult/checkmate') },
  
  board_draw_stalemate: { track: 'voice', path: createPool('/sounds/boarStore/chessGameResult/draw/draw_by_stalemate') },
  board_draw_repetition: { track: 'voice', path: '/sounds/boarStore/chessGameResult/draw/draw_by_repetition.mp3' },
  board_draw_fifty_moves: { track: 'voice', path: '/sounds/boarStore/chessGameResult/draw/draw_by_fifty_moves.mp3' },
  board_draw_insufficient_material: { track: 'voice', path: '/sounds/boarStore/chessGameResult/draw/draw_by_insufficient_material.mp3' },

  board_timer_10s: { track: 'background', path: '/sounds/boarStore/timer_10_seconds_left.mp3' },
  board_timer_8s: { track: 'background', path: '/sounds/boarStore/timer_8_seconds_left.mp3' },
  board_timer_times_up: { track: 'background', path: '/sounds/boarStore/timer_times_up.mp3' },

  // --- Game Result ---
  game_user_won: { track: 'voice', path: createPool('/sounds/gameStore/after_game/if_user_won') },
  game_user_lost: { track: 'voice', path: createPool('/sounds/gameStore/after_game/if_user_lost') },
  game_draw: { track: 'voice', path: createPool('/sounds/boarStore/chessGameResult/draw') },

  // --- Features ---
  game_play_out_start: { track: 'voice', path: createPool('/sounds/gameStore/during_game/play_out_start') },
  game_tacktics_error: { track: 'background', path: '/sounds/gameStore/TacticksError.mp3' },
  game_tacktics_success: { track: 'background', path: '/sounds/gameStore/TacticksSuccess.mp3' },
  game_training_error: { track: 'background', path: '/sounds/gameStore/ErrorChpock.mp3' },
  game_you_move: { track: 'voice', path: '/sounds/gameStore/during_game/play_out_start/play_out_start_1.mp3' },
  game_speedrun_finished: { track: 'background', path: createPool('/sounds/gameStore/applaus_backround') },
  blunder: { track: 'voice', path: '/sounds/gameStore/during_game/play_out_start/play_out_start_2.mp3' },
}

class SoundServiceController {
  private audioCache: Map<string, HTMLAudioElement> = new Map()

  private voiceVolume = 1.0
  private boardVolume = 1.0

  private isVoiceTrackBusy = false
  private voiceQueue: SoundEvent[] = []
  private activeBackgroundSounds: Set<HTMLAudioElement> = new Set()

  constructor() {
    this.loadVolumeSettings()
  }

  /**
   * Plays a sound event. 
   * 'voice' track events are queued and played sequentially.
   * 'background' track events are played immediately.
   */
  public async playSound(event: SoundEvent): Promise<void> {
    const definition = soundDefinitions[event]
    if (!definition) {
      logger.warn(`[SoundService] Sound definition not found for event: ${event}`)
      return
    }

    if (definition.track === 'voice') {
      this.voiceQueue.push(event)
      this._processVoiceQueue()
    } else {
      // Background sounds don't need a queue, play them immediately
      this._playAndTrack(event)
    }
  }

  /**
   * Helper to play multiple sounds in a specific sequence.
   */
  public async playSequence(events: SoundEvent[]): Promise<void> {
    for (const event of events) {
      await this.playSound(event)
    }
  }

  private async _processVoiceQueue(): Promise<void> {
    if (this.isVoiceTrackBusy || this.voiceQueue.length === 0) {
      return
    }
    this.isVoiceTrackBusy = true
    
    const nextEvent = this.voiceQueue.shift()
    if (nextEvent) {
      await this._playAndTrack(nextEvent)
    }
    
    this.isVoiceTrackBusy = false
    this._processVoiceQueue()
  }

  private _getOrCreateAudio(path: string): HTMLAudioElement {
    if (this.audioCache.has(path)) {
      return this.audioCache.get(path)!
    }

    const audio = new Audio(path)
    audio.preload = 'auto'
    this.audioCache.set(path, audio)
    return audio
  }

  private _playAndTrack(event: SoundEvent): Promise<void> {
    return new Promise((resolve) => {
      const definition = soundDefinitions[event]!
      const pathOrPool = definition.path
      const path = Array.isArray(pathOrPool)
        ? pathOrPool[Math.floor(Math.random() * pathOrPool.length)]
        : pathOrPool

      if (!path) {
        logger.warn(`[SoundService] No sound path found for event: ${event}. Pool might be empty.`)
        resolve()
        return
      }

      const audio = this._getOrCreateAudio(path)
      const isBackground = definition.track === 'background'

      audio.volume = isBackground ? this.boardVolume : this.voiceVolume
      audio.currentTime = 0

      audio.onended = () => {
        if (isBackground) {
          this.activeBackgroundSounds.delete(audio)
        }
        audio.onended = null
        resolve()
      }

      if (isBackground) {
        this.activeBackgroundSounds.add(audio)
      }

      audio.play().catch((error) => {
        const message = (error as Error).message
        if (
          message.includes("user didn't interact") ||
          (error as Error).name === 'NotAllowedError'
        ) {
          logger.info(`[SoundService] Autoplay blocked for sound '${path}'. User interaction required.`)
        } else {
          logger.warn(`[SoundService] Error playing sound '${path}':`, message)
        }

        if (isBackground) {
          this.activeBackgroundSounds.delete(audio)
        }
        audio.onended = null
        resolve()
      })
    })
  }

  public stopAllBackgroundSounds(): void {
    this.activeBackgroundSounds.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    this.activeBackgroundSounds.clear()
    logger.info('[SoundService] All background sounds stopped.')
  }

  public setVoiceVolume(volume: number): void {
    this.voiceVolume = Math.max(0, Math.min(1, volume))
    localStorage.setItem(VOICE_VOLUME_KEY, String(this.voiceVolume))
  }

  public setBoardVolume(volume: number): void {
    this.boardVolume = Math.max(0, Math.min(1, volume))
    localStorage.setItem(BOARD_VOLUME_KEY, String(this.boardVolume))
  }

  public getVoiceVolume = (): number => this.voiceVolume
  public getBoardVolume = (): number => this.boardVolume

  private loadVolumeSettings(): void {
    try {
      const savedVoice = localStorage.getItem(VOICE_VOLUME_KEY)
      const savedBoard = localStorage.getItem(BOARD_VOLUME_KEY)
      if (savedVoice !== null) this.voiceVolume = parseFloat(savedVoice)
      if (savedBoard !== null) this.boardVolume = parseFloat(savedBoard)
    } catch (error) {
      logger.error('[SoundService] Failed to load volume settings from localStorage:', error)
    }
  }

  public async ensureInitialized(): Promise<void> {
    return Promise.resolve()
  }
}

export const soundService = new SoundServiceController()
