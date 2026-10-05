<!-- src/pages/user-cabinet/ui/UserCabinetView.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import {
  useDetailedStatsQuery,
} from '@/shared/api/queries/userCabinet.queries'
import {
  NAlert,
  NButton,
  NResult,
  NSpace,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { ThemeRoseChart, UserProfileHeader } from '@/features/profile'
import { useGameLauncher } from '../lib/composables/useGameLauncher'

const { t } = useI18n()
const { launchGame } = useGameLauncher()

const authStore = useAuthStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)

// Vue Query fetching
const {
  data: detailedStatsData,
  isError: isDetailedStatsError,
  error: detailedError,
} = useDetailedStatsQuery(isAuthenticated.value)

const error = computed(() => {
  if (!isAuthenticated.value) return null
  if (isDetailedStatsError.value) return detailedError.value?.message
  return null
})
</script>

<template>
  <div class="max-w-5xl mx-auto my-5 p-6 max-md:max-w-full max-md:p-2 max-md:my-2">
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
      <n-space vertical size="large" class="w-full">
        <UserProfileHeader
          :profile-override="userProfile"
          :profile-stats="detailedStatsData"
        />

        <div class="block w-full">
          <ThemeRoseChart
            v-if="detailedStatsData?.stats"
            :stats="detailedStatsData.stats"
            :title="t('pages.userCabinet.stats.title')"
            @improve="launchGame"
          />
        </div>
      </n-space>
    </div>
  </div>
</template>
