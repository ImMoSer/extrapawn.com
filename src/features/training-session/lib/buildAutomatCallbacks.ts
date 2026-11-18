import type {
  EndgameAutomatCallbacks,
  EndgameAutomatPromptRequest,
  EndgameHopelessCallbacks,
  EndgameHopelessPromptRequest,
} from '@/entities/game'
import type { usePreferencesStore } from '@/entities/user'
import type { TrainingSessionSharedState } from '../model/trainingSession.types'
import type { PuzzleClockController } from '../model/usePuzzleClock'

export interface AutomatCallbackBuildOptions {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  preferencesStore: ReturnType<typeof usePreferencesStore>
  isCrashtest?: () => boolean
  pauseClock?: boolean
}

export interface HopelessCallbackBuildOptions {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  isCrashtest?: () => boolean
  pauseClock?: boolean
}

export function buildEndgameAutomatCallbacks(
  opts: AutomatCallbackBuildOptions,
): EndgameAutomatCallbacks {
  const { state, clock, preferencesStore, isCrashtest, pauseClock = true } = opts

  return {
    getMode: () => {
      if (isCrashtest?.()) {
        return 'off'
      }
      return preferencesStore.preferences.gameplay.endgameAutomat
    },
    onPromptOpen: (prompt: EndgameAutomatPromptRequest) => {
      if (pauseClock) {
        clock.pauseTimer()
      }
      state.automatRemainingMoves.value = null
      state.automatPrompt.value = prompt
    },
    onRolloutStart: (mateInMoves: number) => {
      if (pauseClock) {
        clock.pauseTimer()
      }
      state.automatPrompt.value = null
      state.automatRemainingMoves.value = mateInMoves
    },
    onRolloutStep: (remainingMoves: number) => {
      state.automatRemainingMoves.value = remainingMoves
    },
    onCleanup: () => {
      state.automatPrompt.value = null
      state.automatRemainingMoves.value = null
    },
  }
}

export function buildEndgameHopelessCallbacks(
  opts: HopelessCallbackBuildOptions,
): EndgameHopelessCallbacks {
  const { state, clock, isCrashtest, pauseClock = true } = opts

  return {
    isEnabled: () => !isCrashtest?.(),
    onPromptOpen: (prompt: EndgameHopelessPromptRequest) => {
      if (pauseClock) {
        clock.pauseTimer()
      }
      state.hopelessPrompt.value = prompt
    },
    onCleanup: () => {
      state.hopelessPrompt.value = null
    },
  }
}
