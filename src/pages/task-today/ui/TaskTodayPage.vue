<script setup lang="ts">
import { useTaskTodayStore, type PuzzleResult } from '@/features/task-today'
import { GameLayout } from '@/widgets/game-layout'
import {
  NText,
  NList,
  NListItem,
  NScrollbar,
  NButton,
  NIcon,
  NTag,
  NResult,
  NSpace,
  useMessage
} from 'naive-ui'
import {
  CloseCircleOutline,
  RefreshOutline as RestartIcon,
  ChevronForwardOutline,
  TimeOutline
} from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import { useAuthStore } from '@/entities/user'
import {
  useCurrentTrainingPlanQuery,
  useTrainingPlanHistoryQuery
} from '@/shared/api/queries/userCabinet.queries'
import { useQueryClient } from '@tanstack/vue-query'
import type { DailyTrainingPlanEntity, RecommendationEntry } from '@/shared/types/api.types'
import TaskSidebar from './TaskSidebar.vue'

const taskTodayStore = useTaskTodayStore()
const analysisStore = useAnalysisStore()
const authStore = useAuthStore()
const router = useRouter()
const message = useMessage()
const queryClient = useQueryClient()

const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
const selectedStrategy = ref<'Discovery' | 'Hardcore' | 'Warmup'>('Discovery')
const isStartingPlan = ref(false)

const isAuth = computed(() => authStore.isAuthenticated)

// Query for current plan status
const { data: currentPlanData } = useCurrentTrainingPlanQuery(isAuth.value)

// Query for history
const { data: historyData } = useTrainingPlanHistoryQuery(isAuth.value)

// Extract completed difficulties for today
const completedDifficulties = computed(() => {
  return currentPlanData.value?.completed_difficulties || []
})

// Automatically set the first non-completed difficulty
watch(completedDifficulties, (newVal) => {
  if (newVal.includes(selectedDifficulty.value)) {
    const remaining = (['Novice', 'Pro', 'Master'] as const).find(d => !newVal.includes(d))
    if (remaining) {
      selectedDifficulty.value = remaining
    }
  }
}, { immediate: true })

onMounted(() => {
  // Try to load local state first
  if (!taskTodayStore.isPlaying && !taskTodayStore.isFinished) {
    taskTodayStore.startTaskToday().then((resumed) => {
      // If no local state but backend has an active plan, resume from backend
      if (!resumed && currentPlanData.value?.active && currentPlanData.value?.plan) {
        console.log('[TaskTodayPage] Active plan on backend detected. Resuming from backend data...')
        taskTodayStore.replayPlan(currentPlanData.value)
      }
    })
  }
})

// Watch for backend current plan updates to resume if local state is missing
watch(() => currentPlanData.value, (newVal) => {
  if (newVal?.active && newVal?.plan && !taskTodayStore.isPlaying) {
    console.log('[TaskTodayPage] Active plan detected via API watch. Resuming...')
    taskTodayStore.replayPlan(newVal)
  }
})

const recommendedStrategies = computed(() => {
  const recommendations = currentPlanData.value?.recommendations
  if (!recommendations) {
    return {
      Discovery: { tactics: [], finish_him: [], theory_endings: [], practical_chess: [] } as Record<string, string[]>,
      Hardcore: { tactics: [], finish_him: [], theory_endings: [], practical_chess: [] } as Record<string, string[]>,
      Warmup: { tactics: [], finish_him: [], theory_endings: [], practical_chess: [] } as Record<string, string[]>
    }
  }

  const formatStrategy = (list: RecommendationEntry[]) => {
    const result: Record<string, string[]> = {
      tactics: [],
      finish_him: [],
      theory_endings: [],
      practical_chess: []
    }
    list.forEach(item => {
      const mode = item.sub_mode as keyof typeof result
      if (result[mode]) {
        result[mode].push(item.category)
      }
    })
    return result
  }

  return {
    Discovery: formatStrategy(recommendations.discovery || []),
    Hardcore: formatStrategy(recommendations.hardcore || []),
    Warmup: formatStrategy(recommendations.warmup || [])
  }
})

const selectedPlanPreview = computed(() => {
  const strategy = selectedStrategy.value
  const diff = selectedDifficulty.value
  const recs = recommendedStrategies.value[strategy]
  if (!recs) return null

  const scaling = {
    Novice: { tactics: 3, others: 1, limitTactics: 20, limitOthers: 10 },
    Pro: { tactics: 4, others: 2, limitTactics: 30, limitOthers: 10 },
    Master: { tactics: 5, others: 3, limitTactics: 40, limitOthers: 10 }
  }[diff]

  const tacticsCats = (recs.tactics || []).slice(0, scaling.tactics)
  const finishCats = (recs.finish_him || []).slice(0, scaling.others)
  const theoryCats = (recs.theory_endings || []).slice(0, scaling.others)
  const practicalCats = (recs.practical_chess || []).slice(0, scaling.others)

  const totalTasks = (tacticsCats.length * scaling.limitTactics) +
                     (finishCats.length * scaling.limitOthers) +
                     (theoryCats.length * scaling.limitOthers) +
                     (practicalCats.length * scaling.limitOthers)

  return {
    difficulty: diff,
    strategy,
    totalTasks,
    groups: [
      {
        name: 'Tactics',
        total: tacticsCats.length * scaling.limitTactics,
        limit: scaling.limitTactics,
        categories: tacticsCats
      },
      {
        name: 'Finish Him',
        total: finishCats.length * scaling.limitOthers,
        limit: scaling.limitOthers,
        categories: finishCats
      },
      {
        name: 'Practical Chess',
        total: practicalCats.length * scaling.limitOthers,
        limit: scaling.limitOthers,
        categories: practicalCats
      },
      {
        name: 'Theory Endings',
        total: theoryCats.length * scaling.limitOthers,
        limit: scaling.limitOthers,
        categories: theoryCats
      }
    ].filter(g => g.categories.length > 0)
  }
})

const handleStartPlan = async () => {
  isStartingPlan.value = true
  try {
    const rawRecommendations = currentPlanData.value?.recommendations
    if (!rawRecommendations) throw new Error('No recommendations available')

    const strategyList = {
      Discovery: rawRecommendations.discovery,
      Hardcore: rawRecommendations.hardcore,
      Warmup: rawRecommendations.warmup
    }[selectedStrategy.value]

    const formattedRecs: Record<string, string[]> = {
      tactics: [],
      finish_him: [],
      theory_endings: [],
      practical_chess: []
    }
    strategyList.forEach(item => {
      const mode = item.sub_mode as keyof typeof formattedRecs
      if (formattedRecs[mode]) {
        formattedRecs[mode].push(item.category)
      }
    })

    const success = await taskTodayStore.generateAndStartPlan(
      selectedStrategy.value,
      selectedDifficulty.value,
      formattedRecs
    )

    if (success) {
      message.success('Täglicher Trainingsplan gestartet!')
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    } else {
      message.error('Plan konnte nicht generiert werden.')
    }
  } catch (err) {
    console.error('[TaskTodayPage] Start error:', err)
    message.error('Plan konnte nicht generiert werden.')
  } finally {
    isStartingPlan.value = false
  }
}

const handleReplay = async (plan: DailyTrainingPlanEntity) => {
  const success = await taskTodayStore.replayPlan(plan)
  if (success) {
    message.success('Replay gestartet!')
    queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
  } else {
    message.error('Fehler beim Laden des Replays.')
  }
}

function handleGoToDashboard() {
  taskTodayStore.isFinished = false
  taskTodayStore.isPlaying = false
  taskTodayStore.trainingPlan = null
}

const formattedTime = computed(() => {
  return taskTodayStore.formatMs(taskTodayStore.currentTimeMs)
})

function handleQuit() {
  taskTodayStore.quitTaskToday()
  queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
  router.push('/')
}

function handleRestart() {
  taskTodayStore.playCurrentPuzzle()
}

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
  <div v-if="!taskTodayStore.isPlaying && !taskTodayStore.isFinished" class="dashboard-container">
    <div class="dashboard-header">
      <h1 class="dashboard-title">📅 TASK TODAY</h1>
      <p class="dashboard-subtitle">Absolviere dein tägliches personalisiertes Schachtraining</p>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Setup & Selectors -->
      <div class="dashboard-card setup-card">
        <div class="setup-section">
          <h2 class="section-title">1. Schwierigkeit wählen</h2>
          <div class="difficulty-options">
            <button 
              v-for="diff in (['Novice', 'Pro', 'Master'] as const)" 
              :key="diff"
              class="diff-btn"
              :class="{ 
                active: selectedDifficulty === diff,
                completed: completedDifficulties.includes(diff)
              }"
              :disabled="completedDifficulties.includes(diff)"
              @click="selectedDifficulty = diff"
            >
              <span class="diff-name">{{ diff }}</span>
              <span class="diff-status" v-if="completedDifficulties.includes(diff)">✓ Beendet</span>
            </button>
          </div>
        </div>

        <div class="setup-section" style="margin-top: 2rem;">
          <h2 class="section-title">2. Trainings-Strategie</h2>
          <div class="strategies-options">
            <div 
              v-for="strat in (['Discovery', 'Hardcore', 'Warmup'] as const)"
              :key="strat"
              class="strategy-card-opt"
              :class="{ 
                active: selectedStrategy === strat,
                [strat.toLowerCase()]: true
              }"
              @click="selectedStrategy = strat"
            >
              <div class="strategy-badge">
                <span v-if="strat === 'Discovery'">💡 Discovery</span>
                <span v-else-if="strat === 'Hardcore'">🔥 Hardcore</span>
                <span v-else>⚡ Warmup</span>
              </div>
              <p class="strategy-desc">
                <span v-if="strat === 'Discovery'">Lerne neue Themen kennen und fülle Wissenslücken.</span>
                <span v-else-if="strat === 'Hardcore'">Attackiere gezielt deine größten Schwächen.</span>
                <span v-else>Festige dein Wissen mit deinen stärksten Themen.</span>
              </p>
            </div>
          </div>
        </div>

        <div class="start-action-row" style="margin-top: 2rem;">
          <NButton 
            type="primary" 
            size="large" 
            block 
            :loading="isStartingPlan"
            :disabled="completedDifficulties.length === 3"
            @click="handleStartPlan"
            class="dashboard-start-btn"
          >
            🚀 TRAINING STARTEN
          </NButton>
        </div>
      </div>

      <!-- Center Column: Preview -->
      <div class="dashboard-card preview-card">
        <h2 class="section-title">Plan-Vorschau</h2>
        <div v-if="selectedPlanPreview" class="preview-content">
          <div class="preview-summary">
            <span class="preview-strategy-name">{{ selectedPlanPreview.strategy.toUpperCase() }}</span>
            <span class="preview-task-count">{{ selectedPlanPreview.totalTasks }} Aufgaben</span>
          </div>

          <NScrollbar style="max-height: 480px; padding-right: 8px;">
            <div class="preview-groups">
              <div v-for="group in selectedPlanPreview.groups" :key="group.name" class="preview-group">
                <div class="group-header">
                  <span class="group-title">{{ group.name.toUpperCase() }}</span>
                  <span class="group-total">({{ group.total }} Aufgaben)</span>
                </div>
                <div class="group-categories">
                  <div v-for="cat in group.categories" :key="cat" class="preview-cat-item">
                    <span class="cat-dot"></span>
                    <span class="cat-name">{{ cat }}</span>
                    <span class="cat-count">{{ group.limit }}x</span>
                  </div>
                </div>
              </div>
            </div>
          </NScrollbar>
        </div>
        <div v-else class="preview-empty">
          <NText depth="3">Wähle eine Strategie für die Vorschau aus.</NText>
        </div>
      </div>

      <!-- Right Column: History -->
      <div class="dashboard-card history-card">
        <h2 class="section-title">
          <NIcon style="vertical-align: middle; margin-right: 8px;"><TimeOutline /></NIcon>
          Historie
        </h2>
        <NScrollbar style="max-height: 520px;">
          <NList hoverable clickable bordered v-if="historyData && historyData.length > 0">
            <NListItem 
              v-for="plan in historyData" 
              :key="plan.date + '-' + plan.difficulty" 
              @click="handleReplay(plan)"
            >
              <div class="history-item-row">
                <div class="history-item-details">
                  <span class="history-date">{{ plan.date }}</span>
                  <div class="history-tags">
                    <NTag size="small" :type="plan.difficulty === 'Master' ? 'error' : plan.difficulty === 'Pro' ? 'warning' : 'info'">{{ plan.difficulty }}</NTag>
                    <span class="history-strat">{{ plan.strategy }}</span>
                  </div>
                </div>
                <NIcon class="replay-icon"><ChevronForwardOutline /></NIcon>
              </div>
            </NListItem>
          </NList>
          <div v-else class="history-empty">
            <NText depth="3">Keine vergangenen Pläne gefunden.</NText>
          </div>
        </NScrollbar>
      </div>
    </div>
  </div>

  <div v-else-if="taskTodayStore.isFinished" class="completed-screen">
    <div class="completed-content">
      <NResult
        status="success"
        title="TRAINING ERFOLGREICH BEENDET!"
        description="Du hast alle Aufgaben dieses Trainingsplans gemeistert. Klasse Leistung!"
      >
        <template #footer>
          <NSpace justify="center">
            <NButton type="primary" size="large" @click="handleQuit">
              Zurück zur Startseite
            </NButton>
            <NButton secondary size="large" @click="handleGoToDashboard">
              Anderen Plan starten
            </NButton>
          </NSpace>
        </template>
      </NResult>
    </div>
  </div>

  <GameLayout v-else>
    <template #left-panel>
      <TaskSidebar />
    </template>

    <template #top-info>
      <div class="top-info-banner" v-if="taskTodayStore.currentPuzzle && !taskTodayStore.isFinished">
        <div class="side-action left">
          <NButton circle quaternary type="error" size="small" @click="handleQuit">
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
.dashboard-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  color: #fff;
}

.dashboard-header {
  text-align: center;
}

.dashboard-title {
  font-size: 2.8rem;
  font-weight: 950;
  letter-spacing: 4px;
  margin: 0;
  color: var(--neon-bordeaux, #d9004c);
  text-shadow: 0 0 20px rgba(217, 0, 76, 0.35);
}

.dashboard-subtitle {
  color: var(--color-text-muted, #888);
  font-size: 1.1rem;
  margin: 8px 0 0 0;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1fr;
  gap: 24px;
}

@media (max-width: 1100px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

.dashboard-card {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
}

.dashboard-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.section-title {
  font-size: 1.25rem;
  font-weight: 800;
  letter-spacing: 1px;
  margin: 0 0 16px 0;
  color: var(--color-text-muted, #ccc);
  text-transform: uppercase;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 10px;
}

/* Difficulty Options */
.difficulty-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diff-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #fff;
  font-weight: bold;
  font-size: 1.05rem;
  transition: all 0.25s ease;
}

.diff-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.diff-btn.active {
  border-color: var(--neon-bordeaux);
  background: rgba(217, 0, 76, 0.15);
  box-shadow: 0 0 15px rgba(217, 0, 76, 0.25);
}

.diff-btn.completed {
  border-color: rgba(247, 213, 71, 0.3);
  background: rgba(247, 213, 71, 0.05);
  opacity: 0.6;
  cursor: not-allowed;
}

.diff-status {
  font-size: 0.8rem;
  color: var(--neon-yellow, #f7d547);
  background: rgba(247, 213, 71, 0.15);
  padding: 2px 8px;
  border-radius: 6px;
}

/* Strategies Options */
.strategies-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-card-opt {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.strategy-card-opt:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.strategy-card-opt.active {
  background: rgba(255, 255, 255, 0.06);
}

.strategy-card-opt.active.discovery {
  border-color: #3498db;
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.25);
}

.strategy-card-opt.active.hardcore {
  border-color: #e74c3c;
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.25);
}

.strategy-card-opt.active.warmup {
  border-color: #2ecc71;
  box-shadow: 0 0 15px rgba(46, 204, 113, 0.25);
}

.strategy-badge {
  font-weight: 900;
  font-size: 1.05rem;
  letter-spacing: 1px;
  margin-bottom: 4px;
}

.discovery .strategy-badge { color: #3498db; }
.hardcore .strategy-badge { color: #e74c3c; }
.warmup .strategy-badge { color: #2ecc71; }

.strategy-desc {
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-muted, #aaa);
  line-height: 1.4;
}

/* Plan Preview Panel */
.preview-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.04);
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.preview-strategy-name {
  font-weight: 900;
  letter-spacing: 1px;
}

.preview-task-count {
  font-weight: bold;
  color: var(--neon-cyan, #00e5ff);
}

.preview-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-group {
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  padding: 14px;
  border-left: 3px solid rgba(255, 255, 255, 0.2);
}

.preview-group:nth-child(1) { border-left-color: var(--neon-bordeaux, #d9004c); }
.preview-group:nth-child(2) { border-left-color: #e67e22; }
.preview-group:nth-child(3) { border-left-color: #f1c40f; }
.preview-group:nth-child(4) { border-left-color: #9b59b6; }

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.group-title {
  font-size: 0.85rem;
  font-weight: 900;
  letter-spacing: 1px;
}

.group-total {
  font-size: 0.8rem;
  opacity: 0.6;
}

.group-categories {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.preview-cat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.cat-dot {
  width: 4px;
  height: 4px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
}

.cat-name {
  flex: 1;
  color: #ccc;
}

.cat-count {
  font-family: monospace;
  font-weight: bold;
  opacity: 0.8;
}

/* History Card */
.history-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.history-item-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-date {
  font-weight: bold;
  font-size: 0.95rem;
}

.history-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}

.history-strat {
  opacity: 0.6;
}

.replay-icon {
  font-size: 1.2rem;
  opacity: 0.5;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.history-card :deep(.n-list-item:hover) .replay-icon {
  transform: translateX(4px);
  opacity: 0.9;
  color: var(--neon-bordeaux);
}

.history-empty, .preview-empty {
  text-align: center;
  padding: 40px 20px;
}

/* Completed Screen */
.completed-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  padding: 24px;
}

.completed-content {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  padding: 40px;
  max-width: 600px;
  width: 100%;
  text-align: center;
}

/* Start Button styling */
.dashboard-start-btn {
  font-weight: 900 !important;
  letter-spacing: 2px !important;
  height: 50px !important;
  border-radius: 10px !important;
  background-color: var(--neon-bordeaux, #d9004c) !important;
  box-shadow: 0 0 15px rgba(217, 0, 76, 0.35);
  transition: all 0.3s ease !important;
}

.dashboard-start-btn:hover:not(:disabled) {
  background-color: #ff0055 !important;
  box-shadow: 0 0 25px rgba(255, 0, 85, 0.5);
  transform: translateY(-2px);
}

/* Active gameplay board styles from original */
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
