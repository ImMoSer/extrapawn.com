<script setup lang="ts">
import { apiClient } from '@/shared/api/client'
import { useAuthStore } from '@/entities/user'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NGi,
  NGrid,
  NH1,
  NH2,
  NLayout,
  NLayoutContent,
  NModal,
  NSpace,
  NTag,
  NText,
  NThing,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

// Subscription values and colors
// Subscription values and colors
const PAWN_COINS = 250
const KNIGHT_COINS = 500
const BISHOP_COINS = 750
const ROOK_COINS = 1000
const QUEEN_COINS = 5000
const KING_COINS = 0 // Displayed as LIMITLESS

const PAWN_COLOR = 'var(--text-color-3)'
const KNIGHT_COLOR = 'var(--neon-blue)'
const BISHOP_COLOR = 'var(--neon-lime)'
const ROOK_COLOR = 'var(--neon-purple)'
const QUEEN_COLOR = 'var(--color-accent-error)'
const KING_COLOR = 'var(--neon-gold)' // Gold for King

const showBonusModal = ref(false)
const showUpgradeModal = ref(false)
const upgradeTarget = ref<SubscriptionTier | null>(null)
const agbAccepted = ref(false)

const loadingTier = ref<string | null>(null)
const isUpgrading = ref(false)
const upgradeSuccess = ref(false)

const tierRanks: Record<string, number> = {
  pawn: 0,
  knight: 1,
  bishop: 2,
  rook: 3,
  queen: 4,
  king: 5,
}

const currentUserTier = computed(() => {
  const profile = authStore.getUserProfile
  return (profile?.activeTier || profile?.subscriptionTier || 'pawn').toLowerCase()
})

const polarUserTier = computed(() => {
  const profile = authStore.getUserProfile
  return (profile?.polarTier || 'pawn').toLowerCase()
})

const polarUserRank = computed(() => tierRanks[polarUserTier.value] ?? 0)

const isSubscriptionCanceled = computed(() => {
  return authStore.getUserProfile?.polarStatus === 'canceled'
})

const isPolarCustomer = computed(() => {
  return !!authStore.getUserProfile?.isPolarCustomer
})

const subscriptionTiers = computed(() => {
  const baseTiers = [
    {
      id: 'pawn',
      name: t('features.pricing.tiers.pawn.name'),
      role: t('features.pricing.tiers.pawn.role'),
      icon: '/piece/alpha/wP.svg',
      pawncoins: PAWN_COINS,
      color: PAWN_COLOR,
      price: t('features.pricing.tiers.pawn.price'),
      isPurchasable: false,
    },
    {
      id: 'knight',
      name: t('features.pricing.tiers.knight.name'),
      role: t('features.pricing.tiers.knight.role'),
      icon: '/piece/alpha/wN.svg',
      pawncoins: KNIGHT_COINS,
      color: KNIGHT_COLOR,
      price: t('features.pricing.tiers.price.bonus'),
      isPurchasable: false,
      isBonus: true,
    },
    {
      id: 'bishop',
      name: t('features.pricing.tiers.bishop.name'),
      role: t('features.pricing.tiers.bishop.role'),
      icon: '/piece/alpha/wB.svg',
      pawncoins: BISHOP_COINS,
      color: BISHOP_COLOR,
      price: t('features.pricing.tiers.price.bonus'),
      isPurchasable: false,
      isBonus: true,
    },
    {
      id: 'rook',
      name: t('features.pricing.tiers.rook.name'),
      role: t('features.pricing.tiers.rook.role'),
      icon: '/piece/alpha/wR.svg',
      pawncoins: ROOK_COINS,
      color: ROOK_COLOR,
      price: t('features.pricing.tiers.rook.price'),
      isPurchasable: true,
    },
    {
      id: 'queen',
      name: t('features.pricing.tiers.queen.name'),
      role: t('features.pricing.tiers.queen.role'),
      icon: '/piece/alpha/wQ.svg',
      pawncoins: QUEEN_COINS,
      color: QUEEN_COLOR,
      price: t('features.pricing.tiers.queen.price'),
      isPurchasable: true,
    },
    {
      id: 'king',
      name: t('features.pricing.tiers.king.name'),
      role: t('features.pricing.tiers.king.role'),
      icon: '/piece/alpha/wK.svg',
      pawncoins: KING_COINS,
      color: KING_COLOR,
      price: t('features.pricing.tiers.king.price'),
      isPurchasable: true,
      isLimitless: true,
    },
  ]

  return baseTiers.map((tier) => {
    const rank = tierRanks[tier.id] ?? 0
    const isCurrent = currentUserTier.value === tier.id

    let canBuy = false
    let isUpgrade = false

    if (tier.isPurchasable) {
      if (!isPolarCustomer.value) {
        // Nicht-Abonnenten (oder reine Gift-User ohne Polar-Abo) dürfen ALLES kaufen.
        // Nichts davon zählt als "Upgrade" bei Polar, sondern als neues Abo.
        canBuy = true
        isUpgrade = false
      } else {
        // Polar-Abonnenten können nur in echt höhere Tiers per Button upgraden.
        canBuy = rank > polarUserRank.value
        isUpgrade = canBuy && polarUserRank.value >= 3
      }
    }

    return {
      ...tier,
      isCurrent,
      canBuy: canBuy && !isSubscriptionCanceled.value,
      isUpgrade,
      isBlockedByCancel: canBuy && isSubscriptionCanceled.value,
    }
  })
})

const gameCosts = computed(() => {
  return [
    { name: t('nav.tornado'), icon: '🌪️', cost: 10 },
    { name: t('nav.theoryEndgames'), icon: '📚', cost: 5 },
    { name: t('nav.practicalChess'), icon: '♟️', cost: 5 },
    { name: t('nav.finishHim'), icon: '🎯', cost: 10 },
    { name: t('nav.diamondHunter'), icon: '💎', cost: 25 },
    { name: t('nav.openingExam'), icon: '🤺', cost: 25 },
    { name: t('features.study.replyTraining.title', 'Reply Training'), icon: '🔁', cost: 25 },
    { name: t('nav.speedrun'), icon: '🏃', cost: 25 },
    { name: t('features.pricing.repertoireGenerator'), icon: '📖', cost: 50 },
  ]
})

interface SubscriptionTier {
  id: string
  name: string
  icon: string
  pawncoins: number
  color: string
  price?: string
  highlight?: boolean
  isBonus?: boolean
  isPurchasable?: boolean
  role?: string
  isCurrent?: boolean
  canBuy?: boolean
  isUpgrade?: boolean
  isLimitless?: boolean
}

const message = useMessage()

const handleTierClick = (tier: SubscriptionTier) => {
  if (tier.isBonus) {
    showBonusModal.value = true
  }
}

const initiateCheckout = (tier: SubscriptionTier) => {
  if (tier.isUpgrade) {
    upgradeTarget.value = tier
    agbAccepted.value = false
    upgradeSuccess.value = false
    showUpgradeModal.value = true
  } else {
    handleCheckout(tier)
  }
}

const confirmUpgrade = async () => {
  if (!upgradeTarget.value) return

  if (!agbAccepted.value) {
    message.warning(t('common.terms.acceptRequired', 'Bitte akzeptiere die AGB.'))
    return
  }

  isUpgrading.value = true
  try {
    const response = await apiClient<{ success: boolean }>('/billing/upgrade', {
      method: 'POST',
      body: JSON.stringify({ tier: upgradeTarget.value.id }),
    })

    if (response.success) {
      // Refresh the session to get the new tier locally
      await authStore.checkSession()
      // Wait a short moment to ensure the state has settled
      await new Promise((resolve) => setTimeout(resolve, 500))

      upgradeSuccess.value = true
    }
  } catch (error: unknown) {
    console.error('Upgrade error:', error)
    message.error(t('features.pricing.upgrade.error'))
  } finally {
    isUpgrading.value = false
  }
}

const handleModalClose = () => {
  if (upgradeSuccess.value) {
    // If they just close the modal after success, ensure page reflects it
    window.location.reload()
  } else {
    showUpgradeModal.value = false
  }
}

const goToCabinet = () => {
  showUpgradeModal.value = false
  // Wir nutzen window.location.href um einen echten Page-Reload auszulösen
  window.location.href = '/user-cabinet'
}

const handleCheckout = async (tier: SubscriptionTier) => {
  try {
    loadingTier.value = tier.id

    const response = await apiClient<{ success: boolean; url: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: tier.id, interval: 'monthly' }),
    })

    if (response.success && response.url) {
      window.location.href = response.url // Redirect to Polar
    }
  } catch (error: unknown) {
    console.error('Checkout error:', error)
    message.error(t('pricing.checkoutError', 'Error initiating checkout. Please try again.'))
  } finally {
    loadingTier.value = null
  }
}
</script>

<template>
  <n-layout class="pricing-page-layout">
    <n-layout-content
      class="pricing-content"
      content-style="padding: 10px; max-width: 1200px; margin: 0 auto;"
    >
      <n-space vertical size="large">
        <n-h1 align-text class="page-title">
          <n-text style="color: var(--neon-cyan)">{{ t('features.pricing.title') }}</n-text>
        </n-h1>

        <n-divider title-placement="left">
          <n-h2 prefix="bar" align-text type="success">
            {{ t('features.pricing.tiers.title') }}
          </n-h2>
        </n-divider>

        <n-alert type="info" :show-icon="false" style="margin-bottom: 8px">
          <n-space justify="space-between" align="center">
            <n-text>{{ t('features.pricing.bonusInfo.alertText') }}</n-text>
            <n-button type="primary" secondary size="small" @click="$router.push('/bonus')">
              {{ t('features.pricing.bonusInfo.alertButton') }}
            </n-button>
          </n-space>
        </n-alert>

        <n-grid cols="1 600:2 900:3 1400:6" x-gap="16" y-gap="16">
          <n-gi v-for="tier in subscriptionTiers" :key="tier.name">
            <n-card hoverable class="tier-card" @click="handleTierClick(tier)">
              <template #header>
                <n-space vertical :size="0">
                  <n-text strong>{{ tier.name }}</n-text>
                  <n-text v-if="tier.role" depth="3" style="font-size: 0.75em; font-weight: normal">
                    {{ tier.role }}
                  </n-text>
                </n-space>
              </template>
              <template #header-extra>
                <img :src="tier.icon" :alt="tier.name" style="width: 32px; height: 32px" />
              </template>

              <n-thing>
                <template #description>
                  <n-tooltip v-if="tier.isLimitless" trigger="hover">
                    <template #trigger>
                      <n-text class="rainbow-text limitless-symbol"> ∞ </n-text>
                    </template>
                    {{ t('common.actions.limitless') }}
                  </n-tooltip>
                  <n-text v-else depth="3" style="font-size: 0.9em">
                    {{ t('features.pricing.tiers.pawn.description').split('{pawncoins}')[0] }}
                    <n-text :style="{ color: tier.color, fontWeight: 'bold', fontSize: '1.2em' }">
                      {{ tier.pawncoins }}
                    </n-text>
                    {{ t('features.pricing.tiers.pawn.description').split('{pawncoins}')[1] }}
                  </n-text>
                </template>
                <n-divider dashed style="margin: 5px 0" />

                <div
                  style="
                    min-height: 48px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <n-button
                    v-if="tier.canBuy"
                    block
                    type="primary"
                    @click.stop="initiateCheckout(tier)"
                    :loading="loadingTier === tier.id"
                    :disabled="loadingTier !== null"
                  >
                    {{
                      tier.isUpgrade
                        ? t('features.pricing.upgrade.title') + ' - ' + tier.price
                        : tier.price
                    }}
                  </n-button>
                  <n-tooltip v-else-if="tier.isBlockedByCancel" trigger="hover">
                    <template #trigger>
                      <n-button block disabled>
                        {{ t('features.pricing.upgrade.title') }}
                      </n-button>
                    </template>
                    {{
                      t(
                        'features.userCabinet.subscription.reactivateTooltip',
                        'Bitte reaktiviere dein Abo zuerst.',
                      )
                    }}
                  </n-tooltip>
                  <n-text
                    v-else-if="tier.isCurrent"
                    strong
                    type="success"
                    style="font-size: 1.1em; text-align: center"
                  >
                    Current Tier
                  </n-text>
                  <n-text
                    v-else-if="!tier.isPurchasable"
                    strong
                    type="success"
                    style="font-size: 1.1em; text-align: center"
                  >
                    {{ tier.price }}
                  </n-text>
                </div>
              </n-thing>
            </n-card>
          </n-gi>
        </n-grid>

        <n-divider title-placement="left">
          <n-h2 prefix="bar" align-text type="warning">
            {{ t('features.pricing.costs.title') }}
          </n-h2>
        </n-divider>

        <n-grid cols="1 500:2 800:4" x-gap="16" y-gap="16">
          <n-gi v-for="game in gameCosts" :key="game.name">
            <n-card hoverable class="game-cost-card">
              <template #header>
                <n-space align="center">
                  <n-text style="font-size: 1.5em">{{ game.icon }}</n-text>
                  <n-text strong style="font-size: 0.9em">{{ game.name }}</n-text>
                </n-space>
              </template>
              <n-thing>
                <template #description>
                  <n-space justify="space-between" align="center">
                    <n-text depth="3">{{ t('features.pricing.costs.pawncoinLabel') }}</n-text>
                    <n-text strong type="warning" style="font-size: 1.4em">
                      {{ game.cost }}
                    </n-text>
                  </n-space>
                </template>
              </n-thing>
            </n-card>
          </n-gi>
        </n-grid>
      </n-space>
    </n-layout-content>

    <n-modal
      v-model:show="showBonusModal"
      preset="card"
      style="max-width: 600px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.pricing.bonusInfo.title')"
    >
      <n-space vertical>
        <n-text depth="2">
          <p>{{ t('features.pricing.bonusInfo.p1') }}</p>
          <p>{{ t('features.pricing.bonusInfo.p2') }}</p>
          <p>{{ t('features.pricing.bonusInfo.p3') }}</p>
          <div style="margin-top: 5px">
            <a
              href="https://lichess.org/team/xtrapawn"
              target="_blank"
              style="color: var(--neon-cyan); text-decoration: none; font-weight: bold"
            >
              🔗 {{ t('features.pricing.bonusInfo.teamLink') }}
            </a>
          </div>
        </n-text>
        <n-divider />
        <n-text strong>{{ t('features.pricing.bonusInfo.howItWorks') }}</n-text>
        <n-space vertical :size="8">
          <n-tag type="info">{{ t('features.pricing.bonusInfo.knight') }}</n-tag>
          <n-tag type="warning">{{ t('features.pricing.bonusInfo.bishop') }}</n-tag>
          <router-link
            to="/bonus"
            style="
              color: var(--neon-cyan);
              text-decoration: none;
              font-weight: bold;
              margin-top: 4px;
              display: inline-block;
            "
          >
            ➔ {{ t('features.pricing.bonusInfo.moreInfo') }}
          </router-link>
        </n-space>
        <n-divider dashed />
        <n-text depth="3" italic style="font-size: 0.9em">
          <p>{{ t('features.pricing.bonusInfo.p6') }}</p>
          <p>{{ t('features.pricing.bonusInfo.p7') }}</p>
        </n-text>
        <template #footer>
          <n-text strong style="color: var(--color-accent-primary)">
            {{ t('features.pricing.bonusInfo.p8') }}
          </n-text>
        </template>
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="showUpgradeModal"
      preset="card"
      style="max-width: 500px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('features.pricing.upgrade.title')"
      :on-after-leave="handleModalClose"
      :closable="!isUpgrading"
      :mask-closable="!isUpgrading"
    >
      <n-space vertical size="large">
        <template v-if="!upgradeSuccess">
          <n-alert type="success" :show-icon="false">
            <n-text strong style="font-size: 1.1em; color: var(--neon-cyan)">
              {{ t('features.pricing.upgrade.intro', { targetTier: upgradeTarget?.name }) }}
            </n-text>
          </n-alert>

          <n-text depth="2">
            {{
              t('features.pricing.upgrade.details', {
                currentTier: currentUserTier,
                targetTier: upgradeTarget?.name,
              }).split(upgradeTarget?.name ?? '')[0]
            }}
            <n-text strong :style="{ color: upgradeTarget?.color }">{{
              upgradeTarget?.name
            }}</n-text>
            {{
              t('features.pricing.upgrade.details', {
                currentTier: currentUserTier,
                targetTier: upgradeTarget?.name,
              }).split(upgradeTarget?.name ?? '')[1]
            }}
          </n-text>

          <n-card
            size="small"
            style="background-color: var(--glass-bg); border-color: var(--glass-border)"
          >
            <ul style="margin: 0; padding-left: 20px; color: var(--text-color-3)">
              <li style="margin-bottom: 8px">
                <n-text>{{ t('features.pricing.upgrade.bullet1') }}</n-text>
              </li>
              <li style="margin-bottom: 8px">
                <n-text>{{ t('features.pricing.upgrade.bullet2') }}</n-text>
              </li>
              <li>
                <n-text>{{ t('features.pricing.upgrade.bullet3') }}</n-text>
              </li>
            </ul>
          </n-card>

          <n-alert type="warning" size="small">
            {{ t('features.pricing.upgrade.warning') }}
          </n-alert>

          <n-checkbox v-model:checked="agbAccepted" :disabled="isUpgrading">
            {{ t('features.pricing.upgrade.agbLabel') }}
            <a
              href="https://extrapawn.com/legal#terms"
              target="_blank"
              style="color: var(--neon-cyan)"
              >{{ t('features.pricing.upgrade.agbLinkText') }}</a
            >
            {{ t('features.pricing.upgrade.agbSuffix') }}
          </n-checkbox>

          <n-button
            type="primary"
            block
            size="large"
            :disabled="!agbAccepted"
            :loading="isUpgrading"
            @click="confirmUpgrade"
          >
            {{ t('features.pricing.upgrade.button') }}
          </n-button>
        </template>

        <template v-else>
          <div style="text-align: center; padding: 20px 0">
            <div style="font-size: 4rem; margin-bottom: 10px">🎉</div>
            <n-h2 style="color: var(--neon-cyan); margin-bottom: 10px">{{
              t('features.pricing.upgrade.successTitle')
            }}</n-h2>
            <n-text depth="2">
              {{
                t('features.pricing.upgrade.successMessage', {
                  targetTier: upgradeTarget?.name,
                }).split(upgradeTarget?.name ?? '')[0]
              }}
              <strong :style="{ color: upgradeTarget?.color }">{{ upgradeTarget?.name }}</strong>
              {{
                t('features.pricing.upgrade.successMessage', {
                  targetTier: upgradeTarget?.name,
                }).split(upgradeTarget?.name ?? '')[1]
              }}
            </n-text>
          </div>

          <n-button type="primary" block size="large" @click="goToCabinet">
            {{ t('features.pricing.upgrade.toCabinet') }}
          </n-button>
        </template>
      </n-space>
    </n-modal>
  </n-layout>
</template>

<style scoped>
.pricing-page-layout,
.pricing-content {
  background-color: transparent !important;
}

.page-title {
  margin-bottom: 24px !important;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.tier-card {
  height: 100%;
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tier-card:hover {
  border-color: var(--neon-cyan);
  background-color: var(--glass-bg-hover);
  transform: translateY(-4px);
}

.clickable-tier {
  cursor: pointer;
}

.highlight-tier {
  border: 1px solid var(--neon-cyan) !important;
  box-shadow: 0 0 15px rgba(0, 242, 255, 0.2);
}

.game-cost-card {
  height: 100%;
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  transition: all 0.3s ease;
}

.game-cost-card:hover {
  border-color: var(--neon-cyan);
  background-color: var(--glass-bg-hover);
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .pricing-page-layout :deep(.n-layout-content) {
    padding: 5px !important;
  }
}

.limitless-symbol {
  font-size: 3.5rem;
  line-height: 1;
  display: inline-block;
  cursor: help;
  padding: 0;
  margin: 0;
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
