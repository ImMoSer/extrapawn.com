import type { BlunderSpyStepTelemetry, PuzzleAttemptTelemetry, PuzzlePuzzle } from '@/entities/game'
import { useBoardStore } from '@/entities/game'
import {
  resolveDisciplineForCourseSlug,
  trainingApi,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
} from '@/entities/training'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import {
  recordCrashTestAnomaly,
  recordCrashTestPuzzleOutcome,
  recordCrashTestStepHit,
  resetCrashTestReport,
} from '../lib/crashTestReportLogger'
import { extractErrorText, type TrainingSessionSharedState } from './trainingSession.types'

interface CrashTestDependencies {
  state: TrainingSessionSharedState
  consumeElapsedTimeMs: () => number
  applyHydratedSessionAndLaunch: (dto: HydratedSessionDTO) => void
  advanceAfterAttempt: () => void
  fetchTacticsCourseCurriculum: (
    courseSlug?: TacticsCourseSlug,
  ) => Promise<TacticsCourseCurriculumDTO>
}

export function captureCurrentGameMoveHistory() {
  try {
    const gameMovesUci = pgnService.getCurrentUciPath()
    const gameMovesSan = pgnService.getCurrentSanPath()
    const gamePgn = pgnService.getCurrentPgnString({ showVariations: true })
    return {
      game_moves_uci: gameMovesUci,
      game_moves_san: gameMovesSan,
      game_pgn: gamePgn,
    }
  } catch {
    return {
      game_moves_uci: [],
      game_moves_san: [],
      game_pgn: '',
    }
  }
}

export function useCrashTestActions(deps: CrashTestDependencies) {
  const { state } = deps
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const preferencesStore = usePreferencesStore()

  function isCrashtestActiveForSession(session: SessionSummaryDTO): boolean {
    return (
      session.mode === 'crashtest' ||
      (authStore.isMo3ep && preferencesStore.preferences.gameplay.global_crashtest)
    )
  }

  function handleCrashTestBlunderSpyStep(
    session: SessionSummaryDTO,
    puzzle: PuzzlePuzzle,
    itemIndex: number,
    stepInfo: BlunderSpyStepTelemetry,
  ): void {
    state.runtime.setLastBlunderSpyStep(stepInfo)

    const isCrashtestMode = isCrashtestActiveForSession(session)
    if (isCrashtestMode) {
      recordCrashTestStepHit(stepInfo.cacheHit ? 'cache' : 'engine_healed')
    }

    if (stepInfo.status === 'error' && isCrashtestMode) {
      const gameHistory = captureCurrentGameMoveHistory()
      recordCrashTestAnomaly({
        type: 'api_error',
        puzzle_id: puzzle.puzzle_id,
        course_slug: puzzle.course_slug,
        global_batch_id: puzzle.global_batch_id,
        batch_id: puzzle.batch_id,
        index_in_session: itemIndex,
        domain: puzzle.domain,
        class: puzzle.category,
        objective: puzzle.objective,
        initial_fen: puzzle.initial_fen,
        current_fen: stepInfo.fenBefore,
        move_uci: stepInfo.moveUci,
        user_move_number: stepInfo.userMoveNumber,
        played_moves_uci: stepInfo.playedMovesUci,
        ...gameHistory,
        canonical_solution: puzzle.tactical_solution,
        crashtest_engine: preferencesStore.preferences.gameplay.crashtestEngine,
        blunderspy_state: stepInfo.stateMask,
        best_move_uci: stepInfo.allowedMoves[0],
        allowed_moves: stepInfo.allowedMoves,
        error_message: stepInfo.errorMessage || 'blunderspy API error',
      })
    }
  }

  function recordCrashTestOutcomeIfActive(
    targetItem: HydratedSessionItem,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
    elapsedMs: number,
  ): void {
    recordCrashTestPuzzleOutcome(targetItem.puzzle_id, targetItem.index, solved)
    if (!solved) {
      const lastStep = state.runtime.getLastBlunderSpyStep()
      const gameHistory = captureCurrentGameMoveHistory()
      recordCrashTestAnomaly({
        type:
          telemetry.outcomeReason === 'blunderspy_api_error'
            ? 'api_error'
            : 'blunder_in_crashtest',
        puzzle_id: targetItem.puzzle_id,
        course_slug: targetItem.course_puzzle?.course_slug,
        global_batch_id: targetItem.course_puzzle?.global_batch_id,
        batch_id: targetItem.course_puzzle?.batch_id,
        index_in_session: targetItem.index,
        domain: targetItem.course_puzzle?.domain,
        class: targetItem.course_puzzle?.class,
        objective: targetItem.course_puzzle?.objective,
        initial_fen: targetItem.course_puzzle?.tactical_fen || '',
        current_fen: lastStep?.fenBefore || boardStore.fen,
        move_uci: lastStep?.moveUci,
        user_move_number: lastStep?.userMoveNumber,
        played_moves_uci: lastStep?.playedMovesUci ?? [],
        ...gameHistory,
        canonical_solution: targetItem.course_puzzle?.tactical_solution,
        crashtest_engine: preferencesStore.preferences.gameplay.crashtestEngine,
        blunderspy_state: lastStep?.stateMask,
        blunderspy_reason: telemetry.outcomeReason,
        best_move_uci: lastStep?.allowedMoves?.[0],
        allowed_moves: lastStep?.allowedMoves,
        error_message: `Outcome reason: ${telemetry.outcomeReason} (failStage: ${telemetry.failStage}, timeMs: ${elapsedMs})`,
      })
    }
  }

  function recordCrashTestSubmitError(targetItem: HydratedSessionItem, errorMessage: string): void {
    const lastStep = state.runtime.getLastBlunderSpyStep()
    const gameHistory = captureCurrentGameMoveHistory()
    recordCrashTestAnomaly({
      type: 'api_error',
      puzzle_id: targetItem.puzzle_id,
      course_slug: targetItem.course_puzzle?.course_slug,
      global_batch_id: targetItem.course_puzzle?.global_batch_id,
      batch_id: targetItem.course_puzzle?.batch_id,
      index_in_session: targetItem.index,
      domain: targetItem.course_puzzle?.domain,
      class: targetItem.course_puzzle?.class,
      objective: targetItem.course_puzzle?.objective,
      initial_fen: targetItem.course_puzzle?.tactical_fen || '',
      current_fen: boardStore.fen,
      played_moves_uci: lastStep?.playedMovesUci ?? [],
      ...gameHistory,
      canonical_solution: targetItem.course_puzzle?.tactical_solution,
      crashtest_engine: preferencesStore.preferences.gameplay.crashtestEngine,
      error_message: errorMessage,
    })
  }

  async function startCrashTestSession(
    forceRestart: boolean = false,
    jumpToIndex?: number,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (!authStore.isMo3ep) {
      throw new Error(
        '[TrainingSessionStore] Crash-Test mode is restricted to developer (mo3ep). Fail-Fast!',
      )
    }
    const slug = courseSlug ?? state.activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const defaultTotal = discipline === 'endgame_course' ? 2485 : 2353
      if (forceRestart && jumpToIndex === undefined) {
        resetCrashTestReport(state.tacticsCourseCurriculum.value?.crash_test_total ?? defaultTotal)
      }
      const dto = await trainingApi.composeCrashTestSession({
        discipline,
        course_slug: slug,
        force_restart: forceRestart,
        jump_to_index: jumpToIndex,
      })
      deps.applyHydratedSessionAndLaunch(dto)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Crash-Test session')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startCrashTestSession failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function flagCurrentCoursePuzzle(comment: string): Promise<void> {
    if (!authStore.isMo3ep) {
      throw new Error(
        '[TrainingSessionStore] Course QA flagging is restricted to developer (mo3ep). Fail-Fast!',
      )
    }
    const sess = state.hydratedSession.value
    const item = state.currentItem.value
    if (!sess || !item) return

    state.isFlaggingPuzzle.value = true
    state.error.value = null
    try {
      const lastStep = state.runtime.getLastBlunderSpyStep()
      const gameHistory = captureCurrentGameMoveHistory()
      recordCrashTestAnomaly({
        type: 'manual_flag',
        puzzle_id: item.puzzle_id,
        course_slug: item.course_puzzle?.course_slug,
        global_batch_id: item.course_puzzle?.global_batch_id,
        batch_id: item.course_puzzle?.batch_id,
        index_in_session: item.index,
        domain: item.course_puzzle?.domain,
        class: item.course_puzzle?.class,
        objective: item.course_puzzle?.objective,
        initial_fen: item.course_puzzle?.tactical_fen || '',
        current_fen: boardStore.fen,
        played_moves_uci: lastStep?.playedMovesUci ?? [],
        ...gameHistory,
        canonical_solution: item.course_puzzle?.tactical_solution,
        error_message: comment.trim() || 'Помечено во время прохождения',
      })

      const updatedSession = await trainingApi.flagCoursePuzzle({
        puzzle_id: item.puzzle_id,
        comment: comment.trim() || 'Помечено во время прохождения',
        session_id: sess.session.id,
      })

      if (item.status === 'pending') {
        deps.consumeElapsedTimeMs()
        item.status = 'failed'
      }
      if (updatedSession) {
        sess.session = updatedSession
      }

      void deps.fetchTacticsCourseCurriculum()
      deps.advanceAfterAttempt()
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to flag puzzle')
      state.error.value = msg
      logger.error('[TrainingSessionStore] flagCurrentCoursePuzzle failed:', err)
      throw err
    } finally {
      state.isFlaggingPuzzle.value = false
    }
  }

  return {
    isCrashtestActiveForSession,
    handleCrashTestBlunderSpyStep,
    recordCrashTestOutcomeIfActive,
    recordCrashTestSubmitError,
    startCrashTestSession,
    flagCurrentCoursePuzzle,
  }
}
