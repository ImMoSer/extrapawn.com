import {
  determineHumanColor,
  GameAudioEngine,
  PuzzleStrategy,
  useBoardStore,
  useGameStore,
  type PuzzleAttemptTelemetry,
} from '@/entities/game'
import {
  isClassicalCourseDiscipline,
  MAX_SANITY_ATTEMPTS,
  resolveBotEngineForDifficulty,
  trainingApi,
  validateBotLadderEngine,
  type AttemptFailStage,
  type BotLadderEngineId,
  type ConsumeItemRetryResponseDTO,
  type HubOverviewDTO,
  type HydratedSessionDTO,
  type HydratedSessionItem,
  type SessionSummaryDTO,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
} from '@/entities/training'
import { usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { markRaw } from 'vue'
import { getItemAttemptsUsed, isSessionItemHydrated } from '../lib/sessionItemPolicy'
import {
  buildEndgameAutomatCallbacks,
  buildEndgameHopelessCallbacks,
} from '../lib/buildAutomatCallbacks'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'
import { findNextPendingIndex } from './buildSessionReport'
import { extractErrorText, type TrainingSessionSharedState } from './trainingSession.types'
import type { useCrashTestActions } from './useCrashTestActions'
import type { PuzzleClockController } from './usePuzzleClock'

interface GameplayLifecycleDependencies {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  crashTest: ReturnType<typeof useCrashTestActions>
  persistItemRetry: (
    sessionId: string,
    item: HydratedSessionItem,
  ) => Promise<ConsumeItemRetryResponseDTO>
  fetchOverview: () => Promise<HubOverviewDTO>
  fetchTacticsCourseCurriculum: (
    courseSlug?: TacticsCourseSlug,
  ) => Promise<TacticsCourseCurriculumDTO>
}

export function useGameplayLifecycle(deps: GameplayLifecycleDependencies) {
  const { state, clock, crashTest } = deps
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const preferencesStore = usePreferencesStore()

  let inFlightAttemptKey: string | null = null

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

  function markRawPayloads(item: HydratedSessionItem): void {
    if (item.course_puzzle) item.course_puzzle = markRaw(item.course_puzzle)
    if (item.tactical) item.tactical = markRaw(item.tactical)
    if (item.endgame) item.endgame = markRaw(item.endgame)
  }

  function mergeHydratedItem(incoming: HydratedSessionItem): void {
    const sess = state.hydratedSession.value
    if (!sess) return
    if (incoming.index < 0 || incoming.index >= sess.items.length) {
      throw new Error(
        `[TrainingSessionStore] Received out-of-bounds hydrated item index=${incoming.index} (session length=${sess.items.length}). Fail-Fast!`,
      )
    }
    markRawPayloads(incoming)
    sess.items[incoming.index] = incoming
    const reactiveSlot = sess.items[incoming.index]
    if (reactiveSlot && reactiveSlot.puzzle_id) {
      state.itemByPuzzleId.set(reactiveSlot.puzzle_id, reactiveSlot)
    }
  }

  function applyHydratedSessionAndLaunch(dto: HydratedSessionDTO): void {
    clock.clearAutoNextTimeout()
    clock.stopTimer()

    if (!dto.items || dto.items.length === 0) {
      throw new Error(
        `[TrainingSessionStore] Hydrated session ${dto.session.id} contains 0 items. Fail-Fast!`,
      )
    }

    syncBotLadderForSession(dto.session)

    state.itemByPuzzleId.clear()
    let initialTotalTimeMs = 0
    for (const item of dto.items) {
      if (typeof item.time_ms === 'number' && item.time_ms > 0) {
        initialTotalTimeMs += item.time_ms
      }
      markRawPayloads(item)
    }
    state.runningSessionTimeMs.value = initialTotalTimeMs

    state.activeDiscipline.value = dto.session.discipline
    state.hydratedSession.value = dto
    for (const reactiveItem of state.hydratedSession.value.items) {
      if (reactiveItem.puzzle_id) {
        state.itemByPuzzleId.set(reactiveItem.puzzle_id, reactiveItem)
      }
    }
    state.lastAttemptResult.value = null
    state.lastAttemptTelemetry.value = null
    state.feedbackMessage.value = null
    state.analysisPuzzle.value = null
    state.practicePuzzle.value = null
    state.practiceFeedbackState.value = 'idle'
    state.currentPuzzleUserMoves.value = 0
    state.runtime.setSavedRetrySnapshot(null)
    state.sessionAttemptResults.value = {}

    const preferredStart =
      dto.session.current_index >= 0 && dto.session.current_index < dto.items.length
        ? dto.session.current_index
        : 0
    const nextPending = findNextPendingIndex(dto.items, preferredStart)

    if (dto.session.is_completed || nextPending === -1) {
      state.currentItemIndex.value = 0
      gameStore.stop()
      state.viewState.value = 'report'
      return
    }

    state.currentItemIndex.value = nextPending
    launchCurrentPuzzle()
  }

  function launchCurrentPuzzle(options?: { preserveTimer?: boolean }): void {
    clock.clearAutoNextTimeout()
    const sess = state.hydratedSession.value
    const item = state.currentItem.value
    if (!sess || !item) {
      throw new Error(
        '[TrainingSessionStore] Cannot launch puzzle without active session item. Fail-Fast!',
      )
    }
    if (item.status !== 'pending') {
      throw new Error(
        `[TrainingSessionStore] Cannot launch non-pending item ${item.puzzle_id ?? `#${item.index}`} (status="${item.status}"). Fail-Fast!`,
      )
    }
    if (!isSessionItemHydrated(item) || !item.puzzle_id) {
      throw new Error(
        `[TrainingSessionStore] Cannot launch unhydrated session item at index ${item.index}. Fail-Fast!`,
      )
    }
    const activePuzzleId = item.puzzle_id

    const botEngine = syncBotLadderForSession(sess.session)
    const puzzle = adaptSessionItemToPuzzle(sess.session.discipline, item)
    const humanColor = determineHumanColor(puzzle)

    const tokenAtLaunch = state.runtime.nextPlayToken()
    state.lastAttemptResult.value = null
    state.lastAttemptTelemetry.value = null
    state.feedbackMessage.value = null
    state.analysisPuzzle.value = null
    state.practicePuzzle.value = null
    state.practiceFeedbackState.value = 'idle'
    state.currentPuzzleUserMoves.value = 0
    state.automatPrompt.value = null
    state.automatRemainingMoves.value = null
    state.hopelessPrompt.value = null
    state.runtime.setSavedRetrySnapshot(null)

    const strategy = new PuzzleStrategy(puzzle, humanColor, sess.session.discipline, {
      planId: sess.session.id.slice(0, 12),
      botEngineOverride: botEngine,
      delays: preferencesStore.preferences.delays,
      automat: buildEndgameAutomatCallbacks({
        state,
        clock,
        preferencesStore,
        isCrashtest: () => crashTest.isCrashtestActiveForSession(sess.session),
        pauseClock: true,
      }),
      hopeless: buildEndgameHopelessCallbacks({
        state,
        clock,
        isCrashtest: () => crashTest.isCrashtestActiveForSession(sess.session),
        pauseClock: true,
      }),
      onUserMovePlayed: (userMovesCount: number) => {
        if (state.runtime.getPlayToken() === tokenAtLaunch) {
          state.currentPuzzleUserMoves.value = userMovesCount
        }
      },
      onFeedback: (msg: string) => {
        if (state.runtime.getPlayToken() === tokenAtLaunch) {
          state.feedbackMessage.value = msg
        }
      },
      onSuccess: async (reason?: string, telemetry?: PuzzleAttemptTelemetry) => {
        if (state.runtime.getPlayToken() !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage: 'none',
          outcomeReason: reason ?? 'solved',
        }
        const attemptsUsedOnSolve = Math.min(MAX_SANITY_ATTEMPTS, getItemAttemptsUsed(item) + 1)
        await handleAttemptOutcome(
          tokenAtLaunch,
          sess.session.id,
          activePuzzleId,
          true,
          resolvedTelemetry,
          attemptsUsedOnSolve,
        )
      },
      onFailure: async (telemetry?: PuzzleAttemptTelemetry) => {
        if (state.runtime.getPlayToken() !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage: puzzle.strategy === 'scenarioOnly' ? 'scenario' : 'playout',
          outcomeReason: 'failed',
        }

        const isCrashtestMode = crashTest.isCrashtestActiveForSession(sess.session)
        const nextSpentAttempts = Math.min(MAX_SANITY_ATTEMPTS, getItemAttemptsUsed(item) + 1)

        if (!isCrashtestMode && nextSpentAttempts < MAX_SANITY_ATTEMPTS) {
          clock.pauseTimer()
          GameAudioEngine.playFeatureError()
          item.attempts_used = nextSpentAttempts
          state.lastAttemptTelemetry.value = resolvedTelemetry
          state.runtime.setSavedRetrySnapshot({
            puzzleId: activePuzzleId,
            fen: boardStore.fen,
            orientation: humanColor,
          })
          state.viewState.value = 'awaiting_retry'
          await deps.persistItemRetry(sess.session.id, item)
          return
        }

        await handleAttemptOutcome(
          tokenAtLaunch,
          sess.session.id,
          activePuzzleId,
          false,
          resolvedTelemetry,
          nextSpentAttempts,
        )
      },
    })

    state.viewState.value = 'playing'
    gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor)
    if (options?.preserveTimer) {
      clock.resumeTimer()
    } else {
      clock.startTimer()
    }
  }

  async function handleAttemptOutcome(
    playToken: number,
    sessionId: string,
    puzzleId: string,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
    attemptsUsedOverride?: number,
    options?: { suppressOutcomeSound?: boolean },
  ): Promise<void> {
    const attemptKey = `${sessionId}:${puzzleId}`
    if (inFlightAttemptKey === attemptKey) return

    const sess = state.hydratedSession.value
    if (!sess || sess.session.id !== sessionId) return
    const targetItem =
      state.itemByPuzzleId.get(puzzleId) ?? sess.items.find((it) => it.puzzle_id === puzzleId)
    if (!targetItem || targetItem.status !== 'pending') return

    inFlightAttemptKey = attemptKey
    state.isSubmittingAttempt.value = true
    state.error.value = null

    const elapsedMs = clock.consumeElapsedTimeMs()
    const failStage: AttemptFailStage = solved ? 'none' : telemetry.failStage

    if (!options?.suppressOutcomeSound) {
      if (solved) GameAudioEngine.playFeatureSuccess()
      else GameAudioEngine.playFeatureError()
    }

    const attemptStartedAt = Date.now()
    const isCrashtestActive = crashTest.isCrashtestActiveForSession(sess.session)

    if (isCrashtestActive) {
      crashTest.recordCrashTestOutcomeIfActive(targetItem, solved, telemetry, elapsedMs)
    }

    try {
      const effectiveAttemptsUsed = Math.max(
        1,
        Math.min(
          MAX_SANITY_ATTEMPTS,
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
          if (attempt >= retryDelaysMs.length) throw submitErr
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
      if (result.resolved_item) {
        mergeHydratedItem(result.resolved_item)
      }
      if (result.next_item) {
        mergeHydratedItem(result.next_item)
      }
      state.runningSessionTimeMs.value += elapsedMs
      sess.session = result.session

      state.lastAttemptResult.value = result
      state.lastAttemptTelemetry.value = telemetry
      if (sess.session.mode !== 'crashtest') {
        state.sessionAttemptResults.value[puzzleId] = result
      }

      if (result.promoted_to_tier) {
        state.promotionBannerTier.value = result.promoted_to_tier
      }

      if (state.overview.value) {
        const discOverview = state.overview.value.disciplines[result.session.discipline]
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

      if (state.runtime.getPlayToken() !== playToken) return

      if (solved || isCrashtestActive) {
        const configuredDelayMs = preferencesStore.preferences.delays.nextPuzzleDelayMs
        const elapsedSinceSubmitMs = Math.max(0, Date.now() - attemptStartedAt)
        const remainingDelayMs = Math.max(0, configuredDelayMs - elapsedSinceSubmitMs)
        if (remainingDelayMs <= 0) {
          advanceAfterAttempt()
        } else {
          clock.scheduleAutoNext(remainingDelayMs, () => {
            if (state.runtime.getPlayToken() === playToken) {
              advanceAfterAttempt()
            }
          })
        }
      } else {
        state.viewState.value = 'awaiting_next'
      }
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to submit puzzle attempt')
      state.error.value = msg
      logger.error('[TrainingSessionStore] Failed to record attempt:', err)
      if (isCrashtestActive) {
        crashTest.recordCrashTestSubmitError(targetItem, msg)
        targetItem.status = solved ? 'solved' : 'failed'
        targetItem.time_ms = elapsedMs
        if (state.runtime.getPlayToken() === playToken) {
          advanceAfterAttempt()
        }
        return
      }
      throw err
    } finally {
      inFlightAttemptKey = null
      state.isSubmittingAttempt.value = false
    }
  }

  function advanceAfterAttempt(): void {
    clock.clearAutoNextTimeout()
    const sess = state.hydratedSession.value
    if (!sess) {
      state.viewState.value = 'hub'
      return
    }

    const nextPending = findNextPendingIndex(sess.items, state.currentItemIndex.value + 1)
    if (nextPending === -1 || sess.session.is_completed) {
      GameAudioEngine.playSpeedrunFinished()
      gameStore.stop()
      state.viewState.value = 'report'
      void deps.fetchOverview()
      if (isClassicalCourseDiscipline(sess.session.discipline)) {
        void deps.fetchTacticsCourseCurriculum(state.activeCourseSlug.value)
      }
      return
    }

    state.currentItemIndex.value = nextPending
    launchCurrentPuzzle()
  }

  return {
    syncBotLadderForSession,
    mergeHydratedItem,
    applyHydratedSessionAndLaunch,
    launchCurrentPuzzle,
    handleAttemptOutcome,
    advanceAfterAttempt,
  }
}
