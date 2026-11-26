<script setup lang="ts">
import {
  estimateTurnCostUsd,
  formatDisplayChapterTitle,
  useCoachStudyStore,
  type StudyLanguage,
  type StudyTurnRecord,
} from '@/features/ai-coach'
import { parseDrawTokensToShapes } from '@/shared/lib/markdown/coachDrawShapes'
import { renderCoachMarkdown } from '@/shared/lib/markdown/renderCoachMarkdown'
import { ArrowForwardOutline, CloseOutline, SparklesOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StudyChatComposer from './StudyChatComposer.vue'

const { t, locale } = useI18n()
const studyStore = useCoachStudyStore()

const composerRef = ref<InstanceType<typeof StudyChatComposer> | null>(null)
const scrollRef = ref<HTMLElement | null>(null)
const highlightedTurnId = ref<number | null>(null)
let highlightTimer: ReturnType<typeof setTimeout> | null = null

const currentLanguage = computed<StudyLanguage>(() => {
  const loc = locale.value
  if (loc === 'en' || loc === 'de') return loc
  return 'ru'
})

const showSuggestedCard = computed(() => {
  const card = studyStore.suggestedChapter
  if (!card) return false
  return card.fromChapterId === studyStore.activeChapterId && card.chapter.id !== studyStore.activeChapterId
})

const starterSuggestions = computed(() => [
  { key: 'opening', label: t('pages.study.starterOpening'), prompt: t('pages.study.starterOpeningPrompt') },
  { key: 'trap', label: t('pages.study.starterTrap'), prompt: t('pages.study.starterTrapPrompt') },
  { key: 'endgame', label: t('pages.study.starterEndgame'), prompt: t('pages.study.starterEndgamePrompt') },
  { key: 'weak', label: t('pages.study.starterWeak'), prompt: t('pages.study.starterWeakPrompt') },
])

const renderedStreamingHtml = computed(() =>
  renderCoachMarkdown(studyStore.streamingText, studyStore.sanPathIndex),
)

const renderTurnHtml = (content: string): string =>
  renderCoachMarkdown(content, studyStore.sanPathIndex)

const formatTurnCost = (turn: StudyTurnRecord): string => {
  const cost =
    turn.cost_usd !== undefined
      ? turn.cost_usd
      : estimateTurnCostUsd(turn.model_id, turn.input_tokens, turn.cached_tokens, turn.output_tokens)
  if (cost <= 0) return ''
  return cost < 0.01 ? `$${cost.toFixed(4)}` : `$${cost.toFixed(3)}`
}

const scrollToBottom = async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

watch(
  () => [
    studyStore.visibleTurns.length,
    studyStore.activeChapterId,
    studyStore.streamingText,
    studyStore.coachStatusLabel,
    studyStore.pendingNewChapter,
    studyStore.suggestedChapter?.chapter.id,
  ],
  () => {
    void scrollToBottom()
  },
)

watch(
  () => studyStore.scrollToTurnRequest,
  async (req) => {
    if (!req) return
    await nextTick()
    const targetEl = scrollRef.value?.querySelector<HTMLElement>(`[data-turn-id="${req.turnId}"]`)
    if (!targetEl) return
    targetEl.scrollIntoView({ block: 'center', behavior: 'smooth' })
    highlightedTurnId.value = req.turnId
    if (highlightTimer !== null) clearTimeout(highlightTimer)
    highlightTimer = setTimeout(() => {
      highlightedTurnId.value = null
      highlightTimer = null
    }, 1600)
  },
)

const focusInput = () => {
  composerRef.value?.focusInput()
}

watch(
  () => studyStore.focusChatInputRequest,
  () => {
    focusInput()
  },
)

onUnmounted(() => {
  if (highlightTimer !== null) {
    clearTimeout(highlightTimer)
    highlightTimer = null
  }
})

defineExpose({ focusInput })

const handleSend = async (rawText: string) => {
  const text = rawText.trim()
  if (!text || studyStore.isStreaming) return
  await studyStore.sendCoachMessage({
    text,
    language: currentLanguage.value,
  })
}

const handleMarkdownClick = (ev: MouseEvent) => {
  const target = ev.target as HTMLElement | null
  const pgnChip = target?.closest<HTMLElement>('[data-pgn-path]')
  const path = pgnChip?.dataset.pgnPath
  if (path) {
    const drawRaw = pgnChip.dataset.draw
    const shapes = drawRaw ? parseDrawTokensToShapes(drawRaw) : undefined
    studyStore.navigateToPath(path, shapes && shapes.length > 0 ? shapes : undefined)
    return
  }

  const drawChip = target?.closest<HTMLElement>('[data-draw]')
  const drawRaw = drawChip?.dataset.draw
  if (drawRaw) {
    const shapes = parseDrawTokensToShapes(drawRaw)
    if (shapes.length > 0) {
      studyStore.applyCoachInlineShapes(shapes)
    }
  }
}

const handleOpenSuggested = () => {
  const ch = studyStore.suggestedChapter?.chapter
  if (ch) {
    void studyStore.selectChapter(ch.id)
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <span class="truncate font-display text-xs font-semibold tracking-wide text-text-primary uppercase">
        {{ t('pages.study.coachChat') }}
      </span>
      <span
        v-if="studyStore.isStreaming"
        class="shrink-0 truncate font-condensed text-[0.72rem] text-brand"
      >
        {{ studyStore.coachStatusLabel || t('pages.study.coachThinking') }}
      </span>
    </div>

    <!-- Messages Scroll Feed (1:1 isolated to active chapter) -->
    <div ref="scrollRef" class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
      <!-- Zero-latency localized welcome when current chapter/study has no turns yet -->
      <div
        v-if="studyStore.visibleTurns.length === 0 && !studyStore.isStreaming"
        class="flex flex-col gap-2 rounded-md border border-border bg-elevated/70 p-2.5 text-xs leading-relaxed text-text-primary"
      >
        <p class="m-0">{{ t('pages.study.welcomeCoachMessage') }}</p>
        <div class="flex flex-wrap gap-1.5 pt-1">
          <button
            v-for="chip in starterSuggestions"
            :key="chip.key"
            type="button"
            class="min-w-0 cursor-pointer overflow-hidden rounded-md border border-border bg-surface px-2 py-1 text-[0.72rem] font-medium text-text-primary transition-colors hover:border-brand/60 hover:bg-overlay"
            @click="handleSend(chip.prompt)"
          >
            <span class="truncate">{{ chip.label }}</span>
          </button>
        </div>
      </div>

      <!-- Persisted Turns for Active Chapter -->
      <div
        v-for="turn in studyStore.visibleTurns"
        :key="turn.id"
        :data-turn-id="turn.id"
        class="flex flex-col gap-1"
        :class="turn.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div
          v-if="turn.role === 'user'"
          class="max-w-[94%] rounded-md border bg-elevated px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-text-primary transition-colors"
          :class="
            highlightedTurnId === turn.id ? 'border-brand ring-1 ring-brand' : 'border-border-hover'
          "
        >
          {{ turn.content }}
        </div>

        <div
          v-else
          class="coach-markdown max-w-[96%] rounded-md border bg-canvas px-2.5 py-2 text-xs leading-relaxed break-words text-text-primary transition-colors"
          :class="highlightedTurnId === turn.id ? 'border-brand ring-1 ring-brand' : 'border-border'"
          @click="handleMarkdownClick"
          v-html="renderTurnHtml(turn.content)"
        />

        <!-- Compact telemetry line -->
        <span
          v-if="turn.role === 'assistant' && turn.input_tokens > 0"
          class="flex flex-wrap items-center gap-1 px-1 font-condensed text-[0.68rem] text-text-secondary"
        >
          <span
            class="rounded-sm border border-brand/40 bg-elevated px-1 py-px text-[0.64rem] font-semibold text-brand"
          >
            {{ t('pages.study.roleHead') }}
          </span>
          <span>
            {{ turn.input_tokens }} in ({{ turn.cached_tokens }}c) · {{ turn.output_tokens }} out ·
            {{ (turn.latency_ms / 1000).toFixed(1) }}s
            <template v-if="formatTurnCost(turn)"> · {{ formatTurnCost(turn) }}</template>
          </span>
        </span>
      </div>

      <!-- Non-destructive Suggested New Chapter Card -->
      <div
        v-if="showSuggestedCard && studyStore.suggestedChapter"
        class="flex items-center justify-between gap-2 rounded-md border border-brand/60 bg-elevated px-2.5 py-2"
      >
        <div class="flex min-w-0 flex-col gap-0.5">
          <span class="font-condensed text-[0.68rem] font-semibold text-brand uppercase">
            {{ t('pages.study.suggestedChapterLabel') }}
          </span>
          <span class="truncate font-display text-xs font-semibold text-text-primary">
            {{ studyStore.suggestedChapter.chapter.chapter_order }}.
            {{ formatDisplayChapterTitle(studyStore.suggestedChapter.chapter.title) }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button
            type="button"
            class="inline-flex min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border-none bg-brand px-2.5 py-1 font-display text-[0.72rem] font-semibold text-on-brand transition-colors hover:bg-brand-deep"
            @click="handleOpenSuggested"
          >
            <span class="truncate">{{ t('pages.study.openChapter') }}</span>
            <NIcon :size="12" class="shrink-0"><ArrowForwardOutline /></NIcon>
          </button>
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-1 text-text-secondary hover:text-text-primary"
            @click="studyStore.dismissSuggestedChapter()"
          >
            <NIcon :size="13"><CloseOutline /></NIcon>
          </button>
        </div>
      </div>

      <!-- Live Streaming Assistant Bubble -->
      <div v-if="studyStore.isStreaming" class="flex flex-col items-start gap-1">
        <div
          v-if="studyStore.coachStatusLabel"
          class="inline-flex items-center gap-1.5 rounded-sm border border-brand/40 bg-elevated px-2 py-0.5 font-condensed text-[0.7rem] text-brand"
        >
          <NIcon :size="12" class="shrink-0"><SparklesOutline /></NIcon>
          <span>{{ studyStore.coachStatusLabel }}</span>
        </div>
        <div
          class="coach-markdown max-w-[96%] rounded-md border border-brand/40 bg-canvas px-2.5 py-2 text-xs leading-relaxed break-words text-text-primary"
          @click="handleMarkdownClick"
        >
          <div v-if="studyStore.streamingText" v-html="renderedStreamingHtml" />
          <span v-else class="text-text-secondary italic">{{ t('pages.study.coachPreparing') }}</span>
        </div>
      </div>

      <!-- Zero-latency prompt when user clicked "+ Chapter" -->
      <div
        v-if="studyStore.pendingNewChapter && !studyStore.isStreaming"
        class="rounded-md border border-brand/50 bg-elevated/80 p-2 text-xs leading-relaxed text-text-primary"
      >
        {{ t('pages.study.newChapterPrompt') }}
      </div>

      <!-- Error Banner -->
      <div
        v-if="studyStore.streamError"
        class="rounded-md border border-danger/50 bg-elevated px-2.5 py-1.5 text-xs text-danger"
      >
        {{ studyStore.streamError }}
      </div>
    </div>

    <!-- Live Board Context Anchor + Input Composer -->
    <StudyChatComposer ref="composerRef" @send="handleSend" />
  </section>
</template>

<style scoped>
.coach-markdown :deep(.coach-md-h) {
  margin: 0.45rem 0 0.2rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.coach-markdown :deep(.coach-md-h:first-child) {
  margin-top: 0;
}

.coach-markdown :deep(.coach-md-p) {
  margin: 0 0 0.35rem;
}

.coach-markdown :deep(.coach-md-p:last-child) {
  margin-bottom: 0;
}

.coach-markdown :deep(.coach-md-ul),
.coach-markdown :deep(.coach-md-ol) {
  margin: 0.2rem 0 0.35rem;
  padding-left: 1.1rem;
}

.coach-markdown :deep(li) {
  margin-bottom: 0.18rem;
}

.coach-markdown :deep(.coach-md-code) {
  border-radius: 2px;
  border: 1px solid var(--color-border);
  background: var(--color-elevated);
  padding: 0 0.25rem;
  font-family: var(--font-condensed);
  font-size: 0.78rem;
  color: var(--color-text-primary);
}

.coach-markdown :deep(.coach-san-chip) {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  cursor: pointer;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--color-brand) 45%, transparent);
  background: var(--color-elevated);
  padding: 0 0.3rem;
  font-family: var(--font-condensed);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-brand);
  line-height: 1.3;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.coach-markdown :deep(.coach-san-chip:hover),
.coach-markdown :deep(.coach-draw-chip:hover),
.coach-markdown :deep(.coach-draw-inline:hover) {
  border-color: var(--color-brand);
  background: var(--color-overlay);
}

.coach-markdown :deep(.coach-san-chip--draw) {
  border-color: color-mix(in srgb, var(--color-brand) 70%, transparent);
}

.coach-markdown :deep(.coach-draw-inline) {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  cursor: pointer;
  line-height: 1.3;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.coach-markdown :deep(.coach-draw-chip) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-left: 0.15rem;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--color-brand) 50%, transparent);
  background: var(--color-elevated);
  padding: 0 0.22rem;
  font-family: var(--font-condensed);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-brand);
  line-height: 1.25;
  transition: background-color 120ms ease, border-color 120ms ease;
}

.coach-markdown :deep(.coach-draw-mark) {
  font-size: 0.7rem;
  color: var(--color-brand);
  opacity: 0.9;
}
</style>
