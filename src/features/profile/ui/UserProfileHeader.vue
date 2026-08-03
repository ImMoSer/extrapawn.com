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
  VIP: 'wR.svg',
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
  if (!isoDate) return t('pages.userCabinet.info.tierPermanent')
  const date = new Date(isoDate)
  return t('pages.userCabinet.info.tierExpires', { date: date.toLocaleDateString() })
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

  const ratings: Record<string, number> = {
    finish_him: baseRating,
    tactics: baseRating,
    theory_endings: baseRating,
    practical_chess: baseRating,
  }

  if (props.profileStats) {
    const statsArray = props.profileStats.stats || []

    // Find best rating in stats for each sub_mode
    for (const key in ratings) {
      const modeStats = statsArray.filter((s) => s.sub_mode === key)
      if (modeStats.length > 0) {
        const maxRating = Math.max(...modeStats.map((s) => s.rating || 0))
        if (maxRating > 0) {
          ratings[key] = maxRating
        }
      }
    }
  }

  return [
    {
      key: 'finish_him',
      label: t('pages.userCabinet.stats.modes.finishHim'),
      icon: '🎯',
      color: 'var(--color-accent-success)',
      rating: ratings['finish_him'],
    },
    {
      key: 'tactics',
      label: t('pages.userCabinet.stats.modes.tactics'),
      icon: '🧩',
      color: 'var(--color-accent-primary)',
      rating: ratings['tactics'],
    },
    {
      key: 'theory_endings',
      label: t('pages.puzzle.selection.theoryTitle'),
      icon: '🎓',
      color: 'var(--color-accent-error)',
      rating: ratings['theory_endings'],
    },
    {
      key: 'practical_chess',
      label: t('pages.puzzle.selection.practicalTitle'),
      icon: '♙',
      color: 'var(--color-accent-warning)',
      rating: ratings['practical_chess'],
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
  <n-card v-if="userProfile" class="bg-surface border border-border rounded-lg shadow-flat" :bordered="false">
    <div class="grid grid-cols-1 gap-6">
      <!-- Left side: User Profile Info -->
      <div class="flex items-start gap-6 max-md:gap-4">
        <div class="p-2.5 max-md:p-1.5 rounded-[20%] border border-neon-cyan/40 flex items-center justify-center shrink-0 box-border shadow-glow-cyan/20">
          <n-avatar
            round
            :size="avatarSize"
            :src="avatarUrl"
            fallback-src="https://lichess1.org/assets/images/avatar_default.png"
            class="bg-elevated"
          />
        </div>

        <div class="flex flex-col justify-center h-full min-h-[170px] max-md:min-h-0">
          <n-h1 class="!m-0 !mb-2 font-display text-neon-cyan text-3xl max-md:text-xl font-bold tracking-wide">{{ userProfile.username }}</n-h1>
          <n-space size="small" align="center" wrap class="mb-3">
            <n-tag :type="getTierType(userProfile.subscriptionTier)" round size="small">
              {{ userProfile.subscriptionTier }}
            </n-tag>
            <n-tag v-if="userProfile.polarStatus" :type="polarStatusType" size="small" round ghost>
              {{ userProfile.polarStatus }}
            </n-tag>
            <n-text depth="3" class="text-xs text-text-secondary">
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
              {{ t('pages.userCabinet.subscription.reactivate') }}
            </n-button>
          </n-space>
        </div>
      </div>

      <!-- Right: Best Ratings -->
      <div class="w-full">
        <div class="font-display text-xs font-bold uppercase tracking-wider text-text-secondary mb-4 max-md:mb-3">
          {{ t('pages.userCabinet.stats.bestRatingsTitle') }}
        </div>
        <n-grid :cols="isMobile ? 2 : 4" :x-gap="12" :y-gap="12">
          <n-grid-item v-for="stat in gameModeScores" :key="stat.key">
            <div class="flex items-center gap-2.5 p-2 bg-elevated border-l-4 rounded-md transition-all hover:bg-border/40" :style="{ borderColor: stat.color }">
              <div class="text-xl leading-none flex items-center justify-center w-6 shrink-0">
                {{ stat.icon }}
              </div>
              <div class="ml-2">
                <div class="text-[0.75rem] text-text-secondary leading-tight">{{ stat.label }}</div>
                <div class="font-condensed font-bold text-lg max-md:text-sm text-warning leading-tight">{{ stat.rating }}</div>
              </div>
            </div>
          </n-grid-item>
        </n-grid>
      </div>
    </div>
  </n-card>
</template>
