<script setup lang="ts">
import { 
  useTaskTodayStore, 
  TaskTodayDashboard, 
  TaskTodayReport, 
  TaskSidebar, 
  TaskPlayTopInfo, 
} from '@/features/task-today'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { onMounted, onUnmounted } from 'vue'

defineProps({
  planId: {
    type: String,
    default: undefined,
  },
  puzzleType: {
    type: String,
    default: undefined,
  },
  puzzleId: {
    type: String,
    default: undefined,
  },
})

const taskTodayStore = useTaskTodayStore()

onMounted(() => {
  // Try to load local state first, but ensure we stay on the dashboard/history by forcing isPlaying to false
  if (!taskTodayStore.isPlaying && !taskTodayStore.isFinished) {
    taskTodayStore.startTaskToday(false).then(() => {
      taskTodayStore.isPlaying = false
      taskTodayStore.stopTimer()
    })
  }
})

onUnmounted(() => {
  if (taskTodayStore.isPlaying) {
    taskTodayStore.pauseTaskToday()
  }
})
</script>

<template>
  <TaskTodayDashboard v-if="!taskTodayStore.isPlaying && !taskTodayStore.isFinished" />
  <TaskTodayReport v-else-if="taskTodayStore.isFinished" />
  <GameLayout v-else>
    <template #left-panel>
      <TaskSidebar />
    </template>
    <template #top-info>
      <TaskPlayTopInfo />
    </template>
    <template #center-column>
      <!-- Game board is handled by GameLayout -->
    </template>
    <template #right-panel>
      <CoachSidebarWidget />
    </template>
  </GameLayout>
</template>
