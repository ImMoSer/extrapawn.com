<script setup lang="ts">
import { useTaskTodayStore } from '../model/taskToday.store'
import {
  NButton,
  NSpace
} from 'naive-ui'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const taskTodayStore = useTaskTodayStore()
const router = useRouter()
const { t } = useI18n()

const expandedMode = ref<string | null>(null)

function toggleMode(subMode: string) {
  if (expandedMode.value === subMode) {
    expandedMode.value = null
  } else {
    expandedMode.value = subMode
  }
}

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

function formatCategoryLabel(category: string): string {
  const result = category
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
  return result.charAt(0).toUpperCase() + result.slice(1)
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
  let totalFailed = 0
  let totalRatingSum = 0
  let puzzlesWithRatingCount = 0

  const subModeBreakdown = plan.tasks.map((task: { sub_mode: string }) => {
    const subMode = task.sub_mode
    const solvedList = taskTodayStore.solvedPuzzlesPerTask[subMode] || []
    const count = solvedList.length
    
    let subModeTimeMs = 0
    let subModeAttempts = 0
    let subModeFailed = 0
    let subModeRatingSum = 0
    let subModePuzzlesWithRatingCount = 0

    const categoryMap = new Map<string, { solved: number; failed: number; timeMs: number; ratingSum: number; ratingCount: number }>()

    solvedList.forEach((p: { puzzle_id: string; category?: string; rating?: number | string }) => {
      const res = results[p.puzzle_id]
      if (res) {
        const time = res.time || 0
        const attempts = res.attempts || 1
        const failed = Math.max(0, attempts - 1)
        const rating = p.rating ? Number(p.rating) : 0

        subModeTimeMs += time
        subModeAttempts += attempts
        subModeFailed += failed
        if (rating > 0) {
          subModeRatingSum += rating
          subModePuzzlesWithRatingCount++
        }

        const cat = p.category || 'default'
        if (!categoryMap.has(cat)) {
          categoryMap.set(cat, { solved: 0, failed: 0, timeMs: 0, ratingSum: 0, ratingCount: 0 })
        }
        const catStats = categoryMap.get(cat)!
        catStats.solved++
        catStats.failed += failed
        catStats.timeMs += time
        if (rating > 0) {
          catStats.ratingSum += rating
          catStats.ratingCount++
        }
      }
    })

    totalPuzzles += count
    totalTimeMs += subModeTimeMs
    totalAttempts += subModeAttempts
    totalFailed += subModeFailed
    totalRatingSum += subModeRatingSum
    puzzlesWithRatingCount += subModePuzzlesWithRatingCount

    const categories = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      solved: stats.solved,
      failed: stats.failed,
      avgTimeMs: stats.solved > 0 ? Math.round(stats.timeMs / stats.solved) : 0,
      avgRating: stats.ratingCount > 0 ? Math.round(stats.ratingSum / stats.ratingCount) : 0
    }))

    return {
      subMode,
      count,
      failedCount: subModeFailed,
      timeMs: subModeTimeMs,
      attempts: subModeAttempts,
      avgRating: subModePuzzlesWithRatingCount > 0 ? Math.round(subModeRatingSum / subModePuzzlesWithRatingCount) : 0,
      categories
    }
  })

  const accuracy = totalAttempts > 0 ? (totalPuzzles / totalAttempts) * 100 : 100
  const avgTimeMs = totalPuzzles > 0 ? totalTimeMs / totalPuzzles : 0
  const avgRating = puzzlesWithRatingCount > 0 ? Math.round(totalRatingSum / puzzlesWithRatingCount) : 0

  return {
    strategyTitle: `TODAYS ${strategyUpper} FINISHED!`,
    totalPuzzles,
    totalFailed,
    totalTimeMs,
    totalAttempts,
    accuracy,
    avgTimeMs,
    avgRating,
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
          <div class="metric-value red-glow-text">{{ finishedReport?.totalFailed ?? 0 }}</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.totalFailed', 'Fehler') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{{ formatDurationShort(finishedReport?.avgTimeMs || 0) }}</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.avgTime', 'Ø Zeit') }}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value cyan-glow-text">{{ finishedReport?.avgRating && finishedReport.avgRating > 0 ? finishedReport.avgRating : '--' }}</div>
          <div class="metric-label">{{ t('features.taskToday.completed.stats.avgRating', 'Ø Rating') }}</div>
        </div>
      </div>

      <!-- Mode breakdown list -->
      <div class="breakdown-section">
        <h3 class="breakdown-title">{{ t('features.taskToday.completed.breakdownTitle', 'DEIN REPORT') }}</h3>
        
        <div class="breakdown-list">
          <div 
            v-for="item in finishedReport?.breakdown" 
            :key="item.subMode" 
            class="breakdown-container"
          >
            <!-- Header (Klickbar) -->
            <div 
              class="breakdown-item"
              :class="{ 'is-expanded': expandedMode === item.subMode }"
              @click="toggleMode(item.subMode)"
            >
              <div class="breakdown-left">
                <span class="breakdown-badge" :class="item.subMode"></span>
                <span class="breakdown-name">{{ getSubModeLabel(item.subMode) }}</span>
                <span class="breakdown-count">({{ item.count }} {{ t('features.taskToday.completed.puzzlesCountShort', 'Aufgaben') }})</span>
              </div>
              <div class="breakdown-right">
                <span class="breakdown-rating" v-if="item.avgRating && item.avgRating > 0">
                  {{ item.avgRating }} Elo
                </span>
                <span class="breakdown-time">{{ formatDuration(item.timeMs) }}</span>
                <span class="breakdown-arrow" :class="{ 'rotated': expandedMode === item.subMode }">▼</span>
              </div>
            </div>

            <!-- Aufklappbarer Bereich mit Tabellen-Details -->
            <div 
              class="breakdown-details"
              :class="{ 'is-open': expandedMode === item.subMode }"
            >
              <table class="details-table">
                <thead>
                  <tr>
                    <th>{{ t('features.taskToday.completed.details.category', 'Kategorie') }}</th>
                    <th>{{ t('features.taskToday.completed.details.solved', 'Gelöst') }}</th>
                    <th>{{ t('features.taskToday.completed.details.failed', 'Fehler') }}</th>
                    <th>{{ t('features.taskToday.completed.details.avgTime', 'Ø Zeit') }}</th>
                    <th>{{ t('features.taskToday.completed.details.rating', 'Rating') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="cat in item.categories" :key="cat.category">
                    <td class="cat-name">{{ formatCategoryLabel(cat.category) }}</td>
                    <td class="cat-solved">{{ cat.solved }}</td>
                    <td class="cat-failed" :class="{ 'has-errors': cat.failed > 0 }">{{ cat.failed }}</td>
                    <td class="cat-time">{{ formatDurationShort(cat.avgTimeMs) }}</td>
                    <td class="cat-rating">{{ cat.avgRating > 0 ? cat.avgRating : '--' }}</td>
                  </tr>
                </tbody>
              </table>
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
  max-width: 720px;
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
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  margin-bottom: 36px;
}

@media (max-width: 600px) {
  .metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .metrics-grid > .metric-card:last-child {
    grid-column: span 2;
  }
}

.metric-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 14px 8px;
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
  font-size: 1.4rem;
  font-weight: 850;
  color: var(--neon-cyan, #00e5ff);
  font-family: 'Fira Code', monospace;
  margin-bottom: 4px;
}

.metric-value.red-glow-text {
  color: var(--neon-bordeaux, #d9004c);
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.metric-value.cyan-glow-text {
  color: var(--neon-cyan, #00e5ff);
  text-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

.metric-label {
  font-size: 0.7rem;
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

.breakdown-container {
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.03);
  transition: all 0.3s ease;
}

.breakdown-container:hover {
  border-color: rgba(255, 255, 255, 0.08);
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-left: 4px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  user-select: none;
  transition: all 0.2s ease;
}

.breakdown-item:hover {
  background: rgba(255, 255, 255, 0.02);
}

.breakdown-item.is-expanded {
  background: rgba(255, 255, 255, 0.03);
}

.breakdown-container:nth-child(1) .breakdown-item { border-left-color: var(--neon-bordeaux, #d9004c); }
.breakdown-container:nth-child(2) .breakdown-item { border-left-color: #e67e22; }
.breakdown-container:nth-child(3) .breakdown-item { border-left-color: #f1c40f; }
.breakdown-container:nth-child(4) .breakdown-item { border-left-color: #9b59b6; }

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

.breakdown-rating {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--neon-cyan, #00e5ff);
  background: rgba(0, 229, 255, 0.08);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(0, 229, 255, 0.15);
  margin-right: 16px;
  font-family: 'Fira Code', monospace;
}

.breakdown-time {
  font-weight: 700;
  color: var(--neon-yellow, #f1c40f);
  font-family: 'Fira Code', monospace;
  font-size: 0.95rem;
}

.breakdown-arrow {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.3);
  margin-left: 12px;
  transition: transform 0.3s ease;
}

.breakdown-arrow.rotated {
  transform: rotate(180deg);
  color: rgba(255, 255, 255, 0.7);
}

.breakdown-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease;
  background: rgba(0, 0, 0, 0.25);
  padding: 0 20px;
}

.breakdown-details.is-open {
  max-height: 500px;
  padding: 16px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.details-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.85rem;
}

.details-table th {
  color: rgba(255, 255, 255, 0.4);
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.7rem;
  letter-spacing: 1px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.details-table td {
  padding: 10px 0;
  color: #ccc;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}

.details-table tr:last-child td {
  border-bottom: none;
}

.cat-name {
  font-weight: 700;
  color: #fff;
}

.cat-solved {
  color: #2ecc71;
  font-family: 'Fira Code', monospace;
}

.cat-failed {
  font-family: 'Fira Code', monospace;
}

.cat-failed.has-errors {
  color: var(--neon-bordeaux, #d9004c);
  font-weight: bold;
}

.cat-time {
  color: rgba(255, 255, 255, 0.6);
  font-family: 'Fira Code', monospace;
}

.cat-rating {
  color: var(--neon-cyan, #00e5ff);
  font-family: 'Fira Code', monospace;
  font-weight: 600;
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

@media (max-width: 768px) {
  .completed-screen {
    padding: 20px 12px;
  }
  .completed-content {
    padding: 24px 16px;
  }
  .completed-title-glow {
    font-size: 1.6rem;
    letter-spacing: 1px;
  }
}

@media (max-width: 600px) {
  .completed-hero-stats {
    flex-direction: column;
    gap: 8px;
    padding: 12px;
  }
  .hero-stat-main {
    font-size: 1.2rem;
  }
  .hero-stat-separator {
    display: none;
  }
  .metric-value {
    font-size: 1.15rem;
  }
  .metric-label {
    font-size: 0.65rem;
  }
  .breakdown-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
  }
  .breakdown-right {
    width: 100%;
    justify-content: space-between;
  }
  .breakdown-details.is-open {
    overflow-x: auto;
  }
  .details-table {
    min-width: 480px;
  }
  .completed-actions :deep(.n-space) {
    flex-direction: column !important;
    align-items: stretch !important;
    width: 100%;
  }
  .completed-action-btn {
    width: 100% !important;
  }
}
</style>
