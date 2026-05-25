import {
  enginePlayService,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import logger from '@/shared/lib/logger'
import { usePuzzleSpeedrunStore, type WorkoutPuzzle } from './puzzleSpeedrun.store'

export class PuzzleSpeedrunStrategy implements IGameplayStrategy {
  config = {
    initialBotDelayMs: 300,
    botDelayMs: 50,
  }

  private puzzle: WorkoutPuzzle
  private humanColor: 'white' | 'black'
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean

  constructor(puzzle: WorkoutPuzzle, humanColor: 'white' | 'black') {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []
  }

  private get store() {
    return usePuzzleSpeedrunStore()
  }

  private get gameStore() {
    return useGameStore()
  }

  onGameStart(): void {
    this.store.startTimer()
  }

  onDestroy(): void {
    this.store.stopTimer()
  }

  checkWinCondition(status: GameStatusInfo): boolean {
    const outcome = status.outcome
    if (!outcome || outcome.reason === 'resign') return false

    if (outcome.reason === 'checkmate' && outcome.winner === this.humanColor) {
      return true
    }

    const isScenarioComplete = this.scenarioIndex >= this.scenarioMoves.length

    if (this.puzzle.strategy === 'scenarioOnly') {
      return isScenarioComplete
    }

    if (this.puzzle.strategy === 'playOutOnly' || this.puzzle.strategy === 'scenarioPlus') {
      return outcome.reason === 'checkmate' && outcome.winner === this.humanColor
    }

    return false
  }

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    if (!this.isPlayoutMode) {
      const expectedMove = this.scenarioMoves[this.scenarioIndex]
      if (uciMove === expectedMove) {
        this.scenarioIndex++

        if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
          // Success!
          this.store.handlePuzzleSuccess(this.store.currentTimeMs)
        }
      } else {
        if (this.puzzle.strategy === 'scenarioOnly') {
          this.store.handlePuzzleFailure()
          return
        }

        if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          this.scenarioIndex = this.scenarioMoves.length
          soundService.playSound('game_play_out_start')
          window.$message?.warning('Deviation! Continuing against the engine.')
        }
      }
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
      this.store.handlePuzzleSuccess(this.store.currentTimeMs)
    }
  }

  async requestBotMove(fen: string): Promise<string | null> {
    if (!this.isPlayoutMode && this.scenarioIndex < this.scenarioMoves.length) {
      const move = this.scenarioMoves[this.scenarioIndex] || null
      this.scenarioIndex++
      return move
    }

    if (this.puzzle.strategy === 'scenarioOnly') return null

    try {
      return await enginePlayService.getBestMove(this.gameStore.botEngineId, fen)
    } catch (error) {
      logger.error('[PuzzleSpeedrunStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    const isSuccess = this.checkWinCondition(status)
    if (isSuccess) {
      this.store.handlePuzzleSuccess(this.store.currentTimeMs)
    } else {
      this.store.handlePuzzleFailure()
    }
  }
}
