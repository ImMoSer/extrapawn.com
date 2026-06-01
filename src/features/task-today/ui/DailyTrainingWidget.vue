<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  NCard,
  NSpace,
  NH3,
  NText,
  NButton,
  NButtonGroup,
  NResult,
  NModal,
  useMessage
} from 'naive-ui'
import { useTaskTodayStore } from '@/features/task-today'
import { useCurrentTrainingPlanQuery } from '@/shared/api/queries/userCabinet.queries'
import type { RecommendationEntry } from '@/shared/types/api.types'

const props = defineProps<{
  isAuthenticated: boolean
}>()

const { t } = useI18n()
const router = useRouter()
const message = useMessage()
const taskTodayStore = useTaskTodayStore()

const { data: currentPlanData } = useCurrentTrainingPlanQuery(props.isAuthenticated)

const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')

const localPlan = computed(() => taskTodayStore.trainingPlan)
const isLocalPlanActive = computed(() => taskTodayStore.isPlaying && localPlan.value)

const planStatus = computed(() => {
  if (currentPlanData.value?.is_completed) return 'completed'
  if (isLocalPlanActive.value) return 'active'
  return 'none'
})

const recommendedStrategies = computed(() => {
  const recommendations = currentPlanData.value?.recommendations
  if (!recommendations) {
    return {
      Discovery: {} as Record<string, string[]>,
      Hardcore: {} as Record<string, string[]>,
      Warmup: {} as Record<string, string[]>
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

const isStartingPlan = ref(false)

const handleStartPlan = async (strategyName: 'Discovery' | 'Hardcore' | 'Warmup') => {
  isStartingPlan.value = true
  try {
    // Pass the raw recommendations object from the API response
    const rawRecommendations = currentPlanData.value?.recommendations
    if (!rawRecommendations) throw new Error('No recommendations available')

    // Extract categories for the specific strategy
    const strategyList = {
      Discovery: rawRecommendations.discovery,
      Hardcore: rawRecommendations.hardcore,
      Warmup: rawRecommendations.warmup
    }[strategyName]

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
      strategyName,
      selectedDifficulty.value,
      formattedRecs
    )
    if (success) {
      message.success(t('pages.userCabinet.plan.startSuccess', 'Täglicher Trainingsplan gestartet! Leite weiter...'))
      router.push('/task-today')
    } else {
      message.error(t('pages.userCabinet.plan.startError', 'Plan konnte nicht generiert werden.'))
    }
  } catch (err) {
    console.error('[DailyTrainingWidget] Start error:', err)
    message.error(t('pages.userCabinet.plan.startError', 'Plan konnte nicht generiert werden.'))
  } finally {
    isStartingPlan.value = false
  }
}

const showOverwriteConfirm = ref(false)
const pendingStrategy = ref<'Discovery' | 'Hardcore' | 'Warmup' | null>(null)

const confirmStartPlan = (strategyName: 'Discovery' | 'Hardcore' | 'Warmup') => {
  if (isLocalPlanActive.value) {
    pendingStrategy.value = strategyName
    showOverwriteConfirm.value = true
  } else {
    handleStartPlan(strategyName)
  }
}

const proceedWithOverwrite = () => {
  showOverwriteConfirm.value = false
  if (pendingStrategy.value) {
    handleStartPlan(pendingStrategy.value)
    pendingStrategy.value = null
  }
}
</script>

<template>
  <n-card :bordered="false" class="training-plan-card" embedded>
    <n-space vertical size="medium" style="width: 100%">
      <div class="section-title-row">
        <n-h3 style="margin-bottom: 0; font-weight: 800; letter-spacing: 1px;">📅 {{ t('pages.userCabinet.plan.title', 'TÄGLICHES TRAINING') }}</n-h3>
        <div v-if="planStatus === 'none'" class="difficulty-select-wrapper">
          <n-space align="center">
            <n-text depth="3" style="font-weight: bold; font-size: 0.9rem;">{{ t('pages.userCabinet.plan.selectDifficulty', 'SCHWIERIGKEIT:') }}</n-text>
            <n-button-group>
              <n-button 
                v-for="diff in (['Novice', 'Pro', 'Master'] as const)" 
                :key="diff" 
                :type="selectedDifficulty === diff ? 'primary' : 'default'" 
                size="small"
                @click="selectedDifficulty = diff"
                style="font-weight: bold;"
              >
                {{ diff }}
              </n-button>
            </n-button-group>
          </n-space>
        </div>
      </div>

      <!-- Active Plan Banner -->
      <div v-if="planStatus === 'active'" class="active-plan-banner">
        <div class="active-plan-info">
          <n-text class="active-plan-title">
            {{ t('pages.userCabinet.plan.activeTitle', 'Aktiver Trainingsplan:') }}
            <span class="active-plan-highlight">{{ localPlan?.level }} - {{ localPlan?.strategy }}</span>
          </n-text>
          <div class="active-plan-desc">
            {{ t('pages.userCabinet.plan.activeDesc', 'Setze dein heutiges Training fort.') }}
          </div>
        </div>
        <n-space align="center" justify="end" class="active-plan-actions">
          <n-button type="warning" secondary @click="taskTodayStore.quitTaskToday()">
            {{ t('pages.userCabinet.plan.reset', 'Zurücksetzen') }}
          </n-button>
          <n-button type="primary" size="large" @click="router.push('/task-today')" class="pulse-button">
            🚀 {{ t('pages.userCabinet.plan.resume', 'Fortsetzen') }}
          </n-button>
        </n-space>
      </div>

      <!-- Completed Plan Banner -->
      <div v-else-if="planStatus === 'completed'" class="completed-plan-banner">
        <n-result
          status="success"
          :title="t('pages.userCabinet.plan.completedTitle', 'Tagesziel erreicht!')"
          :description="t('pages.userCabinet.plan.completedDesc', 'Du hast dein tägliches Training für heute erfolgreich abgeschlossen. Komm morgen wieder für einen neuen Plan!')"
        >
          <template #footer>
            <n-button type="primary" secondary @click="router.push('/records')" style="font-weight: bold;">
              🏆 {{ t('pages.userCabinet.plan.viewLeaderboard', 'Bestenliste ansehen') }}
            </n-button>
          </template>
        </n-result>
      </div>

      <!-- Strategies Grid -->
      <div v-else class="strategies-grid">
        <!-- Discovery Strategy -->
        <div class="strategy-card discovery">
          <div class="strategy-header">
            <div class="strategy-badge">💡 DISCOVERY</div>
            <p class="strategy-desc">{{ t('pages.userCabinet.plan.discoveryDesc', 'Lerne neue Themen kennen und fülle Wissenslücken.') }}</p>
          </div>
          <div class="strategy-body">
            <div v-for="subMode in ['tactics', 'finish_him', 'practical_chess']" :key="subMode" class="strategy-submode">
              <span class="submode-label">{{ subMode.replace('_', ' ').toUpperCase() }}</span>
              <div class="categories-list">
                <span v-for="cat in recommendedStrategies.Discovery[subMode]" :key="cat" class="category-tag">
                  {{ cat }}
                </span>
              </div>
            </div>
          </div>
          <div class="strategy-footer">
            <n-button type="primary" block @click="confirmStartPlan('Discovery')" :loading="isStartingPlan" class="start-btn">
              {{ t('pages.userCabinet.plan.startPlan', 'Plan starten') }}
            </n-button>
          </div>
        </div>

        <!-- Hardcore Strategy -->
        <div class="strategy-card hardcore">
          <div class="strategy-header">
            <div class="strategy-badge">🔥 HARDCORE</div>
            <p class="strategy-desc">{{ t('pages.userCabinet.plan.hardcoreDesc', 'Attackiere gezielt deine größten Schwächen.') }}</p>
          </div>
          <div class="strategy-body">
            <div v-for="subMode in ['tactics', 'finish_him', 'practical_chess']" :key="subMode" class="strategy-submode">
              <span class="submode-label">{{ subMode.replace('_', ' ').toUpperCase() }}</span>
              <div class="categories-list">
                <span v-for="cat in recommendedStrategies.Hardcore[subMode]" :key="cat" class="category-tag">
                  {{ cat }}
                </span>
              </div>
            </div>
          </div>
          <div class="strategy-footer">
            <n-button type="primary" block @click="confirmStartPlan('Hardcore')" :loading="isStartingPlan" class="start-btn">
              {{ t('pages.userCabinet.plan.startPlan', 'Plan starten') }}
            </n-button>
          </div>
        </div>

        <!-- Warmup Strategy -->
        <div class="strategy-card warmup">
          <div class="strategy-header">
            <div class="strategy-badge">⚡ WARMUP</div>
            <p class="strategy-desc">{{ t('pages.userCabinet.plan.warmupDesc', 'Festige dein Wissen mit deinen stärksten Themen.') }}</p>
          </div>
          <div class="strategy-body">
            <div v-for="subMode in ['tactics', 'finish_him', 'practical_chess']" :key="subMode" class="strategy-submode">
              <span class="submode-label">{{ subMode.replace('_', ' ').toUpperCase() }}</span>
              <div class="categories-list">
                <span v-for="cat in recommendedStrategies.Warmup[subMode]" :key="cat" class="category-tag">
                  {{ cat }}
                </span>
              </div>
            </div>
          </div>
          <div class="strategy-footer">
            <n-button type="primary" block @click="confirmStartPlan('Warmup')" :loading="isStartingPlan" class="start-btn">
              {{ t('pages.userCabinet.plan.startPlan', 'Plan starten') }}
            </n-button>
          </div>
        </div>
      </div>
    </n-space>
  </n-card>

  <!-- Overwrite Confirm Modal -->
  <n-modal
    v-model:show="showOverwriteConfirm"
    preset="card"
    style="max-width: 420px; background-color: rgba(10, 11, 20, 0.95)"
    :title="t('pages.userCabinet.plan.confirmTitle', 'Plan überschreiben?')"
    :mask-closable="false"
  >
    <n-space vertical :size="24">
      <n-text style="font-size: 1.1em; line-height: 1.5">
        {{ t('pages.userCabinet.plan.confirmMessage', 'Du hast bereits einen aktiven Trainingsplan für heute. Das Starten eines neuen Plans überschreibt deinen aktuellen Fortschritt. Möchtest du fortfahren?') }}
      </n-text>
      <n-space justify="end" :size="12">
        <n-button @click="showOverwriteConfirm = false">
          {{ t('pages.userCabinet.plan.confirmCancel', 'Abbrechen') }}
        </n-button>
        <n-button type="warning" @click="proceedWithOverwrite" style="font-weight: bold;">
          {{ t('pages.userCabinet.plan.confirmOk', 'Ja, überschreiben') }}
        </n-button>
      </n-space>
    </n-space>
  </n-modal>
</template>

<style scoped>
/* Daily Training Plan Styles */
.training-plan-card {
  border-radius: var(--panel-border-radius);
  background-color: var(--color-bg-panel);
  border: 1px solid var(--color-border);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
  margin-top: 16px;
  overflow: hidden;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 12px;
  width: 100%;
}

.active-plan-banner {
  background: linear-gradient(135deg, rgba(230, 126, 34, 0.15) 0%, rgba(241, 196, 15, 0.05) 100%);
  border: 1px solid rgba(230, 126, 34, 0.3);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  width: 100%;
}

.active-plan-info {
  flex: 1;
  min-width: 280px;
}

.active-plan-title {
  font-size: 1.15rem;
  font-weight: bold;
}

.active-plan-highlight {
  color: var(--color-accent-warning);
  font-weight: 800;
  margin-left: 6px;
}

.active-plan-desc {
  color: var(--color-text-muted);
  margin-top: 4px;
}

.pulse-button {
  box-shadow: 0 0 0 0 rgba(230, 126, 34, 0.7);
  animation: button-pulse 2s infinite;
}

@keyframes button-pulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(230, 126, 34, 0.7);
  }
  70% {
    transform: scale(1.03);
    box-shadow: 0 0 0 10px rgba(230, 126, 34, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(230, 126, 34, 0);
  }
}

.completed-plan-banner {
  background: rgba(46, 204, 113, 0.08);
  border: 1px solid rgba(46, 204, 113, 0.2);
  border-radius: 12px;
  padding: 12px;
  width: 100%;
}

.strategies-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-top: 12px;
  width: 100%;
}

@media (min-width: 900px) {
  .strategies-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.strategy-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  transition: all 0.3s ease;
}

.strategy-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.04);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
}

.strategy-header {
  margin-bottom: 16px;
}

.strategy-badge {
  font-weight: 900;
  font-size: 1.1rem;
  letter-spacing: 2px;
  margin-bottom: 6px;
}

.discovery .strategy-badge {
  color: #3498db;
}

.hardcore .strategy-badge {
  color: #e74c3c;
}

.warmup .strategy-badge {
  color: #2ecc71;
}

.strategy-desc {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  margin: 4px 0 0 0;
  line-height: 1.4;
}

.strategy-body {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strategy-submode {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.submode-label {
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.3);
}

.categories-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-tag {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #ddd;
}

.strategy-card:hover .category-tag {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.15);
}

.start-btn {
  font-weight: bold;
}

.discovery:hover {
  border-color: rgba(52, 152, 219, 0.5);
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.2);
}

.hardcore:hover {
  border-color: rgba(231, 76, 60, 0.5);
  box-shadow: 0 0 15px rgba(231, 76, 60, 0.2);
}

.warmup:hover {
  border-color: rgba(46, 204, 113, 0.5);
  box-shadow: 0 0 15px rgba(46, 204, 113, 0.2);
}
</style>
