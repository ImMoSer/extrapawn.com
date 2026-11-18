import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { z } from '@/shared/lib/zod'
import { parseFen } from 'chessops/fen'
import type { PuzzleObjective, PuzzleStrategyType } from '../model/puzzle.types'

export const GaviotaProbeSchema = z.object({
  wdl: z.number().int().nullable(),
  dtm: z.number().int().nullable(),
})

export type GaviotaProbeDTO = z.infer<typeof GaviotaProbeSchema>

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
 * Checks whether the current board position is a valid candidate to probe Gaviota WDL
 * for hopeless resistance in playout mode (`3 <= totalPieces <= 5`, human turn, >= 1 user move played).
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
  wdl: number | null
  dtm: number | null
  currentFen: string
}

/**
 * Evaluates Gaviota WDL/DTM (from side-to-move = humanColor POV) against the puzzle objective:
 * - `objective === 'win'`: `wdl === 0` (tablebase draw) or `wdl === -1` (tablebase loss) -> hopeless.
 * - `objective === 'hold_draw'`: `wdl === -1` with `halfmoves + |dtm| < 100` -> hopeless
 *   (respects FIDE 50-move rule rescues in cursed wins).
 */
export function evaluateHopelessVerdict(
  params: EvaluateHopelessVerdictParams,
): HopelessTablebaseVerdict | null {
  const { objective, wdl, dtm, currentFen } = params
  if (wdl === null) {
    return null
  }

  if (objective === 'win') {
    if (wdl === 0) {
      return 'draw_when_win_required'
    }
    if (wdl < 0) {
      return 'lost_position'
    }
    return null
  }

  if (objective === 'hold_draw' && wdl < 0) {
    if (dtm === null || dtm >= 0) {
      return null
    }
    const parsed = parseFen(currentFen.trim())
    if (parsed.isErr) {
      throw new Error(`[endgameHopelessRules] Invalid FEN "${currentFen}". Fail-Fast!`)
    }
    const halfmoves = parsed.unwrap().halfmoves
    if (halfmoves + Math.abs(dtm) < 100) {
      return 'lost_position'
    }
  }

  return null
}

/**
 * Probes TABLESERVICE (/api/gaviota/probe) for exact <= 5-piece WDL & DTM.
 * Strict Zero-Fallback: returns null if tablebase service is offline or returns 503.
 */
export async function fetchGaviotaProbe(fen: string): Promise<GaviotaProbeDTO | null> {
  try {
    return await apiClient<GaviotaProbeDTO>(
      '/gaviota/probe',
      {
        method: 'POST',
        body: JSON.stringify({ fen }),
      },
      GaviotaProbeSchema,
    )
  } catch (err) {
    logger.warn('[EndgameHopeless] Gaviota probe unavailable — continuing manual playout.', err)
    return null
  }
}
