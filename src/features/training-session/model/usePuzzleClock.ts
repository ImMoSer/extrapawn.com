import { onScopeDispose, ref, type Ref } from 'vue'
import type { TrainingViewState } from './trainingSession.types'

const MAX_ATTEMPT_TIME_MS = 3_600_000

export interface PuzzleClockController {
  currentTimeMs: Ref<number>
  startTimer: () => void
  stopTimer: () => void
  pauseTimer: () => void
  resumeTimer: () => void
  consumeElapsedTimeMs: () => number
  scheduleAutoNext: (delayMs: number, callback: () => void) => void
  clearAutoNextTimeout: () => void
}

export function usePuzzleClock(viewState: Ref<TrainingViewState>): PuzzleClockController {
  const currentTimeMs = ref<number>(0)
  let timerStartedAt = 0
  let accumulatedBeforePauseMs = 0
  let timerIntervalId: ReturnType<typeof setInterval> | null = null
  let autoNextTimeoutId: ReturnType<typeof setTimeout> | null = null

  function clearAutoNextTimeout(): void {
    if (autoNextTimeoutId !== null) {
      clearTimeout(autoNextTimeoutId)
      autoNextTimeoutId = null
    }
  }

  function scheduleAutoNext(delayMs: number, callback: () => void): void {
    clearAutoNextTimeout()
    autoNextTimeoutId = setTimeout(() => {
      autoNextTimeoutId = null
      callback()
    }, delayMs)
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

  return {
    currentTimeMs,
    startTimer,
    stopTimer,
    pauseTimer,
    resumeTimer,
    consumeElapsedTimeMs,
    scheduleAutoNext,
    clearAutoNextTimeout,
  }
}
