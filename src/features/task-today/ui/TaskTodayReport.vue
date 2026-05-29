<script setup lang="ts">
import { useTaskTodayStore } from '../model/taskToday.store'
import {
  NButton,
  NSpace
} from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const taskTodayStore = useTaskTodayStore()
const router = useRouter()
const { t } = useI18n()

function handleGoToDashboard() {
  taskTodayStore.clearSavedState()
  window.location.href = '/task-today'
}

function handleGoToStart() {
  handleGoToDashboard()
  router.push('/')
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []

  if (hours > 0) {
    const hrLabel = hours === 1 
      ? t('features.taskToday.completed.duration.hour', 'Stunde') 
      : t('features.taskToday.completed.duration.hours', 'Stunden')
    parts.push(`${hours} ${hrLabel}`)
  }

  if (minutes > 0 || hours > 0) {
    const minLabel = minutes === 1 
      ? t('features.taskToday.completed.duration.minute', 'Minute') 
      : t('features.taskToday.completed.duration.minutes', 'Minuten')
    parts.push(`${minutes} ${minLabel}`)
  }

  const secLabel = seconds === 1 
    ? t('features.taskToday.completed.duration.second', 'Sekunde') 
    : t('features.taskToday.completed.duration.seconds', 'Sekunden')
  parts.push(`${seconds} ${secLabel}`)

  return parts.join(' ')
}

function formatDurationShort(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

function getSubModeLabel(subMode: string): string {
  switch (subMode) {
    case 'tactics':
      return t('features.taskToday.completed.modes.tactics', 'TACTICS')
    case 'finish_him':
      return t('features.taskToday.completed.modes.finish_him', 'FINISH HIM')
    case 'practical_chess':
      return t('features.taskToday.completed.modes.practical_chess', 'PRACTICAL CHESS')
    case 'theory_endings':
      return t('features.taskToday.completed.modes.theory_endings', 'THEORY ENDINGS')
    default:
      return subMode.replace('_', ' ').toUpperCase()
  }
}

const finishedReport = computed(() => {
  if (taskTodayStore.completedReport) {
    return taskTodayStore.completedReport
  }

  const plan = taskTodayStore.trainingPlan
  if (!plan) return null

  const strategyUpper = (plan.strategy || 'TRAINING').toUpperCase()
  const results = taskTodayStore.completedResults

  let totalPuzzles = 0
  let totalTimeMs = 0
  let totalAttempts = 0

  const subModeBreakdown = plan.tasks.map(task => {
    const subMode = task.sub_mode
    const solvedList = taskTodayStore.solvedPuzzlesPerTask[subMode] || []
    const count = solvedList.length
    
    let subModeTimeMs = 0
    let subModeAttempts = 0
    solvedList.forEach(p => {
      const res = results[p.puzzle_id]
      if (res) {
        if (res.time) {
          subModeTimeMs += res.time
        }
        if (res.attempts) {
          subModeAttempts += res.attempts
        }
      }
    })

    totalPuzzles += count
    totalTimeMs += subModeTimeMs
    totalAttempts += subModeAttempts

    return {
      subMode,
      count,
      timeMs: subModeTimeMs,
      attempts: subModeAttempts
    }
  })

  const accuracy = totalAttempts > 0 ? (totalPuzzles / totalAttempts) * 100 : 100
  const avgTimeMs = totalPuzzles > 0 ? totalTimeMs / totalPuzzles : 0

  return {
    strategyTitle: `TODAYS ${strategyUpper} FINISHED!`,
    totalPuzzles,
    totalTimeMs,
    totalAttempts,
    accuracy,
    avgTimeMs,
    breakdown: subModeBreakdown
  }
})
</script>

<template>
  <div class="completed-screen">
    <div class="completed-content">
      <!-- Title Section with Neon effect -->
      <h1 class="completed-title-glow">
        {{ finishedReport?.strategyTitle }}
      </h1>
      
      <!-- Big stats summary -->
      <div class="completed-hero-stats">
        <div class="hero-stat-main">
          {{ finishedReport?.totalPuzzles }} {{ t('features.taskToday.completed.puzzles', 'Puzzles') }}
        </div>
        <div class="hero-stat-separator">/</div>
        <div class="hero-stat-main">
          {{ formatDuration(finishedReport?.totalTimeMs || 0) }}
        </div>
      </div>

      <!-- Quick Metrics Cards -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-value">{{ finishedReport?.accuracy.toFixed(1) }}%</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.accuracy', 'Genauigkeit') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{ finishedReport?.totalAttempts }}</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.totalAttempts', 'Versuche') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{ formatDurationShort(finishedReport?.avgTimeMs || 0) }}</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.avgTime', 'Ø Zeit') }}</div>
        </div>
      </div>

      <!-- Mode breakdown list -->
      <div class="breakdown-section">
        <h3 class="breakdown-title">{{ t('features.taskToday.completed.breakdownTitle', 'DEIN REPORT') }}</h3>
        
        <div class="breakdown-list">
          <div 
            v-for="item in finishedReport?.breakdown" 
            :key="item.subMode" 
            class="breakdown-item"
          >
            <div class="breakdown-left">
              <span class="breakdown-badge" :class="item.subMode"></span>
              <span class="breakdown-name">{{ getSubModeLabel(item.subMode) }}</span>
              <span class="breakdown-count">({{ item.count }} {{ t('features.taskToday.completed.puzzlesCountShort', 'Aufgaben') }})</span>
            </div>
            <div class="breakdown-right">
              <span class="breakdown-time">{{ formatDuration(item.timeMs) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="completed-actions">
        <NSpace justify="center" size="large">
          <NButton type="primary" size="large" @click="handleGoToStart" class="completed-action-btn primary">
            {{ t('features.taskToday.completed.backToStart', 'Zurück zur Startseite') }}
          </NButton>
          <NButton secondary size="large" @click="handleGoToDashboard" class="completed-action-btn">
            {{ t('features.taskToday.completed.startAnother', 'Anderen Plan starten') }}
          </NButton>
        </NSpace>
      </div>
    </div>
  </div>
</template>

<style scoped>
.completed-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding: 40px 24px;
}

.completed-content {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  padding: 48px;
  max-width: 680px;
  width: 100%;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 
              0 0 30px rgba(217, 0, 76, 0.05);
  text-align: center;
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.completed-title-glow {
  font-size: 2.2rem;
  font-weight: 950;
  letter-spacing: 2px;
  margin: 0 0 16px 0;
  color: var(--neon-bordeaux, #d9004c);
  text-shadow: 0 0 15px rgba(217, 0, 76, 0.4);
  text-transform: uppercase;
}

.completed-hero-stats {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
  background: rgba(255, 255, 255, 0.03);
  padding: 16px 24px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.hero-stat-main {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
}

.hero-stat-separator {
  font-size: 1.5rem;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.2);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 36px;
}

.metric-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.3s ease;
}

.metric-card:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.1);
}

.metric-value {
  font-size: 1.6rem;
  font-weight: 850;
  color: var(--neon-cyan, #00e5ff);
  font-family: 'Fira Code', monospace;
  margin-bottom: 4px;
}

.metric-label {
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--color-text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.breakdown-section {
  text-align: left;
  margin-bottom: 40px;
}

.breakdown-title {
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 16px;
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 8px;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.15);
  padding: 14px 20px;
  border-radius: 10px;
  border-left: 4px solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s ease;
}

.breakdown-item:hover {
  background: rgba(255, 255, 255, 0.03);
  transform: translateX(4px);
}

.breakdown-item:nth-child(1) { border-left-color: var(--neon-bordeaux, #d9004c); }
.breakdown-item:nth-child(2) { border-left-color: #e67e22; }
.breakdown-item:nth-child(3) { border-left-color: #f1c40f; }
.breakdown-item:nth-child(4) { border-left-color: #9b59b6; }

.breakdown-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.breakdown-badge {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}

.breakdown-badge.tactics { background: var(--neon-bordeaux, #d9004c); }
.breakdown-badge.finish_him { background: #e67e22; }
.breakdown-badge.practical_chess { background: #f1c40f; }
.breakdown-badge.theory_endings { background: #9b59b6; }

.breakdown-name {
  font-weight: 800;
  font-size: 0.95rem;
  color: #eee;
  letter-spacing: 0.5px;
}

.breakdown-count {
  font-size: 0.8rem;
  color: var(--color-text-muted, #777);
  font-weight: bold;
}

.breakdown-right {
  display: flex;
  align-items: center;
}

.breakdown-time {
  font-weight: 700;
  color: var(--neon-yellow, #f1c40f);
  font-family: 'Fira Code', monospace;
  font-size: 0.95rem;
}

.completed-actions {
  margin-top: 24px;
}

.completed-action-btn {
  font-weight: bold !important;
  height: 46px !important;
  border-radius: 8px !important;
  padding: 0 24px !important;
}

.completed-action-btn.primary {
  background-color: var(--neon-bordeaux, #d9004c) !important;
  box-shadow: 0 0 10px rgba(217, 0, 76, 0.25);
}

.completed-action-btn.primary:hover {
  background-color: #ff0055 !important;
  box-shadow: 0 0 20px rgba(255, 0, 85, 0.4);
}
</style>
