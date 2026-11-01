<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { LockClosedOutline } from '@vicons/ionicons5'
import {
  NAvatar,
  NButton,
  NCard,
  NIcon,
  NSpace,
  NText,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const authStore = useAuthStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)
const { t } = useI18n()

const handleLogin = () => {
  authStore.login()
}

const avatarUrl = computed(() => {
  return 'https://lichess1.org/assets/images/avatar_default.png'
})
</script>

<template>
  <div class="h-auto">
    <div v-if="isAuthenticated && userProfile">
      <n-card
        :bordered="false"
        size="small"
        class="rounded-xl border border-border bg-surface"
      >
        <n-space vertical :size="16">
          <n-space align="center" justify="space-between" :size="12" class="w-full">
            <n-space align="center" :size="12">
              <n-avatar
                round
                size="medium"
                :src="avatarUrl || undefined"
                fallback-src="https://lichess1.org/assets/images/avatar_default.png"
              />
              <n-text strong class="text-[1.1rem] tracking-[0.5px]">{{
                userProfile?.username
              }}</n-text>
            </n-space>
          </n-space>
        </n-space>
      </n-card>
    </div>

    <div v-else>
      <n-card
        :bordered="false"
        class="rounded-xl border border-border bg-surface py-5"
        size="small"
      >
        <n-space vertical align="center" :size="20">
          <n-icon size="48" depth="3">
            <LockClosedOutline />
          </n-icon>
          <div class="text-center">
            <n-text strong size="large" class="mb-1 block text-[1.4rem]">{{
              t('pages.userCabinet.title')
            }}</n-text>
            <n-text depth="3">{{ t('pages.userCabinet.loginPrompt') }}</n-text>
          </div>
          <n-button type="primary" size="large" block secondary strong @click="handleLogin">
            {{ t('shared.nav.loginWithLichess') }}
          </n-button>
        </n-space>
      </n-card>
    </div>
  </div>
</template>
