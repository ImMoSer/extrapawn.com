<script setup lang="ts">
import { useCoachStudyStore, type StudyLanguage } from '@/features/ai-coach'
import {
  BookOutline,
  CloseOutline,
  SendOutline,
  StopCircleOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const studyStore = useCoachStudyStore()

const draftMessage = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const scrollRef = ref<HTMLElement | null>(null)

const currentLanguage = computed<StudyLanguage>(() => {
  const loc = locale.value
  if (loc === 'en' || loc === 'de') return loc
  return 'ru'
})

const chapterTitleById = computed(() => {
  const map = new Map<string, string>()
  for (const ch of studyStore.chapters) {
    map.set(ch.id, `${ch.chapter_order}. ${ch.title}`)
  }
  return map
})

const starterSuggestions = computed(() => [
  { key: 'weak', label: t('pages.study.starterWeak'), prompt: t('pages.study.starterWeakPrompt') },
  { key: 'opp', label: t('pages.study.starterOpposition'), prompt: t('pages.study.starterOppositionPrompt') },
  { key: 'rook', label: t('pages.study.starterRook'), prompt: t('pages.study.starterRookPrompt') },
])

const scrollToBottom = async () => {
  await nextTick()
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  }
}

watch(
  () => [studyStore.turns.length, studyStore.streamingText, studyStore.pendingNewChapter],
  () => {
    void scrollToBottom()
  },
)

const focusInput = () => {
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

defineExpose({ focusInput })

const handleSend = async (customText?: string) => {
  const text = (customText ?? draftMessage.value).trim()
  if (!text || studyStore.isStreaming) return
  if (!customText) {
    draftMessage.value = ''
  }
  await studyStore.sendCoachMessage({
    text,
    language: currentLanguage.value,
  })
}

const handleKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault()
    void handleSend()
  }
}

const handleOpenChapter = (chapterId: string) => {
  void studyStore.selectChapter(chapterId)
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
        class="shrink-0 font-condensed text-[0.72rem] text-brand"
      >
        {{ t('pages.study.coachThinking') }}
      </span>
    </div>

    <!-- Messages Scroll Feed -->
    <div ref="scrollRef" class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
      <!-- Zero-latency localized welcome when Study is brand new -->
      <div
        v-if="studyStore.turns.length === 0 && !studyStore.isStreaming"
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

      <!-- Persisted Turns -->
      <div
        v-for="turn in studyStore.turns"
        :key="turn.id"
        class="flex flex-col gap-1"
        :class="turn.role === 'user' ? 'items-end' : 'items-start'"
      >
        <div
          class="max-w-[94%] rounded-md border px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words"
          :class="
            turn.role === 'user'
              ? 'border-border-hover bg-elevated text-text-primary'
              : 'border-border bg-canvas text-text-primary'
          "
        >
          {{ turn.content }}

          <!-- Clickable Chapter Pill if this assistant turn created/updated a chapter -->
          <div
            v-if="turn.role === 'assistant' && turn.chapter_id && chapterTitleById.has(turn.chapter_id)"
            class="mt-2 pt-1.5 border-t border-border/60"
          >
            <button
              type="button"
              class="inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1 rounded-sm border border-brand/40 bg-elevated px-2 py-0.5 text-[0.72rem] font-medium text-brand transition-colors hover:bg-overlay"
              @click="handleOpenChapter(turn.chapter_id)"
            >
              <NIcon :size="12" class="shrink-0"><BookOutline /></NIcon>
              <span class="truncate">{{ chapterTitleById.get(turn.chapter_id) }}</span>
            </button>
          </div>
        </div>

        <!-- Compact owner-only telemetry line -->
        <span
          v-if="turn.role === 'assistant' && turn.input_tokens > 0"
          class="px-1 font-condensed text-[0.68rem] text-text-secondary"
        >
          {{ turn.model_id }} · {{ turn.input_tokens }} in ({{ turn.cached_tokens }} cached) ·
          {{ turn.output_tokens }} out · {{ (turn.latency_ms / 1000).toFixed(1) }}s
        </span>
      </div>

      <!-- Live Streaming Assistant Bubble -->
      <div v-if="studyStore.isStreaming" class="flex flex-col items-start">
        <div
          class="max-w-[94%] rounded-md border border-brand/40 bg-canvas px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words text-text-primary"
        >
          <span v-if="studyStore.streamingText">{{ studyStore.streamingText }}</span>
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

    <!-- Pending New Chapter Badge + Input Composer -->
    <div class="flex flex-col gap-1.5 border-t border-border p-2">
      <div
        v-if="studyStore.pendingNewChapter"
        class="flex items-center justify-between gap-2 rounded-sm border border-brand/40 bg-elevated px-2 py-0.5 text-[0.72rem] text-brand"
      >
        <span class="truncate font-medium">{{ t('pages.study.newChapterIntent') }}</span>
        <button
          type="button"
          class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-text-secondary hover:text-text-primary"
          @click="studyStore.cancelNewChapterPrompt()"
        >
          <NIcon :size="13"><CloseOutline /></NIcon>
        </button>
      </div>

      <div class="flex items-end gap-1.5">
        <textarea
          ref="inputRef"
          v-model="draftMessage"
          rows="2"
          :disabled="studyStore.isStreaming"
          :placeholder="t('pages.study.chatPlaceholder')"
          class="min-w-0 flex-1 resize-none rounded-md border border-border bg-elevated px-2.5 py-1.5 font-display text-xs text-text-primary placeholder:text-text-disabled focus:border-border-hover focus:outline-none disabled:opacity-60"
          @keydown="handleKeydown"
        />

        <button
          v-if="studyStore.isStreaming"
          type="button"
          class="flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-danger/50 bg-elevated px-2.5 text-xs font-medium text-danger transition-colors hover:bg-overlay"
          :title="t('pages.study.stop')"
          @click="studyStore.abortStream()"
        >
          <NIcon :size="16"><StopCircleOutline /></NIcon>
        </button>

        <button
          v-else
          type="button"
          :disabled="!draftMessage.trim()"
          class="flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-brand px-2.5 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-45"
          :title="t('pages.study.send')"
          @click="handleSend()"
        >
          <NIcon :size="15"><SendOutline /></NIcon>
        </button>
      </div>
    </div>
  </section>
</template>
