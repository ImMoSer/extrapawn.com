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
  runLocalMultiPvSearch,
  runLocalSinglePvSearch,
  type MultiPvSearchFn,
  type SinglePvSearchFn,
} from './puzzleReportAdapters'
import {
  buildSyzygyProofUrl,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  formatWhitePovScore,
  REPORT_PLAYOUT_TARGET_DEPTH,
  toUserPovEvaluation,
  toUserTablebaseCategory,
  type EngineLineSnapshot,
  type ScorePov,
} from './puzzleReportRules'
import {
  doesMoveMatchTacticsStep,
  evaluateTacticsMultiPvFinal,
  extractTacticsPlayerSteps,
  REPORT_TACTICS_MAX_DEPTH,
  REPORT_TACTICS_STANDARD_DEPTH,
  resolvePuzzleSolverFen,
  shouldStopEarlyTacticsMultiPv,
  type MultiPvDepthSnapshot,
} from './puzzleReportTacticsRules'

export {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  evaluateTacticsMultiPvFinal,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  resolvePuzzleSolverFen,
  runLocalMultiPvSearch,
  runLocalSinglePvSearch,
  shouldStopEarlyTacticsMultiPv,
  toUserPovEvaluation,
  toUserTablebaseCategory,
  type EngineLineSnapshot,
  type MultiPvDepthSnapshot,
  type MultiPvSearchFn,
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
  runMultiPvSearchFn?: MultiPvSearchFn
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
  const targetDepth = REPORT_PLAYOUT_TARGET_DEPTH

  const finalLine = await searchFn({
    fen: evaluatedFen,
    targetDepth,
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

  const isFinalValid = evaluateEndgameStockfishLine(
    { score: finalPov.userScore, wdl: finalPov.userWdl },
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
  const multiPvSearchFn = options.runMultiPvSearchFn ?? runLocalMultiPvSearch
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

  let lastReportedLine: EngineLineSnapshot | null = null
  let lastReportedPov: ReturnType<typeof toUserPovEvaluation> | null = null
  let hasStartedEngineGame = false

  for (const step of steps) {
    // Stage 0: Forced 1-legal-move evasion/recapture -> instant 0 ms pass without engine call
    if (step.isSingleLegalMove) {
      const pct = Math.min(99, Math.round((step.stepIndex / step.totalSteps) * 100))
      options.onProgress?.({
        mode: 'tactics_engine',
        depth: 1,
        targetDepth: 1,
        stepIndex: step.stepIndex,
        totalSteps: step.totalSteps,
        percent: pct,
        currentEvalLabel: lastReportedPov?.whitePovEvalLabel,
      })
      continue
    }

    const resetGame = !hasStartedEngineGame
    hasStartedEngineGame = true

    const pair = await multiPvSearchFn({
      fen: step.fenBeforeMove,
      maxDepth: REPORT_TACTICS_MAX_DEPTH,
      resetGame,
      shouldEarlyStop: (snapshot) =>
        shouldStopEarlyTacticsMultiPv(snapshot, step, objective, userColor),
      onDepthProgress: (snapshot) => {
        const pov = toUserPovEvaluation(
          snapshot.pv1.score,
          snapshot.pv1.wdl,
          step.fenBeforeMove,
          userColor,
        )
        const displayTarget =
          snapshot.depth > REPORT_TACTICS_STANDARD_DEPTH
            ? REPORT_TACTICS_MAX_DEPTH
            : REPORT_TACTICS_STANDARD_DEPTH
        const completedFraction = (step.stepIndex - 1) / step.totalSteps
        const stepFraction = Math.min(1, snapshot.depth / displayTarget) / step.totalSteps
        const percent = Math.min(99, Math.round((completedFraction + stepFraction) * 100))
        options.onProgress?.({
          mode: 'tactics_engine',
          depth: snapshot.depth,
          targetDepth: displayTarget,
          stepIndex: step.stepIndex,
          totalSteps: step.totalSteps,
          percent,
          currentEvalLabel: pov.whitePovEvalLabel,
        })
      },
      signal: options.signal,
    })

    if (!pair) {
      return {
        verdict: 'network_error',
        source: 'local_stockfish',
        solverFen: evaluatedFen,
        objective,
        userColor,
        errorMessage: 'Local Stockfish returned no evaluation for tactics step',
      }
    }

    const stepVerdict = evaluateTacticsMultiPvFinal(pair, step, objective, userColor)
    lastReportedLine = stepVerdict.reportedLine
    lastReportedPov = stepVerdict.reportedPov

    if (stepVerdict.verdict === 'suspicious') {
      return {
        verdict: 'suspicious',
        source: 'local_stockfish',
        failureCriterion: stepVerdict.failureCriterion,
        solverFen: step.fenBeforeMove,
        objective,
        userColor,
        depth: pair.depth,
        userScore: stepVerdict.reportedPov.userScore,
        whiteScore: stepVerdict.reportedPov.whiteScore,
        whitePovEvalLabel: stepVerdict.reportedPov.whitePovEvalLabel,
        wdl: stepVerdict.reportedPov.userWdl,
        engineBestMove: stepVerdict.reportedLine.bestMoveUci,
        mismatchPly: step.plyNumber,
      }
    }
  }

  const finalDepth = lastReportedLine?.depth ?? REPORT_TACTICS_STANDARD_DEPTH
  options.onProgress?.({
    mode: 'tactics_engine',
    depth: finalDepth,
    targetDepth:
      finalDepth > REPORT_TACTICS_STANDARD_DEPTH
        ? REPORT_TACTICS_MAX_DEPTH
        : REPORT_TACTICS_STANDARD_DEPTH,
    stepIndex: steps.length,
    totalSteps: steps.length,
    percent: 100,
    currentEvalLabel: lastReportedPov?.whitePovEvalLabel,
  })

  return {
    verdict: 'valid',
    source: 'local_stockfish',
    solverFen: evaluatedFen,
    objective,
    userColor,
    depth: finalDepth,
    userScore: lastReportedPov?.userScore,
    whiteScore: lastReportedPov?.whiteScore,
    whitePovEvalLabel: lastReportedPov?.whitePovEvalLabel,
    wdl: lastReportedPov?.userWdl,
    engineBestMove: lastReportedLine?.bestMoveUci,
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
