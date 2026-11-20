<script setup lang="ts">
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { NButton, NCard, NDivider, NSpace, NTag, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const appVersion = import.meta.env.VITE_APP_VERSION || '2.0.0'

const modules = [
  'trainingCenter',
  'warmup',
  'woodpecker',
  'userCabinet',
] as const

const moduleVisuals: Record<
  (typeof modules)[number],
  { icon: string; color: string }
> = {
  trainingCenter: {
    icon: '🎯',
    color: 'var(--color-brand)',
  },
  warmup: {
    icon: '⚡',
    color: 'var(--color-accent)',
  },
  woodpecker: {
    icon: '🔥',
    color: 'var(--color-warning)',
  },
  userCabinet: {
    icon: '🧬',
    color: 'var(--color-info)',
  },
}

const conceptKeys = ['what', 'forWho', 'uniqueness'] as const

const techStackItems = [
  { labelKey: 'frontend', stackKey: 'frontendStack', color: 'var(--color-brand)' },
  { labelKey: 'backend', stackKey: 'backendStack', color: 'var(--color-accent)' },
  { labelKey: 'chessLogic', stackKey: 'chessLogicStack', color: 'var(--color-info)' },
  { labelKey: 'boardRendering', stackKey: 'boardRenderingStack', color: 'var(--color-success)' },
  { labelKey: 'chessEngine', stackKey: 'chessEngineStack', color: 'var(--color-warning)' },
  { labelKey: 'api', stackKey: 'apiStack', color: 'var(--color-danger)' },
] as const
</script>

<template>
  <AppPageShell>
    <div class="flex w-full flex-col gap-6 text-text-primary @3xl:gap-8">
      <!-- Hero Section (Aligned to Master Center Column) -->
      <header
        class="relative flex items-center justify-center overflow-hidden rounded-xl border border-border bg-surface px-4 py-7 text-center @2xl:px-8 @2xl:py-10"
      >
        <div class="relative z-10">
          <h1
            class="m-0 font-display text-xl font-black tracking-[1px] text-text-primary uppercase @2xl:text-3xl @4xl:text-4xl @2xl:tracking-[2px]"
          >
            {{ t('about.hero.title') }}
          </h1>
          <p class="mt-2.5 text-xs tracking-[0.5px] text-text-secondary @2xl:mt-3.5 @2xl:text-base @2xl:tracking-[0.8px]">
            {{ t('about.hero.subtitle') }}
            <span
              class="ml-1.5 rounded-sm border border-brand/40 bg-brand/15 px-2 py-0.5 align-middle font-condensed text-[10px] font-bold text-brand @2xl:text-xs"
            >
              v{{ appVersion }}
            </span>
          </p>
        </div>
      </header>

      <!-- Concept Section -->
      <section>
        <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-3">
          <n-card
            v-for="key in conceptKeys"
            :key="key"
            size="small"
            class="glass relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3.5 @2xl:[&>.n-card__content]:!px-5 @2xl:[&>.n-card__content]:!py-4"
          >
            <div class="absolute top-0 left-0 h-[2px] w-full bg-brand"></div>
            <h2 class="m-0 mb-2 font-display text-sm font-bold text-text-primary @2xl:mb-3 @2xl:text-lg">
              {{ t(`about.concept.${key}.title`) }}
            </h2>
            <n-text class="text-xs leading-relaxed @2xl:text-sm">
              <span
                v-html="
                  t(`about.concept.${key}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                "
              ></span>
            </n-text>
          </n-card>
        </div>
      </section>

      <n-divider class="!my-1 !border-border" />

      <!-- Modules Section -->
      <section>
        <h2
          class="mb-4 text-center font-display text-xl font-black tracking-[1px] text-text-primary @2xl:mb-6 @2xl:text-3xl"
        >
          {{ t('about.hero.title').split(' — ')[0] }} Pillars
        </h2>
        <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <n-card
            v-for="mod in modules"
            :key="mod"
            size="small"
            class="glass group h-full transition-colors duration-200 hover:border-border-hover [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3.5 @2xl:[&>.n-card__content]:!px-5 @2xl:[&>.n-card__content]:!py-4"
          >
            <div class="flex items-center gap-3 border-b border-border/60 pb-2.5 @2xl:gap-4 @2xl:pb-3">
              <div
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-elevated/60 @2xl:h-11 @2xl:w-11"
                :style="{
                  color: moduleVisuals[mod].color,
                  border: '1px solid ' + moduleVisuals[mod].color,
                }"
              >
                <span class="text-lg @2xl:text-xl">{{ moduleVisuals[mod].icon }}</span>
              </div>
              <h3 class="m-0 font-display text-sm font-extrabold tracking-[0.5px] text-text-primary @2xl:text-lg">
                {{ t(`about.modules.${mod}.title`) }}
              </h3>
            </div>
            <div class="pt-2.5 @2xl:pt-3">
              <n-text depth="3" class="text-xs leading-relaxed whitespace-pre-wrap text-text-secondary @2xl:text-sm">
                <span
                  v-html="
                    t(`about.modules.${mod}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  "
                ></span>
              </n-text>
            </div>
          </n-card>
        </div>
      </section>

      <n-divider class="!my-1 !border-border" />

      <!-- Tech Stack -->
      <section class="glass p-4 @2xl:p-6 @4xl:p-8">
        <h2
          class="mb-4 text-center font-display text-xl font-black tracking-[1px] text-text-primary @2xl:mb-6 @2xl:text-3xl"
        >
          {{ t('about.techStack.title') }}
        </h2>
        <div class="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
          <div
            v-for="item in techStackItems"
            :key="item.labelKey"
            class="flex items-start gap-3 rounded-lg border border-border bg-elevated/30 p-3 transition-colors hover:border-border-hover hover:bg-elevated/60 @2xl:p-4"
          >
            <div class="flex items-center justify-center pt-1.5">
              <span
                class="inline-block h-2 w-2 rounded-full"
                :style="{ backgroundColor: item.color }"
              ></span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold text-text-primary @2xl:text-sm">
                {{ t('about.techStack.' + item.labelKey) }}
              </span>
              <span class="text-[11px] leading-snug text-text-secondary @2xl:text-xs">
                {{ t('about.techStack.' + item.stackKey) }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <n-divider class="!my-1 !border-border" />

      <!-- Licensing & Acknowledgements -->
      <section>
        <h2
          class="mb-3 text-center font-display text-xl font-black tracking-[1px] text-text-primary @2xl:mb-4 @2xl:text-3xl"
        >
          {{ t('about.licenseAndAcknowledgements.title') }}
        </h2>
        <p class="mb-4 text-center text-xs text-text-secondary @2xl:mb-6 @2xl:text-sm">
          {{ t('about.licenseAndAcknowledgements.gplIntro') }}
        </p>

        <div class="grid grid-cols-1 gap-4 @3xl:grid-cols-2">
          <!-- Stockfish -->
          <n-card
            size="small"
            class="h-full rounded-xl border border-border bg-surface text-xs transition-colors hover:border-border-hover @2xl:text-sm [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3 @2xl:[&>.n-card__content]:!px-4 @2xl:[&>.n-card__content]:!py-3.5"
          >
            <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary @2xl:mb-2 @2xl:text-base">
              {{ t('about.licenseAndAcknowledgements.stockfish.title') }}
            </h3>
            <n-text depth="3" class="text-xs @2xl:text-sm">
              {{ t('about.licenseAndAcknowledgements.stockfish.text1') }}
              <strong>Stockfish</strong>
              {{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
            </n-text>
            <div class="mt-2">
              <n-tag type="warning" size="small" :bordered="false">
                {{ t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle') }}
              </n-tag>
              <n-text depth="3" class="mt-1 block text-[11px] @2xl:text-xs">
                {{ t('about.licenseAndAcknowledgements.stockfish.gplNote') }}
              </n-text>
            </div>
          </n-card>

          <!-- Neural Networks -->
          <n-card
            size="small"
            class="h-full rounded-xl border border-border bg-surface text-xs transition-colors hover:border-border-hover @2xl:text-sm [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3 @2xl:[&>.n-card__content]:!px-4 @2xl:[&>.n-card__content]:!py-3.5"
          >
            <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary @2xl:mb-2 @2xl:text-base">
              {{ t('about.licenseAndAcknowledgements.neuralNetworks.title') }}
            </h3>
            <n-text depth="3" class="text-xs @2xl:text-sm">
              <span
                v-html="
                  t('about.licenseAndAcknowledgements.neuralNetworks.text').replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong>$1</strong>',
                  )
                "
              ></span>
            </n-text>
            <div class="mt-2">
              <a
                href="https://github.com/CallOn84/LeelaNets"
                target="_blank"
                rel="noopener noreferrer"
                class="text-xs font-semibold text-accent hover:underline"
              >
                github.com/CallOn84/LeelaNets →
              </a>
            </div>
          </n-card>

          <!-- LCZero -->
          <n-card
            size="small"
            class="h-full rounded-xl border border-border bg-surface text-xs transition-colors hover:border-border-hover @2xl:text-sm [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3 @2xl:[&>.n-card__content]:!px-4 @2xl:[&>.n-card__content]:!py-3.5"
          >
            <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary @2xl:mb-2 @2xl:text-base">
              {{ t('about.licenseAndAcknowledgements.lcZero.title') }}
            </h3>
            <n-text depth="3" class="text-xs @2xl:text-sm">
              <span
                v-html="
                  t('about.licenseAndAcknowledgements.lcZero.text').replace(
                    /\*\*(.*?)\*\*/g,
                    '<strong>$1</strong>',
                  )
                "
              ></span>
            </n-text>
          </n-card>

          <!-- Chessground & Chessops -->
          <n-card
            size="small"
            class="h-full rounded-xl border border-border bg-surface text-xs transition-colors hover:border-border-hover @2xl:text-sm [&>.n-card__content]:!px-3.5 [&>.n-card__content]:!py-3 @2xl:[&>.n-card__content]:!px-4 @2xl:[&>.n-card__content]:!py-3.5"
          >
            <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary @2xl:mb-2 @2xl:text-base">
              Chessground & Chessops
            </h3>
            <n-text depth="3" class="text-xs @2xl:text-sm">
              {{ t('about.licenseAndAcknowledgements.chessground.text1') }}
              <strong>Chessground</strong> & <strong>Chessops</strong>.
              {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
            </n-text>
          </n-card>
        </div>
      </section>

      <!-- Author Section -->
      <section class="glass p-4 @2xl:p-6 @4xl:p-8">
        <div class="flex flex-col items-center gap-5 text-center @3xl:flex-row @3xl:gap-8 @3xl:text-left">
          <div class="relative shrink-0">
            <img
              class="relative z-10 h-[110px] w-[110px] rounded-full border-2 border-border-hover object-cover @2xl:h-[160px] @2xl:w-[160px]"
              src="/jpg/me.jpg"
              :alt="t('about.author.photoAlt')"
            />
          </div>
          <div class="grow">
            <h2 class="m-0 mb-2 font-display text-lg font-extrabold text-text-primary @2xl:mb-3 @2xl:text-2xl">
              {{ t('about.author.title') }}
            </h2>
            <div class="space-y-2 text-xs leading-relaxed text-text-secondary @2xl:space-y-3 @2xl:text-sm">
              <p>{{ t('about.author.bioPart1') }}</p>
              <p>{{ t('about.author.bioPart2') }}</p>
              <p>{{ t('about.author.bioPart3') }}</p>
            </div>

            <div class="mt-5 flex flex-col items-center gap-4 @3xl:flex-row @3xl:gap-6">
              <n-button
                type="warning"
                secondary
                tag="a"
                href="https://ko-fi.com/extrapawn"
                target="_blank"
              >
                {{ t('about.author.supportButtonText') }}
              </n-button>

              <n-space class="flex gap-3">
                <a
                  href="https://t.me/extrapawn_chat"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-colors hover:bg-brand hover:text-on-brand"
                >
                  TG
                </a>
                <a
                  href="https://github.com/ImMoSer/extrapawn.com"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-colors hover:bg-brand hover:text-on-brand"
                >
                  GH
                </a>
                <a
                  href="mailto:immozerai@gmail.com"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-colors hover:bg-brand hover:text-on-brand"
                >
                  @
                </a>
              </n-space>
            </div>
          </div>
        </div>
      </section>

      <footer class="border-t border-border pt-5 text-center">
        <n-text depth="3" italic>{{ t('about.footerNote') }}</n-text>
      </footer>
    </div>
  </AppPageShell>
</template>
