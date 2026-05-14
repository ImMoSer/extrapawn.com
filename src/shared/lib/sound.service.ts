// src/services/sound.service.ts
import logger from '@/shared/lib/logger'

// --- НАСТРОЙКИ ---
const VOICE_VOLUME_KEY = 'user_voice_volume'
const BOARD_VOLUME_KEY = 'user_board_volume'

// --- ТИПЫ ---
type SoundTrack = 'voice' | 'background'

// Новые, более семантические имена событий, соответствующие структуре папок
export type SoundEvent =
  // --- App ---
  | 'app_game_entry'

  // --- BoardStore ---
  | 'board_move'
  | 'board_capture'
  | 'board_castle'
  | 'board_promote'
  | 'board_load_position'
  | 'board_timer_10s'
  | 'board_timer_8s'
  | 'board_timer_times_up'
  | 'board_bot_checks_player' // Голосовой, но инициируется board.store
  | 'board_check' // Simple check sound (User -> Bot)
  | 'board_checkmate' // Голосовой, но инициируется board.store
  | 'board_draw_stalemate'
  | 'board_draw_repetition'
  | 'board_draw_fifty_moves'
  | 'board_draw_insufficient_material'

  // --- GameStore & ModeStores ---
  | 'game_play_out_start'
  | 'game_user_won'
  | 'game_user_lost'
  | 'game_tacktics_error'
  | 'game_tacktics_success'
  | 'game_you_move'
  | 'game_speedrun_finished'
  | 'game_training_error'
  | 'blunder'

// --- КОНЕЦ ИЗМЕНЕНИЙ ---

// --- ДИНАМИЧЕСКАЯ ЗАГРУЗКА ЗВУКОВЫХ ПУЛОВ ---
const soundModules = import.meta.glob('/public/sounds/**/*.mp3')
const allSoundPaths = Object.keys(soundModules).map((path) => path.replace('/public', ''))

const createPool = (pathPrefix: string): string[] => {
  return allSoundPaths.filter((path) => path.startsWith(pathPrefix))
}

// --- ОПРЕДЕЛЕНИЕ ЗВУКОВЫХ СОБЫТИЙ ---
const soundDefinitions: Record<SoundEvent, { track: SoundTrack; path: string | string[] }> = {
  // --- App (вызывается из сторов режимов) ---
  app_game_entry: { track: 'voice', path: createPool('/sounds/app/gameModusEntry') },

  // --- BoardStore ---
  board_move: { track: 'background', path: '/sounds/boarStore/board_move.mp3' },
  board_capture: { track: 'background', path: '/sounds/boarStore/board_capture.mp3' },
  board_castle: { track: 'background', path: '/sounds/boarStore/board_castle.mp3' },
  board_promote: { track: 'background', path: '/sounds/boarStore/board_promote.mp3' },
  board_load_position: { track: 'background', path: '/sounds/boarStore/board_load_position.mp3' },
  board_timer_10s: { track: 'background', path: '/sounds/boarStore/timer_10_seconds_left.mp3' },
  board_timer_8s: { track: 'background', path: '/sounds/boarStore/timer_8_seconds_left.mp3' },
  board_timer_times_up: { track: 'background', path: '/sounds/boarStore/timer_times_up.mp3' },
  board_bot_checks_player: { track: 'voice', path: createPool('/sounds/boarStore/checks_by_bot') },
  board_check: { track: 'background', path: '/sounds/boarStore/board_check.mp3' },
  board_checkmate: {
    track: 'voice',
    path: createPool('/sounds/boarStore/chessGameResult/checkmate'),
  },
  board_draw_stalemate: {
    track: 'voice',
    path: createPool('/sounds/boarStore/chessGameResult/draw/draw_by_stalemate'),
  },
  board_draw_repetition: {
    track: 'voice',
    path: '/sounds/boarStore/chessGameResult/draw/draw_by_repetition.mp3',
  },
  board_draw_fifty_moves: {
    track: 'voice',
    path: '/sounds/boarStore/chessGameResult/draw/draw_by_fifty_moves.mp3',
  },
  board_draw_insufficient_material: {
    track: 'voice',
    path: '/sounds/boarStore/chessGameResult/draw/draw_by_insufficient_material.mp3',
  },

  // --- GameStore & ModeStores ---
  game_play_out_start: {
    track: 'voice',
    path: createPool('/sounds/gameStore/during_game/play_out_start'),
  },
  game_user_won: { track: 'voice', path: createPool('/sounds/gameStore/after_game/if_user_won') },
  game_user_lost: { track: 'voice', path: createPool('/sounds/gameStore/after_game/if_user_lost') },
  game_tacktics_error: { track: 'background', path: '/sounds/gameStore/TacticksError.mp3' },
  // --- НАЧАЛО ИЗМЕНЕНИЙ ---
  game_tacktics_success: { track: 'background', path: '/sounds/gameStore/TacticksSuccess.mp3' },
  game_you_move: {
    track: 'voice',
    path: '/sounds/gameStore/during_game/play_out_start/play_out_start_1.mp3',
  },
  game_speedrun_finished: {
    track: 'background',
    path: createPool('/sounds/gameStore/applaus_backround'),
  },
  game_training_error: { track: 'background', path: '/sounds/gameStore/ErrorChpock.mp3' },
  blunder: {
    track: 'voice',
    path: '/sounds/gameStore/during_game/play_out_start/play_out_start_2.mp3',
  },
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
      this._playAndTrack(event)
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
    audio.preload = 'auto' // Instructs browser to load data if possible
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

      // Lazy-load the HTMLAudioElement
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
          logger.info(
            `[SoundService] Autoplay blocked for sound '${path}'. User interaction required.`,
          )
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
    // No-op for backwards compatibility if called from elsewhere
    return Promise.resolve()
  }
}

export const soundService = new SoundServiceController()
