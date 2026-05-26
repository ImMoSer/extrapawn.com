<!-- src/pages/UserCabinetView.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { apiClient } from '@/shared/api/client'
import {
  useDetailedStatsQuery,
  usePersonalActivityStatsQuery,
  useCurrentTrainingPlanQuery,
} from '@/shared/api/queries/userCabinet.queries'
import {
  generateRandomActivityStats,
  generateRandomDetailedStats,
  generateRandomUserProfile,
} from '@/shared/lib/statsRandomizer'
import type { UserProfileStatsDto } from '@/shared/types/api.types'
import {
  NAlert,
  NButton,
  NButtonGroup,
  NCard,
  NH3,
  NInput,
  NInputGroup,
  NModal,
  NResult,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import { ActivityChart, ThemeRoseChart, UserProfileHeader } from '@/features/profile'
import { normalizeProfileStats } from '@/shared/lib/statsNormalizer'
import { useGameLauncher } from '../lib/composables/useGameLauncher'
import { useTaskTodayStore } from '@/features/task-today'

const { t } = useI18n()
const { launchGame } = useGameLauncher()
const message = useMessage()

const giftCode = ref('')
const isRedeeming = ref(false)
const showSuccessModal = ref(false)
const successTier = ref('')
const successDate = ref('')

const handleSuccessOk = () => {
  window.location.reload()
}

const authStore = useAuthStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)

const route = useRoute()
const router = useRouter()
const isExample = computed(() => route.params.id === 'example')

const showPolarSuccessModal = ref(false)

onMounted(() => {
  if (route.query.status === 'success') {
    showPolarSuccessModal.value = true

    // Remove query param from URL without reloading
    const query = { ...route.query }
    delete query.status
    router.replace({ query })
  }
})

// Vue Query fetching
const {
  data: personalActivityData,
  isPending: isActivityPending,
  isError: isActivityError,
  error: activityError,
} = usePersonalActivityStatsQuery(!isExample.value && isAuthenticated.value)

const {
  data: detailedStatsData,
  isError: isDetailedStatsError,
  error: detailedError,
} = useDetailedStatsQuery(!isExample.value && isAuthenticated.value)

// Computed wrappers to support Example Mode
const personalActivityStats = computed(() => {
  return isExample.value ? generateRandomActivityStats() : personalActivityData.value
})

const displayProfile = computed(() => {
  if (isExample.value) return generateRandomUserProfile()
  return userProfile.value
})

const detailedStats = computed(() => {
  if (isExample.value) {
    return generateRandomDetailedStats(displayProfile.value?.base_puzzle_rating || 1500)
  }
  const stats = detailedStatsData.value
  const baseRating = displayProfile.value?.base_puzzle_rating || 1000
  return normalizeProfileStats(stats || null, baseRating)
})
const displayStats = computed<UserProfileStatsDto | null>(() => {
  if (isExample.value) {
    return {
      user: {
        id: 'example_user',
        username: displayProfile.value?.username || 'ExampleUser',
        tier: displayProfile.value?.subscriptionTier || 'Pawn',
      },
      stats: [],
    }
  }
  return detailedStatsData.value || null
})

const error = computed(() => {
  if (isExample.value) return null
  if (!isAuthenticated.value) return null // Handled by login-prompt
  if (isActivityError.value) return activityError.value?.message
  if (isDetailedStatsError.value) return detailedError.value?.message
  return null
})

// Current Active Plan and TaskToday store state
const { data: currentPlanData } = useCurrentTrainingPlanQuery(!isExample.value && isAuthenticated.value)
const taskTodayStore = useTaskTodayStore()
const selectedDifficulty = ref<'Novice' | 'Pro' | 'Master'>('Novice')

const localPlan = computed(() => taskTodayStore.trainingPlan)
const isLocalPlanActive = computed(() => taskTodayStore.isPlaying && localPlan.value)

const planStatus = computed(() => {
  if (currentPlanData.value?.is_completed) {
    return 'completed'
  }
  if (isLocalPlanActive.value) {
    return 'active'
  }
  return 'none'
})

const SUBMODE_CATEGORIES: Record<string, string[]> = {
  finish_him: ['bishop', 'expert', 'knight', 'knightBishop', 'pawn', 'queen', 'queenPieces', 'rookPawn', 'rookPieces'],
  theory_endings: ['bishop', 'knight', 'knightBishop', 'pawn', 'queen', 'rookPawn', 'rookPieces'],
  practical_chess: ['bishop', 'extraPawn', 'knight', 'knightBishop', 'materialEquality', 'pawn', 'queen', 'rookPawn', 'rookPieces'],
  tactics: ['advancedPawn', 'attraction', 'backRankMate', 'capturingDefender', 'clearance', 'defensiveMove', 'deflection', 'discoveredAttack', 'fork', 'hangingPiece', 'interference', 'intermezzo', 'kingAttack', 'pin', 'quietMove', 'sacrifice', 'skewer', 'trappedPiece', 'xRayAttack', 'zugzwang']
}

const recommendedStrategies = computed(() => {
  const summary = personalActivityStats.value?.statsSummary || []
  const strategies = {
    Discovery: {} as Record<string, string[]>,
    Hardcore: {} as Record<string, string[]>,
    Warmup: {} as Record<string, string[]>
  }

  for (const subMode of ['finish_him', 'theory_endings', 'practical_chess', 'tactics']) {
    const cats = SUBMODE_CATEGORIES[subMode] || []
    const mapped = cats.map(cat => {
      const match = summary.find(s => s.sub_mode === subMode && s.category === cat)
      const solved = match ? match.total_solved : 0
      const failed = match ? match.total_failed : 0
      const total = solved + failed
      const success = total > 0 ? (solved / total) * 100 : 0
      return { category: cat, total, success }
    })

    // Discovery
    const discoverySorted = [...mapped].sort((a, b) => a.total - b.total)
    strategies.Discovery[subMode] = discoverySorted.slice(0, 3).map(x => x.category)

    // Hardcore
    const groupA = mapped.filter(x => x.total >= 10)
    const groupB = mapped.filter(x => x.total < 10)
    const hardcoreGroupA = [...groupA].sort((a, b) => a.success - b.success || b.total - a.total)
    const hardcoreGroupB = [...groupB].sort((a, b) => a.success - b.success || b.total - a.total)
    strategies.Hardcore[subMode] = [...hardcoreGroupA, ...hardcoreGroupB].slice(0, 3).map(x => x.category)

    // Warmup
    const warmupGroupA = [...groupA].sort((a, b) => b.success - a.success || b.total - a.total)
    const warmupGroupB = [...groupB].sort((a, b) => b.success - a.success || b.total - a.total)
    strategies.Warmup[subMode] = [...warmupGroupA, ...warmupGroupB].slice(0, 3).map(x => x.category)
  }

  return strategies
})

const isStartingPlan = ref(false)

const handleStartPlan = async (strategyName: 'Discovery' | 'Hardcore' | 'Warmup') => {
  isStartingPlan.value = true
  try {
    const categories = recommendedStrategies.value[strategyName]
    const success = await taskTodayStore.generateAndStartPlan(
      strategyName,
      selectedDifficulty.value,
      categories
    )
    if (success) {
      message.success(t('features.userCabinet.plan.startSuccess', 'Täglicher Trainingsplan gestartet! Leite weiter...'))
      router.push('/task-today')
    } else {
      message.error(t('features.userCabinet.plan.startError', 'Plan konnte nicht generiert werden.'))
    }
  } catch {
    message.error(t('features.userCabinet.plan.startError', 'Plan konnte nicht generiert werden.'))
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

const handleRedeem = async () => {
  if (!giftCode.value || giftCode.value.length !== 8) return

  isRedeeming.value = true
  try {
    const res = await apiClient<{ success: boolean; tier: string; expiresAt: string }>(
      '/billing/redeem',
      {
        method: 'POST',
        body: JSON.stringify({ code: giftCode.value }),
      },
    )
    if (res.success) {
      successTier.value = res.tier
      successDate.value = new Date(res.expiresAt).toLocaleDateString()
      showSuccessModal.value = true
      giftCode.value = ''
    }
  } catch (err) {
    const error = err as { status?: number }
    if (error.status === 404 || error.status === 409) {
      message.error(t('features.userCabinet.gift.invalid'))
    } else {
      message.error(t('features.userCabinet.gift.error'))
    }
  } finally {
    isRedeeming.value = false
  }
}

const isManagingSubscription = ref(false)
const handleManageSubscription = async () => {
  isManagingSubscription.value = true
  try {
    const res = await apiClient<{ success: boolean; url: string }>('/billing/portal', {
      method: 'POST',
    })
    if (res.success && res.url) {
      window.location.href = res.url
    }
  } catch {
    message.error(t('features.userCabinet.subscription.error'))
  } finally {
    isManagingSubscription.value = false
  }
}
</script>

<template>
  <div class="user-cabinet-container">
    <n-alert v-if="error" type="error" closable class="error-alert">
      {{ error }}
    </n-alert>

    <div v-else-if="!isExample && (!isAuthenticated || !userProfile)" class="login-prompt">
      <n-result
        status="403"
        :title="t('features.userCabinet.title')"
        :description="t('features.userCabinet.loginPrompt')"
      >
        <template #footer>
          <n-button type="primary" size="large" @click="authStore.login()">
            {{ t('nav.loginWithLichess') }}
          </n-button>
        </template>
      </n-result>
    </div>

    <div class="user-cabinet-content">
      <n-space vertical size="large">
        <UserProfileHeader
          :profile-override="displayProfile"
          :profile-stats="displayStats"
          @reactivate="handleManageSubscription"
        />

        <!-- Daily Training Section -->
        <n-card :bordered="false" class="training-plan-card" embedded>
          <n-space vertical size="medium" style="width: 100%">
            <div class="section-title-row">
              <n-h3 style="margin-bottom: 0; font-weight: 800; letter-spacing: 1px;">📅 {{ t('features.userCabinet.plan.title', 'TÄGLICHES TRAINING') }}</n-h3>
              <div v-if="planStatus === 'none'" class="difficulty-select-wrapper">
                <n-space align="center">
                  <n-text depth="3" style="font-weight: bold; font-size: 0.9rem;">{{ t('features.userCabinet.plan.selectDifficulty', 'SCHWIERIGKEIT:') }}</n-text>
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
                  {{ t('features.userCabinet.plan.activeTitle', 'Aktiver Trainingsplan:') }}
                  <span class="active-plan-highlight">{{ localPlan?.level }} - {{ localPlan?.strategy }}</span>
                </n-text>
                <div class="active-plan-desc">
                  {{ t('features.userCabinet.plan.activeDesc', 'Setze dein heutiges Training fort.') }}
                </div>
              </div>
              <n-space align="center" justify="end" class="active-plan-actions">
                <n-button type="warning" secondary @click="taskTodayStore.quitTaskToday()">
                  {{ t('features.userCabinet.plan.reset', 'Zurücksetzen') }}
                </n-button>
                <n-button type="primary" size="large" @click="router.push('/task-today')" class="pulse-button">
                  🚀 {{ t('features.userCabinet.plan.resume', 'Fortsetzen') }}
                </n-button>
              </n-space>
            </div>

            <!-- Completed Plan Banner -->
            <div v-else-if="planStatus === 'completed'" class="completed-plan-banner">
              <n-result
                status="success"
                :title="t('features.userCabinet.plan.completedTitle', 'Tagesziel erreicht!')"
                :description="t('features.userCabinet.plan.completedDesc', 'Du hast dein tägliches Training für heute erfolgreich abgeschlossen. Komm morgen wieder für einen neuen Plan!')"
              >
                <template #footer>
                  <n-button type="primary" secondary @click="router.push('/records')" style="font-weight: bold;">
                    🏆 {{ t('features.userCabinet.plan.viewLeaderboard', 'Bestenliste ansehen') }}
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
                  <p class="strategy-desc">{{ t('features.userCabinet.plan.discoveryDesc', 'Lerne neue Themen kennen und fülle Wissenslücken.') }}</p>
                </div>
                <div class="strategy-body">
                  <div v-for="subMode in ['tactics', 'finish_him', 'theory_endings', 'practical_chess']" :key="subMode" class="strategy-submode">
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
                    {{ t('features.userCabinet.plan.startPlan', 'Plan starten') }}
                  </n-button>
                </div>
              </div>

              <!-- Hardcore Strategy -->
              <div class="strategy-card hardcore">
                <div class="strategy-header">
                  <div class="strategy-badge">🔥 HARDCORE</div>
                  <p class="strategy-desc">{{ t('features.userCabinet.plan.hardcoreDesc', 'Attackiere gezielt deine größten Schwächen.') }}</p>
                </div>
                <div class="strategy-body">
                  <div v-for="subMode in ['tactics', 'finish_him', 'theory_endings', 'practical_chess']" :key="subMode" class="strategy-submode">
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
                    {{ t('features.userCabinet.plan.startPlan', 'Plan starten') }}
                  </n-button>
                </div>
              </div>

              <!-- Warmup Strategy -->
              <div class="strategy-card warmup">
                <div class="strategy-header">
                  <div class="strategy-badge">⚡ WARMUP</div>
                  <p class="strategy-desc">{{ t('features.userCabinet.plan.warmupDesc', 'Festige dein Wissen mit deinen stärksten Themen.') }}</p>
                </div>
                <div class="strategy-body">
                  <div v-for="subMode in ['tactics', 'finish_him', 'theory_endings', 'practical_chess']" :key="subMode" class="strategy-submode">
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
                    {{ t('features.userCabinet.plan.startPlan', 'Plan starten') }}
                  </n-button>
                </div>
              </div>
            </div>
          </n-space>
        </n-card>

        <div class="charts-grid-unified">
          <ThemeRoseChart
            v-if="detailedStats"
            :stats="detailedStats"
            :title="t('features.userCabinet.stats.title')"
            @improve="launchGame"
          />
        </div>

        <div class="charts-grid">
          <ActivityChart
            :stats="personalActivityStats"
            :is-loading="isExample ? false : isActivityPending"
          />
        </div>


        <!-- Gift Code Redeem Area -->
        <n-card :bordered="false" class="gift-redeem-card" embedded>
          <n-space vertical>
            <n-h3 style="margin-bottom: 0">🎁 {{ t('features.userCabinet.gift.title') }}</n-h3>
            <n-text depth="3">{{ t('features.userCabinet.gift.description') }}</n-text>
            <n-input-group style="margin-top: 8px">
              <n-input
                v-model:value="giftCode"
                :placeholder="t('features.userCabinet.gift.placeholder')"
                :maxlength="8"
                size="large"
                style="max-width: 250px"
                @keyup.enter="handleRedeem"
              />
              <n-button
                type="primary"
                size="large"
                :loading="isRedeeming"
                :disabled="giftCode.length !== 8"
                @click="handleRedeem"
              >
                {{ t('features.userCabinet.gift.activate') }}
              </n-button>
            </n-input-group>
          </n-space>
        </n-card>

        <!-- Manage Subscription Area -->
        <n-card
          v-if="userProfile?.isPolarCustomer"
          :bordered="false"
          class="gift-redeem-card"
          embedded
        >
          <n-space vertical>
            <n-h3 style="margin-bottom: 0"
              >⚙️ {{ t('features.userCabinet.subscription.title') }}</n-h3
            >
            <n-text depth="3">{{ t('features.userCabinet.subscription.description') }}</n-text>
            <n-button
              type="primary"
              size="large"
              :loading="isManagingSubscription"
              @click="handleManageSubscription"
              style="margin-top: 8px; width: fit-content"
            >
              {{ t('features.userCabinet.subscription.openPortal') }}
            </n-button>
          </n-space>
        </n-card>
      </n-space>
    </div>

    <!-- Success Modal -->
    <n-modal
      v-model:show="showSuccessModal"
      preset="card"
      style="max-width: 400px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.userCabinet.gift.successTitle')"
      :mask-closable="false"
      @close="handleSuccessOk"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{
            t('features.userCabinet.gift.successMessage', { tier: successTier, date: successDate })
          }}
        </n-text>
        <n-button type="primary" size="large" block @click="handleSuccessOk">
          {{ t('features.userCabinet.gift.ok') }}
        </n-button>
      </n-space>
    </n-modal>

    <!-- Polar Success Modal -->
    <n-modal
      v-model:show="showPolarSuccessModal"
      preset="card"
      style="max-width: 400px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.userCabinet.polar.successTitle')"
      :mask-closable="false"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{ t('features.userCabinet.polar.successMessage') }}
        </n-text>
        <n-button type="primary" size="large" block @click="showPolarSuccessModal = false">
          {{ t('features.userCabinet.polar.ok') }}
        </n-button>
      </n-space>
    </n-modal>

    <!-- Overwrite Confirm Modal -->
    <n-modal
      v-model:show="showOverwriteConfirm"
      preset="card"
      style="max-width: 420px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.userCabinet.plan.confirmTitle', 'Plan überschreiben?')"
      :mask-closable="false"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{ t('features.userCabinet.plan.confirmMessage', 'Du hast bereits einen aktiven Trainingsplan für heute. Das Starten eines neuen Plans überschreibt deinen aktuellen Fortschritt. Möchtest du fortfahren?') }}
        </n-text>
        <n-space justify="end" :size="12">
          <n-button @click="showOverwriteConfirm = false">
            {{ t('features.userCabinet.plan.confirmCancel', 'Abbrechen') }}
          </n-button>
          <n-button type="warning" @click="proceedWithOverwrite" style="font-weight: bold;">
            {{ t('features.userCabinet.plan.confirmOk', 'Ja, überschreiben') }}
          </n-button>
        </n-space>
      </n-space>
    </n-modal>
  </div>
</template>

<style scoped>
.user-cabinet-container {
  padding: 24px;
  max-width: 1400px;
  margin: 20px auto;
}

.charts-grid-unified {
  display: block;
  width: 100%;
}

.charts-grid {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 1200px) {
  .charts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
  }
}

.state-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 400px;
}

.login-prompt {
  padding: 60px 0;
  background-color: var(--color-bg-secondary);
  border-radius: 12px;
  border: 1px solid var(--color-border-hover);
}

@media (max-width: 768px) {
  .user-cabinet-container {
    padding: 4px;
    margin: 10px auto;
  }

  .charts-grid {
    gap: 17px;
  }
}

.gift-redeem-card {
  margin-top: 24px;
  border-radius: var(--panel-border-radius);
  background-color: var(--color-bg-panel);
}

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
