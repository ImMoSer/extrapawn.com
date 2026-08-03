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
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

const PAWN_COLOR = 'var(--text-color-3)'
const VIP_COLOR = 'var(--neon-purple)'
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
  vip: 1,
  queen: 2,
  king: 3,
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

const subscriptionTiers = computed<SubscriptionTier[]>(() => {
  const baseTiers: SubscriptionTier[] = [
    {
      id: 'pawn',
      name: t('pages.pricing.tiers.pawn.name'),
      role: t('pages.pricing.tiers.pawn.role'),
      icon: '/piece/alpha/wP.svg',
      color: PAWN_COLOR,
      price: t('pages.pricing.tiers.pawn.price'),
      isPurchasable: false,
    },
    {
      id: 'vip',
      name: t('pages.pricing.tiers.vip.name'),
      role: t('pages.pricing.tiers.vip.role'),
      icon: '/piece/alpha/wR.svg',
      color: VIP_COLOR,
      price: t('pages.pricing.tiers.price.bonus'),
      isPurchasable: false,
      isBonus: true,
    },
    {
      id: 'queen',
      name: t('pages.pricing.tiers.queen.name'),
      role: t('pages.pricing.tiers.queen.role'),
      icon: '/piece/alpha/wQ.svg',
      color: QUEEN_COLOR,
      price: t('pages.pricing.tiers.queen.price'),
      isPurchasable: true,
    },
    {
      id: 'king',
      name: t('pages.pricing.tiers.king.name'),
      role: t('pages.pricing.tiers.king.role'),
      icon: '/piece/alpha/wK.svg',
      color: KING_COLOR,
      price: t('pages.pricing.tiers.king.price'),
      isPurchasable: true,
    },
  ]

  return baseTiers.map((tier) => {
    const rank = tierRanks[tier.id] ?? 0
    const isCurrent = currentUserTier.value === tier.id

    let canBuy = false
    let isUpgrade = false

    if (tier.isPurchasable) {
      if (!isPolarCustomer.value) {
        canBuy = true
        isUpgrade = false
      } else {
        canBuy = rank > polarUserRank.value
        isUpgrade = canBuy && polarUserRank.value >= 2
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

interface SubscriptionTier {
  id: string
  name: string
  icon: string
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
  isBlockedByCancel?: boolean
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
    message.warning(t('shared.errors.acceptTermsRequired', 'Bitte akzeptiere die AGB.'))
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
    message.error(t('pages.pricing.upgrade.error'))
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
    message.error(t('pages.pricing.checkoutError', 'Error initiating checkout. Please try again.'))
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
          <n-text style="color: var(--neon-cyan)">{{ t('pages.pricing.title') }}</n-text>
        </n-h1>

        <n-divider title-placement="left">
          <n-h2 prefix="bar" align-text type="success">
            {{ t('pages.pricing.tiers.title') }}
          </n-h2>
        </n-divider>

        <n-alert :show-icon="false" class="bonus-alert">
          <n-space justify="space-between" align="center">
            <n-text class="bonus-alert-text">{{ t('pages.pricing.bonusInfo.alertText') }}</n-text>
            <n-button size="small" @click="$router.push('/bonus')" class="bonus-alert-btn">
              {{ t('pages.pricing.bonusInfo.alertButton') }}
            </n-button>
          </n-space>
        </n-alert>

        <n-grid cols="1 600:2" x-gap="16" y-gap="16" class="pricing-tiers-grid">
          <n-gi v-for="tier in subscriptionTiers" :key="tier.name">
            <n-card
              hoverable
              class="tier-card"
              :class="{ 'active-tier': tier.isCurrent }"
              @click="handleTierClick(tier)"
              :style="{ borderTopColor: tier.color, borderTopWidth: '4px' }"
            >
              <template #header>
                <div class="tier-card-header">
                  <div class="tier-header-info">
                    <span class="tier-card-name" :style="{ color: tier.color }">{{ tier.name }}</span>
                    <span v-if="tier.role" class="tier-card-role">
                      {{ tier.role }}
                    </span>
                  </div>
                  <img :src="tier.icon" :alt="tier.name" class="tier-card-icon" />
                </div>
              </template>

              <div class="tier-card-body">
                <!-- Action Button or Status Badge -->
                <div class="tier-action-container">
                  <n-button
                    v-if="tier.canBuy"
                    block
                    @click.stop="initiateCheckout(tier)"
                    :loading="loadingTier === tier.id"
                    :disabled="loadingTier !== null"
                    class="checkout-btn"
                  >
                    {{
                      tier.isUpgrade
                        ? t('pages.pricing.upgrade.title') + ' - ' + tier.price
                        : tier.price
                    }}
                  </n-button>
                  <n-tooltip v-else-if="tier.isBlockedByCancel" trigger="hover">
                    <template #trigger>
                      <n-button block disabled class="checkout-btn disabled-btn">
                        {{ t('pages.pricing.upgrade.title') }}
                      </n-button>
                    </template>
                    {{
                      t(
                        'pages.userCabinet.subscription.reactivateTooltip',
                        'Bitte reaktiviere dein Abo zuerst.',
                      )
                    }}
                  </n-tooltip>
                  <div v-else-if="tier.isCurrent" class="current-tier-badge">
                    <n-tag type="success" size="medium" class="pulse-tag active-tag">
                      {{ t('features.taskToday.completedStatus', 'Active') }}
                    </n-tag>
                  </div>
                  <div v-else-if="!tier.isPurchasable" class="bonus-tier-badge">
                    <span class="bonus-price-text">{{ tier.price }}</span>
                  </div>
                </div>
              </div>
            </n-card>
          </n-gi>
        </n-grid>
      </n-space>
    </n-layout-content>

    <n-modal
      v-model:show="showBonusModal"
      preset="card"
      style="max-width: 600px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('pages.pricing.bonusInfo.title')"
    >
      <n-space vertical>
        <n-text depth="2">
          <p>{{ t('pages.pricing.bonusInfo.p1') }}</p>
          <p>{{ t('pages.pricing.bonusInfo.p2') }}</p>
          <p>{{ t('pages.pricing.bonusInfo.p3') }}</p>
          <div style="margin-top: 5px">
            <a
              href="https://lichess.org/team/xtrapawn"
              target="_blank"
              style="color: var(--neon-cyan); text-decoration: none; font-weight: bold"
            >
              🔗 {{ t('pages.pricing.bonusInfo.teamLink') }}
            </a>
          </div>
        </n-text>
        <n-divider />
        <n-text strong>{{ t('pages.pricing.bonusInfo.howItWorks') }}</n-text>
        <n-space vertical :size="8">
          <n-tag type="warning">{{ t('pages.pricing.bonusInfo.vip') }}</n-tag>
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
            ➔ {{ t('pages.pricing.bonusInfo.moreInfo') }}
          </router-link>
        </n-space>
        <n-divider dashed />
        <n-text depth="3" italic style="font-size: 0.9em">
          <p>{{ t('pages.pricing.bonusInfo.p6') }}</p>
          <p>{{ t('pages.pricing.bonusInfo.p7') }}</p>
        </n-text>
        <template #footer>
          <n-text strong style="color: var(--color-accent-primary)">
            {{ t('pages.pricing.bonusInfo.p8') }}
          </n-text>
        </template>
      </n-space>
    </n-modal>

    <n-modal
      v-model:show="showUpgradeModal"
      preset="card"
      style="max-width: 500px; background-color: rgba(10, 11, 20, 0.95)"
      :title="t('pages.pricing.upgrade.title')"
      :on-after-leave="handleModalClose"
      :closable="!isUpgrading"
      :mask-closable="!isUpgrading"
    >
      <n-space vertical size="large">
        <template v-if="!upgradeSuccess">
          <n-alert type="success" :show-icon="false">
            <n-text strong style="font-size: 1.1em; color: var(--neon-cyan)">
              {{ t('pages.pricing.upgrade.intro', { targetTier: upgradeTarget?.name }) }}
            </n-text>
          </n-alert>

          <n-text depth="2">
            {{
              t('pages.pricing.upgrade.details', {
                currentTier: currentUserTier,
                targetTier: upgradeTarget?.name,
              }).split(upgradeTarget?.name ?? '')[0]
            }}
            <n-text strong :style="{ color: upgradeTarget?.color }">{{
              upgradeTarget?.name
            }}</n-text>
            {{
              t('pages.pricing.upgrade.details', {
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
                <n-text>{{ t('pages.pricing.upgrade.bullet1') }}</n-text>
              </li>
              <li style="margin-bottom: 8px">
                <n-text>{{ t('pages.pricing.upgrade.bullet2') }}</n-text>
              </li>
              <li>
                <n-text>{{ t('pages.pricing.upgrade.bullet3') }}</n-text>
              </li>
            </ul>
          </n-card>

          <n-alert type="warning" size="small">
            {{ t('pages.pricing.upgrade.warning') }}
          </n-alert>

          <n-checkbox v-model:checked="agbAccepted" :disabled="isUpgrading">
            {{ t('pages.pricing.upgrade.agbLabel') }}
            <a
              href="https://extrapawn.com/legal#terms"
              target="_blank"
              style="color: var(--neon-cyan)"
              >{{ t('pages.pricing.upgrade.agbLinkText') }}</a
            >
            {{ t('pages.pricing.upgrade.agbSuffix') }}
          </n-checkbox>

          <n-button
            type="primary"
            block
            size="large"
            :disabled="!agbAccepted"
            :loading="isUpgrading"
            @click="confirmUpgrade"
          >
            {{ t('pages.pricing.upgrade.button') }}
          </n-button>
        </template>

        <template v-else>
          <div style="text-align: center; padding: 20px 0">
            <div style="font-size: 4rem; margin-bottom: 10px">🎉</div>
            <n-h2 style="color: var(--neon-cyan); margin-bottom: 10px">{{
              t('pages.pricing.upgrade.successTitle')
            }}</n-h2>
            <n-text depth="2">
              {{
                t('pages.pricing.upgrade.successMessage', {
                  targetTier: upgradeTarget?.name,
                }).split(upgradeTarget?.name ?? '')[0]
              }}
              <strong :style="{ color: upgradeTarget?.color }">{{ upgradeTarget?.name }}</strong>
              {{
                t('pages.pricing.upgrade.successMessage', {
                  targetTier: upgradeTarget?.name,
                }).split(upgradeTarget?.name ?? '')[1]
              }}
            </n-text>
          </div>

          <n-button type="primary" block size="large" @click="goToCabinet">
            {{ t('pages.pricing.upgrade.toCabinet') }}
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

.bonus-alert {
  background: linear-gradient(135deg, rgba(9, 9, 11, 0.65), rgba(18, 18, 22, 0.65)) !important;
  border: 1px solid rgba(255, 215, 0, 0.2) !important;
  border-radius: 12px !important;
  padding: 12px 20px !important;
  margin-bottom: 12px;
}

.pricing-tiers-grid {
  max-width: 900px;
  margin: 0 auto;
}

.bonus-alert-text {
  color: var(--text-primary) !important;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.bonus-alert-btn {
  --n-border: 1px solid rgba(255, 215, 0, 0.25) !important;
  --n-border-hover: 1px solid #ffd700 !important;
  --n-border-pressed: 1px solid #ffd700 !important;
  --n-border-focus: 1px solid rgba(255, 215, 0, 0.25) !important;
  --n-ripple-color: #ffd700 !important;

  background: linear-gradient(135deg, #09090b, #121216) !important;
  color: var(--neon-gold) !important;
  border: 1px solid rgba(255, 215, 0, 0.25) !important;
  font-weight: 800 !important;
  letter-spacing: 1px !important;
  border-radius: 6px !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

.bonus-alert-btn:hover {
  background: linear-gradient(135deg, #121217, #1b1b22) !important;
  color: #ffffff !important;
  border-color: var(--neon-gold) !important;
  transform: translateY(-1px);
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.3) !important;
}

.bonus-alert-btn:active {
  transform: translateY(0);
}

.pricing-page-layout {
  --neon-gold: #ffd700;
}

.tier-card {
  height: 100%;
  background-color: rgba(255, 255, 255, 0.02) !important;
  backdrop-filter: blur(12px) !important;
  border: 1px solid rgba(255, 255, 255, 0.06) !important;
  border-radius: 16px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
}

.tier-card:hover {
  border-color: rgba(255, 255, 255, 0.12) !important;
  background-color: rgba(255, 255, 255, 0.04) !important;
  transform: translateY(-6px);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5) !important;
}

.tier-card.active-tier {
  box-shadow: 0 0 20px rgba(0, 229, 255, 0.15) !important;
  border-color: rgba(0, 229, 255, 0.2) !important;
}

.tier-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  width: 100%;
}

.tier-header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tier-card-name {
  font-size: 1.25rem;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.tier-card-role {
  font-size: 0.75rem;
  font-weight: normal;
  color: var(--text-color-3);
  line-height: 1.35;
  margin-top: 4px;
}

.tier-card-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.1));
}

.tier-card-body {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.tier-action-container {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.checkout-btn {
  --n-border: 1px solid rgba(255, 215, 0, 0.25) !important;
  --n-border-hover: 1px solid #ffd700 !important;
  --n-border-pressed: 1px solid #ffd700 !important;
  --n-border-focus: 1px solid rgba(255, 215, 0, 0.25) !important;
  --n-ripple-color: #ffd700 !important;

  background: linear-gradient(135deg, #09090b, #121216) !important;
  color: var(--neon-gold) !important;
  border: 1px solid rgba(255, 215, 0, 0.25) !important;
  font-weight: 800 !important;
  letter-spacing: 1.5px !important;
  border-radius: 8px !important;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
}

.checkout-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #121217, #1b1b22) !important;
  color: #ffffff !important;
  border-color: var(--neon-gold) !important;
  transform: translateY(-2px);
  box-shadow: 0 0 16px rgba(255, 215, 0, 0.35) !important;
}

.checkout-btn:active:not(:disabled) {
  transform: translateY(0);
}

.checkout-btn:disabled,
.checkout-btn.disabled-btn {
  --n-border: 1px solid rgba(255, 255, 255, 0.04) !important;
  --n-border-hover: 1px solid rgba(255, 255, 255, 0.04) !important;
  background: rgba(255, 255, 255, 0.02) !important;
  color: rgba(255, 255, 255, 0.15) !important;
  border-color: rgba(255, 255, 255, 0.04) !important;
  box-shadow: none !important;
  cursor: not-allowed !important;
  transform: none !important;
}

.current-tier-badge {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.active-tag {
  font-weight: 900 !important;
  letter-spacing: 1.5px !important;
  text-transform: uppercase;
  animation: pulse-opacity 1.5s infinite ease-in-out;
}

.bonus-tier-badge {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  font-weight: 800;
}

.bonus-price-text {
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--neon-lime);
}

/* Premium game costs list styles */
.pricing-game-costs-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
}

@media (max-width: 600px) {
  .pricing-game-costs-list {
    grid-template-columns: 1fr;
  }
}

.cost-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left-width: 4px;
  border-left-style: solid;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.cost-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.cost-item-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cost-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.05));
  transition: transform 0.3s ease;
}

.cost-item:hover .cost-item-icon {
  transform: scale(1.15);
}

.cost-item-name {
  font-weight: 800;
  font-size: 1rem;
  color: #eee;
  letter-spacing: 0.5px;
}

.cost-item-right {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.cost-coin-value {
  font-size: 1.6rem;
  font-weight: 900;
  font-family: 'Fira Code', monospace;
}

.cost-coin-label {
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--text-color-3);
  text-transform: uppercase;
  letter-spacing: 1px;
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

@keyframes pulse-opacity {
  0% { opacity: 0.65; }
  50% { opacity: 1; }
  100% { opacity: 0.65; }
}
</style>
