<script setup lang="ts">
import { useTaskTodayStore } from '@/features/task-today'
import { NButton, NIcon, NText, NScrollbar, NSpace } from 'naive-ui'
import { CloseCircleOutline, RefreshOutline as RestartIcon, ChevronForwardOutline } from '@vicons/ionicons5'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const taskTodayStore = useTaskTodayStore()
const router = useRouter()

function handleQuit() {
  taskTodayStore.quitTaskToday()
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
</script>

<template>
  <div class="task-sidebar">
    <h2 class="sidebar-title">TaskToday ({{ taskTodayStore.trainingPlan?.level || 'Novice' }})</h2>

    <div v-if="taskTodayStore.isFinished" class="finished-state">
      <NText type="success" strong>TRAINING COMPLETED</NText>
      <NButton type="primary" @click="handleQuit" style="margin-top: 1rem">
        {{ t('common.actions.back') }}
      </NButton>
    </div>

    <div v-else-if="!taskTodayStore.trainingPlan" class="no-plan-state">
      <NText depth="3">{{ t('features.taskToday.noPlan', 'Kein aktiver Trainingsplan') }}</NText>
      <NButton type="primary" @click="handleQuit" style="margin-top: 1rem; font-weight: bold;">
        Zum Dashboard gehen
      </NButton>
    </div>

    <div v-else class="tasks-container">
      <NScrollbar>
        <div class="task-tabs">
          <div 
            v-for="(task, index) in tasks" 
            :key="task.sub_mode"
            class="task-tab"
            :class="{ 
              active: taskTodayStore.currentTaskIndex === index,
              completed: isTaskCompleted(task.sub_mode)
            }"
            @click="selectTask(index)"
          >
            <div class="task-tab-content">
              <div class="task-row">
                <NText strong class="task-name">{{ task.sub_mode.replace('_', ' ').toUpperCase() }}</NText>
                <NText depth="3" class="task-themes">({{ task.themes.map(t => t.name).join(', ') }})</NText>
                <NText depth="3" class="task-status">{{ taskTodayStore.tasksPuzzles[task.sub_mode]?.length || 0 }} left</NText>
              </div>
            </div>
            <NIcon v-if="taskTodayStore.currentTaskIndex === index"><ChevronForwardOutline /></NIcon>
          </div>
        </div>
      </NScrollbar>

      <div class="sidebar-footer">
        <div class="timer-display">
          {{ taskTodayStore.formatMs(taskTodayStore.currentTimeMs) }}
        </div>
        
        <NSpace vertical block>
          <NButton block type="warning" @click="handleRestart">
            <template #icon><NIcon><RestartIcon /></NIcon></template>
            Restart Puzzle
          </NButton>

          <NButton block type="error" dashed @click="handleQuit">
            <template #icon><NIcon><CloseCircleOutline /></NIcon></template>
            Quit Run
          </NButton>
        </NSpace>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 20px;
  background: var(--color-bg-secondary);
}

.sidebar-title {
  color: var(--neon-bordeaux, #d9004c);
  font-weight: 900;
  letter-spacing: 2px;
  text-align: center;
  margin: 0;
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.tasks-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: hidden;
}

.task-tabs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-tab {
  padding: 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  transition: all 0.2s ease;
}

.task-tab:hover {
  background: rgba(255, 255, 255, 0.08);
}

.task-tab.active {
  border-color: var(--neon-bordeaux);
  background: rgba(217, 0, 76, 0.1);
}

.task-tab.completed {
  border-color: var(--color-success);
  opacity: 0.7;
}

.task-tab-content {
  flex: 1;
  min-width: 0;
}

.task-row {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.task-name {
  font-size: 0.85rem;
  flex-shrink: 0;
}

.task-themes {
  font-size: 0.75rem;
  opacity: 0.6;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.task-status {
  font-size: 0.75rem;
  flex-shrink: 0;
  margin-left: auto;
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.timer-display {
  font-family: monospace;
  font-size: 2.2rem;
  font-weight: 800;
  text-align: center;
  color: var(--neon-yellow, #f7d547);
  background: #111;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(247, 213, 71, 0.3);
}

.finished-state, .no-plan-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.history-section {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 12px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.history-title {
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 800;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.history-item-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-item-meta {
  display: flex;
  align-items: center;
  font-size: 0.8rem;
}
</style>
