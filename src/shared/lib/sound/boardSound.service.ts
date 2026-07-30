import logger from '@/shared/lib/logger'

export type BoardSoundEvent =
  | 'move'
  | 'capture'
  | 'castle'
  | 'promote'
  | 'check'
  | 'load_position'
  | 'chpock'
  | 'tactics_error'
  | 'tactics_success'
  | 'applause'
  | 'timer_10s'
  | 'timer_8s'
  | 'timer_times_up'

export interface BoardVolumeProvider {
  getBoardVolume(): number
  setBoardVolume(vol: number): void
}

let volumeProvider: BoardVolumeProvider | null = null

export function registerBoardVolumeProvider(provider: BoardVolumeProvider): void {
  volumeProvider = provider
}

// Vite glob import for board sound assets
const boardSoundModules = import.meta.glob('/public/sounds/board/**/*.mp3')
const allBoardSoundPaths = Object.keys(boardSoundModules).map((path) => path.replace('/public', ''))

const createBoardPool = (pathPrefix: string): string[] => {
  if (allBoardSoundPaths.includes(pathPrefix)) return [pathPrefix]
  const pool = allBoardSoundPaths.filter((path) => path.startsWith(pathPrefix))
  if (pool.length === 0) {
    logger.warn(`[BoardSoundService] No sounds found for prefix: ${pathPrefix}`)
  }
  return pool
}

const boardSoundDefinitions: Record<BoardSoundEvent, string | string[]> = {
  move: '/sounds/board/move.mp3',
  capture: '/sounds/board/capture.mp3',
  castle: '/sounds/board/castle.mp3',
  promote: '/sounds/board/promote.mp3',
  check: '/sounds/board/check.mp3',
  load_position: '/sounds/board/load_position.mp3',
  chpock: '/sounds/board/sfx_chpock.mp3',
  tactics_error: '/sounds/board/sfx_tactics_error.mp3',
  tactics_success: '/sounds/board/sfx_tactics_success.mp3',
  applause: createBoardPool('/sounds/board/applause/'),
  timer_10s: '/sounds/board/timer/timer_10s.mp3',
  timer_8s: '/sounds/board/timer/timer_8s.mp3',
  timer_times_up: '/sounds/board/timer/timer_times_up.mp3',
}

export class BoardSoundServiceController {
  private audioTemplates: Map<string, HTMLAudioElement> = new Map()
  private activeSounds: Set<HTMLAudioElement> = new Set()

  public get volume(): number {
    if (volumeProvider) return volumeProvider.getBoardVolume()
    return 1.0
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol))
    if (volumeProvider) {
      volumeProvider.setBoardVolume(clamped)
    }
    this.activeSounds.forEach((audio) => {
      audio.volume = clamped
    })
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

  public play(event: BoardSoundEvent, _reason?: string): Promise<void> {
    void _reason
    const pathOrPool = boardSoundDefinitions[event]
    if (!pathOrPool) {
      logger.warn(`[BoardSoundService] Undefined sound event: ${event}`)
      return Promise.resolve()
    }

    const path = Array.isArray(pathOrPool)
      ? pathOrPool[Math.floor(Math.random() * pathOrPool.length)]
      : pathOrPool

    if (!path) {
      logger.warn(`[BoardSoundService] No sound path available for event: ${event}`)
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

      // logger.info(
      //   `[BOARD_SFX] Playing event: '${event}' [Reason: '${reason || 'unspecified'}'] -> File: '${path}' (Volume: ${(this.volume * 100).toFixed(0)}%)`
      // )

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
            logger.info(`[BoardSoundService] Autoplay blocked for '${path}'. User interaction required.`)
          } else {
            logger.warn(`[BoardSoundService] Error playing '${path}':`, error.message)
          }
          cleanup()
        })
      } else {
        // In environments where play() is stubbed or synchronous (e.g. jsdom / Vitest)
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
    logger.info('[BoardSoundService] All board sounds stopped.')
  }
}

export const boardSoundService = new BoardSoundServiceController()
