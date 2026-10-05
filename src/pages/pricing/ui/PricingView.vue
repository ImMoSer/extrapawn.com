<script setup lang="ts">
import {
  NButton,
  NCard,
  NH1,
  NH2,
  NIcon,
  NLayout,
  NLayoutContent,
  NSpace,
  NText,
  NGrid,
  NGi,
} from 'naive-ui'
import {
  CafeOutline,
  CheckmarkCircleOutline,
  HeartOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { computed, ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 768)

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
      windowWidth.value = window.innerWidth
    })
  }
})

const freeFeatures = [
  'pages.pricing.freeFeatures.unlimitedPuzzles',
  'pages.pricing.freeFeatures.allDifficulties',
  'pages.pricing.freeFeatures.dailyPlan',
  'pages.pricing.freeFeatures.deepAnalysis',
  'pages.pricing.freeFeatures.personalStats',
  'pages.pricing.freeFeatures.noSubscription',
]
</script>

<template>
  <n-layout class="pricing-layout">
    <n-layout-content
      class="pricing-content"
      :content-style="isMobile ? 'padding: 12px;' : 'padding: 32px; max-width: 1000px; margin: 0 auto;'"
    >
      <n-space vertical :size="isMobile ? 24 : 36">
        <!-- Header -->
        <div class="header-section text-center">
          <n-h1 class="page-title">
            <span class="gradient-text">100% Free & Open Access</span>
          </n-h1>
          <n-text depth="2" class="subtitle">
            {{ t('pages.pricing.subtitle') || 'ExtraPawn is completely free for every chess player. No paywalls, no tiers, no recurring subscriptions.' }}
          </n-text>
        </div>

        <!-- Free Features Card -->
        <n-card class="glass-card main-card" :bordered="false">
          <div class="card-inner">
            <div class="badge-free">FREE FOR ALL</div>
            <n-h2 class="card-title">Everything is Unlocked</n-h2>
            <p class="card-desc">
              Enjoy complete access to all tactical motifs, endgame theory, neural network conversions, and personalized training plans without limitations.
            </p>

            <n-grid :cols="isMobile ? 1 : 2" :x-gap="16" :y-gap="14" class="features-grid">
              <n-gi v-for="(feat, idx) in freeFeatures" :key="idx">
                <div class="feature-item">
                  <n-icon size="20" color="var(--neon-green)">
                    <CheckmarkCircleOutline />
                  </n-icon>
                  <n-text strong>{{ t(feat) }}</n-text>
                </div>
              </n-gi>
            </n-grid>
          </div>
        </n-card>

        <!-- Support / Buy Me a Coffee Card -->
        <n-card class="glass-card support-card" :bordered="false">
          <n-space vertical align="center" :size="16" class="text-center py-4">
            <div class="heart-icon-wrapper">
              <n-icon size="36" color="#ff4d4f">
                <HeartOutline />
              </n-icon>
            </div>
            
            <n-h2 class="support-title">Support the Project</n-h2>
            
            <n-text depth="2" style="max-width: 580px; font-size: 1.05rem; line-height: 1.6;">
              ExtraPawn is developed independently with passion for the chess community. If you enjoy training here and want to show appreciation or support hosting costs, you are welcome to buy me a coffee! More voluntary donation options will be available soon.
            </n-text>

            <div class="support-actions">
              <n-button
                type="warning"
                size="large"
                round
                tag="a"
                href="https://coff.ee/chessboard.fun"
                target="_blank"
                class="coffee-btn"
              >
                <template #icon>
                  <n-icon><CafeOutline /></n-icon>
                </template>
                {{ t('about.author.supportButtonText') || 'Buy me a coffee' }}
              </n-button>

              <router-link to="/club-player" custom v-slot="{ navigate }">
                <n-button
                  secondary
                  size="large"
                  round
                  class="club-btn"
                  @click="navigate"
                >
                  <template #icon>
                    <n-icon><TrophyOutline /></n-icon>
                  </template>
                  Club Top 20
                </n-button>
              </router-link>
            </div>
          </n-space>
        </n-card>
      </n-space>
    </n-layout-content>
  </n-layout>
</template>

<style scoped>
.pricing-layout,
.pricing-content {
  background-color: transparent !important;
}

.text-center {
  text-align: center;
}

.page-title {
  font-size: 2.4rem;
  font-weight: 800;
  margin-bottom: 8px !important;
  letter-spacing: 1px;
}

.gradient-text {
  background: linear-gradient(135deg, var(--neon-cyan), var(--neon-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  font-size: 1.15rem;
  display: block;
  max-width: 650px;
  margin: 0 auto;
}

.glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  overflow: hidden;
}

.main-card {
  position: relative;
  border: 1px solid rgba(0, 229, 255, 0.25);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}

.badge-free {
  display: inline-block;
  padding: 4px 12px;
  background: rgba(0, 255, 128, 0.15);
  color: var(--neon-green);
  border: 1px solid rgba(0, 255, 128, 0.3);
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 8px !important;
}

.card-desc {
  color: var(--text-color-2);
  font-size: 1.05rem;
  margin-bottom: 24px;
  max-width: 700px;
}

.features-grid {
  margin-top: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
}

.heart-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  background: rgba(255, 77, 79, 0.1);
  border-radius: 50%;
  margin-bottom: 4px;
}

.support-title {
  font-size: 1.6rem;
  font-weight: 700;
  margin-bottom: 0 !important;
}

.support-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 12px;
}

.coffee-btn {
  font-weight: 700;
  padding: 0 28px;
  box-shadow: 0 4px 16px rgba(245, 166, 35, 0.3);
}

.club-btn {
  font-weight: 700;
  padding: 0 24px;
}

@media (max-width: 600px) {
  .page-title {
    font-size: 1.8rem;
  }
  .card-title {
    font-size: 1.4rem;
  }
}
</style>
