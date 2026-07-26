<script setup lang="ts">
import { useTaskTodayStore, getPlanCost, TRAINING_PLAN_CONFIGS, type SubModeType, type SubModeConfig } from '../model/taskToday.store'
import {
  NText,
  NList,
  NListItem,
  NScrollbar,
  NButton,
  NIcon,
  NTag,
  useMessage,
  useDialog
} from 'naive-ui'
import {
  ChevronForwardOutline,
  TimeOutline
} from '@vicons/ionicons5'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/entities/user'
import {
  useCurrentTrainingPlanQuery,
  useTrainingPlanHistoryQuery
} from '@/shared/api/queries/userCabinet.queries'
import { useQueryClient } from '@tanstack/vue-query'
import type { DailyTrainingPlanEntity, RecommendationEntry, SubscriptionTier } from '@/shared/types/api.types'

const { t } = useI18n()
const taskTodayStore = useTaskTodayStore()
const authStore = useAuthStore()
const message = useMessage()
const dialog = useDialog()
const queryClient = useQueryClient()
const router = useRouter()

const TIER_LEVELS: Record<string, number> = {
  Guest: 0,
  Pawn: 1,
  pawn: 1,
  VIP: 3,
  vip: 3,
  Knight: 3,
  knight: 3,
  Bishop: 3,
  bishop: 3,
  Rook: 3,
  rook: 3,
  Queen: 3,
  queen: 3,
  King: 3,
  king: 3,
  administrator: 4,
}

const currentUserTier = computed<SubscriptionTier | 'Guest'>(() => {
  if (!authStore.isAuthenticated || !authStore.userProfile) {
    return 'Guest'
  }
  const tier = authStore.userProfile.subscriptionTier
  if (!(tier in TIER_LEVELS)) {
    throw new Error(`[TaskTodayDashboard] Unexpected subscriptionTier: "${tier}". Fail-Fast!`)
  }
  return tier as SubscriptionTier
})

const currentUserLevel = computed<number>(() => {
  return TIER_LEVELS[currentUserTier.value] ?? 0
})

function showRestrictionModal(messageText: string) {
  dialog.warning({
    title: t('puzzleCategories.tierRestriction.title'),
    content: messageText,
    positiveText: t('puzzleCategories.tierRestriction.upgradeBtn'),
    negativeText: t('puzzleCategories.tierRestriction.cancelBtn'),
    onPositiveClick: () => {
      router.push('/pricing')
    }
  })
}

const _selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')
const selectedDifficulty = computed({
  get: () => _selectedDifficulty.value,
  set: (newDiff) => {
    if (newDiff === 'Novice' && currentUserLevel.value < 1) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.basic'))
      return
    }
    if (newDiff === 'Pro' && currentUserLevel.value < 2) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premium'))
      return
    }
    if (newDiff === 'Master' && currentUserLevel.value < 3) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premiumPlus'))
      return
    }
    _selectedDifficulty.value = newDiff
  }
})

const _selectedStrategy = ref<'Discovery' | 'Hardcore' | 'Warmup'>('Discovery')
const selectedStrategy = computed({
  get: () => _selectedStrategy.value,
  set: (newStrat) => {
    if (newStrat === 'Discovery' && currentUserLevel.value < 1) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.basic'))
      return
    }
    if (newStrat === 'Hardcore' && currentUserLevel.value < 2) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premium'))
      return
    }
    if (newStrat === 'Warmup' && currentUserLevel.value < 3) {
      showRestrictionModal(t('puzzleCategories.tierRestriction.premiumPlus'))
      return
    }
    _selectedStrategy.value = newStrat
  }
})

const isDiffDisabled = (diff: 'Novice' | 'Pro' | 'Master') => {
  const hasTierAccess = (diff === 'Novice' && currentUserLevel.value >= 1) ||
                        (diff === 'Pro' && currentUserLevel.value >= 2) ||
                        (diff === 'Master' && currentUserLevel.value >= 3)
  if (!hasTierAccess) return false
  return authStore.userProfile ? authStore.userProfile.PawnCoins < getPlanCost(diff) : false
}

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

const completedHistory = computed(() => {
  return (historyData.value || []).filter(p => p.is_completed)
})

const handleResumeActivePlan = async () => {
  if (currentPlanData.value) {
    const success = await taskTodayStore.replayPlan(currentPlanData.value)
    if (success) {
      message.success(t('features.taskToday.feedback.resumeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    } else {
      message.error(t('features.taskToday.feedback.resumeError'))
    }
  }
}

const handleCancelActivePlan = () => {
  dialog.warning({
    title: t('pages.userCabinet.plan.confirmTitle'),
    content: t('pages.userCabinet.plan.confirmMessage'),
    positiveText: t('shared.buttons.confirm'),
    negativeText: t('shared.buttons.cancel'),
    onPositiveClick: async () => {
      try {
        await taskTodayStore.quitTaskToday()
        message.success(t('features.taskToday.feedback.cancelSuccess'))
        queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
      } catch (err) {
        console.error('[TaskTodayDashboard] Cancel error:', err)
        message.error(t('features.taskToday.feedback.cancelError'))
      }
    }
  })
}

const recommendedStrategies = computed(() => {
  const recommendations = currentPlanData.value?.recommendations
  if (!recommendations) {
    return {
      Discovery: { tactics: [], finish_him: [], practical_chess: [] } as Record<string, string[]>,
      Hardcore: { tactics: [], finish_him: [], practical_chess: [] } as Record<string, string[]>,
      Warmup: { tactics: [], finish_him: [], practical_chess: [] } as Record<string, string[]>
    }
  }

  const formatStrategy = (list: RecommendationEntry[]) => {
    const result: Record<string, string[]> = {
      tactics: [],
      finish_him: [],
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

  const planConfig = TRAINING_PLAN_CONFIGS[diff]
  let totalTasks = 0

  const groups = (Object.entries(planConfig) as [SubModeType, SubModeConfig][]).map(([subMode, subConfig]) => {
    const cats = (recs[subMode] || []).slice(0, subConfig.categories)
    const totalForGroup = cats.length * subConfig.puzzlesPerCategory
    totalTasks += totalForGroup

    const readableName = {
      tactics: 'Tactics',
      finish_him: 'Finish Him',
      practical_chess: 'Practical Chess'
    }[subMode]

    return {
      name: readableName,
      total: totalForGroup,
      limit: subConfig.puzzlesPerCategory,
      categories: cats
    }
  }).filter(g => g.categories.length > 0)

  return {
    difficulty: diff,
    strategy,
    totalTasks,
    groups
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
      message.success(t('features.taskToday.feedback.startSuccess'))
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    } else {
      message.error(t('features.taskToday.feedback.startError'))
    }
  } catch (err) {
    console.error('[TaskTodayDashboard] Start error:', err)
    message.error(t('features.taskToday.feedback.startError'))
  } finally {
    isStartingPlan.value = false
  }
}

const handleReplay = async (plan: DailyTrainingPlanEntity) => {
  const success = await taskTodayStore.replayPlan(plan)
  if (success) {
    message.success(t('features.taskToday.feedback.replaySuccess'))
    if (!plan.is_completed) {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    }
  } else {
    message.error(t('features.taskToday.feedback.replayError'))
  }
}
</script>

<template>
  <div class="dashboard-container">
    <div class="dashboard-header">
      <h1 class="dashboard-title">📅 {{ t('features.taskToday.title') }}</h1>
      <p class="dashboard-subtitle">{{ t('features.taskToday.subtitle') }}</p>
    </div>

    <div class="dashboard-grid">
      <!-- Left Column: Setup & Selectors -->
      <div class="dashboard-card setup-card">
        <div class="setup-section">
          <h2 class="section-title">{{ t('features.taskToday.chooseDifficulty') }}</h2>
          <div class="difficulty-options">
            <button 
              v-for="diff in (['Novice', 'Pro', 'Master'] as const)" 
              :key="diff"
              class="diff-btn"
              :class="{ 
                active: selectedDifficulty === diff,
                completed: completedDifficulties.includes(diff),
                'disabled-diff': (diff === 'Novice' && currentUserLevel < 1) || (diff === 'Pro' && currentUserLevel < 2) || (diff === 'Master' && currentUserLevel < 3)
              }"
              :disabled="isDiffDisabled(diff)"
              @click="selectedDifficulty = diff"
            >
              <span class="diff-name">
                {{ t('puzzleCategories.difficulties.level_' + diff.toLowerCase()) }}
                <span class="diff-cost-badge">({{ getPlanCost(diff) }} PC)</span>
              </span>
              <span class="diff-status" v-if="completedDifficulties.includes(diff)">
                ✓ {{ t('features.taskToday.completedStatus') }}
              </span>
              <span class="diff-status expensive" v-else-if="authStore.userProfile && authStore.userProfile.PawnCoins < getPlanCost(diff)">
                {{ t('features.taskToday.insufficientCoinsBadge') }}
              </span>
            </button>
          </div>
        </div>

        <div class="setup-section" style="margin-top: 2rem;">
          <h2 class="section-title">{{ t('features.taskToday.trainingStrategy') }}</h2>
          <div class="strategies-options">
            <div 
              v-for="strat in (['Discovery', 'Hardcore', 'Warmup'] as const)"
              :key="strat"
              class="strategy-card-opt"
              :class="{ 
                active: selectedStrategy === strat,
                [strat.toLowerCase()]: true,
                'disabled-strat': (strat === 'Discovery' && currentUserLevel < 1) || (strat === 'Hardcore' && currentUserLevel < 2) || (strat === 'Warmup' && currentUserLevel < 3)
              }"
              @click="selectedStrategy = strat"
            >
              <div class="strategy-badge">
                <span>{{ t(`features.taskToday.strategies.${strat.toLowerCase()}.title`) }}</span>
              </div>
              <p class="strategy-desc">
                <span>{{ t(`features.taskToday.strategies.${strat.toLowerCase()}.desc`) }}</span>
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
            :disabled="!!currentPlanData?.active || (authStore.userProfile ? authStore.userProfile.PawnCoins < getPlanCost(selectedDifficulty) : false)"
            @click="handleStartPlan"
            class="dashboard-start-btn"
          >
            {{ t('features.taskToday.startTrainingBtn') }}
          </NButton>
        </div>
      </div>

      <!-- Center Column: Preview -->
      <div class="dashboard-card preview-card">
        <h2 class="section-title">{{ t('features.taskToday.preview') }}</h2>
        <div v-if="selectedPlanPreview" class="preview-content">
          <div class="preview-summary">
            <span class="preview-strategy-name">{{ selectedPlanPreview.strategy.toUpperCase() }}</span>
            <span class="preview-cost">{{ getPlanCost(selectedPlanPreview.difficulty) }} PawnCoins</span>
            <span class="preview-task-count">{{ t('features.taskToday.previewTasks', { count: selectedPlanPreview.totalTasks }) }}</span>
          </div>

          <NScrollbar style="max-height: 480px; padding-right: 8px;">
            <div class="preview-groups">
              <div v-for="group in selectedPlanPreview.groups" :key="group.name" class="preview-group">
                <div class="group-header">
                  <span class="group-title">{{ group.name.toUpperCase() }}</span>
                  <span class="group-total">({{ t('features.taskToday.previewTasks', { count: group.total }) }})</span>
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
          <NText depth="3">{{ t('features.taskToday.previewChooseStrategy') }}</NText>
        </div>
      </div>

      <!-- Right Column: History -->
      <div class="dashboard-card history-card">
        <h2 class="section-title">
          <NIcon style="vertical-align: middle; margin-right: 8px;"><TimeOutline /></NIcon>
          {{ t('features.taskToday.history') }}
        </h2>
        <NScrollbar style="max-height: 520px;">
          <!-- Laufender Run -->
          <div v-if="currentPlanData?.active" class="active-plan-banner">
            <div class="active-plan-info">
              <span class="active-plan-label">{{ t('features.taskToday.runningTraining') }}</span>
              <div class="active-plan-meta">
                <NTag size="small" type="success" class="pulse-tag">ACTIVE</NTag>
                <span class="active-plan-strat">{{ currentPlanData.strategy }} ({{ currentPlanData.difficulty }})</span>
              </div>
            </div>
            <div class="active-plan-actions">
              <NButton type="success" size="medium" @click="handleResumeActivePlan" class="complete-btn">
                {{ t('features.taskToday.resumeActiveBtn') }}
              </NButton>
              <NButton type="error" size="medium" ghost @click="handleCancelActivePlan" class="cancel-btn">
                {{ t('features.taskToday.cancelActiveBtn') }}
              </NButton>
            </div>
          </div>

          <NList hoverable clickable bordered v-if="completedHistory.length > 0">
            <NListItem 
              v-for="plan in completedHistory" 
              :key="plan.id || (plan.date + '-' + plan.difficulty)" 
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
          <div v-else-if="!currentPlanData?.active" class="history-empty">
            <NText depth="3">{{ t('features.taskToday.noPastPlans') }}</NText>
          </div>
        </NScrollbar>
      </div>
    </div>
  </div>
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
  cursor: pointer;
}

.diff-btn.completed.active {
  border-color: var(--neon-bordeaux);
  background: rgba(217, 0, 76, 0.15);
  box-shadow: 0 0 15px rgba(217, 0, 76, 0.25);
}

.diff-btn.completed:hover:not(:disabled):not(.active) {
  background: rgba(247, 213, 71, 0.1);
  border-color: rgba(247, 213, 71, 0.5);
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

/* Active plan banner */
.active-plan-banner {
  border: 1px solid #28a745;
  background: rgba(40, 167, 69, 0.08);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  animation: blink-green 2s infinite ease-in-out;
}

.active-plan-actions {
  display: flex;
  gap: 8px;
}

@keyframes blink-green {
  0% {
    border-color: rgba(40, 167, 69, 0.4);
    box-shadow: 0 0 5px rgba(40, 167, 69, 0.2);
  }
  50% {
    border-color: rgba(40, 167, 69, 1);
    box-shadow: 0 0 15px rgba(40, 167, 69, 0.6);
  }
  100% {
    border-color: rgba(40, 167, 69, 0.4);
    box-shadow: 0 0 5px rgba(40, 167, 69, 0.2);
  }
}

.active-plan-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.active-plan-label {
  font-weight: 800;
  font-size: 1.05rem;
  color: #fff;
}

.active-plan-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.active-plan-strat {
  font-size: 0.85rem;
  color: #ccc;
}

.pulse-tag {
  animation: pulse-opacity 1.5s infinite ease-in-out;
}

@keyframes pulse-opacity {
  0% { opacity: 0.6; }
  50% { opacity: 1; }
  100% { opacity: 0.6; }
}

.complete-btn {
  font-weight: bold;
}

.diff-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  border-color: rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.01);
}

.diff-cost-badge {
  font-size: 0.85rem;
  opacity: 0.6;
  margin-left: 8px;
  font-weight: normal;
}

.diff-status.expensive {
  background: rgba(217, 0, 76, 0.1);
  color: var(--neon-bordeaux, #d9004c);
  border: 1px solid rgba(217, 0, 76, 0.2);
}

.preview-cost {
  font-weight: bold;
  color: var(--neon-yellow, #f7d547);
}

@media (max-width: 768px) {
  .dashboard-container {
    padding: 24px 16px;
    gap: 20px;
  }
  .dashboard-title {
    font-size: 2.0rem;
    letter-spacing: 2px;
  }
  .dashboard-subtitle {
    font-size: 0.95rem;
  }
  .dashboard-card {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .diff-btn {
    padding: 12px;
    font-size: 0.95rem;
    flex-wrap: wrap;
    gap: 8px;
  }
  .diff-status {
    font-size: 0.75rem;
  }
  .active-plan-banner {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
    text-align: center;
  }
  .active-plan-info {
    align-items: center;
  }
  .active-plan-actions {
    justify-content: center;
    width: 100%;
  }
  .active-plan-actions > * {
    flex: 1;
  }
  .preview-summary {
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }
}

/* Tier restrictions styling */
.diff-btn.disabled-diff {
  opacity: 0.45;
  cursor: not-allowed !important;
}
.diff-btn.disabled-diff * {
  cursor: not-allowed !important;
}

.strategy-card-opt.disabled-strat {
  opacity: 0.45;
  cursor: not-allowed !important;
}
.strategy-card-opt.disabled-strat * {
  cursor: not-allowed !important;
}
.strategy-card-opt.disabled-strat:hover {
  transform: none !important;
  box-shadow: none !important;
}
</style>
