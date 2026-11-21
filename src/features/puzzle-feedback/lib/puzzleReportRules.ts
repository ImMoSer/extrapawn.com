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

export interface ScorePov {
  type: 'cp' | 'mate'
  value: number
}

export interface EngineLineSnapshot {
  depth: number
  score: ScorePov
  wdl?: WdlStats
  bestMoveUci: string
}

export interface UserPovEvaluation {
  isUserTurn: boolean
  userScore: ScorePov
  whiteScore: ScorePov
  whitePovEvalLabel: string
  userWdl?: WdlStats
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

export function getFenTurnColor(fen: string): 'white' | 'black' {
  const setupRes = parseFen(fen)
  if (setupRes.isErr) {
    throw new Error(`[puzzleReportRules] Invalid FEN "${fen}": ${setupRes.error.message}`)
  }
  return setupRes.unwrap().turn === 'black' ? 'black' : 'white'
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
 */
export function buildSyzygyProofUrl(fen: string): string {
  return `https://syzygy-tables.info/?fen=${fen.trim().replace(/\s+/g, '_')}`
}

/**
 * Resolves the root FEN to evaluate:
 * - For `playOutOnly` (practical_chess, endgame_course, and SAVING_DRAW in tactics_course):
 *   returns `initial_fen` (`EndingFEN`), preserving `first_move === 'bot'` so minimax evaluates
 *   whether `user_color` achieves `objective` even against the bot's strongest 1st move.
 * - For `scenarioOnly` / `scenarioPlus`: if `first_move === 'bot'`, applies `tactical_solution[0]`.
 */
export function resolvePuzzleSolverFen(puzzle: PuzzlePuzzle): string {
  const baseFen = (puzzle.initial_fen || puzzle.puzzle_fen || '').trim()
  if (!baseFen) {
    throw new Error(`[puzzleReportRules] Missing FEN for puzzle "${puzzle.puzzle_id}".`)
  }
  if (
    puzzle.strategy !== 'playOutOnly' &&
    puzzle.first_move === 'bot' &&
    puzzle.tactical_solution?.trim()
  ) {
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

export function formatScoreLabel(whiteScore: ScorePov): string {
  if (whiteScore.type === 'mate') {
    if (whiteScore.value > 0) return `M${whiteScore.value}`
    if (whiteScore.value < 0) return `-M${Math.abs(whiteScore.value)}`
    return 'M0'
  }
  const pawns = whiteScore.value / 100
  if (Math.abs(pawns) < 0.005) return '0.00'
  return pawns > 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)
}

/**
 * Formats a raw UCI mover-POV score into standard White-POV display notation (+2.40, -5.08, M4, -M3).
 */
export function formatWhitePovScore(moverScore: ScorePov, fen: string): string {
  const turn = getFenTurnColor(fen)
  const whiteScore: ScorePov = {
    type: moverScore.type,
    value: turn === 'white' ? moverScore.value : -moverScore.value,
  }
  return formatScoreLabel(whiteScore)
}

/**
 * Universal projection from raw UCI (side-to-move POV) into both `userColor` POV and White POV.
 * Handles all 4 combinations of (fenTurn: white|black) x (userColor: white|black).
 */
export function toUserPovEvaluation(
  rawScore: ScorePov,
  rawWdl: WdlStats | undefined,
  fen: string,
  userColor: 'white' | 'black',
): UserPovEvaluation {
  const fenTurn = getFenTurnColor(fen)
  const isUserTurn = fenTurn === userColor

  const userScore: ScorePov = {
    type: rawScore.type,
    value: isUserTurn ? rawScore.value : -rawScore.value,
  }
  const whiteScore: ScorePov = {
    type: rawScore.type,
    value: fenTurn === 'white' ? rawScore.value : -rawScore.value,
  }
  const userWdl: WdlStats | undefined = rawWdl
    ? isUserTurn
      ? { win: rawWdl.win, draw: rawWdl.draw, loss: rawWdl.loss }
      : { win: rawWdl.loss, draw: rawWdl.draw, loss: rawWdl.win }
    : undefined

  return {
    isUserTurn,
    userScore,
    whiteScore,
    whitePovEvalLabel: formatScoreLabel(whiteScore),
    userWdl,
  }
}

/**
 * Maps Lichess 7-man Syzygy `category` (side-to-move POV) into `userColor` POV
 * via exact FIDE 50-move tablebase duality when `fenTurn !== userColor` (`first_move === 'bot'`).
 */
export function toUserTablebaseCategory(
  rawCategory: string,
  fen: string,
  userColor: 'white' | 'black',
): string {
  const norm = rawCategory.trim().toLowerCase()
  const fenTurn = getFenTurnColor(fen)
  if (fenTurn === userColor) {
    return norm
  }
  switch (norm) {
    case 'win':
      return 'loss'
    case 'maybe-win':
      return 'maybe-loss'
    case 'cursed-win':
      return 'blessed-loss'
    case 'draw':
      return 'draw'
    case 'blessed-loss':
      return 'cursed-win'
    case 'maybe-loss':
      return 'maybe-win'
    case 'loss':
      return 'win'
    default:
      return norm
  }
}

/**
 * Evaluates a `userColor`-POV Syzygy tablebase category against puzzle objective.
 */
export function evaluateLichessTablebaseVerdict(
  userCategory: string,
  objective: PuzzleObjective,
): 'valid' | 'suspicious' {
  const norm = userCategory.trim().toLowerCase()
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
 * Evaluates a `userColor`-POV Stockfish line against puzzle objective:
 * - win: strict userWdl.win >= 995 (or userScore mate > 0)
 * - hold_draw: userScore cp >= 0 (or userScore mate > 0)
 */
export function evaluateEndgameStockfishLine(
  line: {
    depth: number
    earlyExitDepth?: number
    score: ScorePov
    wdl?: WdlStats
  },
  objective: PuzzleObjective,
): { isEarlyValid: boolean; isFinalValid: boolean } {
  const { depth, score, wdl } = line
  const earlyDepth = line.earlyExitDepth ?? REPORT_EARLY_EXIT_DEPTH

  if (objective === 'win') {
    const isForcedWin =
      (score.type === 'mate' && score.value > 0) ||
      (wdl !== undefined && wdl.win >= REPORT_WIN_MIN_WDL)
    return {
      isEarlyValid: depth >= earlyDepth && isForcedWin,
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
    isEarlyValid: depth >= earlyDepth && isComfortablySafe,
    isFinalValid: isNotLost,
  }
}

export function extractTacticsPlayerSteps(puzzle: PuzzlePuzzle): TacticsCheckStep[] {
  const baseFen = (puzzle.initial_fen || puzzle.puzzle_fen || '').trim()
  const rawSolution = (puzzle.tactical_solution || '').trim()
  if (!baseFen || !rawSolution) return []

  const tokens = rawSolution.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return []

  const pos = parseChessPosition(baseFen)
  let startIdx = 0
  if (puzzle.first_move === 'bot') {
    if (!applyPrimaryUciMove(pos, tokens[0]!)) return []
    startIdx = 1
  }

  const rawSteps: Array<{
    plyNumber: number
    fenBeforeMove: string
    expectedAlternatives: string[]
  }> = []

  for (let i = startIdx; i < tokens.length; i += 2) {
    const token = tokens[i]!
    const alternatives = token.split('|').map(normalizeUciToken).filter(Boolean)
    if (alternatives.length === 0) break

    rawSteps.push({
      plyNumber: i + 1,
      fenBeforeMove: makeFen(pos.toSetup()),
      expectedAlternatives: alternatives,
    })

    if (!applyPrimaryUciMove(pos, token)) break
    const botReplyToken = tokens[i + 1]
    if (botReplyToken && !applyPrimaryUciMove(pos, botReplyToken)) break
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

export function doesMoveMatchTacticsStep(
  fen: string,
  bestMoveUci: string,
  expectedAlternatives: string[],
  isFinalMove: boolean,
): boolean {
  const normBest = normalizeUciToken(bestMoveUci)
  if (!normBest) return false
  if (expectedAlternatives.includes(normBest)) return true

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
