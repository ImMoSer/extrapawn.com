<!-- src/pages/user-cabinet/ui/UserCabinetView.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { apiClient } from '@/shared/api/client'
import {
  useDetailedStatsQuery,
} from '@/shared/api/queries/userCabinet.queries'
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
import { useGameLauncher } from '../lib/composables/useGameLauncher'
import { LichessGamesCacheSettings, LichessGamesStatistics } from '@/features/lichess-games-db'


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
} = useDetailedStatsQuery(isAuthenticated.value)

const error = computed(() => {
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
  <div class="max-w-[85%] mx-auto my-5 p-6 max-md:max-w-full max-md:p-1 max-md:my-2">
    <n-alert v-if="error" type="error" closable class="mb-4">
      {{ error }}
    </n-alert>

    <div v-else-if="!isAuthenticated || !userProfile" class="py-15 bg-surface rounded-md border border-border">
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

    <div v-else class="w-full">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div class="flex flex-col min-w-0 w-full">
          <n-space vertical size="large">
            <UserProfileHeader
              :profile-override="userProfile"
              :profile-stats="detailedStatsData"
              @reactivate="handleManageSubscription"
            />

            <div class="block w-full">
              <ThemeRoseChart
                v-if="detailedStatsData?.stats"
                :stats="detailedStatsData.stats"
                :title="t('pages.userCabinet.stats.title')"
                @improve="launchGame"
              />
            </div>

            <!-- Gift Code Redeem Area -->
            <n-card :bordered="false" class="mt-6 rounded-md bg-surface border border-border" embedded>
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
              class="mt-6 rounded-md bg-surface border border-border"
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

        <div class="flex flex-col min-w-0 w-full">
          <n-space vertical size="large" style="width: 100%">
            <LichessGamesStatistics />
            <LichessGamesCacheSettings :show-back="false" />
          </n-space>
        </div>
      </div>
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
