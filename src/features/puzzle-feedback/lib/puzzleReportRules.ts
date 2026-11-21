import type { PuzzleObjective } from '@/entities/game'
import { normalizeUciMove } from '@/shared/lib/chess-utils'
import type { WdlStats } from '@/shared/lib/engine'
import { Chess, normalizeMove } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'

// PlayOutOnly (>7 pieces): strict full search to depth 21, zero early exit.
export const REPORT_PLAYOUT_TARGET_DEPTH = 21

export const REPORT_WIN_MIN_WDL = 995
export const REPORT_DRAW_MIN_CP = 0
export const REPORT_STEP_TIMEOUT_MS = 45000
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

export function normalizeUciToken(uci: string): string {
  return normalizeUciMove(uci.trim().toLowerCase())
}

export function getFenTurnColor(fen: string): 'white' | 'black' {
  const setupRes = parseFen(fen)
  if (setupRes.isErr) {
    throw new Error(`[puzzleReportRules] Invalid FEN "${fen}": ${setupRes.error.message}`)
  }
  return setupRes.unwrap().turn === 'black' ? 'black' : 'white'
}

export function parseChessPosition(fen: string): Chess {
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

export function applyPrimaryUciMove(pos: Chess, rawToken: string): boolean {
  const primary = rawToken.split('|')[0]?.trim() ?? ''
  if (!primary) return false
  const parsed = parseUci(normalizeUciToken(primary))
  if (!parsed) return false
  const normalized = normalizeMove(pos, parsed)
  if (!pos.isLegal(normalized)) return false
  pos.play(normalized)
  return true
}

export function buildSyzygyProofUrl(fen: string): string {
  return `https://syzygy-tables.info/?fen=${fen.trim().replace(/\s+/g, '_')}`
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
 * Strict final evaluation for PlayOutOnly (>7 pieces) at depth 21:
 * - win: userWdl.win >= 995 (or userScore mate > 0)
 * - hold_draw: userScore cp >= 0 (or userScore mate > 0)
 */
export function evaluateEndgameStockfishLine(
  line: { score: ScorePov; wdl?: WdlStats },
  objective: PuzzleObjective,
): boolean {
  const { score, wdl } = line
  if (objective === 'win') {
    return (
      (score.type === 'mate' && score.value > 0) ||
      (wdl !== undefined && wdl.win >= REPORT_WIN_MIN_WDL)
    )
  }
  return (
    (score.type === 'mate' && score.value > 0) ||
    (score.type === 'cp' && score.value >= REPORT_DRAW_MIN_CP)
  )
}
