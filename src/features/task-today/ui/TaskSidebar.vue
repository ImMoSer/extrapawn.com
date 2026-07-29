<script setup lang="ts">
import { useTaskTodayStore, type PuzzleResult } from '../model/taskToday.store'
import { NButton, NIcon, NText, NScrollbar } from 'naive-ui'
import { RefreshOutline as RestartIcon, ChevronForwardOutline } from '@vicons/ionicons5'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const taskTodayStore = useTaskTodayStore()
const router = useRouter()

interface DisplayPuzzleItem {
  puzzle_id: string
  category: string
  difficulty: string
  rating?: number | string
  puzzle_type: string
  result?: PuzzleResult
  isCurrent: boolean
}

function handleGoToStart() {
  taskTodayStore.isFinished = false
  taskTodayStore.isPlaying = false
  taskTodayStore.trainingPlan = null
  router.push('/')
}

function handleRestart() {
  taskTodayStore.playCurrentPuzzle()
}

function selectTask(index: number) {
  taskTodayStore.currentTaskIndex = index
  taskTodayStore.playCurrentPuzzle()
}

const tasks = computed(() => taskTodayStore.trainingPlan?.tasks || [])

const isTaskCompleted = (subMode: string) => {
  return taskTodayStore.tasksPuzzles[subMode]?.length === 0
}

const solvedTimesSumMs = computed(() => {
  return Object.values(taskTodayStore.completedResults)
    .filter((r) => r.status === 'solved')
    .reduce((sum, r) => sum + r.time, 0)
})

const solvedPuzzlesCount = computed(() => {
  return Object.values(taskTodayStore.completedResults).filter((r) => r.status === 'solved').length
})

const totalAttemptsCount = computed(() => {
  return Object.values(taskTodayStore.puzzleAttempts).reduce((sum, att) => sum + att, 0)
})

const displayList = computed(() => {
  if (!taskTodayStore.activeTask) return []

  const subMode = taskTodayStore.activeTask.sub_mode
  const results = taskTodayStore.completedResults
  const solved = taskTodayStore.solvedPuzzlesPerTask[subMode] || []
  const queue = taskTodayStore.tasksPuzzles[subMode] || []

  const solvedItems = solved.map((p) => ({
    ...p,
    result: results[p.puzzle_id],
    isCurrent: false,
  }))

  const queueItems = queue.map((p, index) => ({
    ...p,
    result: results[p.puzzle_id],
    isCurrent: index === 0,
  }))

  return [...queueItems, ...solvedItems] as DisplayPuzzleItem[]
})

const getPuzzleStatus = (puzzleId: string) => {
  const result = taskTodayStore.completedResults[puzzleId]
  if (!result) return 'pending'
  return result.status
}
</script>

<template>
  <div class="h-full flex flex-col gap-3 p-3 bg-slate-950/60 backdrop-blur-md border-r border-slate-800/80 text-slate-100 select-none overflow-hidden">
    <!-- Header Title -->
    <h2 class="font-display font-black text-base text-center tracking-wider text-pink-500 drop-shadow-[0_0_10px_rgba(217,0,76,0.3)] uppercase">
      TaskToday ({{ taskTodayStore.trainingPlan?.level || 'Novice' }})
    </h2>

    <!-- State: Finished -->
    <div v-if="taskTodayStore.isFinished" class="flex-1 flex flex-col items-center justify-center gap-3">
      <NText type="success" class="font-display font-bold text-sm tracking-wider">
        TRAINING COMPLETED
      </NText>
      <NButton type="primary" size="small" @click="handleGoToStart">
        {{ t('shared.buttons.back') }}
      </NButton>
    </div>

    <!-- State: No Plan -->
    <div v-else-if="!taskTodayStore.trainingPlan" class="flex-1 flex flex-col items-center justify-center gap-3">
      <NText depth="3" class="text-xs">
        {{ t('features.taskToday.noPlan', 'Kein aktiver Trainingsplan') }}
      </NText>
      <NButton type="primary" size="small" class="font-bold" @click="handleGoToStart">
        Zum Dashboard gehen
      </NButton>
    </div>

    <!-- Main Active Tasks Container -->
    <div v-else class="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
      <!-- Task Selector Tabs -->
      <div class="flex flex-col gap-1.5 flex-shrink-0">
        <div
          v-for="(task, index) in tasks"
          :key="task.sub_mode"
          class="flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer text-xs"
          :class="[
            taskTodayStore.currentTaskIndex === index
              ? 'border-pink-500/80 bg-pink-500/10 text-slate-100 shadow-[0_0_8px_rgba(217,0,76,0.2)]'
              : isTaskCompleted(task.sub_mode)
                ? 'border-emerald-500/40 bg-emerald-500/10 opacity-75'
                : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/50 text-slate-300'
          ]"
          @click="selectTask(index)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="font-display font-bold text-[11px] uppercase tracking-wider shrink-0">
              {{ task.sub_mode.replace('_', ' ') }}
            </span>
            <span class="text-[10px] text-slate-400 truncate flex-1">
              ({{ task.themes.map((t) => t.name).join(', ') }})
            </span>
            <span class="font-condensed font-semibold text-[11px] text-slate-400 shrink-0 ml-auto">
              {{ taskTodayStore.tasksPuzzles[task.sub_mode]?.length || 0 }} left
            </span>
          </div>
          <NIcon v-if="taskTodayStore.currentTaskIndex === index" class="ml-1 text-pink-400">
            <ChevronForwardOutline />
          </NIcon>
        </div>
      </div>

      <!-- Puzzle Queue Section -->
      <div class="flex-1 flex flex-col min-h-0 border border-slate-800/80 rounded-lg bg-slate-900/30 overflow-hidden">
        <div class="px-3 py-1.5 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between">
          <span class="font-display font-bold text-[11px] tracking-wider text-slate-400 uppercase">
            Puzzle Queue
          </span>
          <span class="font-condensed font-semibold text-[11px] text-slate-500">
            {{ displayList.length }} Puzzles
          </span>
        </div>

        <NScrollbar class="flex-1">
          <div class="divide-y divide-slate-800/50">
            <div
              v-for="(puzzle, index) in displayList"
              :key="puzzle.puzzle_id"
              class="flex items-center justify-between p-2 text-xs transition-colors"
              :class="[
                puzzle.isCurrent ? 'bg-pink-500/10 border-l-2 border-l-pink-500' : '',
                getPuzzleStatus(puzzle.puzzle_id) === 'failed' ? 'bg-red-500/10 border-l-2 border-l-red-500' : '',
                getPuzzleStatus(puzzle.puzzle_id) === 'solved' ? 'bg-emerald-500/10 border-l-2 border-l-emerald-500' : ''
              ]"
            >
              <!-- Left: Index + Rating -->
              <div class="flex items-center gap-2">
                <span
                  class="w-5 h-5 flex items-center justify-center rounded text-[11px] font-condensed font-bold shrink-0"
                  :class="puzzle.isCurrent ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'"
                >
                  {{ index + 1 }}
                </span>
                <span class="font-condensed font-bold text-cyan-400 text-[12px]">
                  R: {{ puzzle.rating || '?' }}
                </span>
              </div>

              <!-- Right: Attempts + Timer -->
              <div class="flex items-center gap-2">
                <span
                  class="font-condensed text-[11px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-300"
                  :class="{ 'text-red-400 bg-red-500/20': getPuzzleStatus(puzzle.puzzle_id) === 'failed' }"
                >
                  {{ getPuzzleStatus(puzzle.puzzle_id) === 'solved' ? 1 : 0 }}/{{ taskTodayStore.puzzleAttempts[puzzle.puzzle_id] || 0 }}
                </span>

                <span class="font-condensed font-semibold text-[11px] text-yellow-400 min-w-[45px] text-right">
                  {{ getPuzzleStatus(puzzle.puzzle_id) === 'solved' ? taskTodayStore.formatMs(puzzle.result?.time || 0) : '00:00' }}
                </span>
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>

      <!-- Footer: Timer & Stats & Restart -->
      <div class="mt-auto flex flex-col gap-2 pt-2 border-t border-slate-800/80 shrink-0">
        <div class="bg-slate-900/80 border border-yellow-500/30 rounded-lg p-2 flex flex-col items-center justify-center gap-0.5 shadow-inner">
          <div class="font-condensed font-black text-xl text-yellow-400 tracking-wider">
            {{ taskTodayStore.formatMs(solvedTimesSumMs) }}
          </div>
          <div class="font-condensed font-bold text-xs text-cyan-400 opacity-90">
            Solved: {{ solvedPuzzlesCount }} / {{ totalAttemptsCount }} Attempts
          </div>
        </div>

        <NButton
          block
          size="small"
          type="warning"
          @click="handleRestart"
        >
          <template #icon>
            <NIcon><RestartIcon /></NIcon>
          </template>
          Restart Puzzle
        </NButton>
      </div>
    </div>
  </div>
</template>
