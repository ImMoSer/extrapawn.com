<script setup lang="ts">
import { NButton, NCard, NDivider, NGi, NGrid, NSpace, NTag, NText } from 'naive-ui'
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
  { icon: string; color: string; glow: string }
> = {
  trainingCenter: {
    icon: '🎯',
    color: 'var(--color-brand)',
    glow: 'color-mix(in srgb, var(--color-brand) 12%, transparent)',
  },
  warmup: {
    icon: '⚡',
    color: 'var(--color-accent)',
    glow: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
  },
  woodpecker: {
    icon: '🔥',
    color: 'var(--color-warning)',
    glow: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
  },
  userCabinet: {
    icon: '🧬',
    color: 'var(--color-info)',
    glow: 'color-mix(in srgb, var(--color-info) 12%, transparent)',
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
  <div class="min-h-screen overflow-x-hidden bg-transparent pb-8 text-text-primary sm:pb-15">
    <!-- Hero Section -->
    <header
      class="relative flex items-center justify-center overflow-hidden border-b border-border bg-surface px-2.5 py-6 text-center sm:h-72 sm:px-5 md:h-88"
    >
      <div class="relative z-10">
        <h1
          class="m-0 font-display text-lg font-black tracking-[1px] text-text-primary uppercase sm:text-[clamp(2rem,5vw,4.2rem)] sm:tracking-[2px]"
        >
          {{ t('about.hero.title') }}
        </h1>
        <p class="mt-2 text-xs tracking-[0.5px] text-text-secondary sm:mt-4 sm:text-xl sm:tracking-[1px]">
          {{ t('about.hero.subtitle') }}
          <span
            class="ml-1 rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 align-middle font-condensed text-[10px] font-bold text-brand sm:px-2.5 sm:text-xs"
          >
            v{{ appVersion }}
          </span>
        </p>
      </div>
    </header>

    <div class="relative z-20 mx-auto mt-3 max-w-[1200px] px-1.5 sm:mt-8 sm:px-5">
      <!-- Concept Section -->
      <section>
        <n-grid cols="1 s:1 m:3" responsive="screen" :x-gap="16" :y-gap="12">
          <n-gi v-for="key in conceptKeys" :key="key">
            <n-card
              size="small"
              class="glass relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-3 sm:[&>.n-card__content]:!px-5 sm:[&>.n-card__content]:!py-4"
            >
              <div
                class="absolute top-0 left-0 h-[2px] w-full bg-brand"
              ></div>
              <h2 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary sm:mb-3 sm:text-lg">
                {{ t(`about.concept.${key}.title`) }}
              </h2>
              <n-text class="text-xs leading-snug sm:text-[1.05rem] sm:leading-relaxed">
                <span
                  v-html="
                    t(`about.concept.${key}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  "
                ></span>
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="!my-6 !border-border sm:!my-15" />

      <!-- Modules Section -->
      <section>
        <h2
          class="mb-4 text-center font-display text-xl font-black tracking-[1px] text-text-primary sm:mb-8 sm:text-4xl"
        >
          {{ t('about.hero.title').split(' — ')[0] }} Pillars
        </h2>
        <n-grid cols="1 s:1 m:2 l:2" responsive="screen" :x-gap="16" :y-gap="12">
          <n-gi v-for="mod in modules" :key="mod">
            <n-card
              size="small"
              class="glass group h-full transition-all duration-300 hover:-translate-y-1 hover:border-[var(--hover-border-color)] hover:shadow-[0_12px_40px_var(--hover-glow-color)] [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-3 sm:[&>.n-card__content]:!px-5 sm:[&>.n-card__content]:!py-4"
              :style="{
                '--hover-glow-color': moduleVisuals[mod].glow,
                '--hover-border-color': moduleVisuals[mod].color,
              }"
            >
              <div class="flex items-center gap-2.5 border-b border-border/60 pb-2 sm:gap-4 sm:pb-3">
                <div
                  class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated/40 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 sm:h-12 sm:w-12 sm:rounded-xl"
                  :style="{
                    color: moduleVisuals[mod].color,
                    boxShadow: 'inset 0 0 10px ' + moduleVisuals[mod].glow,
                    border: '1px solid ' + moduleVisuals[mod].color,
                  }"
                >
                  <span class="text-lg sm:text-2xl">{{ moduleVisuals[mod].icon }}</span>
                </div>
                <h3 class="m-0 font-display text-sm font-extrabold tracking-[0.5px] text-text-primary sm:text-xl">
                  {{ t(`about.modules.${mod}.title`) }}
                </h3>
              </div>
              <div class="pt-2 sm:pt-3">
                <n-text depth="3" class="text-xs leading-snug whitespace-pre-wrap text-text-secondary sm:text-[0.95rem] sm:leading-[1.7]">
                  <span
                    v-html="
                      t(`about.modules.${mod}.text`).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    "
                  ></span>
                </n-text>
              </div>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="!my-6 !border-border sm:!my-15" />

      <!-- Tech Stack -->
      <section class="glass p-3 sm:p-5 md:p-10">
        <h2
          class="mb-4 text-center font-display text-xl font-black tracking-[1px] text-text-primary sm:mb-8 sm:text-4xl"
        >
          {{ t('about.techStack.title') }}
        </h2>
        <n-grid cols="1 s:2 m:3" responsive="screen" :x-gap="20" :y-gap="12">
          <n-gi v-for="item in techStackItems" :key="item.labelKey">
            <div
              class="flex items-start gap-2.5 rounded-lg border border-border bg-elevated/30 p-2.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-hover hover:bg-elevated/60 sm:gap-4 sm:rounded-xl sm:p-4"
            >
              <div class="flex items-center justify-center pt-1">
                <span
                  class="inline-block h-2 w-2 rounded-full sm:h-2.5 sm:w-2.5"
                  :style="{ backgroundColor: item.color, boxShadow: '0 0 8px ' + item.color }"
                ></span>
              </div>
              <div class="flex flex-col gap-0.5 sm:gap-1">
                <span class="text-xs font-bold text-text-primary sm:text-[0.9rem]">
                  {{ t('about.techStack.' + item.labelKey) }}
                </span>
                <span class="text-[11px] leading-snug text-text-secondary sm:text-[0.85rem] sm:leading-[1.4]">
                  {{ t('about.techStack.' + item.stackKey) }}
                </span>
              </div>
            </div>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="!my-6 !border-border sm:!my-15" />

      <!-- Licensing & Acknowledgements -->
      <section class="mt-6 sm:mt-15">
        <h2
          class="mb-3 text-center font-display text-xl font-black tracking-[1px] text-text-primary sm:mb-8 sm:text-4xl"
        >
          {{ t('about.licenseAndAcknowledgements.title') }}
        </h2>
        <p class="mb-4 text-center text-xs text-text-secondary sm:mb-7.5 sm:text-[1.05rem]">
          {{ t('about.licenseAndAcknowledgements.gplIntro') }}
        </p>

        <n-grid cols="1 s:1 m:2" responsive="screen" :x-gap="16" :y-gap="12">
          <!-- Stockfish -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 text-xs transition-colors hover:border-border-hover hover:bg-elevated/50 sm:text-sm [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-2.5 sm:[&>.n-card__content]:!px-4 sm:[&>.n-card__content]:!py-3.5"
            >
              <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary sm:mb-2 sm:text-base">
                {{ t('about.licenseAndAcknowledgements.stockfish.title') }}
              </h3>
              <n-text depth="3" class="text-xs sm:text-sm">
                {{ t('about.licenseAndAcknowledgements.stockfish.text1') }}
                <strong>Stockfish</strong>
                {{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
              </n-text>
              <div class="mt-2">
                <n-tag type="warning" size="small" :bordered="false">
                  {{ t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle') }}
                </n-tag>
                <n-text depth="3" class="mt-1 block text-[11px] sm:text-xs">
                  {{ t('about.licenseAndAcknowledgements.stockfish.gplNote') }}
                </n-text>
              </div>
            </n-card>
          </n-gi>

          <!-- Neural Networks -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 text-xs transition-colors hover:border-border-hover hover:bg-elevated/50 sm:text-sm [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-2.5 sm:[&>.n-card__content]:!px-4 sm:[&>.n-card__content]:!py-3.5"
            >
              <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary sm:mb-2 sm:text-base">
                {{ t('about.licenseAndAcknowledgements.neuralNetworks.title') }}
              </h3>
              <n-text depth="3" class="text-xs sm:text-sm">
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
          </n-gi>

          <!-- LCZero -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 text-xs transition-colors hover:border-border-hover hover:bg-elevated/50 sm:text-sm [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-2.5 sm:[&>.n-card__content]:!px-4 sm:[&>.n-card__content]:!py-3.5"
            >
              <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary sm:mb-2 sm:text-base">
                {{ t('about.licenseAndAcknowledgements.lcZero.title') }}
              </h3>
              <n-text depth="3" class="text-xs sm:text-sm">
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
          </n-gi>

          <!-- Chessground & Chessops -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 text-xs transition-colors hover:border-border-hover hover:bg-elevated/50 sm:text-sm [&>.n-card__content]:!px-3 [&>.n-card__content]:!py-2.5 sm:[&>.n-card__content]:!px-4 sm:[&>.n-card__content]:!py-3.5"
            >
              <h3 class="m-0 mb-1.5 font-display text-sm font-bold text-text-primary sm:mb-2 sm:text-base">
                Chessground & Chessops
              </h3>
              <n-text depth="3" class="text-xs sm:text-sm">
                {{ t('about.licenseAndAcknowledgements.chessground.text1') }}
                <strong>Chessground</strong> & <strong>Chessops</strong>.
                {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <!-- Author Section -->
      <section class="glass mt-8 p-3.5 sm:mt-20 sm:p-5 md:p-10">
        <div class="flex flex-col items-center gap-4 text-center md:flex-row md:gap-10 md:text-left">
          <div class="relative shrink-0">
            <img
              class="relative z-10 h-[110px] w-[110px] rounded-full border-2 border-border-hover object-cover sm:h-[180px] sm:w-[180px]"
              src="/jpg/me.jpg"
              :alt="t('about.author.photoAlt')"
            />
          </div>
          <div class="grow">
            <h2 class="m-0 mb-2 font-display text-lg font-extrabold text-text-primary sm:mb-4 sm:text-3xl">
              {{ t('about.author.title') }}
            </h2>
            <div class="space-y-2 text-xs leading-snug text-text-secondary sm:space-y-3 sm:text-sm sm:leading-relaxed">
              <p>{{ t('about.author.bioPart1') }}</p>
              <p>{{ t('about.author.bioPart2') }}</p>
              <p>{{ t('about.author.bioPart3') }}</p>
            </div>

            <div class="mt-6 flex flex-col items-center gap-5 md:flex-row md:gap-6">
              <n-button
                type="warning"
                secondary
                round
                tag="a"
                href="https://buymeacoffee.com/extrapawn.com"
                target="_blank"
              >
                {{ t('about.author.supportButtonText') }}
              </n-button>

              <n-space class="flex gap-3">
                <a
                  href="https://t.me/extrapawn_chat"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-brand hover:text-on-brand"
                >
                  TG
                </a>
                <a
                  href="https://github.com/ImMoSer/extrapawn.com"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-brand hover:text-on-brand"
                >
                  GH
                </a>
                <a
                  href="mailto:immozerai@gmail.com"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-brand hover:text-on-brand"
                >
                  @
                </a>
              </n-space>
            </div>
          </div>
        </div>
      </section>

      <footer class="mt-15 border-t border-border pt-5 text-center">
        <n-text depth="3" italic>{{ t('about.footerNote') }}</n-text>
      </footer>
    </div>
  </div>
</template>
