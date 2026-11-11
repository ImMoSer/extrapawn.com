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
  CheckmarkCircleOutline,
  HeartOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
const isMobile = computed(() => windowWidth.value < 768)
const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateWindowWidth)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth)
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
  <n-layout class="!bg-transparent">
    <n-layout-content
      class="!bg-transparent"
      :content-style="
        isMobile ? 'padding: 12px;' : 'padding: 32px; max-width: 1000px; margin: 0 auto;'
      "
    >
      <n-space vertical :size="isMobile ? 24 : 36">
        <!-- Header -->
        <div class="text-center">
          <n-h1 class="!mb-2 font-display text-[1.8rem] font-extrabold tracking-[1px] text-text-primary sm:text-[2.4rem]">
            {{ t('pages.pricing.title') }}
          </n-h1>
          <n-text depth="2" class="mx-auto block max-w-[650px] text-[1.15rem]">
            {{ t('pages.pricing.subtitle') }}
          </n-text>
        </div>

        <!-- Free Features Card -->
        <n-card
          class="glass relative overflow-hidden border-border-hover"
          :bordered="false"
        >
          <div>
            <div
              class="mb-3 inline-block rounded-full border border-success/30 bg-success/15 px-3 py-1 font-condensed text-xs font-extrabold tracking-[1.5px] text-success"
            >
              {{ t('pages.pricing.freeBadge') }}
            </div>
            <n-h2 class="!mb-2 font-display text-[1.4rem] font-bold sm:text-[1.8rem]">
              {{ t('pages.pricing.unlockedTitle') }}
            </n-h2>
            <p class="mb-6 max-w-[700px] text-[1.05rem] text-text-secondary">
              {{ t('pages.pricing.unlockedDesc') }}
            </p>

            <n-grid :cols="isMobile ? 1 : 2" :x-gap="16" :y-gap="14" class="mt-4">
              <n-gi v-for="(feat, idx) in freeFeatures" :key="idx">
                <div
                  class="flex items-center gap-2.5 rounded-lg border border-border bg-elevated/40 px-3.5 py-2.5"
                >
                  <n-icon size="20" color="var(--color-success)">
                    <CheckmarkCircleOutline />
                  </n-icon>
                  <n-text strong>{{ t(feat) }}</n-text>
                </div>
              </n-gi>
            </n-grid>
          </div>
        </n-card>

        <!-- Support the Project Card -->
        <n-card class="glass overflow-hidden" :bordered="false">
          <n-space vertical align="center" :size="16" class="py-4 text-center">
            <div
              class="mb-1 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10"
            >
              <n-icon size="36" color="var(--color-danger)">
                <HeartOutline />
              </n-icon>
            </div>

            <n-h2 class="!mb-0 font-display text-[1.6rem] font-bold">
              {{ t('pages.pricing.supportTitle') }}
            </n-h2>

            <n-text depth="2" class="max-w-[580px] text-[1.05rem] leading-relaxed">
              {{ t('pages.pricing.supportDesc') }}
            </n-text>

            <div class="mt-3 flex flex-wrap justify-center gap-4">
              <n-button
                type="warning"
                size="large"
                round
                tag="a"
                href="https://ko-fi.com/extrapawn"
                target="_blank"
                class="px-7 font-bold"
              >
                <template #icon>
                  <n-icon><HeartOutline /></n-icon>
                </template>
                {{ t('about.author.supportButtonText') }}
              </n-button>

              <router-link to="/club-player" custom v-slot="{ navigate }">
                <n-button secondary size="large" round class="px-6 font-bold" @click="navigate">
                  <template #icon>
                    <n-icon><TrophyOutline /></n-icon>
                  </template>
                  {{ t('pages.pricing.clubBtn') }}
                </n-button>
              </router-link>
            </div>
          </n-space>
        </n-card>
      </n-space>
    </n-layout-content>
  </n-layout>
</template>
