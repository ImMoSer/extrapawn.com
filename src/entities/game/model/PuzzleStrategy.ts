import { enginePlayService } from '../lib/EnginePlayService'
import { useBoardStore } from './board.store'
import { isFideDrawReason, useGameStore } from './game.store'
import type { GameplayStrategyConfig, GameStatusInfo, IGameplayStrategy } from './strategy.types'
import { areMovesEqual } from '@/shared/lib/chess-utils'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound'
import type { EngineId } from '@/shared/types/api.types'
import i18n from '@/shared/config/i18n'
import { parseFen } from 'chessops/fen'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

const t = i18n.global.t

export type PuzzleStrategyType = 'playOutOnly' | 'scenarioOnly' | 'scenarioPlus'
export type PuzzleObjective = 'win' | 'hold_draw'
export type PuzzleFailStage = 'none' | 'scenario' | 'playout'

export interface PuzzleAttemptTelemetry {
  firstMoveFailed: boolean
  failStage: PuzzleFailStage
  outcomeReason: string
}

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
  user_color?: 'white' | 'black'
  objective?: PuzzleObjective
  domain?: string
  batch_id?: number
  batch_title?: string
  week?: number
  is_exam?: boolean
  is_woodpecker?: boolean
  woodpecker_streak?: number
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
    throw new Error(
      `[PuzzleStrategy] Invalid initial_fen in puzzle ${puzzle.puzzle_id}: "${puzzle.initial_fen}". Fail-Fast!`,
    )
  }
  if (puzzle.first_move !== 'bot' && puzzle.first_move !== 'user') {
    throw new Error(
      `[PuzzleStrategy] Invalid first_move in puzzle ${puzzle.puzzle_id}: "${String(puzzle.first_move)}". Fail-Fast!`,
    )
  }
  const setup = parsed.unwrap()
  const fenTurn: ChessgroundColor = setup.turn === 'white' ? 'white' : 'black'
  const derivedColor: ChessgroundColor =
    puzzle.first_move === 'bot' ? (fenTurn === 'white' ? 'black' : 'white') : fenTurn

  if (puzzle.user_color !== undefined && puzzle.user_color !== derivedColor) {
    throw new Error(
      `[PuzzleStrategy] user_color mismatch in puzzle ${puzzle.puzzle_id}: expected "${derivedColor}" from initial_fen/first_move, got "${puzzle.user_color}". Fail-Fast!`,
    )
  }

  return derivedColor
}

export interface PuzzleStrategyCallbacks {
  onSuccess?: (reason?: string, telemetry?: PuzzleAttemptTelemetry) => void | Promise<void>
  onFailure?: (telemetry?: PuzzleAttemptTelemetry) => void | Promise<void>
  onGameOver?: (status: GameStatusInfo) => void
  onFeedback?: (message: string) => void
  onUndo?: () => void
  planId?: string
  botEngineOverride?: EngineId
  delays?: Partial<GameplayStrategyConfig>
}

export class PuzzleStrategy implements IGameplayStrategy {
  private puzzle: PuzzlePuzzle
  private humanColor: 'white' | 'black'
  private objective: PuzzleObjective
  private submode: string
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean
  private callbacks?: PuzzleStrategyCallbacks

  private userMovesPlayed = 0
  private deviatedInScenario = false
  private deviatedOnFirstMove = false

  private prevScenarioIndex = 0
  private prevPlayoutMode = false
  private prevUserMovesPlayed = 0
  private prevDeviatedInScenario = false
  private prevDeviatedOnFirstMove = false

  private nextPuzzleTimeout: number | null = null
  private isDestroyed = false
  private isResolved = false

  constructor(
    puzzle: PuzzlePuzzle,
    humanColor: 'white' | 'black',
    submode: string,
    callbacks?: PuzzleStrategyCallbacks,
  ) {
    if (
      puzzle.objective !== undefined &&
      puzzle.objective !== 'win' &&
      puzzle.objective !== 'hold_draw'
    ) {
      throw new Error(
        `[PuzzleStrategy] Invalid objective "${String(puzzle.objective)}" in puzzle ${puzzle.puzzle_id}. Fail-Fast!`,
      )
    }

    const parsedScenarioMoves = puzzle.tactical_solution
      ? puzzle.tactical_solution.trim().split(/\s+/).filter(Boolean)
      : []

    if (
      (puzzle.strategy === 'scenarioOnly' || puzzle.strategy === 'scenarioPlus') &&
      parsedScenarioMoves.length === 0
    ) {
      throw new Error(
        `[PuzzleStrategy] Missing tactical_solution for strategy "${puzzle.strategy}" in puzzle ${puzzle.puzzle_id}. Fail-Fast!`,
      )
    }

    this.puzzle = puzzle
    this.humanColor = humanColor
    this.objective = puzzle.objective ?? 'win'
    this.submode = submode
    this.callbacks = callbacks
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = parsedScenarioMoves

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

  get puzzleObjective(): PuzzleObjective {
    return this.objective
  }

  get config(): GameplayStrategyConfig {
    return {
      initialBotDelayMs: this.callbacks?.delays?.initialBotDelayMs ?? 500,
      botDelayMs: this.callbacks?.delays?.botDelayMs ?? 250,
      playGameStatusSounds: false,
      nextPuzzleDelayMs: this.callbacks?.delays?.nextPuzzleDelayMs ?? 100,
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
    if (this.nextPuzzleTimeout !== null) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
  }

  checkWinCondition(status: GameStatusInfo): boolean {
    const outcome = status.outcome
    if (!outcome && this.puzzle.strategy !== 'scenarioOnly') return false
    if (outcome?.reason === 'resign') return false
    if (outcome?.winner && outcome.winner !== this.humanColor) return false

    if (outcome?.reason === 'checkmate' && outcome.winner === this.humanColor) {
      return true
    }

    if (this.puzzle.strategy === 'scenarioOnly') {
      return this.scenarioIndex >= this.scenarioMoves.length
    }

    if (
      this.objective === 'hold_draw' &&
      outcome &&
      !outcome.winner &&
      isFideDrawReason(outcome.reason)
    ) {
      return true
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
    const isCorrect =
      (expectedMove !== undefined && areMovesEqual(uciMove, expectedMove)) || isCheckmate

    return {
      isScenario: true,
      isCorrect,
      expectedMove,
    }
  }

  private buildFailureTelemetry(outcomeReason: string): PuzzleAttemptTelemetry {
    if (this.puzzle.strategy === 'scenarioOnly') {
      return {
        firstMoveFailed: this.userMovesPlayed <= 1,
        failStage: 'scenario',
        outcomeReason,
      }
    }

    if (this.puzzle.strategy === 'scenarioPlus') {
      if (this.deviatedInScenario) {
        return {
          firstMoveFailed: this.deviatedOnFirstMove,
          failStage: 'scenario',
          outcomeReason,
        }
      }
      if (!this.isPlayoutMode) {
        return {
          firstMoveFailed: this.userMovesPlayed <= 1,
          failStage: 'scenario',
          outcomeReason,
        }
      }
      return {
        firstMoveFailed: false,
        failStage: 'playout',
        outcomeReason,
      }
    }

    return {
      firstMoveFailed: this.userMovesPlayed <= 1,
      failStage: 'playout',
      outcomeReason,
    }
  }

  private async triggerSuccess(reason: string = 'scenario_complete'): Promise<void> {
    if (this.isDestroyed || this.isResolved) return
    this.isResolved = true

    this.gameStore.setGamePhase('GAMEOVER')

    const telemetry: PuzzleAttemptTelemetry = {
      firstMoveFailed: false,
      failStage: 'none',
      outcomeReason: reason,
    }

    if (this.callbacks?.onSuccess) {
      await this.callbacks.onSuccess(reason, telemetry)
      return
    }

    soundService.play('tactics_success', 'PuzzleStrategy.scenarioSuccess')
  }

  private async triggerFailure(telemetry: PuzzleAttemptTelemetry): Promise<void> {
    if (this.isDestroyed || this.isResolved) return
    this.isResolved = true

    this.gameStore.setGamePhase('GAMEOVER')

    if (this.callbacks?.onFailure) {
      await this.callbacks.onFailure(telemetry)
      return
    }

    soundService.play('tactics_error')
  }

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
    this.prevUserMovesPlayed = this.userMovesPlayed
    this.prevDeviatedInScenario = this.deviatedInScenario
    this.prevDeviatedOnFirstMove = this.deviatedOnFirstMove

    this.userMovesPlayed++

    const isCheckmate = this.boardStore.chessPosition.isCheckmate()

    if (this.isPlayoutMode) {
      if (isCheckmate) {
        logger.info('[PuzzleStrategy] Checkmate delivered in playout mode. Game won!')
        await this.triggerSuccess('checkmate')
      }
      return
    }

    const expectedMove = this.scenarioMoves[this.scenarioIndex]
    const matchesScenario = expectedMove !== undefined && areMovesEqual(uciMove, expectedMove)

    if (matchesScenario || isCheckmate) {
      if (matchesScenario) {
        this.scenarioIndex++
      } else {
        this.scenarioIndex = this.scenarioMoves.length
      }

      if (isCheckmate || this.scenarioIndex >= this.scenarioMoves.length) {
        logger.info('[PuzzleStrategy] Scenario completed successfully.')

        const isTacticsCourse =
          this.submode === 'tactics_course' || this.puzzle.puzzle_type === 'tactics_course'

        if (isCheckmate || this.puzzle.strategy === 'scenarioOnly' || isTacticsCourse) {
          await this.triggerSuccess(isCheckmate ? 'checkmate' : 'scenario_complete')
        } else if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          this.callbacks?.onFeedback?.(t('features.trainingCenter.play.playoutStart'))
        }
      }
    } else {
      if (this.puzzle.strategy === 'scenarioPlus') {
        this.deviatedInScenario = true
        if (this.userMovesPlayed === 1) {
          this.deviatedOnFirstMove = true
        }
        this.isPlayoutMode = true
        this.scenarioIndex = this.scenarioMoves.length
        this.callbacks?.onFeedback?.(t('features.trainingCenter.play.playoutDeviation'))
      } else {
        logger.info(
          `[PuzzleStrategy] Scenario deviation on expected move: ${expectedMove}. Triggering failure.`,
        )
        await this.triggerFailure({
          firstMoveFailed: this.userMovesPlayed === 1,
          failStage: 'scenario',
          outcomeReason: 'wrong_move',
        })
      }
    }
  }

  onUserMoveUndone() {
    this.scenarioIndex = this.prevScenarioIndex
    this.isPlayoutMode = this.prevPlayoutMode
    this.userMovesPlayed = this.prevUserMovesPlayed
    this.deviatedInScenario = this.prevDeviatedInScenario
    this.deviatedOnFirstMove = this.prevDeviatedOnFirstMove
    this.isResolved = false
    this.callbacks?.onUndo?.()
    if (this.nextPuzzleTimeout !== null) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    if (!this.isPlayoutMode && this.scenarioIndex >= this.scenarioMoves.length) {
      const isTacticsCourse =
        this.submode === 'tactics_course' || this.puzzle.puzzle_type === 'tactics_course'
      if (
        this.puzzle.strategy === 'scenarioOnly' ||
        this.submode === 'tactics' ||
        isTacticsCourse
      ) {
        await this.triggerSuccess('scenario_complete')
      } else if (this.puzzle.strategy === 'scenarioPlus') {
        this.isPlayoutMode = true
        this.callbacks?.onFeedback?.(t('features.trainingCenter.play.playoutStart'))
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

    const targetEngineId = this.callbacks?.botEngineOverride ?? this.gameStore.botEngineId

    try {
      return await enginePlayService.getBestMove(targetEngineId, fen)
    } catch (error) {
      logger.error(`[PuzzleStrategy] Engine "${targetEngineId}" failed to generate move.`, error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    if (this.isDestroyed || this.isResolved) return

    if (this.callbacks?.onGameOver) {
      this.callbacks.onGameOver(status)
      return
    }

    const isWin = this.checkWinCondition(status)
    const outcomeReason = status.outcome?.reason || 'game_over'
    if (isWin) {
      void this.triggerSuccess(outcomeReason)
    } else {
      void this.triggerFailure(this.buildFailureTelemetry(outcomeReason))
    }
  }
}
