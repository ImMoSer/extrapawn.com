import {
  determineHumanColor,
  GameAudioEngine,
  PuzzleStrategy,
  useBoardStore,
  useGameStore,
  type PuzzlePuzzle,
} from '@/entities/game'
import type { BotLadderEngineId, SessionSummaryDTO } from '@/entities/training'
import { usePreferencesStore } from '@/entities/user'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { makeSan } from 'chessops/san'
import { parseUci } from 'chessops/util'
import { canAnalyzeSessionItem, canPracticeReplayItem } from '../lib/sessionItemPolicy'
import {
  buildEndgameAutomatCallbacks,
  buildEndgameHopelessCallbacks,
} from '../lib/buildAutomatCallbacks'
import { adaptSessionItemToPuzzle } from '../lib/sessionPuzzleAdapter'
import type { TrainingSessionSharedState } from './trainingSession.types'
import type { PuzzleClockController } from './usePuzzleClock'

interface InspectionDependencies {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  syncBotLadderForSession: (summary: SessionSummaryDTO) => BotLadderEngineId
  launchCurrentPuzzle: (options?: { preserveTimer?: boolean }) => void
  advanceAfterAttempt: () => void
}

export function useInspectionAndReplay(deps: InspectionDependencies) {
  const { state, clock } = deps
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const preferencesStore = usePreferencesStore()

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
    if (state.viewState.value === 'analyzing' || state.viewState.value === 'practice_replay') {
      return
    }
    if (state.viewState.value === 'report') {
      state.analysisReturnState.value = 'report'
      return
    }
    if (state.viewState.value === 'awaiting_retry') {
      state.analysisReturnState.value = 'awaiting_retry'
      return
    }
    if (state.viewState.value === 'playing' && state.currentItem.value?.status === 'pending') {
      state.analysisReturnState.value = 'playing'
      return
    }
    state.analysisReturnState.value = 'awaiting_next'
  }

  function restoreFromInspectionMode(): void {
    state.analysisPuzzle.value = null
    state.practicePuzzle.value = null
    state.practiceFeedbackState.value = 'idle'

    if (state.analysisReturnState.value === 'report') {
      gameStore.stop()
      state.viewState.value = 'report'
      return
    }

    if (
      state.analysisReturnState.value === 'awaiting_retry' &&
      state.currentItem.value?.status === 'pending'
    ) {
      const sess = state.hydratedSession.value
      const item = state.currentItem.value
      if (sess && item) {
        const adapted = adaptSessionItemToPuzzle(sess.session.discipline, item)
        const fallbackOrientation = determineHumanColor(adapted)
        const savedSnap = state.runtime.getSavedRetrySnapshot()
        const snap =
          savedSnap && savedSnap.puzzleId === item.puzzle_id
            ? savedSnap
            : {
                puzzleId: item.puzzle_id,
                fen: adapted.initial_fen,
                orientation: fallbackOrientation,
              }
        gameStore.setGamePhase('GAMEOVER')
        boardStore.setupPosition(snap.fen, snap.orientation)
        state.viewState.value = 'awaiting_retry'
        return
      }
    }

    if (
      state.analysisReturnState.value === 'playing' &&
      state.currentItem.value?.status === 'pending'
    ) {
      deps.launchCurrentPuzzle({ preserveTimer: true })
      return
    }

    deps.advanceAfterAttempt()
  }

  function startPracticeReplay(puzzleId?: string): void {
    const sess = state.hydratedSession.value
    if (!sess) {
      throw new Error(
        '[TrainingSessionStore] Cannot start practice replay without hydrated session. Fail-Fast!',
      )
    }
    if (
      state.viewState.value === 'playing' &&
      state.currentItem.value?.status === 'pending' &&
      state.currentPuzzleUserMoves.value > 0
    ) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play lock: cannot start practice replay while moves are in progress on pending puzzle "${state.currentItem.value.puzzle_id}". Fail-Fast!`,
      )
    }

    const resolvedId =
      puzzleId ?? state.practicePuzzle.value?.puzzle_id ?? state.analysisPuzzle.value?.puzzle_id
    const targetItem = resolvedId
      ? state.itemByPuzzleId.get(resolvedId) ??
        sess.items.find((it) => it.puzzle_id === resolvedId) ??
        null
      : state.currentItem.value

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

    clock.clearAutoNextTimeout()
    clock.pauseTimer()
    captureInspectionReturnState()

    const botEngine = deps.syncBotLadderForSession(sess.session)
    const adapted = adaptSessionItemToPuzzle(sess.session.discipline, targetItem)
    const humanColor = determineHumanColor(adapted)

    const tokenAtPractice = state.runtime.nextPlayToken()
    state.analysisPuzzle.value = null
    state.practicePuzzle.value = adapted
    state.practiceFeedbackState.value = 'idle'
    state.feedbackMessage.value = null
    state.automatPrompt.value = null
    state.automatRemainingMoves.value = null
    state.hopelessPrompt.value = null

    const strategy = new PuzzleStrategy(adapted, humanColor, sess.session.discipline, {
      planId: `practice-${sess.session.id.slice(0, 8)}`,
      botEngineOverride: botEngine,
      delays: preferencesStore.preferences.delays,
      automat: buildEndgameAutomatCallbacks({
        state,
        clock,
        preferencesStore,
        pauseClock: false,
      }),
      hopeless: buildEndgameHopelessCallbacks({
        state,
        clock,
        pauseClock: false,
      }),
      onUserMovePlayed: (userMovesCount: number) => {
        if (state.runtime.getPlayToken() === tokenAtPractice) {
          state.currentPuzzleUserMoves.value = userMovesCount
        }
      },
      onFeedback: (msg: string) => {
        if (state.runtime.getPlayToken() === tokenAtPractice) {
          state.feedbackMessage.value = msg
        }
      },
      onSuccess: () => {
        if (state.runtime.getPlayToken() !== tokenAtPractice) return
        GameAudioEngine.playFeatureSuccess()
        state.practiceFeedbackState.value = 'solved'
      },
      onFailure: () => {
        if (state.runtime.getPlayToken() !== tokenAtPractice) return
        GameAudioEngine.playFeatureError()
        state.practiceFeedbackState.value = 'failed'
      },
    })

    state.viewState.value = 'practice_replay'
    gameStore.startWithStrategy(adapted.initial_fen, strategy, humanColor)
  }

  function exitPracticeReplay(): void {
    state.runtime.nextPlayToken()
    restoreFromInspectionMode()
  }

  function enterPuzzleAnalysis(puzzleId?: string, loadCanonicalSolution: boolean = false): void {
    const sess = state.hydratedSession.value
    if (!sess) {
      throw new Error(
        '[TrainingSessionStore] Cannot enter analysis without hydrated session. Fail-Fast!',
      )
    }
    if (
      state.viewState.value === 'playing' &&
      state.currentItem.value?.status === 'pending' &&
      state.currentPuzzleUserMoves.value > 0
    ) {
      throw new Error(
        `[TrainingSessionStore] Fair-Play lock: cannot enter analysis while moves are in progress on pending puzzle "${state.currentItem.value.puzzle_id}". Fail-Fast!`,
      )
    }

    const resolvedId =
      puzzleId ?? state.analysisPuzzle.value?.puzzle_id ?? state.practicePuzzle.value?.puzzle_id
    const targetItem = resolvedId
      ? state.itemByPuzzleId.get(resolvedId) ??
        sess.items.find((it) => it.puzzle_id === resolvedId) ??
        null
      : state.currentItem.value

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
      !state.analysisPuzzle.value &&
      !state.practicePuzzle.value &&
      (state.viewState.value === 'awaiting_next' ||
        (state.viewState.value === 'playing' && state.currentItem.value?.status !== 'pending'))

    clock.clearAutoNextTimeout()
    clock.pauseTimer()
    captureInspectionReturnState()

    state.runtime.nextPlayToken()
    state.practicePuzzle.value = null
    state.practiceFeedbackState.value = 'idle'

    const adapted = adaptSessionItemToPuzzle(sess.session.discipline, targetItem)
    state.analysisPuzzle.value = adapted
    state.viewState.value = 'analyzing'

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

  return {
    startPracticeReplay,
    exitPracticeReplay,
    enterPuzzleAnalysis,
    exitPuzzleAnalysis,
  }
}
