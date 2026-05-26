import {
  useGameStore,
  GameAudioEngine
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { apiClient } from '@/shared/api/client'
import { parseFen } from 'chessops/fen'
import { TaskTodayStrategy } from './TaskTodayStrategy'

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

export interface TrainingTask {
  mode: string
  sub_mode: string
  themes: { name: string; count: number }[]
}

export interface TrainingPlan {
  level: string
  tasks: TrainingTask[]
}

export interface PuzzleResult {
  puzzle_id: string
  time: number
  attempts: number
  status: 'solved' | 'failed'
}

const STORAGE_KEY = 'task_today_state'

function determineHumanColor(puzzle: WorkoutPuzzle): 'white' | 'black' {
  const setup = parseFen(puzzle.initial_fen).unwrap()
  const isBotFirst = puzzle.first_move === 'bot'
  return isBotFirst ? (setup.turn === 'white' ? 'black' : 'white') : setup.turn
}

export const useTaskTodayStore = defineStore('taskToday', () => {
  const gameStore = useGameStore()

  const trainingPlan = ref<TrainingPlan | null>(null)
  const currentTaskIndex = ref(0)
  
  // Tasks map: sub_mode -> WorkoutPuzzle[]
  const tasksPuzzles = ref<Record<string, WorkoutPuzzle[]>>({})
  // Solved history: sub_mode -> WorkoutPuzzle[]
  const solvedPuzzlesPerTask = ref<Record<string, WorkoutPuzzle[]>>({})
  // Results map: puzzle_id -> PuzzleResult
  const completedResults = ref<Record<string, PuzzleResult>>({})
  // Attempts map: puzzle_id -> number
  const puzzleAttempts = ref<Record<string, number>>({})
  
  const isPlaying = ref(false)
  const isFinished = ref(false)

  // Timer State
  const startTime = ref(0)
  const currentTimeMs = ref(0)
  let timerInterval: number | null = null

  const activeTask = computed(() => trainingPlan.value?.tasks[currentTaskIndex.value] || null)
  
  const currentPuzzles = computed(() => {
    if (!activeTask.value) return []
    return tasksPuzzles.value[activeTask.value.sub_mode] || []
  })

  const currentPuzzle = computed(() => currentPuzzles.value[0] || null)

  // --- Persistence Logic ---
  
  function saveState() {
    const state = {
      trainingPlan: trainingPlan.value,
      currentTaskIndex: currentTaskIndex.value,
      tasksPuzzles: tasksPuzzles.value,
      solvedPuzzlesPerTask: solvedPuzzlesPerTask.value,
      completedResults: completedResults.value,
      puzzleAttempts: puzzleAttempts.value,
      isPlaying: isPlaying.value,
      isFinished: isFinished.value,
      date: new Date().toISOString().split('T')[0]
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return false

    try {
      const state = JSON.parse(saved)
      const today = new Date().toISOString().split('T')[0]
      
      if (state.date !== today) {
        localStorage.removeItem(STORAGE_KEY)
        return false
      }

      trainingPlan.value = state.trainingPlan
      currentTaskIndex.value = state.currentTaskIndex
      tasksPuzzles.value = state.tasksPuzzles
      solvedPuzzlesPerTask.value = state.solvedPuzzlesPerTask
      completedResults.value = state.completedResults
      puzzleAttempts.value = state.puzzleAttempts
      isPlaying.value = state.isPlaying
      isFinished.value = state.isFinished
      
      return true
    } catch (e) {
      console.error('[TaskTodayStore] Failed to load state:', e)
      return false
    }
  }

  // Auto-save on changes
  watch(
    [trainingPlan, currentTaskIndex, tasksPuzzles, solvedPuzzlesPerTask, completedResults, puzzleAttempts, isPlaying, isFinished],
    () => {
      if (isPlaying.value || isFinished.value) {
        saveState()
      }
    },
    { deep: true }
  )

  // --- Store Actions ---

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

  function playCurrentPuzzle() {
    const puzzle = currentPuzzle.value
    if (!puzzle) return

    const userColor = determineHumanColor(puzzle)

    // Increment attempts when puzzle starts
    puzzleAttempts.value[puzzle.puzzle_id] = (puzzleAttempts.value[puzzle.puzzle_id] || 0) + 1

    gameStore.setGamePhase('LOADING')

    gameStore.startWithStrategy(
      puzzle.initial_fen,
      new TaskTodayStrategy(puzzle, userColor),
      userColor,
    )
  }

  function handlePuzzleFailure() {
    console.log('[TaskToday] Failed! Moving to back of queue...')
    GameAudioEngine.playFeatureError()
    const puzzle = currentPuzzle.value
    if (puzzle) {
      // Mark as failed in results but keep playing it
      completedResults.value[puzzle.puzzle_id] = {
        puzzle_id: puzzle.puzzle_id,
        time: 0,
        attempts: puzzleAttempts.value[puzzle.puzzle_id] || 1,
        status: 'failed'
      }

      const puzzles = [...currentPuzzles.value]
      if (puzzles.length > 0) {
        const failed = puzzles.shift()!
        puzzles.push(failed)
        tasksPuzzles.value[activeTask.value!.sub_mode] = puzzles
      }
    }
    playCurrentPuzzle()
  }

  function handlePuzzleSuccess(timeNeededMs: number) {
    console.log(`[TaskToday] Success! Time needed: ${timeNeededMs}ms`)
    GameAudioEngine.playTaskTodaySuccess()
    stopTimer()
    
    const puzzle = currentPuzzle.value
    if (puzzle) {
      completedResults.value[puzzle.puzzle_id] = {
        puzzle_id: puzzle.puzzle_id,
        time: timeNeededMs,
        attempts: puzzleAttempts.value[puzzle.puzzle_id] || 1,
        status: 'solved'
      }

      const subMode = activeTask.value!.sub_mode
      const puzzles = [...currentPuzzles.value]
      const solved = puzzles.shift()!
      tasksPuzzles.value[subMode] = puzzles

      if (!solvedPuzzlesPerTask.value[subMode]) {
        solvedPuzzlesPerTask.value[subMode] = []
      }
      solvedPuzzlesPerTask.value[subMode].push(solved)
    }

    if (currentPuzzles.value.length === 0) {
      const allDone = trainingPlan.value?.tasks.every(t => (tasksPuzzles.value[t.sub_mode]?.length || 0) === 0)
      if (allDone) {
        isPlaying.value = false
        isFinished.value = true
        GameAudioEngine.playSpeedrunFinished()
        return
      } else {
        const nextIdx = trainingPlan.value?.tasks.findIndex(t => (tasksPuzzles.value[t.sub_mode]?.length || 0) > 0)
        if (nextIdx !== undefined && nextIdx !== -1) {
          currentTaskIndex.value = nextIdx
        }
      }
    }
    
    playCurrentPuzzle()
  }

  async function fetchTrainingPlan(level: string = 'Novice') {
    try {
      const response = await apiClient<{ plan: { tasks_json: TrainingPlan } }>(
        `/training-plan/next?level=${level}`,
      )
      trainingPlan.value = response.plan.tasks_json
      return trainingPlan.value
    } catch (error) {
      console.error('[TaskTodayStore] Failed to fetch training plan:', error)
      return null
    }
  }

  async function loadPuzzlesForTask(task: TrainingTask) {
    const theme = task.themes[0]?.name || ''
    const count = task.themes[0]?.count || 10
    const level = trainingPlan.value?.level || 'Novice'
    
    try {
      const puzzles = await apiClient<WorkoutPuzzle[]>(
        `/play-puzzle/start?puzzle_type=${task.sub_mode}&difficulty=${level}&category=${theme}&limit=${count}`
      )
      tasksPuzzles.value[task.sub_mode] = puzzles
    } catch (error) {
      console.error(`[TaskTodayStore] Failed to load puzzles for task ${task.sub_mode}:`, error)
    }
  }

  async function startTaskToday(level: string = 'Novice') {
    try {
      gameStore.setBotEngineId('maia-2200')

      // Check for existing state first
      if (loadState()) {
        console.log('[TaskTodayStore] Resumed existing state for today.')
        if (isPlaying.value && currentPuzzle.value) {
          playCurrentPuzzle()
        }
        return
      }
      
      const plan = await fetchTrainingPlan(level)
      if (!plan) return

      for (const task of plan.tasks) {
        await loadPuzzlesForTask(task)
      }

      currentTaskIndex.value = 0
      isPlaying.value = true
      isFinished.value = false
      completedResults.value = {}
      puzzleAttempts.value = {}
      solvedPuzzlesPerTask.value = {}
      
      soundService.playSound('app_game_entry')
      playCurrentPuzzle()
    } catch (error) {
      console.error('[TaskTodayStore] Failed to start TaskToday:', error)
    }
  }

  function quitTaskToday() {
    stopTimer()
    isPlaying.value = false
    isFinished.value = false
    tasksPuzzles.value = {}
    solvedPuzzlesPerTask.value = {}
    completedResults.value = {}
    puzzleAttempts.value = {}
    localStorage.removeItem(STORAGE_KEY)
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
    trainingPlan,
    currentTaskIndex,
    activeTask,
    tasksPuzzles,
    solvedPuzzlesPerTask,
    currentPuzzles,
    currentPuzzle,
    currentTimeMs,
    isPlaying,
    isFinished,
    completedResults,
    puzzleAttempts,
    formatMs,
    startTaskToday,
    quitTaskToday,
    handlePuzzleSuccess,
    handlePuzzleFailure,
    startTimer,
    stopTimer,
    playCurrentPuzzle,
  }
})
