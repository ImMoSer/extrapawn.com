import { countBoardPieces } from '@/entities/analysis'
import { determineHumanColor, type PuzzleObjective, type PuzzlePuzzle } from '@/entities/game'
import type {
  PuzzleReportFailureCriterion,
  PuzzleReportVerificationSource,
  ReportableTrainingDiscipline,
} from '@/entities/training'
import type { WdlStats } from '@/shared/lib/engine'
import {
  fetchLichessTablebaseCategory,
  runLocalSinglePvSearch,
  type SinglePvSearchFn,
} from './puzzleReportAdapters'
import {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  getFenTurnColor,
  REPORT_DRAW_MIN_CP,
  REPORT_EARLY_EXIT_DEPTH,
  REPORT_TACTICS_EARLY_EXIT_DEPTH,
  REPORT_TARGET_DEPTH,
  resolvePuzzleSolverFen,
  toUserPovEvaluation,
  toUserTablebaseCategory,
  type EngineLineSnapshot,
  type ScorePov,
} from './puzzleReportRules'

export {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  resolvePuzzleSolverFen,
  runLocalSinglePvSearch,
  toUserPovEvaluation,
  toUserTablebaseCategory,
  type EngineLineSnapshot,
  type ScorePov,
  type SinglePvSearchFn,
}

export interface VerificationProgress {
  mode: 'tablebase' | 'endgame_engine' | 'tactics_engine'
  depth: number
  targetDepth: number
  stepIndex: number
  totalSteps: number
  percent: number
  currentEvalLabel?: string
}

export interface PuzzleVerificationResult {
  verdict: 'valid' | 'suspicious' | 'network_error'
  source: PuzzleReportVerificationSource
  failureCriterion?: PuzzleReportFailureCriterion
  solverFen: string
  objective: PuzzleObjective
  userColor: 'white' | 'black'
  syzygyUrl?: string
  tablebaseCategory?: string
  depth?: number
  userScore?: ScorePov
  whiteScore?: ScorePov
  whitePovEvalLabel?: string
  wdl?: WdlStats
  engineBestMove?: string
  mismatchPly?: number
  errorMessage?: string
}

export interface VerifyPuzzleOptions {
  discipline: ReportableTrainingDiscipline
  onProgress?: (progress: VerificationProgress) => void
  signal?: AbortSignal
  fetchFn?: typeof fetch
  runDepthSearchFn?: SinglePvSearchFn
}

async function verifyViaLichessTablebase(
  evaluatedFen: string,
  userColor: 'white' | 'black',
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const syzygyUrl = buildSyzygyProofUrl(evaluatedFen)

  options.onProgress?.({
    mode: 'tablebase',
    depth: 0,
    targetDepth: 1,
    stepIndex: 1,
    totalSteps: 1,
    percent: 40,
  })

  const tbRes = await fetchLichessTablebaseCategory(evaluatedFen, options.fetchFn, options.signal)
  if (!tbRes.ok) {
    return {
      verdict: 'network_error',
      source: 'lichess_tablebase',
      solverFen: evaluatedFen,
      objective,
      userColor,
      syzygyUrl,
      errorMessage: tbRes.errorMessage,
    }
  }

  const userCategory = toUserTablebaseCategory(tbRes.category, evaluatedFen, userColor)
  const verdict = evaluateLichessTablebaseVerdict(userCategory, objective)

  options.onProgress?.({
    mode: 'tablebase',
    depth: 1,
    targetDepth: 1,
    stepIndex: 1,
    totalSteps: 1,
    percent: 100,
  })

  return {
    verdict,
    source: 'lichess_tablebase',
    failureCriterion:
      verdict === 'suspicious'
        ? objective === 'win'
          ? 'syzygy_win_failed'
          : 'syzygy_draw_failed'
        : undefined,
    solverFen: evaluatedFen,
    objective,
    userColor,
    syzygyUrl,
    tablebaseCategory: userCategory,
  }
}

async function verifyEndgameWithStockfish(
  evaluatedFen: string,
  userColor: 'white' | 'black',
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const searchFn = options.runDepthSearchFn ?? runLocalSinglePvSearch
  const isUserTurn = getFenTurnColor(evaluatedFen) === userColor
  const targetDepth = isUserTurn ? REPORT_TARGET_DEPTH : REPORT_TARGET_DEPTH + 1
  const earlyExitDepth = isUserTurn ? REPORT_EARLY_EXIT_DEPTH : REPORT_EARLY_EXIT_DEPTH + 1

  const finalLine = await searchFn({
    fen: evaluatedFen,
    targetDepth,
    shouldEarlyStop: (line) => {
      const pov = toUserPovEvaluation(line.score, line.wdl, evaluatedFen, userColor)
      return evaluateEndgameStockfishLine(
        {
          depth: line.depth,
          earlyExitDepth,
          score: pov.userScore,
          wdl: pov.userWdl,
        },
        objective,
      ).isEarlyValid
    },
    onDepthProgress: (line) => {
      const pov = toUserPovEvaluation(line.score, line.wdl, evaluatedFen, userColor)
      const pct = Math.min(99, Math.round((line.depth / targetDepth) * 100))
      options.onProgress?.({
        mode: 'endgame_engine',
        depth: line.depth,
        targetDepth,
        stepIndex: 1,
        totalSteps: 1,
        percent: pct,
        currentEvalLabel: pov.whitePovEvalLabel,
      })
    },
    signal: options.signal,
  })

  if (!finalLine) {
    return {
      verdict: 'network_error',
      source: 'local_stockfish',
      solverFen: evaluatedFen,
      objective,
      userColor,
      errorMessage: 'Local Stockfish returned no evaluation',
    }
  }

  const finalPov = toUserPovEvaluation(finalLine.score, finalLine.wdl, evaluatedFen, userColor)
  options.onProgress?.({
    mode: 'endgame_engine',
    depth: finalLine.depth,
    targetDepth,
    stepIndex: 1,
    totalSteps: 1,
    percent: 100,
    currentEvalLabel: finalPov.whitePovEvalLabel,
  })

  const { isFinalValid } = evaluateEndgameStockfishLine(
    {
      depth: finalLine.depth,
      earlyExitDepth,
      score: finalPov.userScore,
      wdl: finalPov.userWdl,
    },
    objective,
  )

  return {
    verdict: isFinalValid ? 'valid' : 'suspicious',
    source: 'local_stockfish',
    failureCriterion: isFinalValid
      ? undefined
      : objective === 'win'
        ? 'win_wdl_below_995'
        : 'hold_draw_cp_below_0',
    solverFen: evaluatedFen,
    objective,
    userColor,
    depth: finalLine.depth,
    userScore: finalPov.userScore,
    whiteScore: finalPov.whiteScore,
    whitePovEvalLabel: finalPov.whitePovEvalLabel,
    wdl: finalPov.userWdl,
    engineBestMove: finalLine.bestMoveUci,
  }
}

async function verifyTacticsWithStockfish(
  puzzle: PuzzlePuzzle,
  evaluatedFen: string,
  userColor: 'white' | 'black',
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const searchFn = options.runDepthSearchFn ?? runLocalSinglePvSearch
  const steps = extractTacticsPlayerSteps(puzzle)
  if (steps.length === 0) {
    return {
      verdict: 'suspicious',
      source: 'local_stockfish',
      failureCriterion: 'tactics_solution_invalid',
      solverFen: evaluatedFen,
      objective,
      userColor,
      mismatchPly: 1,
      errorMessage: 'TacticalSolution is empty or illegal',
    }
  }

  let lastLine: EngineLineSnapshot | null = null
  let lastFen = evaluatedFen

  for (const step of steps) {
    lastFen = step.fenBeforeMove
    const line = await searchFn({
      fen: step.fenBeforeMove,
      targetDepth: REPORT_TARGET_DEPTH,
      shouldEarlyStop: (snapshot) => {
        if (snapshot.depth < REPORT_TACTICS_EARLY_EXIT_DEPTH) return false
        const matches = doesMoveMatchTacticsStep(
          step.fenBeforeMove,
          snapshot.bestMoveUci,
          step.expectedAlternatives,
          step.isFinalMove,
        )
        if (!matches) return false
        const pov = toUserPovEvaluation(snapshot.score, snapshot.wdl, step.fenBeforeMove, userColor)
        if (objective === 'hold_draw') {
          return (
            (pov.userScore.type === 'mate' && pov.userScore.value > 0) ||
            (pov.userScore.type === 'cp' && pov.userScore.value >= REPORT_DRAW_MIN_CP)
          )
        }
        return (
          (pov.userScore.type === 'mate' && pov.userScore.value > 0) ||
          (pov.userScore.type === 'cp' && pov.userScore.value >= 150)
        )
      },
      onDepthProgress: (snapshot) => {
        const pov = toUserPovEvaluation(snapshot.score, snapshot.wdl, step.fenBeforeMove, userColor)
        const completedFraction = (step.stepIndex - 1) / step.totalSteps
        const stepFraction = Math.min(1, snapshot.depth / REPORT_TARGET_DEPTH) / step.totalSteps
        const percent = Math.min(99, Math.round((completedFraction + stepFraction) * 100))
        options.onProgress?.({
          mode: 'tactics_engine',
          depth: snapshot.depth,
          targetDepth: REPORT_TARGET_DEPTH,
          stepIndex: step.stepIndex,
          totalSteps: step.totalSteps,
          percent,
          currentEvalLabel: pov.whitePovEvalLabel,
        })
      },
      signal: options.signal,
    })

    if (!line) {
      return {
        verdict: 'network_error',
        source: 'local_stockfish',
        solverFen: evaluatedFen,
        objective,
        userColor,
        errorMessage: 'Local Stockfish returned no evaluation for tactics step',
      }
    }

    lastLine = line
    const matched = doesMoveMatchTacticsStep(
      step.fenBeforeMove,
      line.bestMoveUci,
      step.expectedAlternatives,
      step.isFinalMove,
    )

    if (!matched) {
      const pov = toUserPovEvaluation(line.score, line.wdl, step.fenBeforeMove, userColor)
      return {
        verdict: 'suspicious',
        source: 'local_stockfish',
        failureCriterion: 'tactics_move_mismatch',
        solverFen: step.fenBeforeMove,
        objective,
        userColor,
        depth: line.depth,
        userScore: pov.userScore,
        whiteScore: pov.whiteScore,
        whitePovEvalLabel: pov.whitePovEvalLabel,
        wdl: pov.userWdl,
        engineBestMove: line.bestMoveUci,
        mismatchPly: step.plyNumber,
      }
    }
  }

  const finalPov = lastLine
    ? toUserPovEvaluation(lastLine.score, lastLine.wdl, lastFen, userColor)
    : null

  options.onProgress?.({
    mode: 'tactics_engine',
    depth: lastLine?.depth ?? REPORT_TARGET_DEPTH,
    targetDepth: REPORT_TARGET_DEPTH,
    stepIndex: steps.length,
    totalSteps: steps.length,
    percent: 100,
    currentEvalLabel: finalPov?.whitePovEvalLabel,
  })

  return {
    verdict: 'valid',
    source: 'local_stockfish',
    solverFen: evaluatedFen,
    objective,
    userColor,
    depth: lastLine?.depth,
    userScore: finalPov?.userScore,
    whiteScore: finalPov?.whiteScore,
    whitePovEvalLabel: finalPov?.whitePovEvalLabel,
    wdl: finalPov?.userWdl,
    engineBestMove: lastLine?.bestMoveUci,
  }
}

export async function verifyPuzzleForReport(
  puzzle: PuzzlePuzzle,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const objective: PuzzleObjective = puzzle.objective ?? 'win'
  const userColor = determineHumanColor(puzzle)
  const evaluatedFen = resolvePuzzleSolverFen(puzzle)

  if (puzzle.strategy === 'playOutOnly') {
    const pieces = countBoardPieces(evaluatedFen)
    if (pieces >= 2 && pieces <= 7) {
      return verifyViaLichessTablebase(evaluatedFen, userColor, objective, options)
    }
    return verifyEndgameWithStockfish(evaluatedFen, userColor, objective, options)
  }

  return verifyTacticsWithStockfish(puzzle, evaluatedFen, userColor, objective, options)
}
