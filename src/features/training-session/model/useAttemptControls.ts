import type { PuzzleAttemptTelemetry } from '@/entities/game'
import { useGameStore } from '@/entities/game'
import {
  isClassicalCourseDiscipline,
  MAX_SANITY_ATTEMPTS,
  trainingApi,
  type ConsumeItemRetryResponseDTO,
  type HubOverviewDTO,
  type HydratedSessionItem,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
} from '@/entities/training'
import logger from '@/shared/lib/logger'
import {
  canRestartDuringPlay,
  canRestartFromRetryPrompt,
  getItemAttemptsUsed,
} from '../lib/sessionItemPolicy'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'
import { extractErrorText, type TrainingSessionSharedState } from './trainingSession.types'
import type { PuzzleClockController } from './usePuzzleClock'

interface AttemptControlsDependencies {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  launchCurrentPuzzle: (options?: { preserveTimer?: boolean }) => void
  handleAttemptOutcome: (
    playToken: number,
    sessionId: string,
    puzzleId: string,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
    attemptsUsedOverride?: number,
    options?: { suppressOutcomeSound?: boolean },
  ) => Promise<void>
  startPracticeReplay: (puzzleId?: string) => void
  fetchOverview: () => Promise<HubOverviewDTO>
  fetchTacticsCourseCurriculum: (
    courseSlug?: TacticsCourseSlug,
  ) => Promise<TacticsCourseCurriculumDTO>
}

export function useAttemptControls(deps: AttemptControlsDependencies) {
  const { state, clock } = deps
  const gameStore = useGameStore()

  async function persistItemRetry(
    sessionId: string,
    item: HydratedSessionItem,
  ): Promise<ConsumeItemRetryResponseDTO> {
    state.isPersistingRetry.value = true
    state.error.value = null
    try {
      const res = await trainingApi.consumeItemRetry(sessionId, item.puzzle_id)
      item.attempts_used = res.attempts_used
      return res
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to persist puzzle retry')
      state.error.value = msg
      logger.error('[TrainingSessionStore] consumeItemRetry failed:', err)
      throw err
    } finally {
      state.isPersistingRetry.value = false
    }
  }

  async function restartCurrentPuzzle(): Promise<void> {
    clock.clearAutoNextTimeout()

    if (state.viewState.value === 'practice_replay') {
      if (!state.practicePuzzle.value) {
        throw new Error(
          '[TrainingSessionStore] Cannot restart practice replay without active practicePuzzle. Fail-Fast!',
        )
      }
      deps.startPracticeReplay(state.practicePuzzle.value.puzzle_id)
      return
    }

    const sess = state.hydratedSession.value
    const item = state.currentItem.value
    if (!sess || !item) {
      throw new Error(
        '[TrainingSessionStore] Cannot restart puzzle without active session item. Fail-Fast!',
      )
    }

    if (state.viewState.value === 'awaiting_retry') {
      if (!canRestartFromRetryPrompt(item)) {
        throw new Error(
          `[TrainingSessionStore] Cannot restart puzzle "${item.puzzle_id}" from retry prompt (status="${item.status}", attempts_used=${getItemAttemptsUsed(item)}). Fail-Fast!`,
        )
      }
      deps.launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    if (state.viewState.value === 'playing') {
      if (!canRestartDuringPlay(item, state.currentPuzzleUserMoves.value)) {
        throw new Error(
          `[TrainingSessionStore] Cannot restart puzzle "${item.puzzle_id}" during play (userMoves=${state.currentPuzzleUserMoves.value}, attempts_used=${getItemAttemptsUsed(item)}). Fail-Fast!`,
        )
      }
      clock.pauseTimer()
      state.runtime.nextPlayToken()
      item.attempts_used = Math.min(MAX_SANITY_ATTEMPTS - 1, getItemAttemptsUsed(item) + 1)
      await persistItemRetry(sess.session.id, item)
      deps.launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    throw new Error(
      `[TrainingSessionStore] Cannot restart puzzle in state "${state.viewState.value}". Fail-Fast!`,
    )
  }

  async function resignCurrentPuzzle(options?: { suppressOutcomeSound?: boolean }): Promise<void> {
    clock.clearAutoNextTimeout()
    const sess = state.hydratedSession.value
    const item = state.currentItem.value
    if (!sess || !item) {
      throw new Error(
        '[TrainingSessionStore] Cannot resign puzzle without active session item. Fail-Fast!',
      )
    }
    if (
      (state.viewState.value !== 'playing' && state.viewState.value !== 'awaiting_retry') ||
      item.status !== 'pending'
    ) {
      throw new Error(
        `[TrainingSessionStore] Cannot resign puzzle "${item.puzzle_id}" in state "${state.viewState.value}" (status="${item.status}"). Fail-Fast!`,
      )
    }

    const wasAwaitingRetry = state.viewState.value === 'awaiting_retry'
    const attemptsUsedAtResign = wasAwaitingRetry
      ? Math.max(1, getItemAttemptsUsed(item))
      : Math.min(MAX_SANITY_ATTEMPTS, getItemAttemptsUsed(item) + 1)

    const puzzle = adaptSessionItemToPuzzle(sess.session.discipline, item)
    const fallbackStage: 'scenario' | 'playout' =
      puzzle.strategy === 'scenarioOnly' ? 'scenario' : 'playout'

    const telemetry: PuzzleAttemptTelemetry =
      wasAwaitingRetry && state.lastAttemptTelemetry.value
        ? { ...state.lastAttemptTelemetry.value, outcomeReason: 'resign' }
        : {
            firstMoveFailed: state.currentPuzzleUserMoves.value <= 1,
            failStage: fallbackStage,
            outcomeReason: 'resign',
          }

    const resignToken = state.runtime.nextPlayToken()
    gameStore.setGamePhase('GAMEOVER')

    await deps.handleAttemptOutcome(
      resignToken,
      sess.session.id,
      item.puzzle_id,
      false,
      telemetry,
      attemptsUsedAtResign,
      options,
    )
  }

  function pauseToHub(): void {
    const wasClassicalCourse = isClassicalCourseDiscipline(
      state.hydratedSession.value?.session.discipline,
    )
    clock.clearAutoNextTimeout()
    state.runtime.nextPlayToken()
    clock.stopTimer()
    state.analysisPuzzle.value = null
    state.practicePuzzle.value = null
    state.practiceFeedbackState.value = 'idle'
    state.currentPuzzleUserMoves.value = 0
    state.runtime.setSavedRetrySnapshot(null)
    gameStore.stop()
    state.viewState.value = 'hub'
    void deps.fetchOverview()
    if (wasClassicalCourse) {
      void deps.fetchTacticsCourseCurriculum(state.activeCourseSlug.value)
    }
  }

  async function dismissActiveSession(sessionId?: string): Promise<void> {
    const targetId = sessionId ?? state.hydratedSession.value?.session.id
    if (!targetId) return

    const wasClassicalCourse = isClassicalCourseDiscipline(
      state.hydratedSession.value?.session.discipline,
    )
    clock.clearAutoNextTimeout()
    state.runtime.nextPlayToken()
    clock.stopTimer()

    try {
      await trainingApi.dismissSession(targetId)
      if (state.hydratedSession.value?.session.id === targetId) {
        state.hydratedSession.value = null
        state.analysisPuzzle.value = null
        state.practicePuzzle.value = null
        state.practiceFeedbackState.value = 'idle'
        state.currentPuzzleUserMoves.value = 0
        state.runtime.setSavedRetrySnapshot(null)
        state.sessionAttemptResults.value = {}
        gameStore.stop()
        state.viewState.value = 'hub'
      }
      await deps.fetchOverview()
      if (wasClassicalCourse) {
        await deps.fetchTacticsCourseCurriculum(state.activeCourseSlug.value)
      }
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to dismiss session')
      state.error.value = msg
      logger.error('[TrainingSessionStore] dismissActiveSession failed:', err)
      throw err
    }
  }

  return {
    persistItemRetry,
    restartCurrentPuzzle,
    resignCurrentPuzzle,
    pauseToHub,
    dismissActiveSession,
  }
}
