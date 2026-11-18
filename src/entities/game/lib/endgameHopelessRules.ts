import { parseFen } from 'chessops/fen'
import type { PuzzleObjective, PuzzleStrategyType } from '../model/puzzle.types'
import type { PlayerTablebaseDTO } from './EnginePlayService'

export type HopelessTablebaseVerdict = 'draw_when_win_required' | 'lost_position'

export interface HopelessCandidateCheckParams {
  currentFen: string
  humanColor: 'white' | 'black'
  isPlayoutMode: boolean
  strategy: PuzzleStrategyType
  isGameOver: boolean
  userMovesPlayed: number
}

/**
 * Checks whether the current board position after the bot's move is eligible
 * for a hopeless tablebase verdict (`3 <= totalPieces <= 5`, human turn, >= 1 user move played).
 */
export function isCandidateForHopelessProbe(params: HopelessCandidateCheckParams): boolean {
  const { currentFen, humanColor, isPlayoutMode, strategy, isGameOver, userMovesPlayed } = params

  if (!isPlayoutMode || strategy === 'scenarioOnly' || isGameOver || userMovesPlayed < 1) {
    return false
  }

  const parsed = parseFen(currentFen.trim())
  if (parsed.isErr) {
    throw new Error(`[endgameHopelessRules] Invalid FEN "${currentFen}". Fail-Fast!`)
  }
  const setup = parsed.unwrap()
  if (setup.turn !== humanColor) {
    return false
  }

  const totalPieces = setup.board.occupied.size()
  return totalPieces >= 3 && totalPieces <= 5
}

export interface EvaluateHopelessVerdictParams {
  objective: PuzzleObjective
  tablebase: PlayerTablebaseDTO | null
}

/**
 * Evaluates the authoritative post-move `playerTablebase` verdict returned by `POST /api/bestmove`
 * (`Syzygy WDL/DTZ + Gaviota DTM`, from side-to-move = humanColor POV) against the puzzle objective:
 * - `objective === 'win'`: `wdl === 0` (tablebase draw) or `wdl < 0` (tablebase loss) -> hopeless.
 * - `objective === 'hold_draw'`: `wdl < 0 && fideLost === true` -> hopeless
 *   (strictly respects FIDE 50-move rule rescues in blessed losses as well as pawn/capture zeroing wins).
 */
export function evaluateHopelessVerdict(
  params: EvaluateHopelessVerdictParams,
): HopelessTablebaseVerdict | null {
  const { objective, tablebase } = params
  if (!tablebase) {
    return null
  }

  if (objective === 'win') {
    if (tablebase.wdl === 0) {
      return 'draw_when_win_required'
    }
    if (tablebase.wdl < 0) {
      return 'lost_position'
    }
    return null
  }

  if (objective === 'hold_draw' && tablebase.wdl < 0 && tablebase.fideLost) {
    return 'lost_position'
  }

  return null
}
