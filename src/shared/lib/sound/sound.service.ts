import logger from '@/shared/lib/logger'
import type { SoundEffect, SoundVolumeProvider } from './sound.types'

let volumeProvider: SoundVolumeProvider | null = null

export function registerVolumeProvider(provider: SoundVolumeProvider): void {
  volumeProvider = provider
}

export const registerBoardVolumeProvider = registerVolumeProvider

export const soundDefinitions: Record<SoundEffect, string | string[]> = {
  move: '/sounds/move.mp3',
  capture: '/sounds/capture.mp3',
  castle: '/sounds/castle.mp3',
  promote: '/sounds/promote.mp3',
  check: '/sounds/check.mp3',
  load_position: '/sounds/load_position.mp3',
  chpock: '/sounds/sfx_chpock.mp3',
  tactics_error: '/sounds/sfx_tactics_error.mp3',
  tactics_success: '/sounds/sfx_tactics_success.mp3',
  applause: [
    '/sounds/applause/applause_1.mp3',
    '/sounds/applause/applause_2.mp3',
    '/sounds/applause/applause_3.mp3',
    '/sounds/applause/applause_4.mp3',
  ],
  checkmate: '/sounds/chess_result/checkmate.mp3',
  stalemate: '/sounds/chess_result/stalemate.mp3',
  draw_by_repetition: '/sounds/chess_result/draw_by_repetition.mp3',
  fifty_moves_no_progress: '/sounds/chess_result/fifty_moves_no_progress.mp3',
  insufficient_material: '/sounds/chess_result/insufficient_material.mp3',
  draw: '/sounds/chess_result/stalemate.mp3',
  timer_10s: '/sounds/timer/timer_10s.mp3',
  timer_8s: '/sounds/timer/timer_8s.mp3',
  timer_times_up: '/sounds/timer/timer_times_up.mp3',
}

const legacyEventMap: Record<string, SoundEffect> = {
  board_move: 'move',
  board_capture: 'capture',
  board_castle: 'castle',
  board_promote: 'promote',
  board_check: 'check',
  board_load_position: 'load_position',
  blunder_sound: 'chpock',
  game_training_error: 'chpock',
  game_tacktics_error: 'tactics_error',
  task_today_error: 'tactics_error',
  game_tacktics_success: 'tactics_success',
  task_today_success: 'tactics_success',
  game_speedrun_finished: 'applause',
  board_timer_10s: 'timer_10s',
  board_timer_8s: 'timer_8s',
  board_timer_times_up: 'timer_times_up',
  board_checkmate: 'checkmate',
  board_draw_stalemate: 'stalemate',
  board_draw_repetition: 'draw_by_repetition',
  board_draw_fifty_moves: 'fifty_moves_no_progress',
  board_draw_insufficient_material: 'insufficient_material',
  game_draw: 'stalemate',
}

export class SoundServiceController {
  private audioTemplates: Map<string, HTMLAudioElement> = new Map()
  private activeSounds: Set<HTMLAudioElement> = new Set()

  public get volume(): number {
    if (volumeProvider) {
      if (typeof volumeProvider.getVolume === 'function') {
        return volumeProvider.getVolume()
      }
      if (typeof volumeProvider.getBoardVolume === 'function') {
        return volumeProvider.getBoardVolume()
      }
    }
    return 1.0
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol))
    if (volumeProvider) {
      if (typeof volumeProvider.setVolume === 'function') {
        volumeProvider.setVolume(clamped)
      } else if (typeof volumeProvider.setBoardVolume === 'function') {
        volumeProvider.setBoardVolume(clamped)
      }
    }
    this.activeSounds.forEach((audio) => {
      audio.volume = clamped
    })
  }

  public setBoardVolume(vol: number): void {
    this.setVolume(vol)
  }

  public getBoardVolume(): number {
    return this.volume
  }


  private _getTemplate(path: string): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    if (this.audioTemplates.has(path)) {
      return this.audioTemplates.get(path)!
    }
    const audio = new Audio(path)
    audio.preload = 'auto'
    this.audioTemplates.set(path, audio)
    return audio
  }

  public play(event: SoundEffect, _reason?: string): Promise<void> {
    void _reason
    const pathOrPool = soundDefinitions[event]
    if (!pathOrPool) {
      logger.warn(`[SoundService] Undefined sound event: ${event}`)
      return Promise.resolve()
    }

    const path = Array.isArray(pathOrPool)
      ? pathOrPool[Math.floor(Math.random() * pathOrPool.length)]
      : pathOrPool

    if (!path) {
      logger.warn(`[SoundService] No sound path available for event: ${event}`)
      return Promise.resolve()
    }

    if (typeof Audio === 'undefined') {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const template = this._getTemplate(path)
      if (!template) {
        resolve()
        return
      }

      const audio = template.cloneNode(true) as HTMLAudioElement
      audio.volume = this.volume
      audio.currentTime = 0

      const cleanup = () => {
        this.activeSounds.delete(audio)
        audio.onended = null
        audio.onerror = null
        resolve()
      }

      audio.onended = cleanup
      audio.onerror = cleanup

      this.activeSounds.add(audio)

      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error: Error) => {
          if (
            error.message?.includes("user didn't interact") ||
            error.name === 'NotAllowedError'
          ) {
            logger.info(`[SoundService] Autoplay blocked for '${path}'. User interaction required.`)
          } else {
            logger.warn(`[SoundService] Error playing '${path}':`, error.message)
          }
          cleanup()
        })
      } else {
        cleanup()
      }
    })
  }

  public playSound(event: string, reason?: string): Promise<void> {
    const mapped = legacyEventMap[event] || (event as SoundEffect)
    if (mapped in soundDefinitions) {
      return this.play(mapped, reason)
    }
    // If unknown or removed event (such as app_game_entry, game_play_out_start), resolve silently
    return Promise.resolve()
  }

  public async playSequence(events: (SoundEffect | string)[], reason?: string): Promise<void> {
    for (const event of events) {
      await this.playSound(event, reason)
    }
  }

  public stopAll(): void {
    this.activeSounds.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    this.activeSounds.clear()
    logger.info('[SoundService] All sounds stopped.')
  }

  public stopAllBackgroundSounds(): void {
    this.stopAll()
  }

  public stopAllVoiceSounds(): void {
    // Deprecated no-op: voice track removed
  }

  public async ensureInitialized(): Promise<void> {
    return Promise.resolve()
  }
}

export const soundService = new SoundServiceController()
export const boardSoundService = soundService
