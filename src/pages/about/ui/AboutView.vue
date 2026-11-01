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
    color: 'var(--color-neon-cyan)',
    glow: 'color-mix(in srgb, var(--color-neon-cyan) 15%, transparent)',
  },
  warmup: {
    icon: '⚡',
    color: 'var(--color-success)',
    glow: 'color-mix(in srgb, var(--color-success) 15%, transparent)',
  },
  woodpecker: {
    icon: '🔥',
    color: 'var(--color-warning)',
    glow: 'color-mix(in srgb, var(--color-warning) 15%, transparent)',
  },
  userCabinet: {
    icon: '🧬',
    color: 'var(--color-highlight)',
    glow: 'color-mix(in srgb, var(--color-highlight) 15%, transparent)',
  },
}

const conceptKeys = ['what', 'forWho', 'uniqueness'] as const

const techStackItems = [
  { labelKey: 'frontend', stackKey: 'frontendStack', color: 'var(--color-neon-cyan)' },
  { labelKey: 'backend', stackKey: 'backendStack', color: 'var(--color-neon-purple)' },
  { labelKey: 'chessLogic', stackKey: 'chessLogicStack', color: 'var(--color-highlight)' },
  { labelKey: 'boardRendering', stackKey: 'boardRenderingStack', color: 'var(--color-success)' },
  { labelKey: 'chessEngine', stackKey: 'chessEngineStack', color: 'var(--color-warning)' },
  { labelKey: 'api', stackKey: 'apiStack', color: 'var(--color-danger)' },
] as const
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-transparent pb-15 text-text-primary">
    <!-- Hero Section -->
    <header
      class="relative flex h-80 items-center justify-center overflow-hidden border-b border-border bg-gradient-to-br from-void to-surface px-5 text-center md:h-[400px]"
    >
      <div class="relative z-10">
        <h1
          class="m-0 bg-gradient-to-r from-text-primary via-neon-cyan to-text-primary bg-clip-text font-display text-[clamp(2rem,5vw,4.5rem)] font-black tracking-[2px] text-transparent uppercase"
        >
          {{ t('about.hero.title') }}
        </h1>
        <p class="mt-4 text-xl tracking-[1px] text-text-secondary">
          {{ t('about.hero.subtitle') }}
          <span
            class="ml-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/20 px-2.5 py-0.5 align-middle font-condensed text-xs font-bold text-neon-cyan"
          >
            v{{ appVersion }}
          </span>
        </p>
      </div>
      <div class="pointer-events-none absolute inset-0 z-0">
        <div
          class="absolute top-0 left-0 h-[350px] w-[350px] rounded-full bg-neon-cyan opacity-12 blur-[100px]"
        ></div>
        <div
          class="absolute top-10 left-1/2 h-[350px] w-[350px] rounded-full bg-neon-purple opacity-12 blur-[100px]"
        ></div>
        <div
          class="absolute right-0 bottom-0 h-[350px] w-[350px] rounded-full bg-warning opacity-12 blur-[100px]"
        ></div>
      </div>
    </header>

    <div class="relative z-20 mx-auto -mt-15 max-w-[1200px] px-5">
      <!-- Concept Section -->
      <section>
        <n-grid cols="1 s:1 m:3" responsive="screen" :x-gap="24" :y-gap="24">
          <n-gi v-for="key in conceptKeys" :key="key">
            <n-card
              class="glass relative h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-neon-cyan/30"
              :title="t(`about.concept.${key}.title`)"
            >
              <div
                class="absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-neon-cyan to-neon-purple"
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
              class="relative z-10 h-[180px] w-[180px] rounded-full border-[3px] border-neon-cyan/30 object-cover shadow-[0_0_25px_color-mix(in_srgb,var(--color-neon-cyan)_20%,transparent)]"
              src="/jpg/me.jpg"
              :alt="t('about.author.photoAlt')"
            />
            <div
              class="absolute -inset-1.5 z-0 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple opacity-40 blur-md"
            ></div>
          </div>
          <div class="grow">
            <h2 class="m-0 mb-4 font-display text-3xl font-extrabold text-neon-cyan">
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
                href="https://coff.ee/chessboard.fun"
                target="_blank"
              >
                {{ t('about.author.supportButtonText') }}
              </n-button>

              <n-space class="flex gap-3">
                <a
                  href="https://t.me/extrapawn_chat"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated/60 text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-neon-cyan hover:text-void"
                >
                  TG
                </a>
                <a
                  href="https://github.com/ImMoSer/extrapawn.com"
                  target="_blank"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated/60 text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-neon-cyan hover:text-void"
                >
                  GH
                </a>
                <a
                  href="mailto:immozerai@gmail.com"
                  class="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-elevated/60 text-xs font-bold text-text-primary no-underline transition-all hover:-translate-y-0.5 hover:bg-neon-cyan hover:text-void"
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
