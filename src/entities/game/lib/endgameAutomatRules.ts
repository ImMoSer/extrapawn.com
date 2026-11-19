import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { z } from '@/shared/lib/zod'
import { parseFen } from 'chessops/fen'
import type { PuzzleObjective, PuzzlePuzzle } from '../model/puzzle.types'

export const GaviotaAutomatLineSchema = z.object({
  eligible: z.boolean(),
  mate_in_moves: z.number().int().nonnegative(),
  dtm_plies: z.number().int().nonnegative(),
  uci_line: z.array(z.string()),
  source: z.string(),
})

export type GaviotaAutomatLineDTO = z.infer<typeof GaviotaAutomatLineSchema>

export const AUTOMAT_DEFAULT_INITIAL_DELAY_MS = 500
export const AUTOMAT_FINAL_DELAY_MS = 100
export const AUTOMAT_MIN_ANIMATION_MS = 80
export const AUTOMAT_ANIMATION_GAP_MS = 50

/**
 * Computes the pre-move delay (ms) for half-move `stepIndex` in a Gaviota rollout of `totalSteps` plies.
 * Starts at `initialDelayMs` (default `500 ms`) and linearly accelerates on each consecutive ply down to `100 ms` on `#`.
 */
export function computeAutomatStepDelayMs(
  stepIndex: number,
  totalSteps: number,
  initialDelayMs: number = AUTOMAT_DEFAULT_INITIAL_DELAY_MS,
): number {
  if (
    !Number.isInteger(totalSteps) ||
    totalSteps <= 0 ||
    !Number.isInteger(stepIndex) ||
    stepIndex < 0 ||
    stepIndex >= totalSteps
  ) {
    throw new Error(
      `[endgameAutomatRules] Invalid step bounds stepIndex=${stepIndex}, totalSteps=${totalSteps}. Fail-Fast!`,
    )
  }
  if (!Number.isFinite(initialDelayMs) || initialDelayMs < AUTOMAT_FINAL_DELAY_MS) {
    throw new Error(
      `[endgameAutomatRules] Invalid initialDelayMs=${initialDelayMs} (must be >= ${AUTOMAT_FINAL_DELAY_MS}). Fail-Fast!`,
    )
  }
  if (totalSteps === 1) {
    return Math.round(initialDelayMs)
  }
  const progress = stepIndex / (totalSteps - 1)
  return Math.round(
    initialDelayMs - (initialDelayMs - AUTOMAT_FINAL_DELAY_MS) * progress,
  )
}

/**
 * Computes the piece slide animation duration (ms) for half-move `stepIndex`.
 * Synchronized with the interval *after* move `stepIndex` (`nextDelayMs - 50 ms`) and floored at `80 ms`
 * (strictly above Chessground's 70 ms animation disable threshold and strictly below the 100 ms minimum step delay).
 */
export function computeAutomatStepAnimationMs(
  stepIndex: number,
  totalSteps: number,
  initialDelayMs: number = AUTOMAT_DEFAULT_INITIAL_DELAY_MS,
): number {
  // Validate bounds and initialDelayMs via computeAutomatStepDelayMs (Fail-Fast)
  computeAutomatStepDelayMs(stepIndex, totalSteps, initialDelayMs)

  const followingDelayMs =
    stepIndex + 1 < totalSteps
      ? computeAutomatStepDelayMs(stepIndex + 1, totalSteps, initialDelayMs)
      : AUTOMAT_FINAL_DELAY_MS

  return Math.max(AUTOMAT_MIN_ANIMATION_MS, followingDelayMs - AUTOMAT_ANIMATION_GAP_MS)
}

/**
 * Universal material predicate for trivial checkmates via Gaviota DTM:
 * 1. Total pieces on board: 3 <= totalPieces <= 5 (100% Gaviota DTM coverage).
 * 2. Bot (defender) has strictly a lone King (no pawns or pieces).
 * 3. Player (attacker) has their King and at least one heavy piece (Queen or Rook).
 */
export function isAutomatMaterial(fen: string, humanColor: 'white' | 'black'): boolean {
  const parsed = parseFen(fen.trim())
  if (parsed.isErr) {
    throw new Error(`[endgameAutomatRules] Invalid FEN "${fen}". Fail-Fast!`)
  }
  const setup = parsed.unwrap()
  const board = setup.board

  const totalPieces = board.occupied.size()
  if (totalPieces < 3 || totalPieces > 5) {
    return false
  }

  const botColor: 'white' | 'black' = humanColor === 'white' ? 'black' : 'white'
  const botPieces = board[botColor]
  const botKings = botPieces.intersect(board.king)
  if (botPieces.size() !== 1 || botKings.size() !== 1) {
    return false
  }

  const userPieces = board[humanColor]
  const userKings = userPieces.intersect(board.king)
  if (userKings.size() !== 1) {
    return false
  }

  const userHeavyPieces = userPieces.intersect(board.queen.union(board.rook))
  return userHeavyPieces.size() >= 1
}

export function resolvePuzzleStartingEndgameFen(puzzle: PuzzlePuzzle): string {
  const candidate = puzzle.puzzle_fen?.trim() || puzzle.initial_fen.trim()
  if (!candidate) {
    throw new Error(
      `[endgameAutomatRules] Puzzle "${puzzle.puzzle_id}" has empty starting FEN. Fail-Fast!`,
    )
  }
  return candidate
}

export interface EndgameAutomatEligibilityParams {
  puzzle: PuzzlePuzzle
  currentFen: string
  humanColor: 'white' | 'black'
  isPlayoutMode: boolean
  objective: PuzzleObjective
  isGameOver: boolean
}

/**
 * Determines whether the current position in a puzzle attempt is eligible to probe Gaviota Automat:
 * - Must be in playout mode (not scenarioOnly, and scenarioPlus tactical phase already completed)
 * - Objective must be 'win', game not over, and side to move must be humanColor
 * - Current board must satisfy `isAutomatMaterial`
 * - Starting `EndingFEN` (and `initial_fen`) MUST NOT have already been `isAutomatMaterial`
 *   (universal pedagogical protection for elementary-mate exercises across all disciplines).
 */
export function isEligibleForEndgameAutomat(params: EndgameAutomatEligibilityParams): boolean {
  const { puzzle, currentFen, humanColor, isPlayoutMode, objective, isGameOver } = params

  if (!isPlayoutMode || puzzle.strategy === 'scenarioOnly') {
    return false
  }
  if (objective !== 'win' || isGameOver) {
    return false
  }

  const parsedCurrent = parseFen(currentFen.trim())
  if (parsedCurrent.isErr) {
    throw new Error(`[endgameAutomatRules] Invalid currentFen "${currentFen}". Fail-Fast!`)
  }
  const currentTurn: 'white' | 'black' = parsedCurrent.unwrap().turn
  if (currentTurn !== humanColor) {
    return false
  }

  if (!isAutomatMaterial(currentFen, humanColor)) {
    return false
  }

  const endingFen = resolvePuzzleStartingEndgameFen(puzzle)
  if (isAutomatMaterial(endingFen, humanColor)) {
    return false
  }
  if (puzzle.initial_fen.trim() !== endingFen && isAutomatMaterial(puzzle.initial_fen, humanColor)) {
    return false
  }

  return true
}

/**
 * Probes TABLESERVICE (/api/gaviota/automat-line) for a verified Gaviota DTM checkmate sequence.
 * Strict Zero-Fallback rule: if offline, 503, or position is not a forced tablebase win, returns null
 * so gameplay seamlessly continues manually without heuristics or local engines.
 */
export async function fetchGaviotaAutomatLine(
  fen: string,
  startFen?: string,
  moves?: string[],
): Promise<GaviotaAutomatLineDTO | null> {
  try {
    const res = await apiClient<GaviotaAutomatLineDTO>(
      '/gaviota/automat-line',
      {
        method: 'POST',
        body: JSON.stringify({
          fen,
          ...(startFen !== undefined ? { start_fen: startFen } : {}),
          ...(moves !== undefined ? { moves } : {}),
        }),
      },
      GaviotaAutomatLineSchema,
    )
    if (!res.eligible || res.uci_line.length === 0 || res.mate_in_moves <= 0) {
      return null
    }
    return res
  } catch (err) {
    logger.warn('[EndgameAutomat] Gaviota tablebase unavailable — continuing manual playout.', err)
    return null
  }
}
