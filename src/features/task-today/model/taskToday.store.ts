import {
  useGameStore,
  GameAudioEngine
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { apiClient, InsufficientPawnCoinsError } from '@/shared/api/client'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useRouter } from 'vue-router'
import { parseFen } from 'chessops/fen'
import { TaskTodayStrategy } from './TaskTodayStrategy'
import type { TrainingPlanCurrentResponse, DailyTrainingPlanEntity, CompletedPlanReport } from '@/shared/types/api.types'

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
  strategy: string
  date: string
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

export function getPlanCost(difficulty: 'Novice' | 'Pro' | 'Master'): number {
  const scaling = {
    Novice: { tactics: 5, others: 1, limitTactics: 10, limitOthers: 10 },
    Pro: { tactics: 4, others: 2, limitTactics: 30, limitOthers: 10 },
    Master: { tactics: 5, others: 3, limitTactics: 40, limitOthers: 10 }
  }[difficulty]

  const tacticsTasks = scaling.tactics * scaling.limitTactics
  const otherTasks = scaling.others * scaling.limitOthers * 3
  return (tacticsTasks * 1) + (otherTasks * 5)
}

export const useTaskTodayStore = defineStore('taskToday', () => {
  const gameStore = useGameStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const router = useRouter()

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
  const isReplay = ref(false)
  const completedReport = ref<CompletedPlanReport | null>(null)

  // Timer State
  const startTime = ref(0)
  const elapsedTimeBeforePause = ref(0)
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
      isReplay: isReplay.value,
      completedReport: completedReport.value,
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
      
      if (state.date !== today || state.isReplay) {
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
      isReplay.value = state.isReplay || false
      completedReport.value = state.completedReport || null
      
      return true
    } catch (e) {
      console.error('[TaskTodayStore] Failed to load state:', e)
      return false
    }
  }

  function clearSavedState() {
    trainingPlan.value = null
    currentTaskIndex.value = 0
    tasksPuzzles.value = {}
    solvedPuzzlesPerTask.value = {}
    completedResults.value = {}
    puzzleAttempts.value = {}
    isPlaying.value = false
    isFinished.value = false
    isReplay.value = false
    completedReport.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  // Auto-save on changes
  watch(
    [trainingPlan, currentTaskIndex, tasksPuzzles, solvedPuzzlesPerTask, completedResults, puzzleAttempts, isPlaying, isFinished, isReplay, completedReport],
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
    elapsedTimeBeforePause.value = 0
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = window.setInterval(() => {
      currentTimeMs.value = elapsedTimeBeforePause.value + (Date.now() - startTime.value)
    }, 100)
  }

  function pauseTimer() {
    if (timerInterval) {
      elapsedTimeBeforePause.value += Date.now() - startTime.value
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function resumeTimer() {
    if (!timerInterval && isPlaying.value) {
      startTime.value = Date.now()
      timerInterval = window.setInterval(() => {
        currentTimeMs.value = elapsedTimeBeforePause.value + (Date.now() - startTime.value)
      }, 100)
    }
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    elapsedTimeBeforePause.value = 0
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      pauseTimer()
    } else {
      resumeTimer()
    }
  }

  if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange)
  }

  function playCurrentPuzzle() {
    const puzzle = currentPuzzle.value
    if (!puzzle) return

    const userColor = determineHumanColor(puzzle)

    gameStore.setGamePhase('LOADING')

    gameStore.startWithStrategy(
      puzzle.initial_fen,
      new TaskTodayStrategy(puzzle, userColor),
      userColor,
    )
  }

  async function handlePuzzleFailure() {
    console.log('[TaskToday] Failed! Moving to back of queue...')
    GameAudioEngine.playFeatureError()
    const puzzle = currentPuzzle.value
    if (puzzle) {
      const attempts = puzzleAttempts.value[puzzle.puzzle_id] || 0
      const newAttempts = attempts + 1
      puzzleAttempts.value[puzzle.puzzle_id] = newAttempts

      completedResults.value[puzzle.puzzle_id] = {
        puzzle_id: puzzle.puzzle_id,
        time: 0,
        attempts: newAttempts,
        status: 'failed'
      }

      const puzzles = [...currentPuzzles.value]
      if (puzzles.length > 0) {
        const failed = puzzles.shift()!
        puzzles.push(failed)
        tasksPuzzles.value[activeTask.value!.sub_mode] = puzzles
      }

      await savePlanProgress(
        puzzle.puzzle_id,
        activeTask.value!.sub_mode,
        puzzle.category,
        'failed',
        newAttempts,
        0,
        puzzle.rating ? Number(puzzle.rating) : undefined
      )
    }
    playCurrentPuzzle()
  }

  async function handlePuzzleSuccess(timeNeededMs: number) {
    const cappedTimeMs = Math.min(timeNeededMs, 15 * 60 * 1000)
    console.log(`[TaskToday] Success! Time needed: ${cappedTimeMs}ms (raw: ${timeNeededMs}ms)`)
    GameAudioEngine.playTaskTodaySuccess()
    stopTimer()
    
    const puzzle = currentPuzzle.value
    if (puzzle) {
      const attempts = puzzleAttempts.value[puzzle.puzzle_id] || 0
      const newAttempts = attempts + 1
      puzzleAttempts.value[puzzle.puzzle_id] = newAttempts

      completedResults.value[puzzle.puzzle_id] = {
        puzzle_id: puzzle.puzzle_id,
        time: cappedTimeMs,
        attempts: newAttempts,
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

      await savePlanProgress(
        puzzle.puzzle_id,
        subMode,
        puzzle.category,
        'solved',
        newAttempts,
        cappedTimeMs,
        puzzle.rating ? Number(puzzle.rating) : undefined
      )
    }

    const allDone = trainingPlan.value?.tasks.every(t => (tasksPuzzles.value[t.sub_mode]?.length || 0) === 0)
    if (allDone) {
      isPlaying.value = false
      isFinished.value = true
      GameAudioEngine.playSpeedrunFinished()
      await saveCompletedPlan()
      return
    }

    if (currentPuzzles.value.length === 0) {
      const nextIdx = trainingPlan.value?.tasks.findIndex(t => (tasksPuzzles.value[t.sub_mode]?.length || 0) > 0)
      if (nextIdx !== undefined && nextIdx !== -1) {
        currentTaskIndex.value = nextIdx
      }
    }
    
    playCurrentPuzzle()
  }

  async function saveCompletedPlan() {
    if (!trainingPlan.value) return

    try {
      const response = await apiClient<{ success: boolean; message: string; report?: CompletedPlanReport }>('/training-plan/complete', {
        method: 'POST',
        body: JSON.stringify({
          difficulty: trainingPlan.value.level,
          strategy: trainingPlan.value.strategy
        })
      })
      if (response && response.report) {
        completedReport.value = response.report
      }
      console.log('[TaskTodayStore] Successfully saved completed training plan to DB.')
    } catch (err) {
      console.error('[TaskTodayStore] Failed to save completed training plan:', err)
    }
  }

  async function startPlanOnBackend() {
    if (!trainingPlan.value) return

    // Collect all puzzles from all tasks
    const allPuzzles: Array<{ puzzle_id: string; sub_mode: string; category: string; rating?: number }> = []
    Object.keys(tasksPuzzles.value).forEach(subMode => {
      const list = tasksPuzzles.value[subMode]
      if (list) {
        list.forEach(p => {
          allPuzzles.push({
            puzzle_id: p.puzzle_id,
            sub_mode: p.puzzle_type,
            category: p.category,
            rating: p.rating ? Number(p.rating) : undefined
          })
        })
      }
    })

    try {
      await apiClient('/training-plan/start', {
        method: 'POST',
        body: JSON.stringify({
          difficulty: trainingPlan.value.level,
          strategy: trainingPlan.value.strategy,
          tasks_json: {
            strategy: trainingPlan.value.strategy,
            difficulty: trainingPlan.value.level,
            date: trainingPlan.value.date,
            puzzles: allPuzzles
          }
        })
      })
      console.log('[TaskTodayStore] Successfully started training plan on backend.')
    } catch (err) {
      console.error('[TaskTodayStore] Failed to start training plan on backend:', err)
    }
  }


  async function generateAndStartPlan(
    strategyName: 'Discovery' | 'Hardcore' | 'Warmup',
    difficulty: 'Novice' | 'Pro' | 'Master',
    recommendations: Record<string, string[]>
  ) {
    const cost = getPlanCost(difficulty)
    const availableCoins = authStore.userProfile?.PawnCoins ?? 0
    if (availableCoins < cost) {
      const error = new InsufficientPawnCoinsError('Daily PawnCoins limit exceeded', cost, availableCoins)
      await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'))
      return false
    }

    try {
      // Charge the plan upfront
      const billingRes = await apiClient<{ success: boolean; PawnCoins: number; dailyLimit: number; spentToday: number }>('/billing/plan', {
        method: 'POST',
        body: JSON.stringify({ cost })
      })
      if (billingRes && billingRes.PawnCoins !== undefined) {
        authStore.updateUserStats({
          PawnCoins: billingRes.PawnCoins,
          dailyLimit: billingRes.dailyLimit,
          spentToday: billingRes.spentToday
        })
      }

      gameStore.setBotEngineId('maia-2200')
      isPlaying.value = false
      isFinished.value = false
      
      const todayStr = new Date().toISOString().split('T')[0] || ''
      
      const tasks: TrainingTask[] = []
      tasksPuzzles.value = {}
      solvedPuzzlesPerTask.value = {}
      completedResults.value = {}
      puzzleAttempts.value = {}
      
      // Scaling Rules
      const scaling = {
        Novice: { tactics: 5, others: 1, limitTactics: 10, limitOthers: 10 },
        Pro: { tactics: 4, others: 2, limitTactics: 30, limitOthers: 10 },
        Master: { tactics: 5, others: 3, limitTactics: 40, limitOthers: 10 }
      }[difficulty]

      const plan: TrainingPlan = {
        level: difficulty,
        strategy: strategyName,
        date: todayStr,
        tasks: []
      }
      
      // We iterate over the 4 sub-modes and apply scaling
      for (const subMode of ['tactics', 'finish_him', 'practical_chess', 'theory_endings']) {
        const catCount = subMode === 'tactics' ? scaling.tactics : scaling.others
        const limitPerCategory = subMode === 'tactics' ? scaling.limitTactics : scaling.limitOthers
        
        // Take only the number of categories allowed for this difficulty
        const categories = (recommendations[subMode] || []).slice(0, catCount)
        const allPuzzlesForMode: WorkoutPuzzle[] = []
        const themes: { name: string; count: number }[] = []
        
        for (const cat of categories) {
          themes.push({ name: cat, count: limitPerCategory })
          try {
            const puzzles = await apiClient<WorkoutPuzzle[]>(
              `/play-puzzle/start?puzzle_type=${subMode}&difficulty=${difficulty}&category=${cat}&limit=${limitPerCategory}`
            )
            if (puzzles && puzzles.length > 0) {
              allPuzzlesForMode.push(...puzzles)
            }
          } catch (err) {
            console.error(`[TaskTodayStore] Failed to fetch puzzles for ${subMode}/${cat}:`, err)
            if (err instanceof InsufficientPawnCoinsError) {
              throw err
            }
          }
        }
        
        if (allPuzzlesForMode.length > 0) {
          tasksPuzzles.value[subMode] = allPuzzlesForMode
          tasks.push({
            mode: 'playPuzzle',
            sub_mode: subMode,
            themes
          })
        }
      }
      
      plan.tasks = tasks
      trainingPlan.value = plan
      currentTaskIndex.value = 0
      isPlaying.value = true
      isFinished.value = false
      
      saveState()
      await startPlanOnBackend()
      
      soundService.playSound('app_game_entry')
      playCurrentPuzzle()
      
      return true
    } catch (err) {
      console.error('[TaskTodayStore] Failed to generate and start plan:', err)
      if (err instanceof InsufficientPawnCoinsError) {
        authStore.setDailyLimitExceeded(true)
      }
      await uiStore.handlePawnCoinsError(err, () => router.push('/pricing'))
      return false
    }
  }

  async function startTaskToday(autoPlay = true) {
    try {
      gameStore.setBotEngineId('maia-2200')

      if (loadState()) {
        console.log('[TaskTodayStore] Resumed existing state for today.')
        if (autoPlay && isPlaying.value && currentPuzzle.value) {
          playCurrentPuzzle()
        }
        return true
      }
      return false
    } catch (error) {
      console.error('[TaskTodayStore] Failed to start TaskToday:', error)
      return false
    }
  }

  async function quitTaskToday() {
    stopTimer()
    isPlaying.value = false
    isFinished.value = false
    tasksPuzzles.value = {}
    solvedPuzzlesPerTask.value = {}
    completedResults.value = {}
    puzzleAttempts.value = {}
    completedReport.value = null
    localStorage.removeItem(STORAGE_KEY)
    gameStore.stop()
    try {
      await apiClient('/training-plan/active', { method: 'DELETE' })
      console.log('[TaskTodayStore] Successfully aborted active plan on backend.')
    } catch (err) {
      console.error('[TaskTodayStore] Failed to abort active plan on backend:', err)
    }
  }

  function pauseTaskToday() {
    stopTimer()
    gameStore.stop()
    isPlaying.value = false
    if (isReplay.value) {
      trainingPlan.value = null
      completedReport.value = null
      isReplay.value = false
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  async function savePlanProgress(
    puzzleId: string,
    subMode: string,
    category: string,
    status: 'solved' | 'failed',
    attempts: number,
    timeMs: number,
    rating?: number
  ) {
    if (!trainingPlan.value) return

    try {
      await apiClient('/training-plan/progress', {
        method: 'POST',
        body: JSON.stringify({
          difficulty: trainingPlan.value.level,
          strategy: trainingPlan.value.strategy,
          date: trainingPlan.value.date,
          puzzle_progress: {
            puzzle_id: puzzleId,
            sub_mode: subMode,
            category: category,
            status: status,
            attempts: attempts,
            time: timeMs,
            rating: rating
          }
        })
      })
      console.log('[TaskTodayStore] Successfully saved plan progress to backend.')
    } catch (err) {
      console.error('[TaskTodayStore] Failed to save plan progress to backend:', err)
      if (err instanceof InsufficientPawnCoinsError) {
        authStore.setDailyLimitExceeded(true)
      }
      await uiStore.handlePawnCoinsError(err, () => router.push('/pricing'))
    }
  }

  function formatMs(ms: number | undefined): string {
    if (ms === undefined) return '--:--.--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  async function replayPlan(planData: DailyTrainingPlanEntity | TrainingPlanCurrentResponse, forceReplayAll = false) {
    try {
      gameStore.setBotEngineId('maia-2200')
      isPlaying.value = false
      isFinished.value = false
      
      const isCompleted = planData.is_completed || ('active' in planData && !planData.active && planData.is_completed)

      if (isCompleted && !forceReplayAll) {
        completedReport.value = planData.report_json || null
        trainingPlan.value = null
        isFinished.value = true
        isPlaying.value = false
        isReplay.value = true
        return true
      }

      const tasks_json = 'tasks_json' in planData ? planData.tasks_json : planData.plan
      if (!tasks_json || !tasks_json.puzzles) {
        throw new Error('Invalid plan data for replay')
      }

      const isResume = !isCompleted && !forceReplayAll

      isReplay.value = isCompleted || false

      const solvedPuzzles = isResume ? tasks_json.puzzles.filter(p => p.solved) : []
      const unsolvedPuzzles = isResume ? tasks_json.puzzles.filter(p => !p.solved) : tasks_json.puzzles

      // 1. Prepare batch request for unsolved puzzles only
      const batchRequest = unsolvedPuzzles.map((p: { puzzle_id: string; sub_mode: string }) => ({
        puzzle_id: p.puzzle_id,
        puzzle_type: p.sub_mode
      }))

      let responsePuzzles: WorkoutPuzzle[] = []
      if (batchRequest.length > 0) {
        const response = await apiClient<{ puzzles: WorkoutPuzzle[] }>('/play-puzzle/batch', {
          method: 'POST',
          body: JSON.stringify(batchRequest)
        })
        responsePuzzles = response.puzzles || []
      }

      // 2. Reconstruct tasksPuzzles (only contains unsolved puzzles)
      const puzzlesMap = new Map<string, WorkoutPuzzle[]>()
      responsePuzzles.forEach(p => {
        if (!puzzlesMap.has(p.puzzle_type)) {
          puzzlesMap.set(p.puzzle_type, [])
        }
        puzzlesMap.get(p.puzzle_type)!.push(p)
      })
      tasksPuzzles.value = Object.fromEntries(puzzlesMap)

      // 3. Reconstruct solvedPuzzlesPerTask, completedResults, puzzleAttempts
      solvedPuzzlesPerTask.value = {}
      completedResults.value = {}
      puzzleAttempts.value = {}

      if (isResume) {
        solvedPuzzles.forEach(p => {
          const subMode = p.sub_mode
          if (!solvedPuzzlesPerTask.value[subMode]) {
            solvedPuzzlesPerTask.value[subMode] = []
          }
          solvedPuzzlesPerTask.value[subMode].push({
            puzzle_id: p.puzzle_id,
            puzzle_type: p.sub_mode,
            category: p.category,
            difficulty: tasks_json.difficulty || 'Novice',
            strategy: 'playOutOnly',
            first_move: 'user',
            initial_fen: ''
          })

          if (p.time !== undefined && p.time !== null && p.time < 0) {
            throw new Error(`Invalid negative puzzle time: ${p.time} ms for puzzle ${p.puzzle_id}`);
          }
          const solvedTimeMs = p.time || 0

          completedResults.value[p.puzzle_id] = {
            puzzle_id: p.puzzle_id,
            time: solvedTimeMs,
            attempts: p.attempts || 1,
            status: 'solved'
          }

          puzzleAttempts.value[p.puzzle_id] = p.attempts || 1
        })

        unsolvedPuzzles.forEach(p => {
          if (p.attempts && p.attempts > 0) {
            puzzleAttempts.value[p.puzzle_id] = p.attempts
            if (p.time && p.time > 0) {
              if (p.time < 0) {
                throw new Error(`Invalid negative puzzle time: ${p.time} ms for puzzle ${p.puzzle_id}`);
              }
              const failedTimeMs = p.time
              completedResults.value[p.puzzle_id] = {
                puzzle_id: p.puzzle_id,
                time: failedTimeMs,
                attempts: p.attempts,
                status: 'failed'
              }
            }
          }
        })
      }

      // 4. Reconstruct TrainingPlan structure
      const tasks: TrainingTask[] = []
      const allSubModes = ['tactics', 'finish_him', 'practical_chess', 'theory_endings']
      
      allSubModes.forEach(subMode => {
        const puzzlesForMode = tasks_json.puzzles.filter(p => p.sub_mode === subMode)
        if (puzzlesForMode.length > 0) {
          const catMap = new Map<string, number>()
          puzzlesForMode.forEach(p => {
            catMap.set(p.category, (catMap.get(p.category) || 0) + 1)
          })

          tasks.push({
            mode: 'playPuzzle',
            sub_mode: subMode,
            themes: Array.from(catMap.entries()).map(([name, count]) => ({ name, count }))
          })
        }
      })

      trainingPlan.value = {
        level: planData.difficulty || tasks_json.difficulty || 'Novice',
        strategy: planData.strategy || tasks_json.strategy || 'Replay',
        date: planData.date || tasks_json.date || (new Date().toISOString().split('T')[0] || ''),
        tasks
      }
      
      const nextIdx = tasks.findIndex(t => (tasksPuzzles.value[t.sub_mode]?.length || 0) > 0)
      if (nextIdx !== -1) {
        currentTaskIndex.value = nextIdx
      } else {
        currentTaskIndex.value = 0
      }
      
      isPlaying.value = true
      isFinished.value = false
      
      saveState()
      
      soundService.playSound('app_game_entry')
      playCurrentPuzzle()
      
      return true
    } catch (err) {
      console.error('[TaskTodayStore] Failed to replay plan:', err)
      return false
    }
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
    isReplay,
    completedResults,
    puzzleAttempts,
    formatMs,
    startTaskToday,
    generateAndStartPlan,
    replayPlan,
    quitTaskToday,
    pauseTaskToday,
    savePlanProgress,
    handlePuzzleSuccess,
    handlePuzzleFailure,
    startTimer,
    stopTimer,
    playCurrentPuzzle,
    clearSavedState,
    completedReport,
  }
})
