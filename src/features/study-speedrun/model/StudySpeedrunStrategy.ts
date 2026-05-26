import {
  enginePlayService,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { useSpeedrunStore } from './study-speedrun.store'
import logger from '@/shared/lib/logger'

export class StudySpeedrunStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 150,
    playGameStatusSounds: false,
  }

  private speedrunStore = useSpeedrunStore()
  private gameStore = useGameStore()
  private userColor: 'white' | 'black'

  constructor(userColor: 'white' | 'black') {
    this.userColor = userColor
  }

  onGameStart(): void {
    // Prevent timer drift by starting timer only after game is fully loaded and started
    this.speedrunStore.startTimer()
  }

  onDestroy(): void {
    this.speedrunStore.stopTimer()
  }

  async validateUserMove(): Promise<boolean> {
    // In Speedrun Play-Out mode, every legal move is valid.
    // The goal is to play against the engine until the target result is reached.
    return true
  }

  async onUserMoveExecuted(): Promise<void> {
    const lastMove = pgnService.getLastMove()
    if (lastMove) {
      this.speedrunStore.currentAttemptMoves.push(lastMove)
    }
  }

  async requestBotMove(fen: string): Promise<string | null> {
    try {
      return await enginePlayService.getBestMove(this.gameStore.botEngineId, fen)
    } catch (error) {
      logger.error('[StudySpeedrunStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    const lastMove = pgnService.getLastMove()
    if (lastMove) {
      this.speedrunStore.currentAttemptMoves.push(lastMove)
    }
  }

  checkWinCondition(status: GameStatusInfo): boolean {
    const outcome = status.outcome
    if (!outcome) return false

    // Target result is guaranteed by StudySidebar.isSpeedrunReady or parent filtering
    const targetResult = this.speedrunStore.currentChapter?.tags.Result

    if (targetResult === '1-0') {
      return outcome.winner === 'white'
    } else if (targetResult === '0-1') {
      return outcome.winner === 'black'
    } else if (targetResult === '1/2-1/2') {
      return outcome.winner === undefined
    }

    return false
  }

  onGameOver(status: GameStatusInfo): void {
    if (this.checkWinCondition(status)) {
      this.speedrunStore.handleChapterSuccess(this.speedrunStore.currentTimeMs)
    } else {
      this.speedrunStore.handleChapterFailure()
    }
  }
}
