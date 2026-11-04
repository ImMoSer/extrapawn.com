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
  <div class="min-h-screen overflow-x-hidden bg-transparent pb-15 text-text-primary">
    <!-- Hero Section -->
    <header
      class="relative flex h-72 items-center justify-center overflow-hidden border-b border-border bg-surface px-5 text-center md:h-88"
    >
      <div class="relative z-10">
        <h1
          class="m-0 font-display text-[clamp(2rem,5vw,4.2rem)] font-black tracking-[2px] text-text-primary uppercase"
        >
          {{ t('about.hero.title') }}
        </h1>
        <p class="mt-4 text-xl tracking-[1px] text-text-secondary">
          {{ t('about.hero.subtitle') }}
          <span
            class="ml-1 rounded-full border border-brand/40 bg-brand/15 px-2.5 py-0.5 align-middle font-condensed text-xs font-bold text-brand"
          >
            v{{ appVersion }}
          </span>
        </p>
      </div>
    </header>

    <div class="relative z-20 mx-auto mt-8 max-w-[1200px] px-5">
      <!-- Concept Section -->
      <section>
        <n-grid cols="1 s:1 m:3" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="key in conceptKeys" :key="key">
            <n-card
              class="glass relative h-full overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-border-hover"
              :title="t(`about.concept.${key}.title`)"
            >
              <div
                class="absolute top-0 left-0 h-[2px] w-full bg-brand"
              ></div>
              <n-text class="text-[1.05rem] leading-relaxed">
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

      <n-divider class="!my-15 !border-border" />

      <!-- Modules Section -->
      <section>
        <h2
          class="mb-8 text-center font-display text-4xl font-black tracking-[1px] text-text-primary"
        >
          {{ t('about.hero.title').split(' — ')[0] }} Pillars
        </h2>
        <n-grid cols="1 s:1 m:2 l:2" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="mod in modules" :key="mod">
            <n-card
              class="glass group h-full transition-all duration-300 hover:-translate-y-1 hover:border-[var(--hover-border-color)] hover:shadow-[0_12px_40px_var(--hover-glow-color)]"
              :style="{
                '--hover-glow-color': moduleVisuals[mod].glow,
                '--hover-border-color': moduleVisuals[mod].color,
              }"
            >
              <template #header>
                <div class="flex items-center gap-4">
                  <div
                    class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-elevated/40 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"
                    :style="{
                      color: moduleVisuals[mod].color,
                      boxShadow: 'inset 0 0 10px ' + moduleVisuals[mod].glow,
                      border: '1px solid ' + moduleVisuals[mod].color,
                    }"
                  >
                    <span class="text-2xl">{{ moduleVisuals[mod].icon }}</span>
                  </div>
                  <span class="font-display text-xl font-extrabold tracking-[0.5px] text-text-primary">
                    {{ t(`about.modules.${mod}.title`) }}
                  </span>
                </div>
              </template>
              <div class="pt-3">
                <n-text depth="3" class="text-[0.95rem] leading-[1.7] whitespace-pre-wrap text-text-secondary">
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

      <n-divider class="!my-15 !border-border" />

      <!-- Tech Stack -->
      <section class="glass p-5 md:p-10">
        <h2
          class="mb-8 text-center font-display text-4xl font-black tracking-[1px] text-text-primary"
        >
          {{ t('about.techStack.title') }}
        </h2>
        <n-grid cols="1 s:2 m:3" responsive="screen" :x-gap="40" :y-gap="24">
          <n-gi v-for="item in techStackItems" :key="item.labelKey">
            <div
              class="flex items-start gap-4 rounded-xl border border-border bg-elevated/30 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-hover hover:bg-elevated/60"
            >
              <div class="flex items-center justify-center pt-1">
                <span
                  class="inline-block h-2.5 w-2.5 rounded-full"
                  :style="{ backgroundColor: item.color, boxShadow: '0 0 8px ' + item.color }"
                ></span>
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-[0.9rem] font-bold text-text-primary">
                  {{ t('about.techStack.' + item.labelKey) }}
                </span>
                <span class="text-[0.85rem] leading-[1.4] text-text-secondary">
                  {{ t('about.techStack.' + item.stackKey) }}
                </span>
              </div>
            </div>
          </n-gi>
        </n-grid>
      </section>

      <n-divider class="!my-15 !border-border" />

      <!-- Licensing & Acknowledgements -->
      <section class="mt-15">
        <h2
          class="mb-8 text-center font-display text-4xl font-black tracking-[1px] text-text-primary"
        >
          {{ t('about.licenseAndAcknowledgements.title') }}
        </h2>
        <p class="mb-7.5 text-center text-[1.05rem] text-text-secondary">
          {{ t('about.licenseAndAcknowledgements.gplIntro') }}
        </p>

        <n-grid cols="1 s:1 m:2" responsive="screen" :x-gap="24" :y-gap="24">
          <!-- Stockfish -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 transition-colors hover:border-border-hover hover:bg-elevated/50"
            >
              <template #header>
                <n-text strong>{{ t('about.licenseAndAcknowledgements.stockfish.title') }}</n-text>
              </template>
              <n-text depth="3">
                {{ t('about.licenseAndAcknowledgements.stockfish.text1') }}
                <strong>Stockfish</strong>
                {{ t('about.licenseAndAcknowledgements.stockfish.text2') }}
              </n-text>
              <div class="mt-2">
                <n-tag type="warning" size="small" :bordered="false">
                  {{ t('about.licenseAndAcknowledgements.stockfish.gplNoteTitle') }}
                </n-tag>
                <n-text depth="3" class="mt-1 block text-xs">
                  {{ t('about.licenseAndAcknowledgements.stockfish.gplNote') }}
                </n-text>
              </div>
            </n-card>
          </n-gi>

          <!-- Neural Networks -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 transition-colors hover:border-border-hover hover:bg-elevated/50"
            >
              <template #header>
                <n-text strong>{{
                  t('about.licenseAndAcknowledgements.neuralNetworks.title')
                }}</n-text>
              </template>
              <n-text depth="3">
                <span
                  v-html="
                    t('about.licenseAndAcknowledgements.neuralNetworks.text').replace(
                      /\*\*(.*?)\*\*/g,
                      '<strong>$1</strong>',
                    )
                  "
                ></span>
              </n-text>
            </n-card>
          </n-gi>

          <!-- LCZero -->
          <n-gi>
            <n-card
              size="small"
              class="h-full rounded-xl border border-border bg-surface/60 transition-colors hover:border-border-hover hover:bg-elevated/50"
            >
              <template #header>
                <n-text strong>{{ t('about.licenseAndAcknowledgements.lcZero.title') }}</n-text>
              </template>
              <n-text depth="3">
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
              class="h-full rounded-xl border border-border bg-surface/60 transition-colors hover:border-border-hover hover:bg-elevated/50"
            >
              <template #header>
                <n-text strong>Chessground & Chessops</n-text>
              </template>
              <n-text depth="3">
                {{ t('about.licenseAndAcknowledgements.chessground.text1') }}
                <strong>Chessground</strong> & <strong>Chessops</strong>.
                {{ t('about.licenseAndAcknowledgements.chessground.gratitude') }}
              </n-text>
            </n-card>
          </n-gi>
        </n-grid>
      </section>

      <!-- Author Section -->
      <section class="glass mt-20 p-5 md:p-10">
        <div class="flex flex-col items-center gap-7.5 text-center md:flex-row md:gap-10 md:text-left">
          <div class="relative shrink-0">
            <img
              class="relative z-10 h-[180px] w-[180px] rounded-full border-2 border-border-hover object-cover"
              src="/jpg/me.jpg"
              :alt="t('about.author.photoAlt')"
            />
          </div>
          <div class="grow">
            <h2 class="m-0 mb-4 font-display text-3xl font-extrabold text-text-primary">
              {{ t('about.author.title') }}
            </h2>
            <div class="space-y-3 leading-relaxed text-text-secondary">
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
