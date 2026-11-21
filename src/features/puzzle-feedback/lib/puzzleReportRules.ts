import type { PuzzleObjective, PuzzlePuzzle } from '@/entities/game'
import type { WdlStats } from '@/shared/lib/engine'
import { Chess, normalizeMove } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'

export const REPORT_EARLY_EXIT_DEPTH = 15
export const REPORT_TACTICS_EARLY_EXIT_DEPTH = 16
export const REPORT_TARGET_DEPTH = 20
export const REPORT_WIN_MIN_WDL = 995
export const REPORT_DRAW_MIN_CP = 0
export const REPORT_DRAW_EARLY_EXIT_CP = 50
export const REPORT_STEP_TIMEOUT_MS = 25000
export const REPORT_TABLEBASE_TIMEOUT_MS = 10000

export interface ScoreMoverPov {
  type: 'cp' | 'mate'
  value: number
}

export interface EngineLineSnapshot {
  depth: number
  score: ScoreMoverPov
  wdl?: WdlStats
  bestMoveUci: string
}

export interface TacticsCheckStep {
  stepIndex: number
  totalSteps: number
  plyNumber: number
  fenBeforeMove: string
  expectedAlternatives: string[]
  isFinalMove: boolean
}

export function normalizeUciToken(uci: string): string {
  return uci.trim().toLowerCase()
}

function parseChessPosition(fen: string): Chess {
  const setupRes = parseFen(fen)
  if (setupRes.isErr) {
    throw new Error(`[puzzleReportRules] Invalid FEN "${fen}": ${setupRes.error.message}`)
  }
  const posRes = Chess.fromSetup(setupRes.unwrap())
  if (posRes.isErr) {
    throw new Error(`[puzzleReportRules] Illegal position "${fen}": ${posRes.error.message}`)
  }
  return posRes.unwrap()
}

function applyPrimaryUciMove(pos: Chess, rawToken: string): boolean {
  const primary = rawToken.split('|')[0]?.trim() ?? ''
  if (!primary) return false
  const parsed = parseUci(primary)
  if (!parsed) return false
  const normalized = normalizeMove(pos, parsed)
  if (!pos.isLegal(normalized)) return false
  pos.play(normalized)
  return true
}

/**
 * Builds a direct proof link on syzygy-tables.info for 3..7 piece positions.
 * Example: 4b3/8/p7/8/kPKN3P/8/8/8 w - - 0 1
 * -> https://syzygy-tables.info/?fen=4b3/8/p7/8/kPKN3P/8/8/8_w_-_-_0_1
 */
export function buildSyzygyProofUrl(fen: string): string {
  const normalized = fen.trim().replace(/\s+/g, '_')
  return `https://syzygy-tables.info/?fen=${normalized}`
}

/**
 * Resolves the exact starting position where the human player makes their first move (SolverFEN).
 * If first_move === 'bot' and tactical_solution exists, applies tactical_solution[0] first.
 */
export function resolvePuzzleSolverFen(puzzle: PuzzlePuzzle): string {
  const baseFen = (puzzle.initial_fen || puzzle.puzzle_fen || '').trim()
  if (!baseFen) {
    throw new Error(`[puzzleReportRules] Missing FEN for puzzle "${puzzle.puzzle_id}".`)
  }
  if (puzzle.first_move === 'bot' && puzzle.tactical_solution?.trim()) {
    const tokens = puzzle.tactical_solution.trim().split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      const pos = parseChessPosition(baseFen)
      if (applyPrimaryUciMove(pos, tokens[0]!)) {
        return makeFen(pos.toSetup())
      }
    }
  }
  return baseFen
}

/**
 * Extracts every human-player move step from TacticalSolution for sequential Stockfish verification.
 */
export function extractTacticsPlayerSteps(puzzle: PuzzlePuzzle): TacticsCheckStep[] {
  const baseFen = (puzzle.initial_fen || puzzle.puzzle_fen || '').trim()
  const rawSolution = (puzzle.tactical_solution || '').trim()
  if (!baseFen || !rawSolution) {
    return []
  }

  const tokens = rawSolution.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const pos = parseChessPosition(baseFen)
  let startIdx = 0
  if (puzzle.first_move === 'bot') {
    if (!applyPrimaryUciMove(pos, tokens[0]!)) {
      return []
    }
    startIdx = 1
  }

  const rawSteps: Array<{
    plyNumber: number
    fenBeforeMove: string
    expectedAlternatives: string[]
  }> = []

  for (let i = startIdx; i < tokens.length; i += 2) {
    const token = tokens[i]!
    const alternatives = token
      .split('|')
      .map(normalizeUciToken)
      .filter(Boolean)
    if (alternatives.length === 0) break

    rawSteps.push({
      plyNumber: i + 1,
      fenBeforeMove: makeFen(pos.toSetup()),
      expectedAlternatives: alternatives,
    })

    if (!applyPrimaryUciMove(pos, token)) {
      break
    }

    const botReplyToken = tokens[i + 1]
    if (botReplyToken) {
      if (!applyPrimaryUciMove(pos, botReplyToken)) {
        break
      }
    }
  }

  const totalSteps = rawSteps.length
  return rawSteps.map((step, idx) => ({
    stepIndex: idx + 1,
    totalSteps,
    plyNumber: step.plyNumber,
    fenBeforeMove: step.fenBeforeMove,
    expectedAlternatives: step.expectedAlternatives,
    isFinalMove: idx === totalSteps - 1,
  }))
}

/**
 * Formats a raw UCI mover-POV score into standard White-POV display notation (+2.40, -0.15, M4, -M3).
 */
export function formatWhitePovScore(moverScore: ScoreMoverPov, fen: string): string {
  const setupRes = parseFen(fen)
  const isBlackToMove = !setupRes.isErr && setupRes.unwrap().turn === 'black'
  const whiteValue = isBlackToMove ? -moverScore.value : moverScore.value

  if (moverScore.type === 'mate') {
    if (whiteValue > 0) return `M${whiteValue}`
    if (whiteValue < 0) return `-M${Math.abs(whiteValue)}`
    return 'M0'
  }

  const pawns = whiteValue / 100
  if (Math.abs(pawns) < 0.005) return '0.00'
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)
}

/**
 * Evaluates Lichess 7-man tablebase `category` (side-to-move POV) against puzzle objective.
 * Note: `cursed-win` requires >50 moves (draw under FIDE 50-move rule), so it fails `win`.
 */
export function evaluateLichessTablebaseVerdict(
  category: string,
  objective: PuzzleObjective,
): 'valid' | 'suspicious' {
  const norm = category.trim().toLowerCase()
  if (objective === 'win') {
    return norm === 'win' || norm === 'maybe-win' ? 'valid' : 'suspicious'
  }
  if (
    norm === 'win' ||
    norm === 'maybe-win' ||
    norm === 'cursed-win' ||
    norm === 'draw' ||
    norm === 'blessed-loss'
  ) {
    return 'valid'
  }
  return 'suspicious'
}

/**
 * Evaluates a local Stockfish line (raw UCI mover POV, where mover == user on SolverFEN).
 * - win: strict wdl.win >= 995 (or mate > 0); early exit allowed at depth >= 15.
 * - hold_draw: moverScore cp >= 0 (or mate > 0); early exit allowed at depth >= 15 if cp >= +50 or mate > 0.
 */
export function evaluateEndgameStockfishLine(
  line: Pick<EngineLineSnapshot, 'depth' | 'score' | 'wdl'>,
  objective: PuzzleObjective,
): { isEarlyValid: boolean; isFinalValid: boolean } {
  const { depth, score, wdl } = line

  if (objective === 'win') {
    const isForcedWin =
      (score.type === 'mate' && score.value > 0) ||
      (wdl !== undefined && wdl.win >= REPORT_WIN_MIN_WDL)
    return {
      isEarlyValid: depth >= REPORT_EARLY_EXIT_DEPTH && isForcedWin,
      isFinalValid: isForcedWin,
    }
  }

  const isNotLost =
    (score.type === 'mate' && score.value > 0) ||
    (score.type === 'cp' && score.value >= REPORT_DRAW_MIN_CP)
  const isComfortablySafe =
    (score.type === 'mate' && score.value > 0) ||
    (score.type === 'cp' && score.value >= REPORT_DRAW_EARLY_EXIT_CP)

  return {
    isEarlyValid: depth >= REPORT_EARLY_EXIT_DEPTH && isComfortablySafe,
    isFinalValid: isNotLost,
  }
}

/**
 * Checks whether Stockfish's best move matches any accepted UCI move in the tactics step
 * (or delivers immediate checkmate on the final move).
 */
export function doesMoveMatchTacticsStep(
  fen: string,
  bestMoveUci: string,
  expectedAlternatives: string[],
  isFinalMove: boolean,
): boolean {
  const normBest = normalizeUciToken(bestMoveUci)
  if (!normBest) return false
  if (expectedAlternatives.includes(normBest)) {
    return true
  }
  if (isFinalMove) {
    try {
      const pos = parseChessPosition(fen)
      const parsed = parseUci(normBest)
      if (parsed) {
        const normalized = normalizeMove(pos, parsed)
        if (pos.isLegal(normalized)) {
          pos.play(normalized)
          if (pos.isCheckmate()) return true
        }
      }
    } catch {
      return false
    }
  }
  return false
}
