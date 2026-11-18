import type { PlayerTablebaseDTO } from '../lib/EnginePlayService'
import {
  evaluateHopelessVerdict,
  isCandidateForHopelessProbe,
  type HopelessTablebaseVerdict,
} from '../lib/endgameHopelessRules'
import { useBoardStore } from './board.store'
import { GameAudioEngine } from './GameAudioEngine'
import { useGameStore } from './game.store'
import type { PuzzleObjective, PuzzleStrategyType } from './puzzle.types'

export interface EndgameHopelessPromptRequest {
  verdict: HopelessTablebaseVerdict
  source: 'gaviota' | 'syzygy'
  suffer: () => void
}

export interface EndgameHopelessCallbacks {
  isEnabled: () => boolean
  onPromptOpen?: (prompt: EndgameHopelessPromptRequest) => void
  onCleanup?: () => void
}

export interface EndgameHopelessHost {
  strategy: PuzzleStrategyType
  humanColor: 'white' | 'black'
  objective: PuzzleObjective
  isPlayoutMode: () => boolean
  getUserMovesPlayed: () => number
  isActiveAndUnresolved: () => boolean
}

export class EndgameHopelessController {
  private host: EndgameHopelessHost
  private hooks?: EndgameHopelessCallbacks

  private sufferChosenInAttempt = false
  private promptOpen = false
  private runToken = 0
  private pendingTimer: ReturnType<typeof setTimeout> | null = null
  private pendingSleepResolve: (() => void) | null = null

  constructor(host: EndgameHopelessHost, hooks?: EndgameHopelessCallbacks) {
    this.host = host
    this.hooks = hooks
  }

  get isLocked(): boolean {
    return this.promptOpen
  }

  private clearSleepTimer(): void {
    if (this.pendingTimer !== null) {
      clearTimeout(this.pendingTimer)
      this.pendingTimer = null
    }
    if (this.pendingSleepResolve) {
      const resolve = this.pendingSleepResolve
      this.pendingSleepResolve = null
      resolve()
    }
  }

  private sleep(ms: number): Promise<void> {
    this.clearSleepTimer()
    if (ms <= 0) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      this.pendingSleepResolve = resolve
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null
        this.pendingSleepResolve = null
        resolve()
      }, ms)
    })
  }

  destroy(): void {
    this.runToken++
    const wasOpen = this.promptOpen
    this.promptOpen = false
    this.clearSleepTimer()
    if (wasOpen) {
      this.hooks?.onCleanup?.()
    }
  }

  resetOnUndo(): void {
    this.destroy()
  }

  async evaluateAfterBotTurn(playerTablebase: PlayerTablebaseDTO | null): Promise<void> {
    if (
      !playerTablebase ||
      !this.hooks ||
      !this.hooks.onPromptOpen ||
      !this.hooks.isEnabled() ||
      this.sufferChosenInAttempt ||
      this.promptOpen ||
      !this.host.isActiveAndUnresolved()
    ) {
      return
    }

    const boardStore = useBoardStore()
    const gameStore = useGameStore()
    if (gameStore.gamePhase !== 'PLAYING') {
      return
    }

    const status = gameStore.getGameStatus()
    const currentFen = boardStore.fen

    const isCandidate = isCandidateForHopelessProbe({
      currentFen,
      humanColor: this.host.humanColor,
      isPlayoutMode: this.host.isPlayoutMode(),
      strategy: this.host.strategy,
      isGameOver: status.isGameOver,
      userMovesPlayed: this.host.getUserMovesPlayed(),
    })

    if (!isCandidate) {
      return
    }

    const verdict = evaluateHopelessVerdict({
      objective: this.host.objective,
      tablebase: playerTablebase,
    })

    if (!verdict) {
      return
    }

    const tokenAtEval = ++this.runToken

    // Let the bot's refutation move finish sliding onto its target square before locking
    const elapsedSinceBotMove = Date.now() - boardStore.lastMoveTimestamp
    const remainingAnimMs = Math.max(0, boardStore.animationDurationMs - elapsedSinceBotMove)
    if (remainingAnimMs > 0) {
      await this.sleep(remainingAnimMs)
    }

    if (
      tokenAtEval !== this.runToken ||
      !this.hooks.isEnabled() ||
      this.sufferChosenInAttempt ||
      !this.host.isActiveAndUnresolved() ||
      gameStore.gamePhase !== 'PLAYING' ||
      boardStore.fen !== currentFen
    ) {
      return
    }

    this.promptOpen = true
    GameAudioEngine.playHopelessVerdict()

    this.hooks.onPromptOpen({
      verdict,
      source: playerTablebase.source ?? 'gaviota',
      suffer: () => {
        if (tokenAtEval !== this.runToken || !this.promptOpen) return
        this.promptOpen = false
        this.sufferChosenInAttempt = true
        this.hooks?.onCleanup?.()
      },
    })
  }
}
