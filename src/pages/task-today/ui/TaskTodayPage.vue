<script setup lang="ts">
import { useTaskTodayStore, type PuzzleResult } from '@/features/task-today'
import { GameLayout } from '@/widgets/game-layout'
import { NText, NList, NListItem, NScrollbar } from 'naive-ui'
import { computed, onMounted, onUnmounted } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import TaskSidebar from './TaskSidebar.vue'

const taskTodayStore = useTaskTodayStore()
const analysisStore = useAnalysisStore()
const route = useRoute()

onMounted(() => {
  if (!taskTodayStore.isPlaying && !taskTodayStore.isFinished) {
    const level = (route.query.level as string) || 'Novice'
    taskTodayStore.startTaskToday(level)
  }
})

const formattedTime = computed(() => {
  return taskTodayStore.formatMs(taskTodayStore.currentTimeMs)
})

interface DisplayPuzzleItem {
  puzzle_id: string
  category: string
  difficulty: string
  rating?: number | string
  puzzle_type: string
  result?: PuzzleResult
  isCurrent: boolean
}

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

  return [...solvedItems, ...queueItems] as DisplayPuzzleItem[]
})

const getPuzzleStatus = (puzzleId: string) => {
  const result = taskTodayStore.completedResults[puzzleId]
  if (!result) return 'pending'
  return result.status
}

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

onUnmounted(() => {
  analysisStore.hidePanel()
  if (taskTodayStore.isPlaying) {
    taskTodayStore.quitTaskToday()
  }
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <TaskSidebar />
    </template>

    <template #top-info>
      <div class="top-info-banner" v-if="taskTodayStore.currentPuzzle && !taskTodayStore.isFinished">
        <div class="target-badge target-win">
          {{ taskTodayStore.currentPuzzle.puzzle_type.toUpperCase() }}
        </div>
        <span class="top-timer">{{ formattedTime }}</span>
      </div>
    </template>

    <template #center-column>
      <!-- Game board is handled by GameLayout -->
    </template>

    <template #right-panel>
      <div class="right-panel-tasks">
        <div class="task-list-header">
          <NText strong>PUZZLE QUEUE</NText>
        </div>

        <NScrollbar class="task-list-scroll">
          <NList hoverable>
            <NListItem
              v-for="(puzzle, index) in displayList"
              :key="puzzle.puzzle_id"
              :class="{ 
                active: puzzle.isCurrent,
                'status-failed': getPuzzleStatus(puzzle.puzzle_id) === 'failed',
                'status-solved': getPuzzleStatus(puzzle.puzzle_id) === 'solved'
              }"
              class="puzzle-list-item"
            >
              <div class="puzzle-row-compact">
                <div class="puzzle-index" :class="{ active: puzzle.isCurrent }">
                  {{ index + 1 }}
                </div>
                
                <div class="puzzle-stats-grid">
                  <span class="stat-rating">R: {{ puzzle.rating || '?' }}</span>
                  <div class="stat-group">
                    <span class="stat-attempts" :class="{ 'has-failed': getPuzzleStatus(puzzle.puzzle_id) === 'failed' }">
                      {{ getPuzzleStatus(puzzle.puzzle_id) === 'solved' ? 1 : 0 }}/{{ taskTodayStore.puzzleAttempts[puzzle.puzzle_id] || 0 }}
                    </span>
                    <span class="stat-timer">{{ getPuzzleStatus(puzzle.puzzle_id) === 'solved' ? taskTodayStore.formatMs(puzzle.result?.time || 0) : '00:00' }}</span>
                  </div>
                </div>
              </div>
            </NListItem>
          </NList>
        </NScrollbar>

        <div class="analysis-toggle-section">
          <AnalysisPanel v-if="analysisStore.isPanelVisible" />
        </div>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.top-info-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px 24px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
}

.target-badge {
  padding: 3px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-align: center;
  min-width: 80px;
  white-space: nowrap;
}

.target-win {
  background: rgba(0, 229, 255, 0.15);
  color: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

.top-timer {
  font-family: 'Fira Code', monospace;
  font-weight: 800;
  color: var(--neon-yellow);
  font-size: 1.1rem;
  min-width: 80px;
}

.right-panel-tasks {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.task-list-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 1px;
}

.task-list-scroll {
  flex: 1;
}

.puzzle-list-item {
  padding: 6px 12px !important;
}

.puzzle-row-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.puzzle-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.puzzle-index.active {
  background: var(--neon-bordeaux);
  color: white;
}

.puzzle-stats-grid {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  font-family: 'Fira Code', monospace;
  font-size: 0.85rem;
}

.stat-rating {
  color: var(--neon-cyan);
  font-weight: 600;
}

.stat-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-attempts {
  color: var(--color-text-3);
  background: rgba(255, 255, 255, 0.03);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 35px;
  text-align: center;
}

.stat-attempts.has-failed {
  color: #ff4d4f;
  background: rgba(255, 77, 79, 0.1);
}

.stat-timer {
  color: var(--neon-yellow);
  min-width: 45px;
  text-align: right;
}

.active {
  background-color: rgba(217, 0, 76, 0.05) !important;
}

.status-failed {
  background-color: rgba(209, 44, 44, 0.1) !important;
  border-left: 3px solid #d12c2c;
}

.status-solved {
  background-color: rgba(40, 167, 69, 0.1) !important;
  border-left: 3px solid #28a745;
}

.analysis-toggle-section {
  border-top: 1px solid var(--color-border);
  padding: 8px;
}
</style>
