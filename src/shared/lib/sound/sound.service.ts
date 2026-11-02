import logger from '@/shared/lib/logger'
import type { SoundEffect, SoundVolumeProvider } from './sound.types'

let volumeProvider: SoundVolumeProvider | null = null

export function registerVolumeProvider(provider: SoundVolumeProvider): void {
  volumeProvider = provider
}

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

export class SoundServiceController {
  private audioPool: Map<string, HTMLAudioElement[]> = new Map()
  private activeSounds: Set<HTMLAudioElement> = new Set()

  public get volume(): number {
    return volumeProvider ? volumeProvider.getVolume() : 1.0
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol))
    volumeProvider?.setVolume(clamped)
    this.activeSounds.forEach((audio) => {
      audio.volume = clamped
    })
  }

  private _acquireAudio(path: string): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null
    let pool = this.audioPool.get(path)
    if (!pool) {
      pool = []
      this.audioPool.set(path, pool)
    }

    const idleAudio = pool.find((el) => !this.activeSounds.has(el) && (el.paused || el.ended))
    if (idleAudio) {
      try {
        idleAudio.currentTime = 0
      } catch {
        // Ignore if metadata is not yet loaded
      }
      return idleAudio
    }

    const audio = new Audio(path)
    audio.preload = 'auto'
    pool.push(audio)
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
      const audio = this._acquireAudio(path)
      if (!audio) {
        resolve()
        return
      }

      audio.volume = this.volume

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

  public stopAll(): void {
    this.activeSounds.forEach((audio) => {
      audio.pause()
      audio.currentTime = 0
    })
    this.activeSounds.clear()
    logger.info('[SoundService] All sounds stopped.')
  }
}

export const soundService = new SoundServiceController()

