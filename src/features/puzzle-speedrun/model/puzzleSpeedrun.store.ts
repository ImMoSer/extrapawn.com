import {
  useGameStore,
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/shared/api/client'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useRouter } from 'vue-router'
import type { UserStatsUpdate } from '@/shared/types/api.types'
import { parseFen } from 'chessops/fen'
import testPuzzles from '@/../test_speedrung.json'
import { PuzzleSpeedrunStrategy } from './PuzzleSpeedrunStrategy'

export type PuzzleStrategyType = 'playOutOnly' | 'scenarioOnly' | 'scenarioPlus'

export interface WorkoutPuzzle {
  puzzle_id: string
  puzzle_type: string
  category: string
  sub_category?: string
  difficulty: string
  rating?: number | string
  strategy: PuzzleStrategyType
  first_move: 'bot' | 'user'
  initial_fen: string
  tactical_solution?: string
  puzzle_fen?: string
}

function determineHumanColor(puzzle: WorkoutPuzzle): 'white' | 'black' {
  const setup = parseFen(puzzle.initial_fen).unwrap()
  const isBotFirst = puzzle.first_move === 'bot'
  return isBotFirst ? (setup.turn === 'white' ? 'black' : 'white') : setup.turn
}

export const usePuzzleSpeedrunStore = defineStore('puzzleSpeedrun', () => {
  const gameStore = useGameStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const router = useRouter()

  const puzzlesToPlay = ref<WorkoutPuzzle[]>([])
  const currentPuzzleIndex = ref(0)
  const isPlaying = ref(false)
  const isFinished = ref(false)

  // Track times for each puzzle index
  const puzzleTimes = ref<Record<number, number>>({})

  // Timer State
  const startTime = ref(0)
  const currentTimeMs = ref(0)
  let timerInterval: number | null = null

  const currentPuzzle = computed(() => puzzlesToPlay.value[currentPuzzleIndex.value])
  const totalPuzzles = computed(() => puzzlesToPlay.value.length)

  const totalTimeMs = computed(() => {
    return Object.values(puzzleTimes.value).reduce((acc, time) => acc + time, 0)
  })

  function startTimer() {
    startTime.value = Date.now()
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = window.setInterval(() => {
      currentTimeMs.value = Date.now() - startTime.value
    }, 100)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function resetTimer() {
    stopTimer()
    currentTimeMs.value = 0
  }

  function playCurrentPuzzle() {
    const puzzle = puzzlesToPlay.value[currentPuzzleIndex.value]
    if (!puzzle) return

    const userColor = determineHumanColor(puzzle)

    resetTimer()
    startTimer()

    gameStore.setGamePhase('LOADING')

    gameStore.startWithStrategy(
      puzzle.initial_fen,
      new PuzzleSpeedrunStrategy(puzzle, userColor),
      userColor,
    )
  }

  function handlePuzzleFailure() {
    console.log('[PuzzleSpeedrun] Failed! Retrying puzzle...')
    playCurrentPuzzle()
  }

  function handlePuzzleSuccess(timeNeededMs: number) {
    console.log(`[PuzzleSpeedrun] Success! Time needed: ${timeNeededMs}ms`)
    stopTimer()
    puzzleTimes.value[currentPuzzleIndex.value] = timeNeededMs

    const nextIndex = puzzlesToPlay.value.findIndex(
      (_, idx) => puzzleTimes.value[idx] === undefined,
    )

    if (nextIndex === -1) {
      isPlaying.value = false
      isFinished.value = true
      soundService.playSound('game_speedrun_finished')
      return
    }

    currentPuzzleIndex.value = nextIndex
    playCurrentPuzzle()
  }

  function restartCurrentPuzzle() {
    if (!isPlaying.value) return
    playCurrentPuzzle()
  }

  function jumpToPuzzle(index: number) {
    if (!isPlaying.value) return
    if (index >= 0 && index < totalPuzzles.value) {
      currentPuzzleIndex.value = index
      playCurrentPuzzle()
    }
  }

  async function startSpeedrun() {
    try {
      gameStore.setBotEngineId('maia-2200')

      // Charge PawnCoins (MVP: keep same endpoint for now or skip if desired, but user wants MVP)
      const response = await apiClient<{ userStatsUpdate: UserStatsUpdate }>('/speedrun/start', {
        method: 'POST',
        body: JSON.stringify({ subMode: 'puzzle' }),
      })

      if (response.userStatsUpdate) {
        authStore.updateUserStats(response.userStatsUpdate)
      }

      // Initialize with test puzzles
      puzzlesToPlay.value = testPuzzles as WorkoutPuzzle[]
      currentPuzzleIndex.value = 0
      isPlaying.value = true
      isFinished.value = false
      puzzleTimes.value = {}
      playCurrentPuzzle()
    } catch (error) {
      console.error('[PuzzleSpeedrunStore] Failed to start speedrun:', error)
      const handled = await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'))
      if (!handled) {
        throw error
      }
    }
  }

  function quitSpeedrun() {
    stopTimer()
    isPlaying.value = false
    isFinished.value = false
    puzzlesToPlay.value = []
    puzzleTimes.value = {}
    gameStore.stop()
  }

  function formatMs(ms: number | undefined): string {
    if (ms === undefined) return '--:--.--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  return {
    puzzlesToPlay,
    currentPuzzleIndex,
    currentPuzzle,
    totalPuzzles,
    currentTimeMs,
    totalTimeMs,
    isPlaying,
    isFinished,
    puzzleTimes,
    formatMs,
    startSpeedrun,
    quitSpeedrun,
    restartCurrentPuzzle,
    jumpToPuzzle,
    handlePuzzleSuccess,
    handlePuzzleFailure,
  }
})

