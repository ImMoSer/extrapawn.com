import {
  determineHumanColor,
  GameAudioEngine,
  PuzzleStrategy,
  useBoardStore,
  useGameStore,
  type PuzzleAttemptTelemetry,
  type PuzzlePuzzle,
} from '@/entities/game'
import {
  isDisciplineVisibleForUser,
  resolveBotEngineForDifficulty,
  trainingApi,
  validateBotLadderEngine,
  type AttemptFailStage,
  type AttemptResultDTO,
  type BotLadderEngineId,
  type CourseDTO,
  type DisciplineOverviewDTO,
  type HubOverviewDTO,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
  type StartCourseRequest,
  type TacticsCourseCurriculumDTO,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingSessionMode,
  type WarmUpSessionRequest,
} from '@/entities/training'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'

export type TrainingViewState = 'hub' | 'playing' | 'awaiting_next' | 'analyzing' | 'report'

export interface SessionReportSummary {
  sessionId: string
  discipline: TrainingDiscipline
  mode: TrainingSessionMode
  difficulty: TrainingDifficulty
  botEngine: BotLadderEngineId
  focusGroup: string
  focusKey: string
  totalCount: number
  solvedCount: number
  failedCount: number
  pendingCount: number
  accuracyPercent: number
  totalTimeMs: number
  avgTimeMs: number
  netGlobalRatingDelta: number
  woodpeckerCount: number
  woodpeckerSolvedCount: number
  woodpeckerGraduatedCount: number
  woodpeckerQueuedCount: number
  items: HydratedSessionItem[]
}

const MAX_ATTEMPT_TIME_MS = 3_600_000

function extractErrorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return fallback
}

export const useTrainingSessionStore = defineStore('trainingSession', () => {
  const authStore = useAuthStore()
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const preferencesStore = usePreferencesStore()

  // ==========================================================================
  // Reactive State
  // ==========================================================================

  const overview = ref<HubOverviewDTO | null>(null)
  const courseHistory = ref<CourseDTO[]>([])
  const tacticsCourseCurriculum = ref<TacticsCourseCurriculumDTO | null>(null)
  const activeDiscipline = ref<TrainingDiscipline>('tactics')
  const viewState = ref<TrainingViewState>('hub')

  const hydratedSession = ref<HydratedSessionDTO | null>(null)
  const currentItemIndex = ref<number>(0)

  const isLoadingOverview = ref<boolean>(false)
  const isLoadingCurriculum = ref<boolean>(false)
  const isStartingSession = ref<boolean>(false)
  const isSubmittingAttempt = ref<boolean>(false)
  const isFlaggingPuzzle = ref<boolean>(false)
  const error = ref<string | null>(null)
  const feedbackMessage = ref<string | null>(null)

  const lastAttemptResult = ref<AttemptResultDTO | null>(null)
  const lastAttemptTelemetry = ref<PuzzleAttemptTelemetry | null>(null)
  const sessionAttemptResults = ref<Record<string, AttemptResultDTO>>({})
  const promotionBannerTier = ref<TrainingDifficulty | null>(null)

  const analysisPuzzle = ref<PuzzlePuzzle | null>(null)
  const analysisReturnState = ref<'awaiting_next' | 'report'>('awaiting_next')

  // ==========================================================================
  // Timer & Transition Guards
  // ==========================================================================

  const currentTimeMs = ref<number>(0)
  let timerStartedAt = 0
  let accumulatedBeforePauseMs = 0
  let timerIntervalId: ReturnType<typeof setInterval> | null = null
  let autoNextTimeoutId: ReturnType<typeof setTimeout> | null = null
  let activePlayToken = 0
  let inFlightAttemptKey: string | null = null

  function clearAutoNextTimeout(): void {
    if (autoNextTimeoutId !== null) {
      clearTimeout(autoNextTimeoutId)
      autoNextTimeoutId = null
    }
  }

  function stopTimer(): void {
    if (timerIntervalId !== null) {
      accumulatedBeforePauseMs += Math.max(0, Date.now() - timerStartedAt)
      clearInterval(timerIntervalId)
      timerIntervalId = null
    }
    currentTimeMs.value = Math.min(MAX_ATTEMPT_TIME_MS, accumulatedBeforePauseMs)
  }

  function startTimer(): void {
    stopTimer()
    accumulatedBeforePauseMs = 0
    currentTimeMs.value = 0
    timerStartedAt = Date.now()
    timerIntervalId = setInterval(() => {
      const elapsed = accumulatedBeforePauseMs + Math.max(0, Date.now() - timerStartedAt)
      currentTimeMs.value = Math.min(MAX_ATTEMPT_TIME_MS, elapsed)
    }, 100)
  }

  function pauseTimer(): void {
    if (timerIntervalId !== null) {
      accumulatedBeforePauseMs += Math.max(0, Date.now() - timerStartedAt)
      clearInterval(timerIntervalId)
      timerIntervalId = null
      currentTimeMs.value = Math.min(MAX_ATTEMPT_TIME_MS, accumulatedBeforePauseMs)
    }
  }

  function resumeTimer(): void {
    if (timerIntervalId === null && viewState.value === 'playing') {
      timerStartedAt = Date.now()
      timerIntervalId = setInterval(() => {
        const elapsed = accumulatedBeforePauseMs + Math.max(0, Date.now() - timerStartedAt)
        currentTimeMs.value = Math.min(MAX_ATTEMPT_TIME_MS, elapsed)
      }, 100)
    }
  }

  function consumeElapsedTimeMs(): number {
    stopTimer()
    return Math.min(MAX_ATTEMPT_TIME_MS, Math.max(0, Math.round(currentTimeMs.value)))
  }

  const handleVisibilityChange = (): void => {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      pauseTimer()
    } else if (document.visibilityState === 'visible' && viewState.value === 'playing') {
      resumeTimer()
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  onScopeDispose(() => {
    clearAutoNextTimeout()
    stopTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  // ==========================================================================
  // Computed Getters
  // ==========================================================================

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
  const isAwaitingNext = computed<boolean>(() => viewState.value === 'awaiting_next')
  const isAnalysisMode = computed<boolean>(() => viewState.value === 'analyzing')
  const isFinished = computed<boolean>(() => viewState.value === 'report')

  const sessionReportSummary = computed<SessionReportSummary | null>(() => {
    const sess = hydratedSession.value
    if (!sess) return null

    let solvedCount = 0
    let failedCount = 0
    let pendingCount = 0
    let totalTimeMs = 0
    let netGlobalRatingDelta = 0
    let woodpeckerCount = 0
    let woodpeckerSolvedCount = 0
    let woodpeckerGraduatedCount = 0
    let woodpeckerQueuedCount = 0

    for (const item of sess.items) {
      if (item.status === 'solved') solvedCount++
      else if (item.status === 'failed') failedCount++
      else pendingCount++

      if (typeof item.time_ms === 'number' && item.time_ms > 0) {
        totalTimeMs += item.time_ms
      }
      if (typeof item.rating_delta === 'number') {
        netGlobalRatingDelta += item.rating_delta
      }
      if (item.is_woodpecker) {
        woodpeckerCount++
        if (item.status === 'solved') woodpeckerSolvedCount++
      }

      const recorded = sessionAttemptResults.value[item.puzzle_id]
      if (recorded) {
        if (recorded.woodpecker.action === 'graduated') woodpeckerGraduatedCount++
        if (recorded.woodpecker.action === 'queued') woodpeckerQueuedCount++
      }
    }

    const decidedCount = solvedCount + failedCount
    const accuracyPercent =
      decidedCount > 0 ? Math.round((solvedCount / decidedCount) * 1000) / 10 : 0
    const avgTimeMs = decidedCount > 0 ? Math.round(totalTimeMs / decidedCount) : 0

    return {
      sessionId: sess.session.id,
      discipline: sess.session.discipline,
      mode: sess.session.mode,
      difficulty: sess.session.difficulty,
      botEngine: validateBotLadderEngine(sess.session.bot_engine),
      focusGroup: sess.session.focus_group,
      focusKey: sess.session.focus_key,
      totalCount: sess.items.length,
      solvedCount,
      failedCount,
      pendingCount,
      accuracyPercent,
      totalTimeMs,
      avgTimeMs,
      netGlobalRatingDelta: Math.round(netGlobalRatingDelta * 10) / 10,
      woodpeckerCount,
      woodpeckerSolvedCount,
      woodpeckerGraduatedCount,
      woodpeckerQueuedCount,
      items: sess.items,
    }
  })

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  function syncBotLadderForSession(summary: SessionSummaryDTO): BotLadderEngineId {
    const expectedBot = resolveBotEngineForDifficulty(summary.difficulty)
    const serverBot = validateBotLadderEngine(summary.bot_engine)
    if (serverBot !== expectedBot) {
      throw new Error(
        `[TrainingSessionStore] Bot Ladder mismatch for session ${summary.id}: difficulty "${summary.difficulty}" requires "${expectedBot}", got "${serverBot}". Fail-Fast!`,
      )
    }
    gameStore.setBotEngineId(serverBot)
    return serverBot
  }

  function findNextPendingIndex(items: HydratedSessionItem[], startFrom: number = 0): number {
    for (let i = startFrom; i < items.length; i++) {
      if (items[i]?.status === 'pending') return i
    }
    for (let i = 0; i < startFrom && i < items.length; i++) {
      if (items[i]?.status === 'pending') return i
    }
    return -1
  }

  function applyHydratedSessionAndLaunch(dto: HydratedSessionDTO): void {
    clearAutoNextTimeout()
    stopTimer()

    if (!dto.items || dto.items.length === 0) {
      throw new Error(
        `[TrainingSessionStore] Hydrated session ${dto.session.id} contains 0 items. Fail-Fast!`,
      )
    }

    syncBotLadderForSession(dto.session)

    activeDiscipline.value = dto.session.discipline
    hydratedSession.value = dto
    lastAttemptResult.value = null
    lastAttemptTelemetry.value = null
    feedbackMessage.value = null
    analysisPuzzle.value = null
    sessionAttemptResults.value = {}

    const preferredStart =
      dto.session.current_index >= 0 && dto.session.current_index < dto.items.length
        ? dto.session.current_index
        : 0
    const nextPending = findNextPendingIndex(dto.items, preferredStart)

    if (dto.session.is_completed || nextPending === -1) {
      currentItemIndex.value = 0
      gameStore.stop()
      viewState.value = 'report'
      return
    }

    currentItemIndex.value = nextPending
    launchCurrentPuzzle()
  }

  function launchCurrentPuzzle(): void {
    clearAutoNextTimeout()
    const sess = hydratedSession.value
    const item = currentItem.value
    if (!sess || !item) {
      throw new Error('[TrainingSessionStore] Cannot launch puzzle without active session item. Fail-Fast!')
    }
    if (item.status !== 'pending') {
      throw new Error(
        `[TrainingSessionStore] Cannot launch non-pending item ${item.puzzle_id} (status="${item.status}"). Fail-Fast!`,
      )
    }

    const botEngine = syncBotLadderForSession(sess.session)
    const puzzle = adaptSessionItemToPuzzle(sess.session.discipline, item)
    const humanColor = determineHumanColor(puzzle)

    activePlayToken++
    const tokenAtLaunch = activePlayToken
    lastAttemptResult.value = null
    lastAttemptTelemetry.value = null
    feedbackMessage.value = null
    analysisPuzzle.value = null

    const strategy = new PuzzleStrategy(puzzle, humanColor, sess.session.discipline, {
      planId: sess.session.id.slice(0, 12),
      botEngineOverride: botEngine,
      delays: preferencesStore.preferences.delays,
      onFeedback: (msg: string) => {
        if (activePlayToken === tokenAtLaunch) {
          feedbackMessage.value = msg
        }
      },
      onSuccess: async (reason?: string, telemetry?: PuzzleAttemptTelemetry) => {
        if (activePlayToken !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage: 'none',
          outcomeReason: reason ?? 'solved',
        }
        await handleAttemptOutcome(tokenAtLaunch, sess.session.id, item.puzzle_id, true, resolvedTelemetry)
      },
      onFailure: async (telemetry?: PuzzleAttemptTelemetry) => {
        if (activePlayToken !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage: puzzle.strategy === 'scenarioOnly' ? 'scenario' : 'playout',
          outcomeReason: 'failed',
        }
        await handleAttemptOutcome(tokenAtLaunch, sess.session.id, item.puzzle_id, false, resolvedTelemetry)
      },
    })

    viewState.value = 'playing'
    gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor)
    startTimer()
  }

  async function handleAttemptOutcome(
    playToken: number,
    sessionId: string,
    puzzleId: string,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
  ): Promise<void> {
    const attemptKey = `${sessionId}:${puzzleId}`
    if (inFlightAttemptKey === attemptKey) return

    const sess = hydratedSession.value
    if (!sess || sess.session.id !== sessionId) return
    const targetItem = sess.items.find((it) => it.puzzle_id === puzzleId)
    if (!targetItem || targetItem.status !== 'pending') return

    inFlightAttemptKey = attemptKey
    isSubmittingAttempt.value = true
    error.value = null

    const elapsedMs = consumeElapsedTimeMs()
    const failStage: AttemptFailStage = solved ? 'none' : telemetry.failStage

    if (solved) {
      GameAudioEngine.playFeatureSuccess()
    } else {
      GameAudioEngine.playFeatureError()
    }

    const attemptStartedAt = Date.now()

    try {
      const result = await trainingApi.submitAttempt(sessionId, {
        puzzle_id: puzzleId,
        solved,
        time_ms: elapsedMs,
        first_move_failed: solved ? false : telemetry.firstMoveFailed,
        fail_stage: failStage,
      })

      targetItem.status = solved ? 'solved' : 'failed'
      targetItem.time_ms = elapsedMs
      targetItem.rating_delta = result.global_rating_delta
      sess.session = result.session

      lastAttemptResult.value = result
      lastAttemptTelemetry.value = telemetry
      sessionAttemptResults.value[puzzleId] = result

      if (result.promoted_to_tier) {
        promotionBannerTier.value = result.promoted_to_tier
      }

      // Optimistically update Hub overview if loaded
      if (overview.value) {
        const discOverview = overview.value.disciplines[result.session.discipline]
        if (discOverview) {
          discOverview.global_rating = result.global_rating_after
          if (solved) discOverview.solved_total += 1
          else discOverview.failed_total += 1
          discOverview.active_session = result.session.is_completed ? undefined : result.session
          if (result.course) {
            discOverview.active_course =
              result.course.status === 'active' ? result.course : undefined
          }
          if (result.promoted_to_tier) {
            discOverview.unlocked_tier = result.promoted_to_tier
          }
        }
      }

      if (activePlayToken !== playToken) return

      const isCrashtestActive =
        authStore.isMo3ep && preferencesStore.preferences.gameplay.global_crashtest
      if (solved || isCrashtestActive) {
        const configuredDelayMs = preferencesStore.preferences.delays.nextPuzzleDelayMs
        const elapsedSinceSubmitMs = Math.max(0, Date.now() - attemptStartedAt)
        const remainingDelayMs = Math.max(0, configuredDelayMs - elapsedSinceSubmitMs)
        if (remainingDelayMs <= 0) {
          advanceAfterAttempt()
        } else {
          autoNextTimeoutId = setTimeout(() => {
            autoNextTimeoutId = null
            if (activePlayToken === playToken) {
              advanceAfterAttempt()
            }
          }, remainingDelayMs)
        }
      } else {
        viewState.value = 'awaiting_next'
      }
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to submit puzzle attempt')
      error.value = msg
      logger.error('[TrainingSessionStore] Failed to record attempt:', err)
      throw err
    } finally {
      inFlightAttemptKey = null
      isSubmittingAttempt.value = false
    }
  }

  // ==========================================================================
  // Public Store Actions
  // ==========================================================================

  async function fetchOverview(): Promise<HubOverviewDTO> {
    isLoadingOverview.value = true
    error.value = null
    try {
      const data = await trainingApi.getOverview()
      overview.value = data
      if (!isDisciplineVisibleForUser(activeDiscipline.value, authStore.isMo3ep)) {
        activeDiscipline.value = 'tactics'
      }
      if (activeDiscipline.value === 'tactics_course') {
        void fetchTacticsCourseCurriculum()
      }
      return data
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load Training Center overview')
      error.value = msg
      logger.error('[TrainingSessionStore] fetchOverview failed:', err)
      throw err
    } finally {
      isLoadingOverview.value = false
    }
  }

  async function fetchTacticsCourseCurriculum(): Promise<TacticsCourseCurriculumDTO> {
    isLoadingCurriculum.value = true
    try {
      const data = await trainingApi.getTacticsCourseCurriculum()
      tacticsCourseCurriculum.value = data
      return data
    } catch (err) {
      logger.error('[TrainingSessionStore] fetchTacticsCourseCurriculum failed:', err)
      throw err
    } finally {
      isLoadingCurriculum.value = false
    }
  }

  async function fetchCourseHistory(limit: number = 25): Promise<CourseDTO[]> {
    error.value = null
    try {
      const list = await trainingApi.getCourseHistory(limit)
      courseHistory.value = list
      return list
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load course history')
      error.value = msg
      logger.error('[TrainingSessionStore] fetchCourseHistory failed:', err)
      throw err
    }
  }

  function selectDiscipline(discipline: TrainingDiscipline): void {
    const safeDiscipline = isDisciplineVisibleForUser(discipline, authStore.isMo3ep)
      ? discipline
      : 'tactics'
    activeDiscipline.value = safeDiscipline
    if (safeDiscipline === 'tactics_course') {
      void fetchTacticsCourseCurriculum()
    }
  }

  function dismissPromotionBanner(): void {
    promotionBannerTier.value = null
  }

  async function startCourse(payload: StartCourseRequest): Promise<CourseDTO> {
    error.value = null
    try {
      const course = await trainingApi.startCourse(payload)
      activeDiscipline.value = payload.discipline
      await fetchOverview()
      return course
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start course')
      error.value = msg
      logger.error('[TrainingSessionStore] startCourse failed:', err)
      throw err
    }
  }

  async function abortCourse(courseId: string): Promise<CourseDTO> {
    error.value = null
    try {
      const aborted = await trainingApi.abortCourse(courseId)
      if (hydratedSession.value?.session.course_id === courseId) {
        clearAutoNextTimeout()
        stopTimer()
        hydratedSession.value = null
        gameStore.stop()
        viewState.value = 'hub'
      }
      await fetchOverview()
      return aborted
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to abort course')
      error.value = msg
      logger.error('[TrainingSessionStore] abortCourse failed:', err)
      throw err
    }
  }

  async function startOrResumeCourseBatch(
    discipline: TrainingDiscipline,
    batchSize?: number,
    forceNew: boolean = false,
  ): Promise<HydratedSessionDTO> {
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        batch_size: batchSize,
        force_new: forceNew,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to compose course batch session')
      error.value = msg
      logger.error('[TrainingSessionStore] startOrResumeCourseBatch failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function startTacticsCourseBatch(
    batchId: number = 0,
    forceNew: boolean = false,
  ): Promise<HydratedSessionDTO> {
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline: 'tactics_course',
        batch_size: batchId,
        force_new: forceNew,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course batch')
      error.value = msg
      logger.error('[TrainingSessionStore] startTacticsCourseBatch failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function startCrashTestSession(
    forceRestart: boolean = false,
    jumpToIndex?: number,
  ): Promise<HydratedSessionDTO> {
    if (!authStore.isMo3ep) {
      throw new Error(
        '[TrainingSessionStore] Crash-Test mode is restricted to developer (mo3ep). Fail-Fast!',
      )
    }
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCrashTestSession({
        force_restart: forceRestart,
        jump_to_index: jumpToIndex,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Crash-Test (3822) session')
      error.value = msg
      logger.error('[TrainingSessionStore] startCrashTestSession failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function flagCurrentCoursePuzzle(comment: string): Promise<void> {
    if (!authStore.isMo3ep) {
      throw new Error(
        '[TrainingSessionStore] Course QA flagging is restricted to developer (mo3ep). Fail-Fast!',
      )
    }
    const sess = hydratedSession.value
    const item = currentItem.value
    if (!sess || !item) return

    isFlaggingPuzzle.value = true
    error.value = null
    try {
      const updatedSession = await trainingApi.flagCoursePuzzle({
        puzzle_id: item.puzzle_id,
        comment: comment.trim() || 'Помечено во время прохождения',
        session_id: sess.session.id,
      })

      if (item.status === 'pending') {
        consumeElapsedTimeMs()
        item.status = 'failed'
      }
      if (updatedSession) {
        sess.session = updatedSession
      }

      void fetchTacticsCourseCurriculum()
      advanceAfterAttempt()
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to flag puzzle')
      error.value = msg
      logger.error('[TrainingSessionStore] flagCurrentCoursePuzzle failed:', err)
      throw err
    } finally {
      isFlaggingPuzzle.value = false
    }
  }

  async function startWarmupSession(payload: WarmUpSessionRequest): Promise<HydratedSessionDTO> {
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeWarmupSession(payload)
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to compose WarmUp session')
      error.value = msg
      logger.error('[TrainingSessionStore] startWarmupSession failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function resumeDisciplineSession(
    discipline: TrainingDiscipline,
  ): Promise<HydratedSessionDTO | null> {
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.getActiveSession(discipline)
      if (!dto) {
        return null
      }
      applyHydratedSessionAndLaunch(dto)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load active session')
      error.value = msg
      logger.error('[TrainingSessionStore] resumeDisciplineSession failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  function advanceAfterAttempt(): void {
    clearAutoNextTimeout()
    const sess = hydratedSession.value
    if (!sess) {
      viewState.value = 'hub'
      return
    }

    const nextPending = findNextPendingIndex(sess.items, currentItemIndex.value + 1)
    if (nextPending === -1 || sess.session.is_completed) {
      GameAudioEngine.playSpeedrunFinished()
      gameStore.stop()
      viewState.value = 'report'
      void fetchOverview()
      return
    }

    currentItemIndex.value = nextPending
    launchCurrentPuzzle()
  }

  function populateCanonicalSolutionOnBoard(puzzle: PuzzlePuzzle): void {
    const humanColor = determineHumanColor(puzzle)
    gameStore.enterAnalysisMode()
    boardStore.setupPosition(puzzle.initial_fen, humanColor)
    pgnService.reset(puzzle.initial_fen)

    if (puzzle.tactical_solution) {
      const moves = puzzle.tactical_solution.trim().split(/\s+/).filter(Boolean)
      for (const uci of moves) {
        const posBefore = boardStore.chessPosition.clone()
        const parsed = parseUci(uci)
        if (!parsed) continue
        const san = makeSan(posBefore, parsed)
        const fenBefore = boardStore.fen
        const applied = boardStore.applyUciMove(uci, { skipSound: true })
        if (applied) {
          const fenAfter = boardStore.fen
          pgnService.addNode({ san, uci, fenBefore, fenAfter })
        }
      }
      pgnService.navigateToStart()
      boardStore.loadPosition(pgnService.getCurrentNavigatedFen())
    }

    gameStore.syncPgnVisualCuesToBoard()
  }

  function enterPuzzleAnalysis(puzzleId?: string, loadCanonicalSolution: boolean = false): void {
    clearAutoNextTimeout()
    stopTimer()

    const sess = hydratedSession.value
    if (!sess) {
      throw new Error('[TrainingSessionStore] Cannot enter analysis without hydrated session. Fail-Fast!')
    }

    analysisReturnState.value = viewState.value === 'report' ? 'report' : 'awaiting_next'

    const targetItem = puzzleId
      ? sess.items.find((it) => it.puzzle_id === puzzleId) ?? null
      : currentItem.value

    if (!targetItem) {
      throw new Error(
        `[TrainingSessionStore] Puzzle "${puzzleId ?? ''}" not found in current session for analysis. Fail-Fast!`,
      )
    }

    const adapted = adaptSessionItemToPuzzle(sess.session.discipline, targetItem)
    analysisPuzzle.value = adapted
    viewState.value = 'analyzing'

    // If entering immediately from post-puzzle GAMEOVER without requesting canonical reset,
    // preserve the actual played moves in PGN so the user can inspect their own game first.
    if (!puzzleId && !loadCanonicalSolution && analysisReturnState.value === 'awaiting_next') {
      gameStore.enterAnalysisMode()
      gameStore.syncPgnVisualCuesToBoard()
      return
    }

    populateCanonicalSolutionOnBoard(adapted)
  }

  function exitPuzzleAnalysis(): void {
    analysisPuzzle.value = null
    if (analysisReturnState.value === 'report') {
      gameStore.stop()
      viewState.value = 'report'
      return
    }
    advanceAfterAttempt()
  }

  function pauseToHub(): void {
    clearAutoNextTimeout()
    activePlayToken++
    stopTimer()
    analysisPuzzle.value = null
    gameStore.stop()
    viewState.value = 'hub'
    void fetchOverview()
  }

  async function dismissActiveSession(sessionId?: string): Promise<void> {
    const targetId = sessionId ?? hydratedSession.value?.session.id
    if (!targetId) return

    clearAutoNextTimeout()
    activePlayToken++
    stopTimer()

    try {
      await trainingApi.dismissSession(targetId)
      if (hydratedSession.value?.session.id === targetId) {
        hydratedSession.value = null
        analysisPuzzle.value = null
        sessionAttemptResults.value = {}
        gameStore.stop()
        viewState.value = 'hub'
      }
      await fetchOverview()
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to dismiss session')
      error.value = msg
      logger.error('[TrainingSessionStore] dismissActiveSession failed:', err)
      throw err
    }
  }

  function formatDurationMs(ms: number | undefined): string {
    if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '--:--.-'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  return {
    // State
    overview,
    courseHistory,
    tacticsCourseCurriculum,
    activeDiscipline,
    viewState,
    hydratedSession,
    currentItemIndex,
    currentTimeMs,
    isLoadingOverview,
    isLoadingCurriculum,
    isStartingSession,
    isSubmittingAttempt,
    isFlaggingPuzzle,
    error,
    feedbackMessage,
    lastAttemptResult,
    lastAttemptTelemetry,
    sessionAttemptResults,
    promotionBannerTier,
    analysisPuzzle,

    // Getters
    activeDisciplineOverview,
    activeSessionSummary,
    sessionItems,
    currentItem,
    currentPuzzle,
    activeBotEngine,
    isPlaying,
    isAwaitingNext,
    isAnalysisMode,
    isFinished,
    sessionReportSummary,

    // Actions
    fetchOverview,
    fetchTacticsCourseCurriculum,
    fetchCourseHistory,
    selectDiscipline,
    dismissPromotionBanner,
    startCourse,
    abortCourse,
    startOrResumeCourseBatch,
    startTacticsCourseBatch,
    startCrashTestSession,
    flagCurrentCoursePuzzle,
    startWarmupSession,
    resumeDisciplineSession,
    advanceAfterAttempt,
    enterPuzzleAnalysis,
    exitPuzzleAnalysis,
    pauseToHub,
    dismissActiveSession,
    formatDurationMs,
  }
})

