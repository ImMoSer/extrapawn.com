import {
  enginePlayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound.service'
import { useEndgamesStore, type EndgamePuzzle } from './endgames.store'
import { usePreferencesStore } from '@/features/settings'

export class EndgamePuzzleStrategy implements IGameplayStrategy {
  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      /** Reaktionszeit des Bots am Start (wenn Bot beginnt) */
      initialBotDelayMs: preferencesStore.preferences.delays.initialBotDelayMs,
      /** Bedenkzeit des Bots während des Puzzles (Endspiele brauchen "Bedenkzeit") */
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      /** Pause nach erfolgreichem Lösen, bevor das nächste Puzzle kommt */
      nextPuzzleDelayMs: preferencesStore.preferences.delays.nextPuzzleDelayMs,
      /** Pause nach Fehlzug, bevor das Puzzle neu gestartet wird */
      restartDelayMs: preferencesStore.preferences.delays.restartDelayMs,
    }
  }


  private puzzle: EndgamePuzzle
  private humanColor: 'white' | 'black'
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean

  private prevScenarioIndex = 0
  private prevPlayoutMode = false
  private nextPuzzleTimeout: number | null = null

  constructor(puzzle: EndgamePuzzle, humanColor: 'white' | 'black') {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []

    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
  }

  private get store() {
    return useEndgamesStore()
  }

  private get gameStore() {
    return useGameStore()
  }

  private get boardStore() {
    return useBoardStore()
  }

  onGameStart() {
    // If it's user's turn at start, trigger coach
    if (this.boardStore.turn === this.humanColor) {
      useCoachStore().analyzeCurrentPosition()
    }
  }

  onDestroy() {
    if (this.nextPuzzleTimeout) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
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
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode

    if (!this.isPlayoutMode) {
      const expectedMove = this.scenarioMoves[this.scenarioIndex]
      if (uciMove === expectedMove) {
        this.scenarioIndex++

        if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
           soundService.playSound('game_tacktics_success')
           this.store.handleGameOver(this.puzzle, true, { winner: this.humanColor, reason: 'scenario_complete' }, this.humanColor)
           this.nextPuzzleTimeout = window.setTimeout(() => {
             this.store.loadNewPuzzle(this.puzzle.puzzle_type)
           }, this.config.nextPuzzleDelayMs)
        }
      } else {
        if (this.puzzle.strategy === 'scenarioOnly') {
           soundService.playSound('game_tacktics_error')
           this.store.handleGameOver(this.puzzle, false, { winner: undefined, reason: 'wrong_move' }, this.humanColor)
           this.nextPuzzleTimeout = window.setTimeout(() => {
             this.store.localRestart()
           }, this.config.restartDelayMs)
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
    // Bot just moved, it's now user's turn. Trigger coach.
    useCoachStore().analyzeCurrentPosition()

    if (this.puzzle.strategy === 'scenarioOnly' && this.scenarioIndex >= this.scenarioMoves.length) {
      soundService.playSound('game_tacktics_success')
      this.store.handleGameOver(this.puzzle, true, { winner: this.humanColor, reason: 'scenario_complete' }, this.humanColor)
      this.nextPuzzleTimeout = window.setTimeout(() => {
        this.store.loadNewPuzzle(this.puzzle.puzzle_type)
      }, this.config.nextPuzzleDelayMs)
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
      logger.error('[EndgamesStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    const isWin = this.checkWinCondition(status)
    if (status.outcome) {
      this.store.handleGameOver(this.puzzle, isWin, status.outcome, this.humanColor)
      if (isWin) {
        soundService.playSound('game_tacktics_success')
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.loadNewPuzzle(this.puzzle.puzzle_type)
        }, this.config.nextPuzzleDelayMs)
      } else {
        soundService.playSound('game_tacktics_error')
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.localRestart()
        }, this.config.restartDelayMs)
      }
    }
  }
}
