import type { PuzzleObjective, PuzzlePuzzle } from '@/entities/game'
import type { PuzzleReportFailureCriterion } from '@/entities/training'
import type { WdlStats } from '@/shared/lib/engine'
import { type Chess, normalizeMove } from 'chessops/chess'
import { makeFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import {
  applyPrimaryUciMove,
  normalizeUciToken,
  parseChessPosition,
  REPORT_DRAW_MIN_CP,
  toUserPovEvaluation,
  type EngineLineSnapshot,
  type ScorePov,
  type UserPovEvaluation,
} from './puzzleReportRules'

// ScenarioOnly / ScenarioPlus (CreateTacticKURS Lichess-v50 MultiPV=2 adaptive ladder):
export const REPORT_TACTICS_MATE1_EXIT_DEPTH = 8
export const REPORT_TACTICS_FAST_EXIT_DEPTH = 15
export const REPORT_TACTICS_STANDARD_DEPTH = 20
export const REPORT_TACTICS_MAX_DEPTH = 24

// MultiPV=2 uniqueness & contrast thresholds aligned with CreateTacticKURS/scripts/lichesLikeValidator.py
export const TACTICS_MIN_WIN_CP = 180
export const TACTICS_FAST_WIN_CP = 220
export const TACTICS_PV2_REFUTED_MAX_CP = 130
export const TACTICS_PV2_REFUTED_MAX_WDL_WIN = 350
export const TACTICS_DUAL_MIN_CP = 180
export const TACTICS_DUAL_MIN_WDL_WIN = 450
export const TACTICS_MIN_CP_CONTRAST = 200
export const TACTICS_FINAL_MIN_CP_CONTRAST = 160
export const TACTICS_MIN_WDL_CHANCES_DIFF = 0.5

export interface MultiPvDepthSnapshot {
  depth: number
  pv1: EngineLineSnapshot
  pv2?: EngineLineSnapshot
  pv1StableCount: number
}

export interface TacticsCheckStep {
  stepIndex: number
  totalSteps: number
  plyNumber: number
  fenBeforeMove: string
  expectedAlternatives: string[]
  isFinalMove: boolean
  isSingleLegalMove: boolean
}

export type TacticsStepFinalVerdict =
  | {
      verdict: 'valid'
      reportedLine: EngineLineSnapshot
      reportedPov: UserPovEvaluation
    }
  | {
      verdict: 'suspicious'
      failureCriterion: Extract<
        PuzzleReportFailureCriterion,
        'tactics_move_mismatch' | 'tactics_eval_insufficient' | 'tactics_dual_move'
      >
      reportedLine: EngineLineSnapshot
      reportedPov: UserPovEvaluation
    }

function hasStrictlySingleLegalMove(pos: Chess): boolean {
  let totalMoves = 0
  for (const [from, dests] of pos.allDests()) {
    const destCount = dests.size()
    if (destCount === 0) continue
    const isPawn = pos.board.getRole(from) === 'pawn'
    for (const dest of dests) {
      if (isPawn && (dest < 8 || dest >= 56)) {
        totalMoves += 4
      } else {
        totalMoves += 1
      }
      if (totalMoves > 1) return false
    }
  }
  return totalMoves === 1
}

export function resolvePuzzleSolverFen(puzzle: PuzzlePuzzle): string {
  const baseFen = (puzzle.initial_fen || puzzle.puzzle_fen || '').trim()
  if (!baseFen) {
    throw new Error(`[puzzleReportTacticsRules] Missing FEN for puzzle "${puzzle.puzzle_id}".`)
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
    isSingleLegalMove: boolean
  }> = []

  for (let i = startIdx; i < tokens.length; i += 2) {
    const token = tokens[i]!
    const alternatives = token.split('|').map(normalizeUciToken).filter(Boolean)
    if (alternatives.length === 0) break

    rawSteps.push({
      plyNumber: i + 1,
      fenBeforeMove: makeFen(pos.toSetup()),
      expectedAlternatives: alternatives,
      isSingleLegalMove: hasStrictlySingleLegalMove(pos),
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
    isSingleLegalMove: step.isSingleLegalMove,
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

function scoreToComparableCp(score: ScorePov): number {
  if (score.type === 'mate') {
    return score.value > 0
      ? 10000 - Math.abs(score.value) * 10
      : -10000 + Math.abs(score.value) * 10
  }
  return score.value
}

function computeWdlChances(score: ScorePov, wdl?: WdlStats): number | null {
  if (score.type === 'mate') {
    return score.value > 0 ? 1.0 : -1.0
  }
  if (!wdl) return null
  return (wdl.win - wdl.loss) / 1000
}

function isPv2CleanlyRefuted(
  pov1: UserPovEvaluation,
  pov2: UserPovEvaluation | undefined,
  pv2MatchesAllowed: boolean,
  objective: PuzzleObjective,
): boolean {
  if (!pov2 || pv2MatchesAllowed) return true

  const cp1 = scoreToComparableCp(pov1.userScore)
  const cp2 = scoreToComparableCp(pov2.userScore)

  if (objective === 'hold_draw') {
    return cp2 <= -200 && cp1 - cp2 >= TACTICS_MIN_CP_CONTRAST
  }

  if (pov2.userScore.type === 'mate' && pov2.userScore.value > 0) {
    return false
  }
  if (cp2 > TACTICS_PV2_REFUTED_MAX_CP) return false
  if (pov2.userWdl && pov2.userWdl.win > TACTICS_PV2_REFUTED_MAX_WDL_WIN) return false
  if (cp1 - cp2 < TACTICS_MIN_CP_CONTRAST) return false

  const ch1 = computeWdlChances(pov1.userScore, pov1.userWdl)
  const ch2 = computeWdlChances(pov2.userScore, pov2.userWdl)
  if (ch1 !== null && ch2 !== null && ch1 - ch2 < TACTICS_MIN_WDL_CHANCES_DIFF) {
    return false
  }
  return true
}

export function shouldStopEarlyTacticsMultiPv(
  pair: MultiPvDepthSnapshot,
  step: TacticsCheckStep,
  objective: PuzzleObjective,
  userColor: 'white' | 'black',
): boolean {
  const pv1Matches = doesMoveMatchTacticsStep(
    step.fenBeforeMove,
    pair.pv1.bestMoveUci,
    step.expectedAlternatives,
    step.isFinalMove,
  )
  if (!pv1Matches) return false

  const pov1 = toUserPovEvaluation(pair.pv1.score, pair.pv1.wdl, step.fenBeforeMove, userColor)
  const pov2 = pair.pv2
    ? toUserPovEvaluation(pair.pv2.score, pair.pv2.wdl, step.fenBeforeMove, userColor)
    : undefined
  const pv2MatchesAllowed = pair.pv2
    ? doesMoveMatchTacticsStep(
        step.fenBeforeMove,
        pair.pv2.bestMoveUci,
        step.expectedAlternatives,
        step.isFinalMove,
      )
    : true

  if (!isPv2CleanlyRefuted(pov1, pov2, pv2MatchesAllowed, objective)) {
    return false
  }

  if (
    pair.depth >= REPORT_TACTICS_MATE1_EXIT_DEPTH &&
    pov1.userScore.type === 'mate' &&
    pov1.userScore.value === 1
  ) {
    return true
  }

  if (pair.depth >= REPORT_TACTICS_FAST_EXIT_DEPTH && pair.pv1StableCount >= 2) {
    if (objective === 'hold_draw') {
      return scoreToComparableCp(pov1.userScore) >= REPORT_DRAW_MIN_CP
    }
    return (
      (pov1.userScore.type === 'mate' && pov1.userScore.value > 0) ||
      (pov1.userScore.type === 'cp' && pov1.userScore.value >= TACTICS_FAST_WIN_CP)
    )
  }

  if (pair.depth >= REPORT_TACTICS_STANDARD_DEPTH) {
    if (objective === 'hold_draw') {
      return scoreToComparableCp(pov1.userScore) >= REPORT_DRAW_MIN_CP
    }
    return (
      (pov1.userScore.type === 'mate' && pov1.userScore.value > 0) ||
      (pov1.userScore.type === 'cp' && pov1.userScore.value >= TACTICS_MIN_WIN_CP)
    )
  }

  return false
}

export function evaluateTacticsMultiPvFinal(
  pair: MultiPvDepthSnapshot,
  step: TacticsCheckStep,
  objective: PuzzleObjective,
  userColor: 'white' | 'black',
): TacticsStepFinalVerdict {
  const pov1 = toUserPovEvaluation(pair.pv1.score, pair.pv1.wdl, step.fenBeforeMove, userColor)
  const pv1Matches = doesMoveMatchTacticsStep(
    step.fenBeforeMove,
    pair.pv1.bestMoveUci,
    step.expectedAlternatives,
    step.isFinalMove,
  )

  if (!pv1Matches) {
    return {
      verdict: 'suspicious',
      failureCriterion: 'tactics_move_mismatch',
      reportedLine: pair.pv1,
      reportedPov: pov1,
    }
  }

  const pv1AchievesObjective =
    objective === 'hold_draw'
      ? scoreToComparableCp(pov1.userScore) >= REPORT_DRAW_MIN_CP
      : (pov1.userScore.type === 'mate' && pov1.userScore.value > 0) ||
        (pov1.userScore.type === 'cp' && pov1.userScore.value >= TACTICS_MIN_WIN_CP)

  if (!pv1AchievesObjective) {
    return {
      verdict: 'suspicious',
      failureCriterion: 'tactics_eval_insufficient',
      reportedLine: pair.pv1,
      reportedPov: pov1,
    }
  }

  if (pair.pv2) {
    const pv2MatchesAllowed = doesMoveMatchTacticsStep(
      step.fenBeforeMove,
      pair.pv2.bestMoveUci,
      step.expectedAlternatives,
      step.isFinalMove,
    )
    if (!pv2MatchesAllowed) {
      const pov2 = toUserPovEvaluation(pair.pv2.score, pair.pv2.wdl, step.fenBeforeMove, userColor)
      const cp1 = scoreToComparableCp(pov1.userScore)
      const cp2 = scoreToComparableCp(pov2.userScore)

      const isDual =
        objective === 'hold_draw'
          ? cp2 >= -80
          : (pov2.userScore.type === 'mate' && pov2.userScore.value > 0) ||
            cp2 >= TACTICS_DUAL_MIN_CP ||
            (pov2.userWdl !== undefined && pov2.userWdl.win >= TACTICS_DUAL_MIN_WDL_WIN) ||
            cp1 - cp2 < TACTICS_FINAL_MIN_CP_CONTRAST

      if (isDual) {
        return {
          verdict: 'suspicious',
          failureCriterion: 'tactics_dual_move',
          reportedLine: pair.pv2,
          reportedPov: pov2,
        }
      }
    }
  }

  return {
    verdict: 'valid',
    reportedLine: pair.pv1,
    reportedPov: pov1,
  }
}
