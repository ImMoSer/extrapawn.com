import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import {
  AUTOMAT_ANIMATION_MS,
  computeAutomatStepDelayMs,
  fetchGaviotaAutomatLine,
  isEligibleForEndgameAutomat,
} from '../lib/endgameAutomatRules'
import { useBoardStore } from './board.store'
import { useGameStore } from './game.store'
import type { PuzzleObjective, PuzzlePuzzle } from './puzzle.types'

export type EndgameAutomatPolicyMode = 'unknown' | 'on' | 'off'

export interface EndgameAutomatPromptRequest {
  mateInMoves: number
  dtmPlies: number
  accept: () => void
  decline: () => void
}

export interface EndgameAutomatCallbacks {
  getMode: () => EndgameAutomatPolicyMode
  onPromptOpen?: (prompt: EndgameAutomatPromptRequest) => void
  onRolloutStart?: (mateInMoves: number) => void
  onRolloutStep?: (remainingMoves: number) => void
  onCleanup?: () => void
}

export interface EndgameAutomatHost {
  puzzle: PuzzlePuzzle
  humanColor: 'white' | 'black'
  objective: PuzzleObjective
  isPlayoutMode: () => boolean
  isActiveAndUnresolved: () => boolean
  recordAutomatMove: (uci: string) => void
  deliverAutomatSuccess: () => Promise<void>
}

export class EndgameAutomatController {
  private host: EndgameAutomatHost
  private hooks?: EndgameAutomatCallbacks

  private declinedInAttempt = false
  private triggeredInAttempt = false
  private promptOpen = false
  private runningRollout = false
  private runToken = 0
  private pendingTimer: ReturnType<typeof setTimeout> | null = null
  private pendingSleepResolve: (() => void) | null = null

  constructor(host: EndgameAutomatHost, hooks?: EndgameAutomatCallbacks) {
    this.host = host
    this.hooks = hooks
  }

  get isLocked(): boolean {
    return this.promptOpen || this.runningRollout
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
    return new Promise((resolve) => {
      this.pendingSleepResolve = resolve
      this.pendingTimer = setTimeout(() => {
        this.pendingTimer = null
        this.pendingSleepResolve = null
        resolve()
      }, Math.max(0, ms))
    })
  }

  destroy(): void {
    this.runToken++
    const wasActive = this.promptOpen || this.runningRollout
    const wasRollingOut = this.runningRollout
    this.promptOpen = false
    this.runningRollout = false
    this.clearSleepTimer()
    if (wasRollingOut) {
      useBoardStore().setAnimationDurationOverride(null)
    }
    if (wasActive) {
      this.hooks?.onCleanup?.()
    }
  }

  resetOnUndo(): void {
    this.destroy()
  }

  async evaluateAfterBotTurn(): Promise<void> {
    if (!this.hooks || this.declinedInAttempt || this.triggeredInAttempt || this.isLocked) {
      return
    }
    if (!this.host.isActiveAndUnresolved()) {
      return
    }

    const mode = this.hooks.getMode()
    if (mode === 'off') {
      return
    }

    const boardStore = useBoardStore()
    const gameStore = useGameStore()
    if (gameStore.gamePhase !== 'PLAYING') {
      return
    }

    const status = gameStore.getGameStatus()
    const currentFen = boardStore.fen

    const eligible = isEligibleForEndgameAutomat({
      puzzle: this.host.puzzle,
      currentFen,
      humanColor: this.host.humanColor,
      isPlayoutMode: this.host.isPlayoutMode(),
      objective: this.host.objective,
      isGameOver: status.isGameOver,
    })

    if (!eligible) {
      return
    }

    const tokenAtProbe = ++this.runToken
    const { startFen, moves } = pgnService.getAnalysisPayloadContext()
    const lineDto = await fetchGaviotaAutomatLine(currentFen, startFen, moves)

    if (
      !lineDto ||
      tokenAtProbe !== this.runToken ||
      !this.host.isActiveAndUnresolved() ||
      gameStore.gamePhase !== 'PLAYING' ||
      boardStore.fen !== currentFen
    ) {
      return
    }

    const latestMode = this.hooks.getMode()
    if (latestMode === 'off') {
      return
    }

    if (latestMode === 'on') {
      this.triggeredInAttempt = true
      await this.executeRollout(tokenAtProbe, lineDto.uci_line, lineDto.mate_in_moves)
      return
    }

    if (!this.hooks.onPromptOpen) {
      return
    }

    this.promptOpen = true
    this.hooks.onPromptOpen({
      mateInMoves: lineDto.mate_in_moves,
      dtmPlies: lineDto.dtm_plies,
      accept: () => {
        if (tokenAtProbe !== this.runToken || !this.promptOpen) return
        this.promptOpen = false
        this.triggeredInAttempt = true
        void this.executeRollout(tokenAtProbe, lineDto.uci_line, lineDto.mate_in_moves)
      },
      decline: () => {
        if (tokenAtProbe !== this.runToken || !this.promptOpen) return
        this.promptOpen = false
        this.declinedInAttempt = true
        this.hooks?.onCleanup?.()
      },
    })
  }

  private async executeRollout(
    token: number,
    uciLine: string[],
    mateInMoves: number,
  ): Promise<void> {
    const boardStore = useBoardStore()
    const gameStore = useGameStore()
    const totalSteps = uciLine.length

    this.runningRollout = true
    boardStore.setAnimationDurationOverride(AUTOMAT_ANIMATION_MS)
    this.hooks?.onRolloutStart?.(mateInMoves)

    try {
      for (let idx = 0; idx < totalSteps; idx++) {
        const uci = uciLine[idx]
        if (!uci) continue

        const stepDelayMs = computeAutomatStepDelayMs(idx, totalSteps)
        await this.sleep(stepDelayMs)

        if (
          token !== this.runToken ||
          !this.runningRollout ||
          !this.host.isActiveAndUnresolved() ||
          gameStore.gamePhase !== 'PLAYING'
        ) {
          return
        }

        const remainingMoves = Math.max(1, Math.ceil((totalSteps - idx) / 2))
        this.hooks?.onRolloutStep?.(remainingMoves)

        const fenBefore = boardStore.fen
        const posBefore = boardStore.chessPosition.clone()
        const parsedMove = parseUci(uci)
        if (!parsedMove || !posBefore.isLegal(parsedMove)) {
          throw new Error(
            `[EndgameAutomat] Illegal Gaviota move "${uci}" on FEN "${fenBefore}". Fail-Fast!`,
          )
        }

        const san = makeSan(posBefore, parsedMove)
        const applied = boardStore.applyUciMove(uci)
        if (!applied) {
          throw new Error(`[EndgameAutomat] Failed to apply move "${uci}". Fail-Fast!`)
        }

        const fenAfter = boardStore.fen
        pgnService.addNode({ san, uci, fenBefore, fenAfter })
        gameStore.syncPgnVisualCuesToBoard()
        this.host.recordAutomatMove(uci)
      }

      // Let the final mating piece complete its 200ms slide before transitioning to GAMEOVER
      await this.sleep(AUTOMAT_ANIMATION_MS)

      if (token !== this.runToken || !this.runningRollout || !this.host.isActiveAndUnresolved()) {
        return
      }

      if (!boardStore.chessPosition.isCheckmate()) {
        throw new Error(
          `[EndgameAutomat] Rollout finished without checkmate on FEN "${boardStore.fen}". Fail-Fast!`,
        )
      }

      logger.info('[EndgameAutomat] Gaviota DTM checkmate delivered.')
      this.runningRollout = false
      boardStore.setAnimationDurationOverride(null)
      this.hooks?.onCleanup?.()
      await this.host.deliverAutomatSuccess()
    } finally {
      if (token === this.runToken) {
        boardStore.setAnimationDurationOverride(null)
        if (this.runningRollout) {
          this.runningRollout = false
          this.hooks?.onCleanup?.()
        }
      }
    }
  }
}
