<!-- src/pages/user-cabinet/ui/UserCabinetView.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { apiClient } from '@/shared/api/client'
import {
  useDetailedStatsQuery,
} from '@/shared/api/queries/userCabinet.queries'
import {
  generateRandomDetailedStats,
  generateRandomUserProfile,
} from '@/shared/lib/statsRandomizer'
import type { UserProfileStatsDto } from '@/shared/types/api.types'
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

import { ThemeRoseChart, UserProfileHeader } from '@/features/profile'
import { normalizeProfileStats } from '@/shared/lib/statsNormalizer'
import { useGameLauncher } from '../lib/composables/useGameLauncher'


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
  data: detailedStatsData,
  isError: isDetailedStatsError,
  error: detailedError,
} = useDetailedStatsQuery(!isExample.value && isAuthenticated.value)

// Computed wrappers to support Example Mode
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
  if (isDetailedStatsError.value) return detailedError.value?.message
  return null
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
      message.error(t('pages.userCabinet.gift.invalid'))
    } else {
      message.error(t('pages.userCabinet.gift.error'))
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
    message.error(t('pages.userCabinet.subscription.error'))
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
        :title="t('pages.userCabinet.title')"
        :description="t('pages.userCabinet.loginPrompt')"
      >
        <template #footer>
          <n-button type="primary" size="large" @click="authStore.login()">
            {{ t('shared.nav.loginWithLichess') }}
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
        <n-card :bordered="false" class="gift-redeem-card" embedded>
          <n-space justify="space-between" align="center" style="width: 100%; flex-wrap: wrap; gap: 16px;">
            <div>
              <n-h3 style="margin-bottom: 0; font-weight: 800; letter-spacing: 1px;">📅 {{ t('pages.userCabinet.plan.title', 'TÄGLICHES TRAINING') }}</n-h3>
              <n-text depth="3">{{ t('pages.userCabinet.plan.desc', 'Absolviere dein tägliches, personalisiertes Training, um deine Taktik und Endspiele zu verbessern.') }}</n-text>
            </div>
            <n-button type="primary" size="large" @click="router.push('/task-today')">
              🚀 {{ t('pages.userCabinet.plan.start', 'Training starten') }}
            </n-button>
          </n-space>
        </n-card>

        <div class="charts-grid-unified">
          <ThemeRoseChart
            v-if="detailedStats"
            :stats="detailedStats"
            :title="t('pages.userCabinet.stats.title')"
            @improve="launchGame"
          />
        </div>


        <!-- Gift Code Redeem Area -->
        <n-card :bordered="false" class="gift-redeem-card" embedded>
          <n-space vertical>
            <n-h3 style="margin-bottom: 0">🎁 {{ t('pages.userCabinet.gift.title') }}</n-h3>
            <n-text depth="3">{{ t('pages.userCabinet.gift.description') }}</n-text>
            <n-input-group style="margin-top: 8px">
              <n-input
                v-model:value="giftCode"
                :placeholder="t('pages.userCabinet.gift.placeholder')"
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
                {{ t('pages.userCabinet.gift.activate') }}
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
              >⚙️ {{ t('pages.userCabinet.subscription.title') }}</n-h3
            >
            <n-text depth="3">{{ t('pages.userCabinet.subscription.description') }}</n-text>
            <n-button
              type="primary"
              size="large"
              :loading="isManagingSubscription"
              @click="handleManageSubscription"
              style="margin-top: 8px; width: fit-content"
            >
              {{ t('pages.userCabinet.subscription.openPortal') }}
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
      :title="t('pages.userCabinet.gift.successTitle')"
      :mask-closable="false"
      @close="handleSuccessOk"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{
            t('pages.userCabinet.gift.successMessage', { tier: successTier, date: successDate })
          }}
        </n-text>
        <n-button type="primary" size="large" block @click="handleSuccessOk">
          {{ t('pages.userCabinet.gift.ok') }}
        </n-button>
      </n-space>
    </n-modal>

    <!-- Polar Success Modal -->
    <n-modal
      v-model:show="showPolarSuccessModal"
      preset="card"
      style="max-width: 400px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('pages.userCabinet.polar.successTitle')"
      :mask-closable="false"
    >
      <n-space vertical :size="24">
        <n-text style="font-size: 1.1em; line-height: 1.5">
          {{ t('pages.userCabinet.polar.successMessage') }}
        </n-text>
        <n-button type="primary" size="large" block @click="showPolarSuccessModal = false">
          {{ t('pages.userCabinet.polar.ok') }}
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

.charts-grid-unified {
  display: block;
  width: 100%;
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
}

.gift-redeem-card {
  margin-top: 24px;
  border-radius: var(--panel-border-radius);
  background-color: var(--color-bg-panel);
}
</style>
