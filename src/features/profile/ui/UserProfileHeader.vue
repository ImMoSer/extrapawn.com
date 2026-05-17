<!-- src/components/userCabinet/sections/UserProfileHeader.vue -->
<script setup lang="ts">
import { useAuthStore } from '@/entities/user'
import type { UserProfileStatsDto, UserSessionProfile } from '@/shared/types/api.types'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  profileOverride?: UserSessionProfile | null
  profileStats?: UserProfileStatsDto | null
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const { userProfile: storeProfile } = storeToRefs(authStore)

const userProfile = computed(() => props.profileOverride || storeProfile.value)

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
  Administrator: 'wK.svg',
}

defineEmits<{
  (e: 'reactivate'): void
}>()

const avatarUrl = computed(() => {
  const tier = userProfile.value?.subscriptionTier
  if (tier && tierToPieceMap[tier]) {
    return `/piece/alpha/${tierToPieceMap[tier]}`
  }
  return 'https://lichess1.org/assets/images/avatar_default.png'
})

const formatTierExpireDate = (isoDate: string | null | undefined) => {
  if (!isoDate) return t('features.userCabinet.info.tierPermanent')
  const date = new Date(isoDate)
  return t('features.userCabinet.info.tierExpires', { date: date.toLocaleDateString() })
}

const getTierType = (tier: string = '') => {
  const t = tier.toLowerCase()
  if (t === 'platinum' || t === 'gold') return 'warning'
  if (t === 'silver' || t === 'bronze') return 'info'
  if (t === 'administrator') return 'error'
  return 'default'
}

// Game modes best ratings logic
const gameModeScores = computed(() => {
  const baseRating = userProfile.value?.base_puzzle_rating || 1500
  
  const ratings = {
    'finish_him': baseRating,
    'tornado': baseRating,
    'practical-chess': baseRating,
    'theory': baseRating,
  }

  if (props.profileStats) {
    const statsArray = props.profileStats.stats || []
    
    // Find best rating in stats for each mode
    let key: keyof typeof ratings
    for (key in ratings) {
      const modeStats = statsArray.filter((s) => s.game_mode === key)
      if (modeStats.length > 0) {
        const maxRating = Math.max(...modeStats.map((s) => s.rating || 0))
        if (maxRating > 0) {
          ratings[key] = maxRating
        }
      }
    }

    // Special check for tornadoHighScores if present
    if (props.profileStats.tornadoHighScores) {
      const scores = Object.values(props.profileStats.tornadoHighScores)
      if (scores.length > 0) {
        const maxHighScore = Math.max(...scores)
        if (maxHighScore > ratings['tornado']) {
          ratings['tornado'] = maxHighScore
        }
      }
    }
  }

  return [
    {
      key: 'finish_him',
      label: t('features.userCabinet.stats.modes.finishHim'),
      icon: '🎯',
      color: 'var(--color-accent-success)',
      rating: ratings['finish_him'],
    },
    {
      key: 'tornado',
      label: t('features.userCabinet.stats.modes.tornado'),
      icon: '🌪️',
      color: 'var(--color-accent-primary)',
      rating: ratings['tornado'],
    },
    {
      key: 'practical-chess',
      label: t('features.practicalChess.selection.title'),
      icon: '♙',
      color: 'var(--color-accent-warning)',
      rating: ratings['practical-chess'],
    },
    {
      key: 'theory',
      label: t('nav.theoryEndgames'),
      icon: '🎓',
      color: 'var(--color-accent-error)',
      rating: ratings['theory'],
    },
  ]
})

// Responsive avatar size
const isMobile = ref(false)
const updateMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  updateMobile()
  window.addEventListener('resize', updateMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

const avatarSize = computed(() => (isMobile.value ? 75 : 150))
const isLimitless = computed(() => (userProfile.value?.dailyLimit || 0) > 90000)

const polarStatusType = computed(() => {
  const status = userProfile.value?.polarStatus
  if (status === 'active') return 'success'
  if (status === 'canceled') return 'warning'
  if (status === 'past_due' || status === 'unpaid' || status === 'revoked') return 'error'
  return 'default'
})

const showReactivateButton = computed(() => userProfile.value?.polarStatus === 'canceled')
</script>

<template>
  <n-card v-if="userProfile" class="header-card" :bordered="false">
    <div class="header-main-grid">
      <!-- Left side: User Profile Info -->
      <div class="profile-basic-info">
        <div class="avatar-container">
          <!-- KEEP CLEAR: No elements should be placed directly under the avatar -->
          <n-avatar
            round
            :size="avatarSize"
            :src="avatarUrl"
            fallback-src="https://lichess1.org/assets/images/avatar_default.png"
            class="user-avatar"
          />
        </div>

        <div class="user-main-info">
          <n-h1 class="username">{{ userProfile.username }}</n-h1>
          <n-space size="small" align="center" wrap class="tier-info">
            <n-tag :type="getTierType(userProfile.subscriptionTier)" round size="small">
              {{ userProfile.subscriptionTier }}
            </n-tag>
            <n-tag v-if="userProfile.polarStatus" :type="polarStatusType" size="small" round ghost>
              {{ userProfile.polarStatus }}
            </n-tag>
            <n-text depth="3" class="expire-date">
              {{ formatTierExpireDate(userProfile.TierExpire) }}
            </n-text>
            <n-button
              v-if="showReactivateButton"
              size="tiny"
              type="warning"
              secondary
              round
              @click="$emit('reactivate')"
            >
              {{ t('features.userCabinet.subscription.reactivate') }}
            </n-button>
          </n-space>

          <div class="funcoins-stat">
            <n-statistic :label="t('features.userCabinet.stats.pawncoinsLabel')">
              <template #prefix>🪙</template>
              <template #default>
                <span v-if="isLimitless" class="rainbow-text limitless-symbol">∞</span>
                <span v-else>{{
                  (userProfile.dailyLimit || 0) - (userProfile.spentToday || 0)
                }}</span>
              </template>
              <template #suffix>
                <span v-if="!isLimitless"> / {{ userProfile.dailyLimit || 0 }}</span>
              </template>
            </n-statistic>
          </div>
        </div>
      </div>

      <!-- Right: Best Ratings (taking remaining space) -->
      <div class="tornado-ratings-section">
        <div class="section-title">{{ t('features.userCabinet.stats.bestRatingsTitle') }}</div>
        <n-grid :cols="2" :x-gap="12" :y-gap="12">
          <n-grid-item v-for="stat in gameModeScores" :key="stat.key">
            <div class="score-item" :style="{ borderColor: stat.color }">
              <div class="mode-emoji-icon" style="font-size: 22px; line-height: 1; display: flex; align-items: center; justify-content: center; width: 24px;">
                {{ stat.icon }}
              </div>
              <div class="score-details" style="margin-left: 8px;">
                <div class="mode-name">{{ stat.label }}</div>
                <div class="mode-score">{{ stat.rating }}</div>
              </div>
            </div>
          </n-grid-item>
        </n-grid>
      </div>
    </div>
  </n-card>
</template>

<style scoped>
.header-card {
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  border: 1px solid var(--color-border-hover);
}

.header-main-grid {
  display: grid;
  grid-template-columns: 1fr 1.5fr;
  gap: 48px;
}

.profile-basic-info {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

.avatar-container {
  padding: 10px;
  border-radius: 20%;
  border: 1px solid var(--color-blue-base);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  box-sizing: border-box;
}

.user-avatar {
  background-color: var(--color-bg-tertiary);
}

.user-main-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  min-height: 170px;
}

.username {
  margin: 0 0 8px 0 !important;
  font-family: var(--font-family-primary);
  color: var(--color-accent-primary);
  font-size: 2.2rem;
}

.tier-info {
  margin-bottom: 12px;
}

.expire-date {
  font-size: var(--font-size-tiny);
}

.funcoins-stat {
  margin-top: 4px;
}

.section-title {
  font-family: var(--font-family-primary);
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: bold;
  margin-bottom: 16px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.score-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background-color: var(--color-bg-secondary);
  border-left: 4px solid;
  border-radius: 6px;
}

.mode-name {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.mode-score {
  font-weight: bold;
  font-size: 1.1rem;
  color: var(--color-accent-warning);
}

@media (max-width: 1100px) {
  .header-main-grid {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}

@media (max-width: 768px) {
  .header-card :deep(.n-card-content) {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }

  .header-main-grid {
    gap: 17px;
  }

  .profile-basic-info {
    gap: 17px;
  }

  .avatar-container {
    padding: 7px;
  }

  .user-main-info {
    min-height: auto;
  }

  .username {
    font-size: 1.5rem;
    margin-bottom: 4px !important;
  }

  .section-title {
    font-size: 0.65rem;
    margin-bottom: 11px;
  }

  .score-item {
    gap: 7px;
    padding: 6px;
  }

  .mode-score {
    font-size: 0.85rem;
  }
}

:deep(.n-statistic-label) {
  font-family: var(--font-family-primary);
}

:deep(.n-statistic-value__content) {
  font-family: var(--font-family-primary);
  font-weight: bold;
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
