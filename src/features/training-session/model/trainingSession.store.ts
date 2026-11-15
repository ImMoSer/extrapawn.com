import {
  determineHumanColor,
  GameAudioEngine,
  PuzzleStrategy,
  useBoardStore,
  useGameStore,
  type BlunderSpyStepTelemetry,
  type PuzzleAttemptTelemetry,
  type PuzzlePuzzle,
} from '@/entities/game'
import {
  isClassicalCourseDiscipline,
  isDisciplineVisibleForUser,
  MAX_PUZZLE_ATTEMPTS,
  resolveBotEngineForDifficulty,
  resolveDisciplineForCourseSlug,
  trainingApi,
  validateBotLadderEngine,
  type AttemptFailStage,
  type AttemptResultDTO,
  type BotLadderEngineId,
  type ConsumeItemRetryResponseDTO,
  type CourseDTO,
  type DisciplineOverviewDTO,
  type HubOverviewDTO,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
  type StartCourseRequest,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingSessionMode,
  type WarmUpSessionRequest,
} from '@/entities/training'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, markRaw, onScopeDispose, ref } from 'vue'
import {
  recordCrashTestAnomaly,
  recordCrashTestPuzzleOutcome,
  recordCrashTestStepHit,
  resetCrashTestReport,
} from '../lib/crashTestReportLogger'
import {
  canAnalyzeSessionItem,
  canPracticeReplayItem,
  canRestartDuringPlay,
  canRestartFromRetryPrompt,
  getCurrentAttemptNumber,
  getItemAttemptsUsed,
} from '../lib/sessionItemPolicy'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'

export type TrainingViewState =
  | 'hub'
  | 'playing'
  | 'awaiting_retry'
  | 'awaiting_next'
  | 'practice_replay'
  | 'analyzing'
  | 'report'

export type PracticeFeedbackState = 'idle' | 'solved' | 'failed'

type InspectionReturnState = 'playing' | 'awaiting_retry' | 'awaiting_next' | 'report'

interface RetryBoardSnapshot {
  puzzleId: string
  fen: string
  orientation: ChessgroundColor
}

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
  const activeCourseSlug = ref<TacticsCourseSlug>('tactics_classical_1')
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
  const runningSessionTimeMs = ref<number>(0)

  const analysisPuzzle = ref<PuzzlePuzzle | null>(null)
  const practicePuzzle = ref<PuzzlePuzzle | null>(null)
  const practiceFeedbackState = ref<PracticeFeedbackState>('idle')
  const currentPuzzleUserMoves = ref<number>(0)
  const isPersistingRetry = ref<boolean>(false)
  const analysisReturnState = ref<InspectionReturnState>('awaiting_next')
  let savedRetrySnapshot: RetryBoardSnapshot | null = null

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
  let lastBlunderSpyStep: BlunderSpyStepTelemetry | null = null
  const itemByPuzzleId = new Map<string, HydratedSessionItem>()

  function captureCurrentGameMoveHistory() {
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

  const sessionReportSummary = computed<SessionReportSummary | null>(() => {
    const sess = hydratedSession.value
    if (!sess) return null

    if (sess.session.mode === 'crashtest' || sess.items.length > 200) {
      const solvedCount = sess.session.solved_count
      const failedCount = sess.session.failed_count
      const totalCount = sess.session.total_count || sess.items.length
      const pendingCount = Math.max(0, totalCount - solvedCount - failedCount)
      const decidedCount = solvedCount + failedCount
      const totalTimeMs = runningSessionTimeMs.value
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
        totalCount,
        solvedCount,
        failedCount,
        pendingCount,
        accuracyPercent,
        totalTimeMs,
        avgTimeMs,
        netGlobalRatingDelta: 0,
        woodpeckerCount: 0,
        woodpeckerSolvedCount: 0,
        woodpeckerGraduatedCount: 0,
        woodpeckerQueuedCount: 0,
        items: sess.items,
      }
    }

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
        if (recorded.woodpecker.action === 'queued' || recorded.woodpecker.action === 'reset') {
          woodpeckerQueuedCount++
        }
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
        `[TrainingSessionStore] Bot Ladder mismatch for session ${summary.id}: difficulty "${summary.difficulty}" (${summary.discipline}) requires "${expectedBot}", got "${serverBot}". Fail-Fast!`,
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

    itemByPuzzleId.clear()
    let initialTotalTimeMs = 0
    for (const item of dto.items) {
      if (typeof item.time_ms === 'number' && item.time_ms > 0) {
        initialTotalTimeMs += item.time_ms
      }
      if (item.course_puzzle) {
        item.course_puzzle = markRaw(item.course_puzzle)
      }
      if (item.tactical) {
        item.tactical = markRaw(item.tactical)
      }
      if (item.endgame) {
        item.endgame = markRaw(item.endgame)
      }
    }
    runningSessionTimeMs.value = initialTotalTimeMs

    activeDiscipline.value = dto.session.discipline
    hydratedSession.value = dto
    for (const reactiveItem of hydratedSession.value.items) {
      itemByPuzzleId.set(reactiveItem.puzzle_id, reactiveItem)
    }
    lastAttemptResult.value = null
    lastAttemptTelemetry.value = null
    feedbackMessage.value = null
    analysisPuzzle.value = null
    practicePuzzle.value = null
    practiceFeedbackState.value = 'idle'
    currentPuzzleUserMoves.value = 0
    savedRetrySnapshot = null
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

  async function persistItemRetry(
    sessionId: string,
    item: HydratedSessionItem,
  ): Promise<ConsumeItemRetryResponseDTO> {
    isPersistingRetry.value = true
    error.value = null
    try {
      const res = await trainingApi.consumeItemRetry(sessionId, item.puzzle_id)
      item.attempts_used = res.attempts_used
      return res
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to persist puzzle retry')
      error.value = msg
      logger.error('[TrainingSessionStore] consumeItemRetry failed:', err)
      throw err
    } finally {
      isPersistingRetry.value = false
    }
  }

  function launchCurrentPuzzle(options?: { preserveTimer?: boolean }): void {
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
    const effectiveBotEngine: BotLadderEngineId = botEngine

    activePlayToken++
    const tokenAtLaunch = activePlayToken
    lastAttemptResult.value = null
    lastAttemptTelemetry.value = null
    feedbackMessage.value = null
    analysisPuzzle.value = null
    practicePuzzle.value = null
    practiceFeedbackState.value = 'idle'
    currentPuzzleUserMoves.value = 0
    savedRetrySnapshot = null
    lastBlunderSpyStep = null

    const strategy = new PuzzleStrategy(puzzle, humanColor, sess.session.discipline, {
      planId: sess.session.id.slice(0, 12),
      botEngineOverride: effectiveBotEngine,
      delays: preferencesStore.preferences.delays,
      onUserMovePlayed: (userMovesCount: number) => {
        if (activePlayToken === tokenAtLaunch) {
          currentPuzzleUserMoves.value = userMovesCount
        }
      },
      onBlunderSpyStep: (stepInfo: BlunderSpyStepTelemetry) => {
        if (activePlayToken !== tokenAtLaunch) return
        lastBlunderSpyStep = stepInfo

        const isCrashtestMode =
          sess.session.mode === 'crashtest' ||
          (authStore.isMo3ep && preferencesStore.preferences.gameplay.global_crashtest)

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
            index_in_session: item.index,
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
      },
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
        const attemptsUsedOnSolve = Math.min(MAX_PUZZLE_ATTEMPTS, getItemAttemptsUsed(item) + 1)
        await handleAttemptOutcome(
          tokenAtLaunch,
          sess.session.id,
          item.puzzle_id,
          true,
          resolvedTelemetry,
          attemptsUsedOnSolve,
        )
      },
      onFailure: async (telemetry?: PuzzleAttemptTelemetry) => {
        if (activePlayToken !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage:
            puzzle.strategy === 'scenarioOnly' || puzzle.strategy === 'blunderSpy'
              ? 'scenario'
              : 'playout',
          outcomeReason: 'failed',
        }

        const isCrashtestMode =
          sess.session.mode === 'crashtest' ||
          (authStore.isMo3ep && preferencesStore.preferences.gameplay.global_crashtest)

        const nextSpentAttempts = Math.min(MAX_PUZZLE_ATTEMPTS, getItemAttemptsUsed(item) + 1)

        if (!isCrashtestMode && nextSpentAttempts < MAX_PUZZLE_ATTEMPTS) {
          pauseTimer()
          GameAudioEngine.playFeatureError()
          item.attempts_used = nextSpentAttempts
          lastAttemptTelemetry.value = resolvedTelemetry
          savedRetrySnapshot = {
            puzzleId: item.puzzle_id,
            fen: boardStore.fen,
            orientation: humanColor,
          }
          viewState.value = 'awaiting_retry'
          await persistItemRetry(sess.session.id, item)
          return
        }

        await handleAttemptOutcome(
          tokenAtLaunch,
          sess.session.id,
          item.puzzle_id,
          false,
          resolvedTelemetry,
          nextSpentAttempts,
        )
      },
    })

    viewState.value = 'playing'
    gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor)
    if (options?.preserveTimer) {
      resumeTimer()
    } else {
      startTimer()
    }
  }

  async function handleAttemptOutcome(
    playToken: number,
    sessionId: string,
    puzzleId: string,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
    attemptsUsedOverride?: number,
  ): Promise<void> {
    const attemptKey = `${sessionId}:${puzzleId}`
    if (inFlightAttemptKey === attemptKey) return

    const sess = hydratedSession.value
    if (!sess || sess.session.id !== sessionId) return
    const targetItem =
      itemByPuzzleId.get(puzzleId) ?? sess.items.find((it) => it.puzzle_id === puzzleId)
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
    const isCrashtestActive =
      sess.session.mode === 'crashtest' ||
      (authStore.isMo3ep && preferencesStore.preferences.gameplay.global_crashtest)

    if (isCrashtestActive) {
      recordCrashTestPuzzleOutcome(puzzleId, targetItem.index, solved)
      if (!solved) {
        const gameHistory = captureCurrentGameMoveHistory()
        recordCrashTestAnomaly({
          type:
            telemetry.outcomeReason === 'blunderspy_api_error'
              ? 'api_error'
              : 'blunder_in_crashtest',
          puzzle_id: puzzleId,
          course_slug: targetItem.course_puzzle?.course_slug,
          global_batch_id: targetItem.course_puzzle?.global_batch_id,
          batch_id: targetItem.course_puzzle?.batch_id,
          index_in_session: targetItem.index,
          domain: targetItem.course_puzzle?.domain,
          class: targetItem.course_puzzle?.class,
          objective: targetItem.course_puzzle?.objective,
          initial_fen: targetItem.course_puzzle?.tactical_fen || '',
          current_fen: lastBlunderSpyStep?.fenBefore || boardStore.fen,
          move_uci: lastBlunderSpyStep?.moveUci,
          user_move_number: lastBlunderSpyStep?.userMoveNumber,
          played_moves_uci: lastBlunderSpyStep?.playedMovesUci ?? [],
          ...gameHistory,
          canonical_solution: targetItem.course_puzzle?.tactical_solution,
          crashtest_engine: preferencesStore.preferences.gameplay.crashtestEngine,
          blunderspy_state: lastBlunderSpyStep?.stateMask,
          blunderspy_reason: telemetry.outcomeReason,
          best_move_uci: lastBlunderSpyStep?.allowedMoves?.[0],
          allowed_moves: lastBlunderSpyStep?.allowedMoves,
          error_message: `Outcome reason: ${telemetry.outcomeReason} (failStage: ${telemetry.failStage}, timeMs: ${elapsedMs})`,
        })
      }
    }

    try {
      const effectiveAttemptsUsed = Math.max(
        1,
        Math.min(
          MAX_PUZZLE_ATTEMPTS,
          attemptsUsedOverride ?? getItemAttemptsUsed(targetItem) + 1,
        ),
      )
      const attemptPayload = {
        puzzle_id: puzzleId,
        solved,
        time_ms: elapsedMs,
        first_move_failed: solved ? false : telemetry.firstMoveFailed,
        fail_stage: failStage,
        attempts_used: effectiveAttemptsUsed,
      }
      const retryDelaysMs = [250, 600, 1200]
      let result: Awaited<ReturnType<typeof trainingApi.submitAttempt>> | null = null
      let lastSubmitErr: unknown = null

      for (let attempt = 0; attempt <= retryDelaysMs.length; attempt++) {
        try {
          result = await trainingApi.submitAttempt(sessionId, attemptPayload)
          break
        } catch (submitErr) {
          lastSubmitErr = submitErr
          if (attempt >= retryDelaysMs.length) {
            throw submitErr
          }
          const waitMs = retryDelaysMs[attempt] ?? 250
          logger.warn(
            `[TrainingSessionStore] Transient submitAttempt error for ${puzzleId} (attempt ${attempt + 1}). Retrying in ${waitMs}ms...`,
            submitErr,
          )
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
      }

      if (!result) {
        throw lastSubmitErr instanceof Error
          ? lastSubmitErr
          : new Error('Failed to submit puzzle attempt')
      }

      targetItem.status = solved ? 'solved' : 'failed'
      targetItem.attempts_used = effectiveAttemptsUsed
      targetItem.time_ms = elapsedMs
      targetItem.rating_delta = result.global_rating_delta
      runningSessionTimeMs.value += elapsedMs
      sess.session = result.session

      lastAttemptResult.value = result
      lastAttemptTelemetry.value = telemetry
      if (sess.session.mode !== 'crashtest') {
        sessionAttemptResults.value[puzzleId] = result
      }

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
      if (isCrashtestActive) {
        const gameHistory = captureCurrentGameMoveHistory()
        recordCrashTestAnomaly({
          type: 'api_error',
          puzzle_id: puzzleId,
          course_slug: targetItem.course_puzzle?.course_slug,
          global_batch_id: targetItem.course_puzzle?.global_batch_id,
          batch_id: targetItem.course_puzzle?.batch_id,
          index_in_session: targetItem.index,
          domain: targetItem.course_puzzle?.domain,
          class: targetItem.course_puzzle?.class,
          objective: targetItem.course_puzzle?.objective,
          initial_fen: targetItem.course_puzzle?.tactical_fen || '',
          current_fen: boardStore.fen,
          played_moves_uci: lastBlunderSpyStep?.playedMovesUci ?? [],
          ...gameHistory,
          canonical_solution: targetItem.course_puzzle?.tactical_solution,
          crashtest_engine: preferencesStore.preferences.gameplay.crashtestEngine,
          error_message: msg,
        })
        targetItem.status = solved ? 'solved' : 'failed'
        targetItem.time_ms = elapsedMs
        if (activePlayToken === playToken) {
          advanceAfterAttempt()
        }
        return
      }
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
      if (isClassicalCourseDiscipline(activeDiscipline.value)) {
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

  async function fetchTacticsCourseCurriculum(
    courseSlug?: TacticsCourseSlug,
  ): Promise<TacticsCourseCurriculumDTO> {
    const slug = courseSlug ?? activeCourseSlug.value
    activeCourseSlug.value = slug
    isLoadingCurriculum.value = true
    try {
      const data = await trainingApi.getTacticsCourseCurriculum(slug)
      tacticsCourseCurriculum.value = data
      return data
    } catch (err) {
      logger.error('[TrainingSessionStore] fetchTacticsCourseCurriculum failed:', err)
      throw err
    } finally {
      isLoadingCurriculum.value = false
    }
  }

  function selectTacticsCourse(courseSlug: TacticsCourseSlug): void {
    activeCourseSlug.value = courseSlug
    void fetchTacticsCourseCurriculum(courseSlug)
  }

  async function resetTacticsCourse(
    courseSlug?: TacticsCourseSlug,
  ): Promise<TacticsCourseCurriculumDTO> {
    const slug = courseSlug ?? activeCourseSlug.value
    activeCourseSlug.value = slug
    isLoadingCurriculum.value = true
    error.value = null
    try {
      const data = await trainingApi.resetTacticsCourse(slug)
      tacticsCourseCurriculum.value = data
      if (
        isClassicalCourseDiscipline(hydratedSession.value?.session.discipline) &&
        hydratedSession.value?.session.mode === 'course'
      ) {
        clearAutoNextTimeout()
        stopTimer()
        hydratedSession.value = null
        gameStore.stop()
        viewState.value = 'hub'
      }
      return data
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to reset Classical Course')
      error.value = msg
      logger.error('[TrainingSessionStore] resetTacticsCourse failed:', err)
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
    if (isClassicalCourseDiscipline(safeDiscipline)) {
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

  async function startClassicalCourseNextStep(
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    const slug = courseSlug ?? activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    activeCourseSlug.value = slug
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'next',
        force_new: false,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course step')
      error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseNextStep failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function startClassicalCourseBatch(
    batchId: number,
    forceNew: boolean = true,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (!Number.isInteger(batchId) || batchId <= 0) {
      throw new Error(
        `[TrainingSessionStore] Invalid Classical Course batchId (${String(batchId)}). Fail-Fast!`,
      )
    }
    const slug = courseSlug ?? activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    activeCourseSlug.value = slug
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'batch',
        batch_id: batchId,
        force_new: forceNew,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course batch')
      error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseBatch failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function startClassicalCourseWoodpecker(
    checkpointId: number,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
      throw new Error(
        `[TrainingSessionStore] Invalid Classical Course Woodpecker checkpointId (${String(checkpointId)}). Fail-Fast!`,
      )
    }
    const slug = courseSlug ?? activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    activeCourseSlug.value = slug
    isStartingSession.value = true
    error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'woodpecker',
        checkpoint_id: checkpointId,
        force_new: true,
      })
      applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course Woodpecker checkpoint')
      error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseWoodpecker failed:', err)
      throw err
    } finally {
      isStartingSession.value = false
    }
  }

  async function startTacticsCourseBatch(
    batchId: number = 0,
    forceNew: boolean = false,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (batchId > 0) {
      return startClassicalCourseBatch(batchId, forceNew, courseSlug)
    }
    return startClassicalCourseNextStep(courseSlug)
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
    const slug = courseSlug ?? activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    isStartingSession.value = true
    error.value = null
    try {
      const defaultTotal = discipline === 'endgame_course' ? 2485 : 2353
      if (forceRestart && jumpToIndex === undefined) {
        resetCrashTestReport(tacticsCourseCurriculum.value?.crash_test_total ?? defaultTotal)
      }
      const dto = await trainingApi.composeCrashTestSession({
        discipline,
        course_slug: slug,
        force_restart: forceRestart,
        jump_to_index: jumpToIndex,
      })
      applyHydratedSessionAndLaunch(dto)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Crash-Test session')
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
        played_moves_uci: lastBlunderSpyStep?.playedMovesUci ?? [],
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
      if (isClassicalCourseDiscipline(sess.session.discipline)) {
        void fetchTacticsCourseCurriculum(activeCourseSlug.value)
      }
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
      for (const rawToken of moves) {
        const uci = rawToken.split('|')[0]?.trim() || ''
        if (!uci) continue
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

  function captureInspectionReturnState(): void {
    if (viewState.value === 'analyzing' || viewState.value === 'practice_replay') {
      return
    }
    if (viewState.value === 'report') {
      analysisReturnState.value = 'report'
      return
    }
    if (viewState.value === 'awaiting_retry') {
      analysisReturnState.value = 'awaiting_retry'
      return
    }
    if (viewState.value === 'playing' && currentItem.value?.status === 'pending') {
      analysisReturnState.value = 'playing'
      return
    }
    analysisReturnState.value = 'awaiting_next'
  }

  function restoreFromInspectionMode(): void {
    analysisPuzzle.value = null
    practicePuzzle.value = null
    practiceFeedbackState.value = 'idle'

    if (analysisReturnState.value === 'report') {
      gameStore.stop()
      viewState.value = 'report'
      return
    }

    if (analysisReturnState.value === 'awaiting_retry' && currentItem.value?.status === 'pending') {
      const sess = hydratedSession.value
      const item = currentItem.value
      if (sess && item) {
        const adapted = adaptSessionItemToPuzzle(sess.session.discipline, item)
        const fallbackOrientation = determineHumanColor(adapted)
        const snap =
          savedRetrySnapshot && savedRetrySnapshot.puzzleId === item.puzzle_id
            ? savedRetrySnapshot
            : { puzzleId: item.puzzle_id, fen: adapted.initial_fen, orientation: fallbackOrientation }
        gameStore.setGamePhase('GAMEOVER')
        boardStore.setupPosition(snap.fen, snap.orientation)
        viewState.value = 'awaiting_retry'
        return
      }
    }

    if (analysisReturnState.value === 'playing' && currentItem.value?.status === 'pending') {
      launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    advanceAfterAttempt()
  }

  async function restartCurrentPuzzle(): Promise<void> {
    clearAutoNextTimeout()

    if (viewState.value === 'practice_replay') {
      if (!practicePuzzle.value) {
        throw new Error(
          '[TrainingSessionStore] Cannot restart practice replay without active practicePuzzle. Fail-Fast!',
        )
      }
      startPracticeReplay(practicePuzzle.value.puzzle_id)
      return
    }

    const sess = hydratedSession.value
    const item = currentItem.value
    if (!sess || !item) {
      throw new Error(
        '[TrainingSessionStore] Cannot restart puzzle without active session item. Fail-Fast!',
      )
    }

    if (viewState.value === 'awaiting_retry') {
      if (!canRestartFromRetryPrompt(item)) {
        throw new Error(
          `[TrainingSessionStore] Cannot restart puzzle "${item.puzzle_id}" from retry prompt (status="${item.status}", attempts_used=${getItemAttemptsUsed(item)}). Fail-Fast!`,
        )
      }
      launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    if (viewState.value === 'playing') {
      if (!canRestartDuringPlay(item, currentPuzzleUserMoves.value)) {
        throw new Error(
          `[TrainingSessionStore] Cannot restart puzzle "${item.puzzle_id}" during play (userMoves=${currentPuzzleUserMoves.value}, attempts_used=${getItemAttemptsUsed(item)}). Fail-Fast!`,
        )
      }
      pauseTimer()
      activePlayToken++
      item.attempts_used = Math.min(MAX_PUZZLE_ATTEMPTS - 1, getItemAttemptsUsed(item) + 1)
      await persistItemRetry(sess.session.id, item)
      launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    throw new Error(
      `[TrainingSessionStore] Cannot restart puzzle in state "${viewState.value}". Fail-Fast!`,
    )
  }

  async function resignCurrentPuzzle(): Promise<void> {
    clearAutoNextTimeout()
    const sess = hydratedSession.value
    const item = currentItem.value
    if (!sess || !item) {
      throw new Error(
        '[TrainingSessionStore] Cannot resign puzzle without active session item. Fail-Fast!',
      )
    }
    if (
      (viewState.value !== 'playing' && viewState.value !== 'awaiting_retry') ||
      item.status !== 'pending'
    ) {
      throw new Error(
        `[TrainingSessionStore] Cannot resign puzzle "${item.puzzle_id}" in state "${viewState.value}" (status="${item.status}"). Fail-Fast!`,
      )
    }

    const wasAwaitingRetry = viewState.value === 'awaiting_retry'
    const attemptsUsedAtResign = wasAwaitingRetry
      ? Math.max(1, getItemAttemptsUsed(item))
      : Math.min(MAX_PUZZLE_ATTEMPTS, getItemAttemptsUsed(item) + 1)

    const puzzle = adaptSessionItemToPuzzle(sess.session.discipline, item)
    const fallbackStage: 'scenario' | 'playout' =
      puzzle.strategy === 'scenarioOnly' || puzzle.strategy === 'blunderSpy'
        ? 'scenario'
        : 'playout'

    const telemetry: PuzzleAttemptTelemetry =
      wasAwaitingRetry && lastAttemptTelemetry.value
        ? {
            ...lastAttemptTelemetry.value,
            outcomeReason: 'resign',
          }
        : {
            firstMoveFailed: currentPuzzleUserMoves.value <= 1,
            failStage: fallbackStage,
            outcomeReason: 'resign',
          }

    activePlayToken++
    const resignToken = activePlayToken
    gameStore.setGamePhase('GAMEOVER')

    await handleAttemptOutcome(
      resignToken,
      sess.session.id,
      item.puzzle_id,
      false,
      telemetry,
      attemptsUsedAtResign,
    )
  }

  function startPracticeReplay(puzzleId?: string): void {
    const sess = hydratedSession.value
    if (!sess) {
      throw new Error(
        '[TrainingSessionStore] Cannot start practice replay without hydrated session. Fail-Fast!',
      )
    }
    if (
      viewState.value === 'playing' &&
      currentItem.value?.status === 'pending' &&
      currentPuzzleUserMoves.value > 0
    ) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play lock: cannot start practice replay while moves are in progress on pending puzzle "${currentItem.value.puzzle_id}". Fail-Fast!`,
      )
    }

    const resolvedId =
      puzzleId ?? practicePuzzle.value?.puzzle_id ?? analysisPuzzle.value?.puzzle_id
    const targetItem = resolvedId
      ? itemByPuzzleId.get(resolvedId) ?? sess.items.find((it) => it.puzzle_id === resolvedId) ?? null
      : currentItem.value

    if (!targetItem) {
      throw new Error(
        `[TrainingSessionStore] Puzzle "${resolvedId ?? ''}" not found in session for practice replay. Fail-Fast!`,
      )
    }
    if (!canPracticeReplayItem(targetItem)) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play violation: cannot practice-replay unsolved puzzle "${targetItem.puzzle_id}" (status="${targetItem.status}"). Fail-Fast!`,
      )
    }

    clearAutoNextTimeout()
    pauseTimer()
    captureInspectionReturnState()

    const botEngine = syncBotLadderForSession(sess.session)
    const adapted = adaptSessionItemToPuzzle(sess.session.discipline, targetItem)
    const humanColor = determineHumanColor(adapted)

    activePlayToken++
    const tokenAtPractice = activePlayToken
    analysisPuzzle.value = null
    practicePuzzle.value = adapted
    practiceFeedbackState.value = 'idle'
    feedbackMessage.value = null

    const strategy = new PuzzleStrategy(adapted, humanColor, sess.session.discipline, {
      planId: `practice-${sess.session.id.slice(0, 8)}`,
      botEngineOverride: botEngine,
      delays: preferencesStore.preferences.delays,
      onFeedback: (msg: string) => {
        if (activePlayToken === tokenAtPractice) {
          feedbackMessage.value = msg
        }
      },
      onSuccess: () => {
        if (activePlayToken !== tokenAtPractice) return
        GameAudioEngine.playFeatureSuccess()
        practiceFeedbackState.value = 'solved'
      },
      onFailure: () => {
        if (activePlayToken !== tokenAtPractice) return
        GameAudioEngine.playFeatureError()
        practiceFeedbackState.value = 'failed'
      },
    })

    viewState.value = 'practice_replay'
    gameStore.startWithStrategy(adapted.initial_fen, strategy, humanColor)
  }

  function exitPracticeReplay(): void {
    activePlayToken++
    restoreFromInspectionMode()
  }

  function enterPuzzleAnalysis(puzzleId?: string, loadCanonicalSolution: boolean = false): void {
    const sess = hydratedSession.value
    if (!sess) {
      throw new Error('[TrainingSessionStore] Cannot enter analysis without hydrated session. Fail-Fast!')
    }
    if (
      viewState.value === 'playing' &&
      currentItem.value?.status === 'pending' &&
      currentPuzzleUserMoves.value > 0
    ) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play lock: cannot enter analysis while moves are in progress on pending puzzle "${currentItem.value.puzzle_id}". Fail-Fast!`,
      )
    }

    const resolvedId =
      puzzleId ?? analysisPuzzle.value?.puzzle_id ?? practicePuzzle.value?.puzzle_id
    const targetItem = resolvedId
      ? itemByPuzzleId.get(resolvedId) ?? sess.items.find((it) => it.puzzle_id === resolvedId) ?? null
      : currentItem.value

    if (!targetItem) {
      throw new Error(
        `[TrainingSessionStore] Puzzle "${resolvedId ?? ''}" not found in current session for analysis. Fail-Fast!`,
      )
    }

    if (!canAnalyzeSessionItem(targetItem)) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play violation: cannot analyze unsolved puzzle "${targetItem.puzzle_id}" (status="${targetItem.status}"). Fail-Fast!`,
      )
    }

    const wasDirectCurrentPostGameOver =
      !puzzleId &&
      !analysisPuzzle.value &&
      !practicePuzzle.value &&
      (viewState.value === 'awaiting_next' ||
        (viewState.value === 'playing' && currentItem.value?.status !== 'pending'))

    clearAutoNextTimeout()
    pauseTimer()
    captureInspectionReturnState()

    activePlayToken++
    practicePuzzle.value = null
    practiceFeedbackState.value = 'idle'

    const adapted = adaptSessionItemToPuzzle(sess.session.discipline, targetItem)
    analysisPuzzle.value = adapted
    viewState.value = 'analyzing'

    // If entering immediately from post-puzzle GAMEOVER without requesting canonical reset,
    // preserve the actual played moves in PGN so the user can inspect their own game first.
    if (!loadCanonicalSolution && wasDirectCurrentPostGameOver) {
      gameStore.enterAnalysisMode()
      gameStore.syncPgnVisualCuesToBoard()
      return
    }

    populateCanonicalSolutionOnBoard(adapted)
  }

  function exitPuzzleAnalysis(): void {
    restoreFromInspectionMode()
  }

  function pauseToHub(): void {
    const wasClassicalCourse = isClassicalCourseDiscipline(hydratedSession.value?.session.discipline)
    clearAutoNextTimeout()
    activePlayToken++
    stopTimer()
    analysisPuzzle.value = null
    practicePuzzle.value = null
    practiceFeedbackState.value = 'idle'
    currentPuzzleUserMoves.value = 0
    savedRetrySnapshot = null
    gameStore.stop()
    viewState.value = 'hub'
    void fetchOverview()
    if (wasClassicalCourse) {
      void fetchTacticsCourseCurriculum(activeCourseSlug.value)
    }
  }

  async function dismissActiveSession(sessionId?: string): Promise<void> {
    const targetId = sessionId ?? hydratedSession.value?.session.id
    if (!targetId) return

    const wasClassicalCourse = isClassicalCourseDiscipline(hydratedSession.value?.session.discipline)
    clearAutoNextTimeout()
    activePlayToken++
    stopTimer()

    try {
      await trainingApi.dismissSession(targetId)
      if (hydratedSession.value?.session.id === targetId) {
        hydratedSession.value = null
        analysisPuzzle.value = null
        practicePuzzle.value = null
        practiceFeedbackState.value = 'idle'
        currentPuzzleUserMoves.value = 0
        savedRetrySnapshot = null
        sessionAttemptResults.value = {}
        gameStore.stop()
        viewState.value = 'hub'
      }
      await fetchOverview()
      if (wasClassicalCourse) {
        await fetchTacticsCourseCurriculum(activeCourseSlug.value)
      }
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
    activeCourseSlug,
    activeDiscipline,
    viewState,
    hydratedSession,
    currentItemIndex,
    currentTimeMs,
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
    fetchOverview,
    fetchTacticsCourseCurriculum,
    selectTacticsCourse,
    resetTacticsCourse,
    fetchCourseHistory,
    selectDiscipline,
    dismissPromotionBanner,
    startCourse,
    abortCourse,
    startOrResumeCourseBatch,
    startClassicalCourseNextStep,
    startClassicalCourseBatch,
    startClassicalCourseWoodpecker,
    startTacticsCourseBatch,
    startCrashTestSession,
    flagCurrentCoursePuzzle,
    startWarmupSession,
    resumeDisciplineSession,
    advanceAfterAttempt,
    restartCurrentPuzzle,
    resignCurrentPuzzle,
    startPracticeReplay,
    exitPracticeReplay,
    enterPuzzleAnalysis,
    exitPuzzleAnalysis,
    pauseToHub,
    dismissActiveSession,
    formatDurationMs,
  }
})

