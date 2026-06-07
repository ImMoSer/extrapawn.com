<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { CoachSidebar, useCoachStore } from '@/features/coach'
import { NButton } from 'naive-ui'
import { useTaskTodayStore } from '@/features/task-today'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const taskTodayStore = useTaskTodayStore()
const coachStore = useCoachStore()

onMounted(() => {
  // Enable the Coach completely (spins up coach engine for current position, renders coach shapes)
  coachStore.setCoachEnabled(true)
})

onUnmounted(() => {
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <div class="coach-widget-container">
    <div v-if="taskTodayStore.isHelpActive" class="help-done-header">
      <NButton block type="warning" class="done-btn" @click="taskTodayStore.stopHelpMode()">
        {{ t('features.taskToday.helpDone') }}
      </NButton>
    </div>
    <div class="sidebar-inner">
      <CoachSidebar />
    </div>
  </div>
</template>

<style scoped>
.coach-widget-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.sidebar-inner {
  flex: 1;
  min-height: 0;
}
.help-done-header {
  padding: 8px 14px;
  background: rgba(247, 213, 71, 0.1);
  border-bottom: 1px solid rgba(247, 213, 71, 0.2);
}
.done-btn {
  font-weight: bold;
}
</style>
