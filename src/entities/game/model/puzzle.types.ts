import type { EngineId } from '@/shared/types/api.types'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { parseFen } from 'chessops/fen'
import type { EndgameAutomatCallbacks } from './EndgameAutomatController'
import type { GameplayStrategyConfig, GameStatusInfo } from './strategy.types'

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
  difficulty?: string
  rating?: number | string
  strategy: PuzzleStrategyType
  first_move: 'bot' | 'user'
  user_color?: 'white' | 'black'
  objective?: PuzzleObjective
  domain?: string
  course_slug?: string
  course_id?: number
  global_batch_id?: number
  batch_id?: number
  batch_title?: string
  week?: number
  is_exam?: boolean
  is_woodpecker?: boolean
  woodpecker_streak?: number
  twin_group_id?: string
  twin_role?: string
  initial_fen: string
  tactical_solution?: string
  puzzle_fen?: string
  is_golden?: boolean
  userSelectedColor?: boolean
}

export type WorkoutPuzzle = PuzzlePuzzle

export interface PuzzleStrategyCallbacks {
  onSuccess?: (reason?: string, telemetry?: PuzzleAttemptTelemetry) => void | Promise<void>
  onFailure?: (telemetry?: PuzzleAttemptTelemetry) => void | Promise<void>
  onGameOver?: (status: GameStatusInfo) => void
  onFeedback?: (message: string) => void
  onUndo?: () => void
  onUserMovePlayed?: (userMovesCount: number) => void
  planId?: string
  botEngineOverride?: EngineId
  delays?: Partial<GameplayStrategyConfig>
  automat?: EndgameAutomatCallbacks
}

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
