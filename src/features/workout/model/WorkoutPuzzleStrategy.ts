import {
  enginePlayService,
  useGameStore,
  useBoardStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import logger from '@/shared/lib/logger'
import { FreeExplorationStrategy } from '@/features/study'
import { useWorkoutStore, type WorkoutPuzzle } from './workout.store'

export class WorkoutPuzzleStrategy implements IGameplayStrategy {
  config = {
    initialBotDelayMs: 300,
    botDelayMs: 50,
  }

  private puzzle: WorkoutPuzzle
  private humanColor: 'white' | 'black'
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean
  
  private prevScenarioIndex = 0
  private prevPlayoutMode = false

  constructor(puzzle: WorkoutPuzzle, humanColor: 'white' | 'black') {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []
    
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
  }

  private get store() {
    return useWorkoutStore()
  }

  private get gameStore() {
    return useGameStore()
  }
  
  private get boardStore() {
    return useBoardStore()
  }

  onGameStart() {}

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
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode

    if (!this.isPlayoutMode) {
      const expectedMove = this.scenarioMoves[this.scenarioIndex]
      if (uciMove === expectedMove) {
        this.scenarioIndex++

        if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
           this.store.handleGameOver(this.puzzle, true, { winner: this.humanColor, reason: 'scenario_complete' }, this.humanColor)
           setTimeout(() => {
             this.store.loadNewPuzzle(this.puzzle.puzzle_type, this.store.activeParams)
           }, 1000)
        }
      } else {
        if (this.puzzle.strategy === 'scenarioOnly') {
           this.store.handleGameOver(this.puzzle, false, { winner: undefined, reason: 'wrong_move' }, this.humanColor)
           this.gameStore.startWithStrategy(this.boardStore.fen, new FreeExplorationStrategy(), this.humanColor, true)
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

  onUserMoveUndone() {
    this.scenarioIndex = this.prevScenarioIndex
    this.isPlayoutMode = this.prevPlayoutMode
    this.store.setProcessingGameOver(false)
  }

  async onBotMoveExecuted(): Promise<void> {
    if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
      this.store.handleGameOver(this.puzzle, true, { winner: this.humanColor, reason: 'scenario_complete' }, this.humanColor)
      setTimeout(() => {
        this.store.loadNewPuzzle(this.puzzle.puzzle_type, this.store.activeParams)
      }, 1000)
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
      logger.error('[WorkoutStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    const isWin = this.checkWinCondition(status)
    if (status.outcome) {
      this.store.handleGameOver(this.puzzle, isWin, status.outcome, this.humanColor)
    }
  }
}
