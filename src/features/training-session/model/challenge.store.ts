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
  resolveBotEngineForDifficulty,
  trainingApi,
  validateBotLadderEngine,
  type BotLadderEngineId,
  type ChallengeParticipantDTO,
  type ChallengeStateDTO,
  type TrainingDiscipline,
} from '@/entities/training'
import { usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { adaptChallengeStateToPuzzle } from '../lib/sessionPuzzleAdapter'

export type ChallengeViewState =
  | 'loading'
  | 'playing'
  | 'attempt_failed'
  | 'solved'
  | 'surrendered'
  | 'analyzing'
  | 'error'

const MAX_ATTEMPT_TIME_MS = 3_600_000

function extractErrorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return fallback
}

export const useChallengeStore = defineStore('challenge', () => {
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const preferencesStore = usePreferencesStore()

  // ==========================================================================
  // Reactive State
  // ==========================================================================

  const challengeState = ref<ChallengeStateDTO | null>(null)
  const viewState = ref<ChallengeViewState>('loading')
  const isSubmitting = ref<boolean>(false)
  const error = ref<string | null>(null)
  const feedbackMessage = ref<string | null>(null)
  const lastTelemetry = ref<PuzzleAttemptTelemetry | null>(null)
  const selectedUserId = ref<string | null>(null)

  const currentTimeMs = ref<number>(0)
  let timerStartedAt = 0
  let accumulatedBeforePauseMs = 0
  let timerIntervalId: ReturnType<typeof setInterval> | null = null
  let activePlayToken = 0
  let inFlightAttempt = false

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
    stopTimer()
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  })

  // ==========================================================================
  // Computed Getters
  // ==========================================================================

  const currentPuzzle = computed<PuzzlePuzzle | null>(() => {
    if (!challengeState.value) return null
    return adaptChallengeStateToPuzzle(challengeState.value)
  })

  const myEntry = computed<ChallengeParticipantDTO | null>(
    () => challengeState.value?.my_entry ?? null,
  )

  const leaderboard = computed<ChallengeParticipantDTO[]>(
    () => challengeState.value?.leaderboard ?? [],
  )

  const selectedParticipant = computed<ChallengeParticipantDTO | null>(() => {
    if (!selectedUserId.value) return null
    return leaderboard.value.find((p) => p.user_id === selectedUserId.value && p.solved) ?? null
  })

  const activeBotEngine = computed<BotLadderEngineId>(() => {
    if (challengeState.value) {
      return validateBotLadderEngine(challengeState.value.bot_engine)
    }
    return 'maia-1500'
  })

  const isPlaying = computed<boolean>(() => viewState.value === 'playing')
  const isAttemptFailed = computed<boolean>(() => viewState.value === 'attempt_failed')
  const isSolved = computed<boolean>(() => myEntry.value?.status === 'solved')
  const isSurrendered = computed<boolean>(() => myEntry.value?.status === 'surrendered')
  const isFinalized = computed<boolean>(() => isSolved.value || isSurrendered.value)
  const isAnalysisMode = computed<boolean>(() => viewState.value === 'analyzing')

  // ==========================================================================
  // Internal Helpers
  // ==========================================================================

  function syncBotLadder(state: ChallengeStateDTO): BotLadderEngineId {
    const expectedBot = resolveBotEngineForDifficulty(state.difficulty, state.discipline)
    const serverBot = validateBotLadderEngine(state.bot_engine)
    if (serverBot !== expectedBot) {
      throw new Error(
        `[ChallengeStore] Bot Ladder mismatch for challenge ${state.puzzle_id}: difficulty "${state.difficulty}" (${state.discipline}) requires "${expectedBot}", got "${serverBot}". Fail-Fast!`,
      )
    }
    gameStore.setBotEngineId(serverBot)
    return serverBot
  }

  function populateMovesOnBoard(puzzle: PuzzlePuzzle, uciMovesStr: string): void {
    const humanColor = determineHumanColor(puzzle)
    gameStore.enterAnalysisMode()
    boardStore.setupPosition(puzzle.initial_fen, humanColor)
    pgnService.reset(puzzle.initial_fen)

    const trimmed = uciMovesStr.trim()
    if (trimmed) {
      const moves = trimmed.split(/\s+/).filter(Boolean)
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

  function populateCanonicalSolutionOnBoard(puzzle: PuzzlePuzzle): void {
    populateMovesOnBoard(puzzle, puzzle.tactical_solution ?? '')
  }

  function selectParticipantSolution(targetUserId: string): boolean {
    if (!isFinalized.value) return false
    const puzzle = currentPuzzle.value
    if (!puzzle) return false

    const normalized = targetUserId.trim().toLowerCase()
    if (!normalized) return false

    const target = leaderboard.value.find(
      (p) =>
        p.solved &&
        (p.user_id.toLowerCase() === normalized || p.username.toLowerCase() === normalized),
    )
    if (!target) return false

    stopTimer()
    selectedUserId.value = target.user_id
    viewState.value = 'analyzing'
    const movesToReplay = target.uci_moves?.trim() || puzzle.tactical_solution?.trim() || ''
    populateMovesOnBoard(puzzle, movesToReplay)
    return true
  }

  function showCanonicalSolution(): void {
    if (!isFinalized.value) return
    const puzzle = currentPuzzle.value
    if (!puzzle) return
    stopTimer()
    selectedUserId.value = null
    viewState.value = 'analyzing'
    populateCanonicalSolutionOnBoard(puzzle)
  }

  function launchAttempt(): void {
    const state = challengeState.value
    const puzzle = currentPuzzle.value
    if (!state || !puzzle) {
      throw new Error('[ChallengeStore] Cannot launch challenge without loaded puzzle. Fail-Fast!')
    }
    if (state.my_entry?.status === 'solved' || state.my_entry?.status === 'surrendered') {
      enterAnalysis(true)
      return
    }

    const botEngine = syncBotLadder(state)
    const humanColor = determineHumanColor(puzzle)

    activePlayToken++
    const tokenAtLaunch = activePlayToken
    feedbackMessage.value = null
    lastTelemetry.value = null

    const strategy = new PuzzleStrategy(puzzle, humanColor, state.discipline, {
      planId: `challenge_${state.puzzle_id}`,
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
        await handleAttemptOutcome(tokenAtLaunch, true, resolvedTelemetry)
      },
      onFailure: async (telemetry?: PuzzleAttemptTelemetry) => {
        if (activePlayToken !== tokenAtLaunch) return
        const resolvedTelemetry: PuzzleAttemptTelemetry = telemetry ?? {
          firstMoveFailed: false,
          failStage: puzzle.strategy === 'scenarioOnly' ? 'scenario' : 'playout',
          outcomeReason: 'failed',
        }
        await handleAttemptOutcome(tokenAtLaunch, false, resolvedTelemetry)
      },
    })

    viewState.value = 'playing'
    gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor)
    startTimer()
  }

  async function handleAttemptOutcome(
    playToken: number,
    solved: boolean,
    telemetry: PuzzleAttemptTelemetry,
  ): Promise<void> {
    if (inFlightAttempt) return
    const state = challengeState.value
    if (!state) return

    inFlightAttempt = true
    isSubmitting.value = true
    error.value = null

    const elapsedMs = consumeElapsedTimeMs()
    lastTelemetry.value = telemetry

    if (solved) {
      GameAudioEngine.playFeatureSuccess()
    } else {
      GameAudioEngine.playFeatureError()
    }

    try {
      const uciMoves = solved ? pgnService.getCurrentUciPath().join(' ').trim() : undefined
      const pgnMoves = solved
        ? pgnService.getCurrentPgnString().replace(/\s+/g, ' ').trim()
        : undefined
      const updated = await trainingApi.submitChallengeAttempt(
        state.discipline,
        state.puzzle_id,
        {
          solved,
          time_ms: elapsedMs,
          ...(uciMoves ? { uci_moves: uciMoves } : {}),
          ...(pgnMoves ? { pgn_moves: pgnMoves } : {}),
        },
        state.edition,
      )
      challengeState.value = updated

      if (activePlayToken !== playToken) return

      if (solved) {
        selectedUserId.value = updated.my_entry?.user_id ?? null
        viewState.value = 'solved'
      } else {
        viewState.value = 'attempt_failed'
      }
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to record challenge attempt')
      error.value = msg
      logger.error('[ChallengeStore] handleAttemptOutcome failed:', err)
      throw err
    } finally {
      inFlightAttempt = false
      isSubmitting.value = false
    }
  }

  // ==========================================================================
  // Public Actions
  // ==========================================================================

  async function loadChallenge(
    discipline: TrainingDiscipline,
    puzzleId: string,
    edition?: string,
    requestedUserId?: string,
  ): Promise<ChallengeStateDTO> {
    stopTimer()
    activePlayToken++
    viewState.value = 'loading'
    error.value = null
    feedbackMessage.value = null
    selectedUserId.value = null

    try {
      const dto = await trainingApi.getChallengeState(discipline, puzzleId, edition)
      challengeState.value = dto
      syncBotLadder(dto)

      if (dto.my_entry?.status === 'solved' || dto.my_entry?.status === 'surrendered') {
        const trimmedTarget = requestedUserId?.trim() ?? ''
        if (trimmedTarget && selectParticipantSolution(trimmedTarget)) {
          return dto
        }
        if (dto.my_entry.status === 'solved' && selectParticipantSolution(dto.my_entry.user_id)) {
          return dto
        }
        enterAnalysis(true)
      } else {
        launchAttempt()
      }
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load challenge puzzle')
      error.value = msg
      viewState.value = 'error'
      logger.error('[ChallengeStore] loadChallenge failed:', err)
      throw err
    }
  }

  function retryChallenge(): void {
    if (isFinalized.value) return
    launchAttempt()
  }

  async function surrenderAndAnalyze(): Promise<void> {
    const state = challengeState.value
    if (!state) return

    stopTimer()
    activePlayToken++
    isSubmitting.value = true
    error.value = null

    try {
      const updated = await trainingApi.surrenderChallenge(
        state.discipline,
        state.puzzle_id,
        state.edition,
      )
      challengeState.value = updated
      enterAnalysis(false)
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to surrender challenge')
      error.value = msg
      logger.error('[ChallengeStore] surrenderAndAnalyze failed:', err)
      throw err
    } finally {
      isSubmitting.value = false
    }
  }

  function enterAnalysis(loadCanonicalSolution: boolean = false): void {
    stopTimer()
    const puzzle = currentPuzzle.value
    if (!puzzle) return

    const previousState = viewState.value
    viewState.value = 'analyzing'

    // If entering immediately after playing/failing/solving without canonical reset, keep played PGN moves
    if (
      !loadCanonicalSolution &&
      (previousState === 'solved' ||
        previousState === 'attempt_failed' ||
        previousState === 'surrendered')
    ) {
      gameStore.enterAnalysisMode()
      gameStore.syncPgnVisualCuesToBoard()
      return
    }

    if (!loadCanonicalSolution && myEntry.value?.status === 'solved' && myEntry.value.uci_moves) {
      selectedUserId.value = myEntry.value.user_id
      populateMovesOnBoard(puzzle, myEntry.value.uci_moves)
      return
    }

    selectedUserId.value = null
    populateCanonicalSolutionOnBoard(puzzle)
  }

  function stopChallenge(): void {
    stopTimer()
    activePlayToken++
    gameStore.stop()
  }

  function formatDurationMs(ms: number | undefined): string {
    if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '--:--.-'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`
  }

  return {
    challengeState,
    viewState,
    isSubmitting,
    error,
    feedbackMessage,
    lastTelemetry,
    currentTimeMs,
    currentPuzzle,
    myEntry,
    leaderboard,
    selectedUserId,
    selectedParticipant,
    activeBotEngine,
    isPlaying,
    isAttemptFailed,
    isSolved,
    isSurrendered,
    isFinalized,
    isAnalysisMode,
    loadChallenge,
    retryChallenge,
    surrenderAndAnalyze,
    enterAnalysis,
    selectParticipantSolution,
    showCanonicalSolution,
    stopChallenge,
    formatDurationMs,
  }
})

