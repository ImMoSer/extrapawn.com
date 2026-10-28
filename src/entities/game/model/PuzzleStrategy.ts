import { enginePlayService } from '../lib/EnginePlayService'
import { useBoardStore } from './board.store'
import { useGameStore } from './game.store'
import type { GameplayStrategyConfig, GameStatusInfo, IGameplayStrategy } from './strategy.types'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound'
import i18n from '@/shared/config/i18n'
import { parseFen } from 'chessops/fen'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

const t = i18n.global.t

export type PuzzleStrategyType = 'playOutOnly' | 'scenarioOnly' | 'scenarioPlus'

export interface PuzzlePuzzle {
  puzzle_id: string
  puzzle_type: string
  category: string
  category_comby?: string[]
  motifs_pg?: string[]
  sub_category?: string
  difficulty: string
  rating?: number | string
  strategy: PuzzleStrategyType
  first_move: 'bot' | 'user'
  initial_fen: string
  tactical_solution?: string
  puzzle_fen?: string
  is_golden?: boolean
  userSelectedColor?: boolean
}

export type WorkoutPuzzle = PuzzlePuzzle

export function determineHumanColor(puzzle: PuzzlePuzzle): ChessgroundColor {
  const parsed = parseFen(puzzle.initial_fen)
  if (parsed.isErr) {
    throw new Error(`[PuzzleStrategy] Invalid initial_fen in puzzle ${puzzle.puzzle_id}: "${puzzle.initial_fen}". Fail-Fast!`)
  }
  const setup = parsed.unwrap()
  const fenTurn = setup.turn === 'white' ? 'white' : 'black'
  if (puzzle.first_move === 'bot') {
    return fenTurn === 'white' ? 'black' : 'white'
  }
  return fenTurn
}

export interface PuzzleStrategyCallbacks {
  onSuccess?: (reason?: string) => void | Promise<void>
  onFailure?: () => void | Promise<void>
  onGameOver?: (status: GameStatusInfo) => void
  onFeedback?: (message: string) => void
  onUndo?: () => void
  planId?: string
  delays?: Partial<GameplayStrategyConfig>
}

export class PuzzleStrategy implements IGameplayStrategy {
  private puzzle: PuzzlePuzzle
  private humanColor: 'white' | 'black'
  private submode: string
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean
  private callbacks?: PuzzleStrategyCallbacks

  private prevScenarioIndex = 0
  private prevPlayoutMode = false
  private nextPuzzleTimeout: number | null = null
  private isDestroyed = false

  constructor(
    puzzle: PuzzlePuzzle,
    humanColor: 'white' | 'black',
    submode: string,
    callbacks?: PuzzleStrategyCallbacks,
  ) {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.submode = submode
    this.callbacks = callbacks
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []

    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
  }

  get sessionId(): string {
    const prefix = this.callbacks?.planId
      ? `task_today_${this.callbacks.planId}`
      : (this.puzzle.puzzle_type || 'puzzle')
    return `${prefix}_${this.puzzle.puzzle_id}`
  }

  get isPlayout(): boolean {
    return this.isPlayoutMode
  }

  get config(): GameplayStrategyConfig {
    return {
      initialBotDelayMs: this.callbacks?.delays?.initialBotDelayMs ?? 500,
      botDelayMs: this.callbacks?.delays?.botDelayMs ?? 250,
      playGameStatusSounds: false,
      nextPuzzleDelayMs: this.callbacks?.delays?.nextPuzzleDelayMs ?? 2000,
      restartDelayMs: this.callbacks?.delays?.restartDelayMs ?? 500,
    }
  }

  private get gameStore() {
    return useGameStore()
  }

  private get boardStore() {
    return useBoardStore()
  }

  onGameStart() {}

  onDestroy() {
    this.isDestroyed = true
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

  getScenarioValidation(
    uciMove: string,
  ): { isScenario: boolean; isCorrect: boolean; expectedMove?: string } | null {
    if (this.isPlayoutMode) return null
    if (this.puzzle.strategy !== 'scenarioOnly' && this.puzzle.strategy !== 'scenarioPlus')
      return null
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

  private async triggerSuccess(reason: string = 'scenario_complete'): Promise<void> {
    if (this.isDestroyed) return

    this.gameStore.setGamePhase('GAMEOVER')

    if (this.callbacks?.onSuccess) {
      await this.callbacks.onSuccess(reason)
      return
    }

    soundService.play('tactics_success', 'PuzzleStrategy.scenarioSuccess')
  }

  private async triggerFailure(): Promise<void> {
    if (this.isDestroyed) return

    this.gameStore.setGamePhase('GAMEOVER')

    if (this.callbacks?.onFailure) {
      await this.callbacks.onFailure()
      return
    }

    soundService.play('tactics_error')
  }

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode

    const isCheckmate = this.boardStore.chessPosition.isCheckmate()

    if (this.isPlayoutMode) {
      if (isCheckmate) {
        logger.info('[PuzzleStrategy] Checkmate delivered in playout mode. Game won!')
        await this.triggerSuccess('checkmate')
      }
      return
    }

    const expectedMove = this.scenarioMoves[this.scenarioIndex]

    if (uciMove === expectedMove || isCheckmate) {
      if (uciMove === expectedMove) {
        this.scenarioIndex++
      } else {
        this.scenarioIndex = this.scenarioMoves.length
      }

      if (isCheckmate || this.scenarioIndex >= this.scenarioMoves.length) {
        logger.info('[PuzzleStrategy] Scenario completed successfully.')

        if (isCheckmate || this.puzzle.strategy === 'scenarioOnly') {
          await this.triggerSuccess(isCheckmate ? 'checkmate' : 'scenario_complete')
        } else if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          this.callbacks?.onFeedback?.(t('features.puzzle.feedback.playoutStart'))
        }
      }
    } else {
      if (this.puzzle.strategy === 'scenarioPlus') {
        this.isPlayoutMode = true
        this.scenarioIndex = this.scenarioMoves.length
        this.callbacks?.onFeedback?.(t('features.puzzle.feedback.playoutDeviation'))
      } else {
        logger.info(
          `[PuzzleStrategy] Scenario deviation on expected move: ${expectedMove}. Triggering failure.`,
        )
        await this.triggerFailure()
      }
    }
  }

  onUserMoveUndone() {
    this.scenarioIndex = this.prevScenarioIndex
    this.isPlayoutMode = this.prevPlayoutMode
    this.callbacks?.onUndo?.()
    if (this.nextPuzzleTimeout) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    if (this.scenarioIndex >= this.scenarioMoves.length) {
      if (this.puzzle.strategy === 'scenarioOnly' || this.submode === 'tactics') {
        await this.triggerSuccess('scenario_complete')
      }
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
      logger.error('[PuzzleStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    if (this.isDestroyed) return

    if (this.callbacks?.onGameOver) {
      this.callbacks.onGameOver(status)
      return
    }

    const isWin = this.checkWinCondition(status)
    if (isWin) {
      void this.triggerSuccess(status.outcome?.reason || 'checkmate')
    } else {
      void this.triggerFailure()
    }
  }
}
