<script setup lang="ts">
import { useTaskTodayStore } from '../model/taskToday.store'
import { NButton, NIcon } from 'naive-ui'
import { CloseCircleOutline, RefreshOutline as RestartIcon } from '@vicons/ionicons5'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const taskTodayStore = useTaskTodayStore()
const router = useRouter()

const formattedTime = computed(() => {
  return taskTodayStore.formatMs(taskTodayStore.currentTimeMs)
})

function handleExit() {
  taskTodayStore.pauseTaskToday()
  router.push('/')
}

function handleRestart() {
  taskTodayStore.playCurrentPuzzle()
}
</script>

<template>
  <div class="top-info-banner" v-if="taskTodayStore.currentPuzzle && !taskTodayStore.isFinished">
    <div class="side-action left">
      <NButton circle quaternary type="error" size="small" @click="handleExit">
        <template #icon>
          <NIcon><CloseCircleOutline /></NIcon>
        </template>
      </NButton>
    </div>

    <div class="center-meta">
      <div class="target-badge target-win">
        {{ taskTodayStore.currentPuzzle.puzzle_type.toUpperCase() }}
      </div>
      <span class="top-timer">{{ formattedTime }}</span>
    </div>

    <div class="side-action right">
      <NButton circle quaternary type="warning" size="small" @click="handleRestart">
        <template #icon>
          <NIcon><RestartIcon /></NIcon>
        </template>
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.top-info-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 12px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
}

.center-meta {
  display: flex;
  align-items: center;
  gap: 24px;
}

.side-action {
  display: flex;
  align-items: center;
  min-width: 32px;
}

.side-action.left {
  justify-content: flex-start;
}

.side-action.right {
  justify-content: flex-end;
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
</style>
