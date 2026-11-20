<script setup lang="ts">
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import {
  CheckmarkCircleOutline,
  HeartOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NH1,
  NH2,
  NIcon,
  NSpace,
  NText,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  <AppPageShell>
    <div class="flex w-full flex-col gap-6 @3xl:gap-8">
      <!-- Header -->
      <div class="rounded-xl border border-border bg-surface px-5 py-6 text-center @3xl:px-8 @3xl:py-8">
        <n-h1 class="!mb-2 font-display text-[1.6rem] font-extrabold tracking-[1px] text-text-primary @2xl:text-[2.2rem]">
          {{ t('pages.pricing.title') }}
        </n-h1>
        <n-text depth="2" class="mx-auto block max-w-[650px] text-sm @2xl:text-base">
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
            class="mb-3 inline-block rounded-sm border border-success/30 bg-success/15 px-3 py-1 font-condensed text-xs font-extrabold tracking-[1.5px] text-success"
          >
            {{ t('pages.pricing.freeBadge') }}
          </div>
          <n-h2 class="!mb-2 font-display text-[1.3rem] font-bold @2xl:text-[1.65rem]">
            {{ t('pages.pricing.unlockedTitle') }}
          </n-h2>
          <p class="mb-5 max-w-[700px] text-sm text-text-secondary @2xl:text-base">
            {{ t('pages.pricing.unlockedDesc') }}
          </p>

          <div class="mt-4 grid grid-cols-1 gap-3.5 @2xl:grid-cols-2">
            <div
              v-for="(feat, idx) in freeFeatures"
              :key="idx"
              class="flex items-center gap-2.5 rounded-lg border border-border bg-elevated/40 px-3.5 py-2.5"
            >
              <n-icon size="20" color="var(--color-success)" class="shrink-0">
                <CheckmarkCircleOutline />
              </n-icon>
              <n-text strong>{{ t(feat) }}</n-text>
            </div>
          </div>
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

          <n-h2 class="!mb-0 font-display text-[1.45rem] font-bold @2xl:text-[1.6rem]">
            {{ t('pages.pricing.supportTitle') }}
          </n-h2>

          <n-text depth="2" class="max-w-[580px] text-sm leading-relaxed @2xl:text-base">
            {{ t('pages.pricing.supportDesc') }}
          </n-text>

          <div class="mt-3 flex flex-wrap justify-center gap-4">
            <n-button
              type="warning"
              size="large"
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
              <n-button secondary size="large" class="px-6 font-bold" @click="navigate">
                <template #icon>
                  <n-icon><TrophyOutline /></n-icon>
                </template>
                {{ t('pages.pricing.clubBtn') }}
              </n-button>
            </router-link>
          </div>
        </n-space>
      </n-card>
    </div>
  </AppPageShell>
</template>
