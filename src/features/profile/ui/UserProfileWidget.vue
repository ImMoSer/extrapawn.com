<!-- src/components/UserStats.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import type { TornadoMode } from '@/shared/types/api.types'
import { GolfOutline, LockClosedOutline, RibbonOutline, WalletOutline } from '@vicons/ionicons5'
import {
  NAvatar,
  NButton,
  NCard,
  NDivider,
  NGrid,
  NGridItem,
  NIcon,
  NNumberAnimation,
  NSpace,
  NStatistic,
  NTag,
  NText,
  NTooltip,
} from 'naive-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const authStore = useAuthStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)
const { t } = useI18n()
const route = useRoute()

const handleLogin = () => {
  authStore.login()
}

const localResetTimeMessage = computed(() => {
  const now = new Date()
  const tomorrowUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  )
  const localTime = tomorrowUTC.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return t('features.userCabinet.stats.activity.titleWithTime', { time: localTime })
})

const activityModes = [
  { key: 'finish_him' as const, label: t('nav.finishHim'), icon: '🎯' },
  { key: 'tornado' as const, label: t('nav.tornado'), icon: '🌪️' },
  {
    key: 'practical-chess' as const,
    label: t('features.practicalChess.selection.title'),
    icon: '♙♖',
  },
  { key: 'theory' as const, label: t('nav.theoryEndgames'), icon: '♔♙' },
]

const tornadoMode = computed(() => {
  if (route.name === 'tornado' && route.params.mode) {
    return route.params.mode as TornadoMode
  }
  return null
})

const tornadoHighScore = computed(() => {
  if (userProfile.value?.tornadoHighScores && tornadoMode.value) {
    return userProfile.value.tornadoHighScores[tornadoMode.value]
  }
  return null
})

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
              <template #suffix v-if="!isLimitless">
                <span class="limit-text"> / {{ userProfile.dailyLimit || 0 }}</span>
              </template>
            </n-statistic>
          </n-space>

          <n-divider class="mini-divider" />

          <!-- Dynamic Rating (if applicable) -->
          <div v-if="tornadoMode && tornadoHighScore !== null" class="dynamic-rating-row">
            <n-statistic :label="`${t('features.tornado.leaderboard.highScore')} (${tornadoMode})`">
              <template #prefix>
                <n-icon color="#f0a020">
                  <RibbonOutline />
                </n-icon>
              </template>
              {{ tornadoHighScore }}
            </n-statistic>
          </div>

          <!-- Today's Activity Section -->
          <div v-if="userProfile.today_activity" class="activity-section">
            <div class="activity-header">
              <n-text depth="3" class="reset-timer">{{ localResetTimeMessage }}</n-text>
            </div>

            <n-space vertical :size="16">
              <!-- Puzzles Solved Today -->
              <div class="activity-item">
                <n-space align="center" justify="space-between" class="mb-4">
                  <n-space align="center" :size="8">
                    <n-icon size="18" depth="2" color="var(--color-accent)">
                      <GolfOutline />
                    </n-icon>
                    <n-text strong>{{
                      t('features.userCabinet.stats.puzzlesSolved', {
                        count: userProfile.today_activity.puzzles_solved_today.total,
                      })
                    }}</n-text>
                  </n-space>
                  <n-text type="primary" strong class="total-value">
                    {{ userProfile.today_activity.puzzles_solved_today.total }}
                  </n-text>
                </n-space>
                <n-grid :cols="2" :x-gap="12" :y-gap="12">
                  <n-grid-item v-for="mode in activityModes" :key="mode.key">
                    <n-tooltip trigger="hover">
                      <template #trigger>
                        <div class="mini-stat-box">
                          <span class="mode-icon">{{ mode.icon }}</span>
                          <span class="mode-count">
                            {{ userProfile.today_activity.puzzles_solved_today[mode.key] ?? 0 }}
                          </span>
                        </div>
                      </template>
                      {{ mode.label }}
                    </n-tooltip>
                  </n-grid-item>
                </n-grid>
              </div>
            </n-space>
          </div>
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

.mini-divider {
  margin: 4px 0 !important;
  opacity: 0.3;
}

.activity-section {
  margin-top: 4px;
}

.activity-header {
  text-align: center;
  margin-bottom: 16px;
}

.reset-timer {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  font-weight: 600;
}

.mb-4 {
  margin-bottom: 6px;
}

.total-value {
  font-size: 1.3rem;
  font-weight: 900;
  font-family: monospace;
}

.limit-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  font-weight: bold;
}

.mini-stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 10px;
  padding: 8px 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--color-border-hover);
    transform: translateY(-2px);
  }

  .mode-icon {
    font-size: 1.2rem;
    margin-bottom: 4px;
  }

  .mode-count {
    font-weight: 800;
    font-size: 1rem;
    font-family: monospace;
  }
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
