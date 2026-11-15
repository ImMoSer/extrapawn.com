import type {
  BlunderSpyStepTelemetry,
  PuzzleAttemptTelemetry,
  PuzzlePuzzle,
} from '@/entities/game'
import {
  resolveBotEngineForDifficulty,
  validateBotLadderEngine,
  type AttemptResultDTO,
  type BotLadderEngineId,
  type CourseDTO,
  type DisciplineOverviewDTO,
  type HubOverviewDTO,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
  type TrainingDifficulty,
  type TrainingDiscipline,
} from '@/entities/training'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  canRestartDuringPlay,
  canRestartFromRetryPrompt,
  getCurrentAttemptNumber,
  getItemAttemptsUsed,
} from '../lib/sessionItemPolicy'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'
import { computeSessionReportSummary } from './buildSessionReport'
import {
  formatDurationMs,
  type InspectionReturnState,
  type PracticeFeedbackState,
  type RetryBoardSnapshot,
  type SessionReportSummary,
  type TrainingSessionSharedState,
  type TrainingViewState,
} from './trainingSession.types'
import { useAttemptControls } from './useAttemptControls'
import { useCrashTestActions } from './useCrashTestActions'
import { useGameplayLifecycle } from './useGameplayLifecycle'
import { useHubAndCurriculumActions } from './useHubAndCurriculumActions'
import { useInspectionAndReplay } from './useInspectionAndReplay'
import { usePuzzleClock } from './usePuzzleClock'

export type { PracticeFeedbackState, SessionReportSummary, TrainingViewState }

export const useTrainingSessionStore = defineStore('trainingSession', () => {
  const overview = ref<HubOverviewDTO | null>(null)
  const courseHistory = ref<CourseDTO[]>([])
  const tacticsCourseCurriculum = ref<TacticsCourseCurriculumDTO | null>(null)
  const activeCourseSlug = ref<TacticsCourseSlug>('tactics_classical_1')
  const activeDiscipline = ref<TrainingDiscipline>('tactics')
  const viewState = ref<TrainingViewState>('hub')

  const hydratedSession = ref<HydratedSessionDTO | null>(null)
  const currentItemIndex = ref<number>(0)

  const isLoadingOverview = ref<boolean>(false)
  const isLoadingCurriculum = ref<boolean>(false)
  const isStartingSession = ref<boolean>(false)
  const isSubmittingAttempt = ref<boolean>(false)
  const isPersistingRetry = ref<boolean>(false)
  const isFlaggingPuzzle = ref<boolean>(false)
  const error = ref<string | null>(null)
  const feedbackMessage = ref<string | null>(null)

  const lastAttemptResult = ref<AttemptResultDTO | null>(null)
  const lastAttemptTelemetry = ref<PuzzleAttemptTelemetry | null>(null)
  const sessionAttemptResults = ref<Record<string, AttemptResultDTO>>({})
  const promotionBannerTier = ref<TrainingDifficulty | null>(null)
  const runningSessionTimeMs = ref<number>(0)

  const analysisPuzzle = ref<PuzzlePuzzle | null>(null)
  const practicePuzzle = ref<PuzzlePuzzle | null>(null)
  const practiceFeedbackState = ref<PracticeFeedbackState>('idle')
  const currentPuzzleUserMoves = ref<number>(0)
  const analysisReturnState = ref<InspectionReturnState>('awaiting_next')

  let activePlayToken = 0
  let savedRetrySnapshot: RetryBoardSnapshot | null = null
  let lastBlunderSpyStep: BlunderSpyStepTelemetry | null = null
  const itemByPuzzleId = new Map<string, HydratedSessionItem>()

  const clock = usePuzzleClock(viewState)

  const activeDisciplineOverview = computed<DisciplineOverviewDTO | null>(() => {
    if (!overview.value) return null
    return overview.value.disciplines[activeDiscipline.value] ?? null
  })

  const activeSessionSummary = computed<SessionSummaryDTO | null>(
    () => hydratedSession.value?.session ?? null,
  )

  const sessionItems = computed<HydratedSessionItem[]>(() => hydratedSession.value?.items ?? [])

  const currentItem = computed<HydratedSessionItem | null>(() => {
    const items = sessionItems.value
    if (currentItemIndex.value < 0 || currentItemIndex.value >= items.length) {
      return null
    }
    return items[currentItemIndex.value] ?? null
  })

  const currentPuzzle = computed<PuzzlePuzzle | null>(() => {
    const sess = hydratedSession.value
    const item = currentItem.value
    if (!sess || !item) return null
    return adaptSessionItemToPuzzle(sess.session.discipline, item)
  })

  const activeBotEngine = computed<BotLadderEngineId>(() => {
    if (activeSessionSummary.value) {
      return validateBotLadderEngine(activeSessionSummary.value.bot_engine)
    }
    const tier = activeDisciplineOverview.value?.unlocked_tier ?? 'Novice'
    return resolveBotEngineForDifficulty(tier)
  })

  const isPlaying = computed<boolean>(() => viewState.value === 'playing')
  const isAwaitingRetry = computed<boolean>(() => viewState.value === 'awaiting_retry')
  const isAwaitingNext = computed<boolean>(() => viewState.value === 'awaiting_next')
  const isPracticeReplay = computed<boolean>(() => viewState.value === 'practice_replay')
  const isAnalysisMode = computed<boolean>(() => viewState.value === 'analyzing')
  const isFinished = computed<boolean>(() => viewState.value === 'report')
  const isBoardSessionActive = computed<boolean>(
    () => viewState.value !== 'hub' && viewState.value !== 'report',
  )

  const currentAttemptsUsed = computed<number>(() => getItemAttemptsUsed(currentItem.value))
  const currentAttemptNumber = computed<number>(() => getCurrentAttemptNumber(currentItem.value))
  const displayAttemptNumber = computed<number>(() =>
    viewState.value === 'awaiting_retry'
      ? Math.max(1, getItemAttemptsUsed(currentItem.value))
      : getCurrentAttemptNumber(currentItem.value),
  )

  const canRestartCurrentPuzzle = computed<boolean>(() => {
    if (isSubmittingAttempt.value || isPersistingRetry.value) return false
    if (viewState.value === 'practice_replay') return Boolean(practicePuzzle.value)
    if (viewState.value === 'awaiting_retry') return canRestartFromRetryPrompt(currentItem.value)
    if (viewState.value === 'playing') {
      return canRestartDuringPlay(currentItem.value, currentPuzzleUserMoves.value)
    }
    return false
  })

  const canResignCurrentPuzzle = computed<boolean>(() => {
    if (isSubmittingAttempt.value || isPersistingRetry.value) return false
    return (
      (viewState.value === 'playing' || viewState.value === 'awaiting_retry') &&
      currentItem.value?.status === 'pending'
    )
  })

  const canSwitchSidebarItem = computed<boolean>(
    () =>
      !(
        viewState.value === 'playing' &&
        currentItem.value?.status === 'pending' &&
        currentPuzzleUserMoves.value > 0
      ),
  )

  const sessionReportSummary = computed<SessionReportSummary | null>(() =>
    computeSessionReportSummary(
      hydratedSession.value,
      runningSessionTimeMs.value,
      sessionAttemptResults.value,
    ),
  )

  const sharedState: TrainingSessionSharedState = {
    overview,
    courseHistory,
    tacticsCourseCurriculum,
    activeCourseSlug,
    activeDiscipline,
    viewState,
    hydratedSession,
    currentItemIndex,
    isLoadingOverview,
    isLoadingCurriculum,
    isStartingSession,
    isSubmittingAttempt,
    isPersistingRetry,
    isFlaggingPuzzle,
    error,
    feedbackMessage,
    lastAttemptResult,
    lastAttemptTelemetry,
    sessionAttemptResults,
    promotionBannerTier,
    runningSessionTimeMs,
    analysisPuzzle,
    practicePuzzle,
    practiceFeedbackState,
    currentPuzzleUserMoves,
    analysisReturnState,
    currentItem,
    itemByPuzzleId,
    runtime: {
      nextPlayToken: () => {
        activePlayToken += 1
        return activePlayToken
      },
      getPlayToken: () => activePlayToken,
      getSavedRetrySnapshot: () => savedRetrySnapshot,
      setSavedRetrySnapshot: (snapshot) => {
        savedRetrySnapshot = snapshot
      },
      getLastBlunderSpyStep: () => lastBlunderSpyStep,
      setLastBlunderSpyStep: (step) => {
        lastBlunderSpyStep = step
      },
    },
  }

  const hubActions = useHubAndCurriculumActions({
    state: sharedState,
    clock,
    applyHydratedSessionAndLaunch: (dto) => gameplay.applyHydratedSessionAndLaunch(dto),
  })

  const crashTest = useCrashTestActions({
    state: sharedState,
    consumeElapsedTimeMs: clock.consumeElapsedTimeMs,
    applyHydratedSessionAndLaunch: (dto) => gameplay.applyHydratedSessionAndLaunch(dto),
    advanceAfterAttempt: () => gameplay.advanceAfterAttempt(),
    fetchTacticsCourseCurriculum: hubActions.fetchTacticsCourseCurriculum,
  })

  const inspection = useInspectionAndReplay({
    state: sharedState,
    clock,
    syncBotLadderForSession: (summary) => gameplay.syncBotLadderForSession(summary),
    launchCurrentPuzzle: (options) => gameplay.launchCurrentPuzzle(options),
    advanceAfterAttempt: () => gameplay.advanceAfterAttempt(),
  })

  const attemptControls = useAttemptControls({
    state: sharedState,
    clock,
    launchCurrentPuzzle: (options) => gameplay.launchCurrentPuzzle(options),
    handleAttemptOutcome: (...args) => gameplay.handleAttemptOutcome(...args),
    startPracticeReplay: (puzzleId) => inspection.startPracticeReplay(puzzleId),
    fetchOverview: hubActions.fetchOverview,
    fetchTacticsCourseCurriculum: hubActions.fetchTacticsCourseCurriculum,
  })

  const gameplay = useGameplayLifecycle({
    state: sharedState,
    clock,
    crashTest,
    persistItemRetry: attemptControls.persistItemRetry,
    fetchOverview: hubActions.fetchOverview,
    fetchTacticsCourseCurriculum: hubActions.fetchTacticsCourseCurriculum,
  })

  return {
    // State
    overview,
    courseHistory,
    tacticsCourseCurriculum,
    activeCourseSlug,
    activeDiscipline,
    viewState,
    hydratedSession,
    currentItemIndex,
    currentTimeMs: clock.currentTimeMs,
    isLoadingOverview,
    isLoadingCurriculum,
    isStartingSession,
    isSubmittingAttempt,
    isPersistingRetry,
    isFlaggingPuzzle,
    error,
    feedbackMessage,
    lastAttemptResult,
    lastAttemptTelemetry,
    sessionAttemptResults,
    promotionBannerTier,
    analysisPuzzle,
    practicePuzzle,
    practiceFeedbackState,
    currentPuzzleUserMoves,

    // Getters
    activeDisciplineOverview,
    activeSessionSummary,
    sessionItems,
    currentItem,
    currentPuzzle,
    activeBotEngine,
    isPlaying,
    isAwaitingRetry,
    isAwaitingNext,
    isPracticeReplay,
    isAnalysisMode,
    isFinished,
    isBoardSessionActive,
    currentAttemptsUsed,
    currentAttemptNumber,
    displayAttemptNumber,
    canRestartCurrentPuzzle,
    canResignCurrentPuzzle,
    canSwitchSidebarItem,
    sessionReportSummary,

    // Actions
    ...hubActions,
    startCrashTestSession: crashTest.startCrashTestSession,
    flagCurrentCoursePuzzle: crashTest.flagCurrentCoursePuzzle,
    advanceAfterAttempt: gameplay.advanceAfterAttempt,
    restartCurrentPuzzle: attemptControls.restartCurrentPuzzle,
    resignCurrentPuzzle: attemptControls.resignCurrentPuzzle,
    startPracticeReplay: inspection.startPracticeReplay,
    exitPracticeReplay: inspection.exitPracticeReplay,
    enterPuzzleAnalysis: inspection.enterPuzzleAnalysis,
    exitPuzzleAnalysis: inspection.exitPuzzleAnalysis,
    pauseToHub: attemptControls.pauseToHub,
    dismissActiveSession: attemptControls.dismissActiveSession,
    formatDurationMs,
  }
})
