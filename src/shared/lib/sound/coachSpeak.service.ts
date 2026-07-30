import logger from '@/shared/lib/logger'
import { ref, type Ref } from 'vue'

export type CoachSpeechCategory =
  | 'entry'
  | 'during_game'
  | 'blunder'
  | 'praise'
  | 'chess_result'

export type BlunderSeverity = 'critical' | 'tactical' | 'insist' | 'takeback'

export interface CoachAudioContext {
  category: CoachSpeechCategory
  severity?: BlunderSeverity
  motifs?: string[]
  themes?: string[]
  specificKey?: string
  reason?: string
}

export interface CoachVolumeProvider {
  getVoiceVolume(): number
  setVoiceVolume(vol: number): void
}

let volumeProvider: CoachVolumeProvider | null = null

export function registerCoachVolumeProvider(provider: CoachVolumeProvider): void {
  volumeProvider = provider
}

// Vite glob import for coach voice assets
const coachSoundModules = import.meta.glob('/public/sounds/coach/**/*.mp3')
const allCoachSoundPaths = Object.keys(coachSoundModules).map((path) => path.replace('/public', ''))

const createCoachPool = (pathPrefix: string): string[] => {
  if (allCoachSoundPaths.includes(pathPrefix)) return [pathPrefix]
  const pool = allCoachSoundPaths.filter((path) => path.startsWith(pathPrefix))
  if (pool.length === 0) {
    logger.warn(`[CoachSpeakService] No voice files found for prefix: ${pathPrefix}`)
  }
  return pool
}

// Category Pools Mapping
const coachPools: Record<string, string[]> = {
  'entry': createCoachPool('/sounds/coach/entry/'),
  'during_game': createCoachPool('/sounds/coach/during_game/'),
  'during_game:coach_says_check': ['/sounds/coach/during_game/coach_says_check.mp3'],
  'during_game:your_move': ['/sounds/coach/during_game/your_move.mp3'],
  
  'blunder:critical': createCoachPool('/sounds/coach/blunders/critical/'),
  'blunder:tactical': createCoachPool('/sounds/coach/blunders/tactical/'),
  'blunder:insist': createCoachPool('/sounds/coach/blunders/insist/'),
  'blunder:takeback': createCoachPool('/sounds/coach/blunders/takeback/'),

  'praise': createCoachPool('/sounds/coach/praise/'),
  
  'chess_result:checkmate': ['/sounds/coach/chess_result/checkmate.mp3'],
  'chess_result:stalemate': createCoachPool('/sounds/coach/chess_result/stalemate'),
  'chess_result:draw_by_repetition': ['/sounds/coach/chess_result/draw_by_repetition.mp3'],
  'chess_result:fifty_moves_no_progress': ['/sounds/coach/chess_result/fifty_moves_no_progress.mp3'],
  'chess_result:insufficient_material': ['/sounds/coach/chess_result/insufficient_material.mp3'],
  'chess_result:draw': createCoachPool('/sounds/coach/chess_result/'),
}

export class CoachSpeakServiceController {
  public isSpeaking: Ref<boolean> = ref(false)
  public currentSpeechPath: Ref<string | null> = ref(null)

  private speechQueue: CoachAudioContext[] = []
  private isProcessingQueue = false
  private activeAudio: HTMLAudioElement | null = null
  private recentHistory: string[] = []
  private readonly maxHistorySize = 10
  private lastEntryTimestamp = 0
  private readonly entryCooldownMs = 4000

  public get volume(): number {
    if (volumeProvider) return volumeProvider.getVoiceVolume()
    return 1.0
  }

  public setVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol))
    if (volumeProvider) {
      volumeProvider.setVoiceVolume(clamped)
    }
    if (this.activeAudio) {
      this.activeAudio.volume = clamped
    }
  }

  /**
   * Main entry point to play coach speech contextually.
   * Critical blunders and results interrupt currently playing lower-priority lines.
   */
  public async speak(context: CoachAudioContext): Promise<void> {
    if (context.category === 'entry') {
      const now = Date.now()
      if (now - this.lastEntryTimestamp < this.entryCooldownMs) {
        logger.info(
          `[COACH_VOICE] Suppressed duplicate entry speech request [Reason: '${context.reason || 'unspecified'}']`
        )
        return
      }
      this.lastEntryTimestamp = now
    }

    const isHighPriority =
      context.category === 'blunder' && context.severity === 'critical'

    logger.info(
      `[COACH_VOICE] Speak requested [Reason: '${context.reason || 'unspecified'}'] -> Category: '${context.category}'${context.severity ? `, Severity: '${context.severity}'` : ''}${context.specificKey ? `, Key: '${context.specificKey}'` : ''}${isHighPriority ? ' (HIGH_PRIORITY_INTERRUPT)' : ''}`
    )

    if (isHighPriority) {
      this.stop()
      this.speechQueue.unshift(context)
    } else {
      this.speechQueue.push(context)
    }

    this._processQueue()
  }

  public clearQueue(): void {
    this.speechQueue = []
  }

  public stop(): void {
    this.speechQueue = []
    if (this.activeAudio) {
      this.activeAudio.pause()
      this.activeAudio.currentTime = 0
      this.activeAudio = null
    }
    this.isSpeaking.value = false
    this.currentSpeechPath.value = null
    this.isProcessingQueue = false
    logger.info('[CoachSpeakService] Voice playback stopped.')
  }

  private resolvePath(context: CoachAudioContext): string | null {
    let poolKey = context.category as string
    if (context.category === 'blunder' && context.severity) {
      poolKey = `blunder:${context.severity}`
    } else if (context.specificKey) {
      poolKey = `${context.category}:${context.specificKey}`
    }

    const candidatePool = coachPools[poolKey] || coachPools[context.category] || []
    if (candidatePool.length === 0) {
      logger.warn(`[CoachSpeakService] No voice candidates found for poolKey: ${poolKey}`)
      return null
    }

    // Anti-repetition filtering
    const nonRecentCandidates = candidatePool.filter(
      (path) => !this.recentHistory.includes(path)
    )

    const finalPool = nonRecentCandidates.length > 0 ? nonRecentCandidates : candidatePool
    const selected = finalPool[Math.floor(Math.random() * finalPool.length)]

    if (selected) {
      this.recentHistory.push(selected)
      if (this.recentHistory.length > this.maxHistorySize) {
        this.recentHistory.shift()
      }
    }

    return selected
  }

  private async _processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.speechQueue.length === 0) {
      return
    }

    this.isProcessingQueue = true
    const nextContext = this.speechQueue.shift()

    if (nextContext) {
      const path = this.resolvePath(nextContext)
      if (path) {
        await this._playVoiceFile(path, nextContext)
      }
    }

    this.isProcessingQueue = false
    if (this.speechQueue.length > 0) {
      this._processQueue()
    }
  }

  private _playVoiceFile(path: string, _context?: CoachAudioContext): Promise<void> {
    void _context
    // logger.info(
    //   `[COACH_VOICE] Playing voice track [Reason: '${context?.reason || 'unspecified'}'] -> File: '${path}' (Volume: ${(this.volume * 100).toFixed(0)}%)`
    // )

    if (typeof Audio === 'undefined') {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const audio = new Audio(path)
      audio.volume = this.volume
      audio.preload = 'auto'
      this.activeAudio = audio

      this.isSpeaking.value = true
      this.currentSpeechPath.value = path

      const cleanup = () => {
        if (this.activeAudio === audio) {
          this.activeAudio = null
        }
        audio.onended = null
        audio.onerror = null
        this.isSpeaking.value = false
        this.currentSpeechPath.value = null
        resolve()
      }

      audio.onended = cleanup
      audio.onerror = cleanup

      const playPromise = audio.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch((error: Error) => {
          if (
            error.message?.includes("user didn't interact") ||
            error.name === 'NotAllowedError'
          ) {
            logger.info(`[CoachSpeakService] Autoplay blocked for '${path}'. User interaction required.`)
          } else {
            logger.warn(`[CoachSpeakService] Error playing voice '${path}':`, error.message)
          }
          cleanup()
        })
      } else {
        // In environments where play() is stubbed or synchronous (e.g. jsdom / Vitest)
        cleanup()
      }
    })
  }
}

export const coachSpeakService = new CoachSpeakServiceController()
