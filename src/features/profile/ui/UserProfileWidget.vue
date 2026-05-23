<!-- src/components/UserStats.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import { LockClosedOutline, WalletOutline } from '@vicons/ionicons5'
import {
  NAvatar,
  NButton,
  NCard,
  NIcon,
  NNumberAnimation,
  NSpace,
  NStatistic,
  NTag,
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

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
  Administrator: 'wK.svg',
}

const avatarUrl = computed(() => {
  const tier = userProfile.value?.subscriptionTier
  if (tier && tierToPieceMap[tier]) {
    return `/piece/alpha/${tierToPieceMap[tier]}`
  }
  return 'https://lichess1.org/assets/images/avatar_default.png'
})
const isLimitless = computed(() => (userProfile.value?.dailyLimit || 0) > 90000)
</script>

<template>
  <div class="user-stats-container">
    <div v-if="isAuthenticated && userProfile" class="stats-view">
      <n-card :bordered="false" size="small" class="profile-card">
        <n-space vertical :size="16">
          <!-- Header: Avatar, Name & PawnCoins -->
          <n-space align="center" justify="space-between" :size="12" style="width: 100%">
            <n-space align="center" :size="12">
              <n-avatar
                round
                size="medium"
                :src="avatarUrl || undefined"
                fallback-src="https://lichess1.org/assets/images/avatar_default.png"
                class="piece-avatar"
              />
              <n-space vertical :size="0">
                <n-text strong class="username">{{ userProfile.username }}</n-text>
                <n-tag
                  :bordered="false"
                  :type="userProfile.subscriptionTier === 'administrator' ? 'error' : 'warning'"
                  size="tiny"
                  round
                  uppercase
                >
                  {{ userProfile.subscriptionTier }}
                </n-tag>
              </n-space>
            </n-space>

            <n-statistic
              :label="t('features.userCabinet.stats.pawncoinsLabel')"
              class="header-pawncoins"
            >
              <template #prefix>
                <n-icon color="#f0a020">
                  <WalletOutline />
                </n-icon>
              </template>
              <template #default>
                <span v-if="isLimitless" class="rainbow-text limitless-symbol">∞</span>
                <n-number-animation
                  v-else
                  :from="0"
                  :to="(userProfile.dailyLimit || 0) - (userProfile.spentToday || 0)"
                />
              </template>
              <template #suffix>
                <span v-if="!isLimitless" class="limit-text"> / {{ userProfile.dailyLimit || 0 }}</span>
              </template>
            </n-statistic>
          </n-space>
        </n-space>
      </n-card>
    </div>

    <div v-else class="login-state">
      <n-card :bordered="false" class="profile-card login-card" size="small">
        <n-space vertical align="center" :size="20" class="login-content">
          <n-icon size="48" depth="3">
            <LockClosedOutline />
          </n-icon>
          <div style="text-align: center">
            <n-text strong size="large" block class="login-title">{{
              t('features.userCabinet.title')
            }}</n-text>
            <n-text depth="3">{{ t('features.userCabinet.loginPrompt') }}</n-text>
          </div>
          <n-button type="primary" size="large" block secondary strong @click="handleLogin">
            {{ t('nav.loginWithLichess') }}
          </n-button>
        </n-space>
      </n-card>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-stats-container {
  height: auto;
}

.profile-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

.username {
  font-size: 1.1rem;
  letter-spacing: 0.5px;
}

.limit-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-weight: bold;
}

.login-card {
  padding: 20px 0;
}

.login-title {
  font-size: 1.4rem;
  margin-bottom: 4px;
}

:deep(.n-statistic) {
  .n-statistic-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .n-statistic-value__content {
    font-size: 1.3rem;
    font-weight: 900;
    font-family: monospace;
  }
}

.limitless-symbol {
  font-size: 2.5em;
  line-height: 1;
  vertical-align: middle;
}

.rainbow-text {
  background: linear-gradient(
    to right,
    #ff0000,
    #ff7f00,
    #ffff00,
    #00ff00,
    #0000ff,
    #4b0082,
    #8b00ff
  );
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: rainbow 3s linear infinite;
  font-weight: bold;
}

@keyframes rainbow {
  to {
    background-position: 200% center;
  }
}
</style>
