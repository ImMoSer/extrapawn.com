import { countBoardPieces } from '@/entities/analysis'
import type { PuzzleObjective, PuzzlePuzzle } from '@/entities/game'
import type {
  PuzzleReportVerificationSource,
  ReportableTrainingDiscipline,
} from '@/entities/training'
import { localEngineManager, type EvaluatedLine, type WdlStats } from '@/shared/lib/engine'
import {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  normalizeUciToken,
  REPORT_DRAW_MIN_CP,
  REPORT_STEP_TIMEOUT_MS,
  REPORT_TABLEBASE_TIMEOUT_MS,
  REPORT_TACTICS_EARLY_EXIT_DEPTH,
  REPORT_TARGET_DEPTH,
  resolvePuzzleSolverFen,
  type EngineLineSnapshot,
  type ScoreMoverPov,
} from './puzzleReportRules'

export {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  resolvePuzzleSolverFen,
  type EngineLineSnapshot,
  type ScoreMoverPov,
}

const LICHESS_TABLEBASE_ENDPOINT = 'https://tablebase.lichess.ovh/standard'

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
  solverFen: string
  objective: PuzzleObjective
  syzygyUrl?: string
  tablebaseCategory?: string
  depth?: number
  moverScore?: ScoreMoverPov
  whitePovEvalLabel?: string
  wdl?: WdlStats
  engineBestMove?: string
  mismatchPly?: number
  errorMessage?: string
}

export type SinglePvSearchFn = (params: {
  fen: string
  targetDepth: number
  shouldEarlyStop: (line: EngineLineSnapshot) => boolean
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}) => Promise<EngineLineSnapshot | null>

export interface VerifyPuzzleOptions {
  discipline: ReportableTrainingDiscipline
  onProgress?: (progress: VerificationProgress) => void
  signal?: AbortSignal
  fetchFn?: typeof fetch
  runDepthSearchFn?: SinglePvSearchFn
}

interface LichessTablebaseResponse {
  category?: string
  dtz?: number | null
  dtm?: number | null
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

export async function runLocalSinglePvSearch(params: {
  fen: string
  targetDepth: number
  shouldEarlyStop: (line: EngineLineSnapshot) => boolean
  onDepthProgress: (line: EngineLineSnapshot) => void
  signal?: AbortSignal
}): Promise<EngineLineSnapshot | null> {
  const { fen, targetDepth, shouldEarlyStop, onDepthProgress, signal } = params
  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  await localEngineManager.ensureReady()
  await localEngineManager.startNewGame()

  if (signal?.aborted) {
    throw new DOMException('Verification aborted', 'AbortError')
  }

  return new Promise<EngineLineSnapshot | null>((resolve, reject) => {
    let settled = false
    let latestLine: EngineLineSnapshot | null = null

    const cleanup = () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', handleAbort)
    }

    const finishWith = (result: EngineLineSnapshot | null, needStop: boolean) => {
      if (settled) return
      settled = true
      cleanup()
      if (needStop) {
        void localEngineManager.stopAnalysis().finally(() => resolve(result))
      } else {
        resolve(result)
      }
    }

    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      void localEngineManager.stopAnalysis().finally(() => {
        reject(new DOMException('Verification aborted', 'AbortError'))
      })
    }

    const timeoutId = setTimeout(() => {
      finishWith(latestLine, true)
    }, REPORT_STEP_TIMEOUT_MS)

    signal?.addEventListener('abort', handleAbort, { once: true })

    void localEngineManager
      .startAnalysis(
        fen,
        (lines: EvaluatedLine[], bestMoveUci?: string | null) => {
          if (settled) return

          for (const line of lines) {
            if (line.id !== 1) continue
            const moveUci = line.pvUci[0] ? normalizeUciToken(line.pvUci[0]) : ''
            if (!moveUci) continue

            const snapshot: EngineLineSnapshot = {
              depth: line.depth,
              score: line.score,
              wdl: line.wdl,
              bestMoveUci: moveUci,
            }
            latestLine = snapshot
            onDepthProgress(snapshot)

            if (snapshot.depth >= targetDepth || shouldEarlyStop(snapshot)) {
              finishWith(snapshot, true)
              return
            }
          }

          if (bestMoveUci !== undefined && bestMoveUci !== null) {
            finishWith(
              latestLine ?? {
                depth: targetDepth,
                score: { type: 'cp', value: 0 },
                bestMoveUci: normalizeUciToken(bestMoveUci),
              },
              false,
            )
          }
        },
        { multiPv: 1 },
      )
      .catch((err: unknown) => {
        if (settled) return
        settled = true
        cleanup()
        reject(err)
      })
  })
}

async function verifyViaLichessTablebase(
  solverFen: string,
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const fetchFn = options.fetchFn ?? fetch
  const syzygyUrl = buildSyzygyProofUrl(solverFen)

  options.onProgress?.({
    mode: 'tablebase',
    depth: 0,
    targetDepth: 1,
    stepIndex: 1,
    totalSteps: 1,
    percent: 40,
  })

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REPORT_TABLEBASE_TIMEOUT_MS)
  const onParentAbort = () => controller.abort()
  options.signal?.addEventListener('abort', onParentAbort, { once: true })

  try {
    const url = `${LICHESS_TABLEBASE_ENDPOINT}?fen=${encodeURIComponent(solverFen)}`
    const response = await fetchFn(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    if (!response.ok) {
      return {
        verdict: 'network_error',
        source: 'lichess_tablebase',
        solverFen,
        objective,
        syzygyUrl,
        errorMessage: `Lichess Tablebase HTTP ${response.status}`,
      }
    }

    const data = (await response.json()) as LichessTablebaseResponse
    const category = (data.category ?? '').trim().toLowerCase()
    if (!category) {
      return {
        verdict: 'network_error',
        source: 'lichess_tablebase',
        solverFen,
        objective,
        syzygyUrl,
        errorMessage: 'Empty Lichess Tablebase category',
      }
    }

    options.onProgress?.({
      mode: 'tablebase',
      depth: 1,
      targetDepth: 1,
      stepIndex: 1,
      totalSteps: 1,
      percent: 100,
    })

    return {
      verdict: evaluateLichessTablebaseVerdict(category, objective),
      source: 'lichess_tablebase',
      solverFen,
      objective,
      syzygyUrl,
      tablebaseCategory: category,
    }
  } catch (err: unknown) {
    if (options.signal?.aborted) {
      throw new DOMException('Verification aborted', 'AbortError')
    }
    return {
      verdict: 'network_error',
      source: 'lichess_tablebase',
      solverFen,
      objective,
      syzygyUrl,
      errorMessage: isAbortError(err)
        ? 'Lichess Tablebase request timed out'
        : err instanceof Error
          ? err.message
          : String(err),
    }
  } finally {
    clearTimeout(timeoutId)
    options.signal?.removeEventListener('abort', onParentAbort)
  }
}

async function verifyEndgameWithStockfish(
  solverFen: string,
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const searchFn = options.runDepthSearchFn ?? runLocalSinglePvSearch

  const finalLine = await searchFn({
    fen: solverFen,
    targetDepth: REPORT_TARGET_DEPTH,
    shouldEarlyStop: (line) => evaluateEndgameStockfishLine(line, objective).isEarlyValid,
    onDepthProgress: (line) => {
      const pct = Math.min(99, Math.round((line.depth / REPORT_TARGET_DEPTH) * 100))
      options.onProgress?.({
        mode: 'endgame_engine',
        depth: line.depth,
        targetDepth: REPORT_TARGET_DEPTH,
        stepIndex: 1,
        totalSteps: 1,
        percent: pct,
        currentEvalLabel: formatWhitePovScore(line.score, solverFen),
      })
    },
    signal: options.signal,
  })

  if (!finalLine) {
    return {
      verdict: 'network_error',
      source: 'local_stockfish',
      solverFen,
      objective,
      errorMessage: 'Local Stockfish returned no evaluation',
    }
  }

  options.onProgress?.({
    mode: 'endgame_engine',
    depth: finalLine.depth,
    targetDepth: REPORT_TARGET_DEPTH,
    stepIndex: 1,
    totalSteps: 1,
    percent: 100,
    currentEvalLabel: formatWhitePovScore(finalLine.score, solverFen),
  })

  const { isFinalValid } = evaluateEndgameStockfishLine(finalLine, objective)
  return {
    verdict: isFinalValid ? 'valid' : 'suspicious',
    source: 'local_stockfish',
    solverFen,
    objective,
    depth: finalLine.depth,
    moverScore: finalLine.score,
    whitePovEvalLabel: formatWhitePovScore(finalLine.score, solverFen),
    wdl: finalLine.wdl,
    engineBestMove: finalLine.bestMoveUci,
  }
}

async function verifyTacticsWithStockfish(
  puzzle: PuzzlePuzzle,
  solverFen: string,
  objective: PuzzleObjective,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const searchFn = options.runDepthSearchFn ?? runLocalSinglePvSearch
  const steps = extractTacticsPlayerSteps(puzzle)
  if (steps.length === 0) {
    return {
      verdict: 'suspicious',
      source: 'local_stockfish',
      solverFen,
      objective,
      mismatchPly: 1,
      errorMessage: 'TacticalSolution is empty or illegal',
    }
  }

  let lastLine: EngineLineSnapshot | null = null
  let lastFen = solverFen

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
        if (objective === 'hold_draw') {
          return (
            (snapshot.score.type === 'mate' && snapshot.score.value > 0) ||
            (snapshot.score.type === 'cp' && snapshot.score.value >= REPORT_DRAW_MIN_CP)
          )
        }
        return (
          (snapshot.score.type === 'mate' && snapshot.score.value > 0) ||
          (snapshot.score.type === 'cp' && snapshot.score.value >= 150)
        )
      },
      onDepthProgress: (snapshot) => {
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
          currentEvalLabel: formatWhitePovScore(snapshot.score, step.fenBeforeMove),
        })
      },
      signal: options.signal,
    })

    if (!line) {
      return {
        verdict: 'network_error',
        source: 'local_stockfish',
        solverFen,
        objective,
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
      return {
        verdict: 'suspicious',
        source: 'local_stockfish',
        solverFen,
        objective,
        depth: line.depth,
        moverScore: line.score,
        whitePovEvalLabel: formatWhitePovScore(line.score, step.fenBeforeMove),
        wdl: line.wdl,
        engineBestMove: line.bestMoveUci,
        mismatchPly: step.plyNumber,
      }
    }
  }

  options.onProgress?.({
    mode: 'tactics_engine',
    depth: lastLine?.depth ?? REPORT_TARGET_DEPTH,
    targetDepth: REPORT_TARGET_DEPTH,
    stepIndex: steps.length,
    totalSteps: steps.length,
    percent: 100,
    currentEvalLabel: lastLine ? formatWhitePovScore(lastLine.score, lastFen) : undefined,
  })

  return {
    verdict: 'valid',
    source: 'local_stockfish',
    solverFen,
    objective,
    depth: lastLine?.depth,
    moverScore: lastLine?.score,
    whitePovEvalLabel: lastLine ? formatWhitePovScore(lastLine.score, lastFen) : undefined,
    wdl: lastLine?.wdl,
    engineBestMove: lastLine?.bestMoveUci,
  }
}

/**
 * Main verification orchestrator for the Puzzle Report Service:
 * - playOutOnly & <= 7 pieces -> Lichess 7-man Tablebase + syzygy-tables.info proof link
 * - playOutOnly & > 7 pieces  -> local Stockfish depth 20 (win: WDL >= 995; hold_draw: mover CP >= 0)
 * - tactics_course (scenario) -> local Stockfish depth 20 sequential match against TacticalSolution
 */
export async function verifyPuzzleForReport(
  puzzle: PuzzlePuzzle,
  options: VerifyPuzzleOptions,
): Promise<PuzzleVerificationResult> {
  const objective: PuzzleObjective = puzzle.objective ?? 'win'
  const solverFen = resolvePuzzleSolverFen(puzzle)

  if (puzzle.strategy === 'playOutOnly') {
    const pieces = countBoardPieces(solverFen)
    if (pieces >= 2 && pieces <= 7) {
      return verifyViaLichessTablebase(solverFen, objective, options)
    }
    return verifyEndgameWithStockfish(solverFen, objective, options)
  }

  return verifyTacticsWithStockfish(puzzle, solverFen, objective, options)
}
