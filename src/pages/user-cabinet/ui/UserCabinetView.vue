<!-- src/pages/UserCabinetView.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { apiClient } from '@/shared/api/client'
import {
  useDetailedStatsQuery,
  usePersonalActivityStatsQuery,
} from '@/shared/api/queries/userCabinet.queries'
import {
  generateRandomActivityStats,
  generateRandomDetailedStats,
  generateRandomUserProfile,
} from '@/shared/lib/statsRandomizer'
import type { FinishHimDifficulty, TornadoMode } from '@/shared/types/api.types'
import {
  NAlert,
  NButton,
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
import TrainingPlanWidget from './TrainingPlanWidget.vue'

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

const error = computed(() => {
  if (isExample.value) return null
  if (!isAuthenticated.value) return null // Handled by login-prompt
  if (isActivityError.value) return activityError.value?.message
  if (isDetailedStatsError.value) return detailedError.value?.message
  return null
})

const selectedTornadoMode = ref<TornadoMode>('blitz')
const selectedFinishHimMode = ref<FinishHimDifficulty>('Novice')
const selectedTheoryWinMode = ref<FinishHimDifficulty>('Novice')
const selectedTheoryDrawMode = ref<FinishHimDifficulty>('Novice')
const selectedPracticalMode = ref<FinishHimDifficulty>('Novice')

const currentTornadoThemes = computed(() => {
  if (!detailedStats.value?.tornado?.modes) return []
  return detailedStats.value.tornado.modes[selectedTornadoMode.value]?.mix || []
})

const currentFinishHimThemes = computed(() => {
  if (!detailedStats.value?.finish_him?.modes?.win) return []
  return detailedStats.value.finish_him.modes.win[selectedFinishHimMode.value] || []
})

const currentTheoryWinThemes = computed(() => {
  if (!detailedStats.value?.theory?.modes?.win) return []
  return detailedStats.value.theory.modes.win[selectedTheoryWinMode.value] || []
})

const currentTheoryDrawThemes = computed(() => {
  if (!detailedStats.value?.theory?.modes?.draw) return []
  return detailedStats.value.theory.modes.draw[selectedTheoryDrawMode.value] || []
})

const currentPracticalThemes = computed(() => {
  if (!detailedStats.value?.practical?.modes?.win) return []
  return detailedStats.value.practical.modes.win[selectedPracticalMode.value] || []
})

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
          @reactivate="handleManageSubscription"
        />

        <div class="charts-grid">
          <ThemeRoseChart
            v-if="detailedStats && detailedStats.tornado"
            v-model:activeMode="selectedTornadoMode"
            mode="tornado"
            :modes="['bullet', 'blitz', 'rapid', 'classic']"
            :themes="currentTornadoThemes"
            :title="t('features.userCabinet.stats.modes.tornado')"
            @improve="launchGame"
          />

          <ThemeRoseChart
            v-if="detailedStats && detailedStats.finish_him"
            v-model:activeMode="selectedFinishHimMode"
            mode="finish_him"
            subMode="win"
            :modes="['Novice', 'Pro', 'Master']"
            :themes="currentFinishHimThemes"
            :title="t('features.userCabinet.stats.modes.finishHim')"
            @improve="launchGame"
          />
        </div>

        <div class="charts-grid">
          <ThemeRoseChart
            v-if="detailedStats && detailedStats.theory"
            v-model:activeMode="selectedTheoryWinMode"
            mode="theory"
            subMode="win"
            :modes="['Novice', 'Pro', 'Master']"
            :themes="currentTheoryWinThemes"
            :title="t('features.userCabinet.stats.modes.theoryWin')"
            @improve="launchGame"
          />

          <ThemeRoseChart
            v-if="detailedStats && detailedStats.theory"
            v-model:activeMode="selectedTheoryDrawMode"
            mode="theory"
            subMode="draw"
            :modes="['Novice', 'Pro', 'Master']"
            :themes="currentTheoryDrawThemes"
            :title="t('features.userCabinet.stats.modes.theoryDraw')"
            @improve="launchGame"
          />
        </div>

        <div class="charts-grid">
          <ThemeRoseChart
            v-if="detailedStats && detailedStats.practical"
            v-model:activeMode="selectedPracticalMode"
            mode="practical"
            subMode="win"
            :modes="['Novice', 'Pro', 'Master']"
            :themes="currentPracticalThemes"
            :title="t('features.userCabinet.stats.modes.practical')"
            @improve="launchGame"
          />

          <ActivityChart
            :stats="personalActivityStats"
            :is-loading="isExample ? false : isActivityPending"
          />
        </div>

        <TrainingPlanWidget
          v-if="displayProfile"
          :user-status="displayProfile.training_status || 'N'"
          :is-example="isExample"
        />

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
  </div>
</template>

<style scoped>
.user-cabinet-container {
  padding: 24px;
  max-width: 1400px;
  margin: 20px auto;
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
</style>
