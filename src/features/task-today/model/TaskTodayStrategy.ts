import {
  enginePlayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import logger from '@/shared/lib/logger'
import { useTaskTodayStore, type WorkoutPuzzle } from './taskToday.store'
import { usePreferencesStore } from '@/features/settings'

export class TaskTodayStrategy implements IGameplayStrategy {
  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      initialBotDelayMs: preferencesStore.preferences.delays.initialBotDelayMs,
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
    }
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
    return useTaskTodayStore()
  }

  private get gameStore() {
    return useGameStore()
  }

  private get boardStore() {
    return useBoardStore()
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

  getScenarioValidation(uciMove: string): { isScenario: boolean; isCorrect: boolean; expectedMove?: string } | null {
    if (this.isPlayoutMode) return null
    if (this.puzzle.strategy !== 'scenarioOnly' && this.puzzle.strategy !== 'scenarioPlus') return null
    if (this.scenarioIndex >= this.scenarioMoves.length) return null

    const expectedMove = this.scenarioMoves[this.scenarioIndex]
    const isCheckmate = this.boardStore.chessPosition.isCheckmate()
    const isCorrect = uciMove === expectedMove || isCheckmate

    return {
      isScenario: true,
      isCorrect,
      expectedMove,
    }
  }

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    if (!this.isPlayoutMode) {
      const expectedMove = this.scenarioMoves[this.scenarioIndex]
      const isCheckmate = this.boardStore.chessPosition.isCheckmate()

      if (uciMove === expectedMove || isCheckmate) {
        if (uciMove === expectedMove) {
          this.scenarioIndex++
        } else {
          this.scenarioIndex = this.scenarioMoves.length
        }

        if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
          // Success!
          await this.store.handlePuzzleSuccess(this.store.currentTimeMs)
        }
      } else {
        if (this.puzzle.strategy === 'scenarioOnly') {
          await this.store.handlePuzzleFailure()
          return
        }

        if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          this.scenarioIndex = this.scenarioMoves.length
          soundService.playSound('game_play_out_start')
          window.$message.success('Tacktics completed! Playout starts.')
        }
      }
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
      await this.store.handlePuzzleSuccess(this.store.currentTimeMs)
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
      logger.error('[TaskTodayStrategy] Engine failed to generate move.', error)
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
