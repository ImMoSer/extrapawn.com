<script setup lang="ts">
import { 
  useTaskTodayStore, 
  TaskTodayDashboard, 
  TaskTodayReport, 
  TaskSidebar, 
  TaskPlayTopInfo, 
  TaskPlayRightPanel 
} from '@/features/task-today'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { useAnalysisStore } from '@/features/analysis'
import { onBeforeRouteLeave } from 'vue-router'
import { onMounted, onUnmounted } from 'vue'

const taskTodayStore = useTaskTodayStore()
const analysisStore = useAnalysisStore()

onMounted(() => {
  // Try to load local state first, but ensure we stay on the dashboard/history by forcing isPlaying to false
  if (!taskTodayStore.isPlaying && !taskTodayStore.isFinished) {
    taskTodayStore.startTaskToday(false).then(() => {
      taskTodayStore.isPlaying = false
      taskTodayStore.stopTimer()
    })
  }
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

onUnmounted(() => {
  analysisStore.hidePanel()
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
      <CoachSidebarWidget v-if="taskTodayStore.isHelpActive" />
      <TaskPlayRightPanel v-else />
    </template>
  </GameLayout>
</template>
