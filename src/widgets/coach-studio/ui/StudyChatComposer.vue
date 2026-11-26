<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import {
  CloseOutline,
  LocationOutline,
  SendOutline,
  StopCircleOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'send', text: string): void
}>()

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const draftMessage = ref('')
const inputRef = ref<HTMLTextAreaElement | null>(null)

const anchorDisplayLabel = computed(() => {
  const info = studyStore.anchorInfo
  if (!info.moveLabel) return t('pages.study.startPosition')
  return info.isBranch
    ? `${info.moveLabel} · ${t('pages.study.anchorBranchTag')}`
    : info.moveLabel
})

const focusInput = () => {
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

defineExpose({ focusInput })

const submitDraft = () => {
  const text = draftMessage.value.trim()
  if (!text || studyStore.isStreaming) return
  draftMessage.value = ''
  emit('send', text)
}

const handleKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault()
    submitDraft()
  }
}
</script>

<template>
  <div class="flex flex-col gap-1.5 border-t border-border p-2">
    <!-- Live Board Context Anchor Pill -->
    <div
      v-if="studyStore.activeChapter"
      class="flex items-center justify-between gap-2 rounded-sm border px-2 py-0.5 text-[0.72rem] transition-colors"
      :class="
        studyStore.anchorEnabled
          ? 'border-brand/35 bg-elevated text-brand'
          : 'border-border bg-elevated/60 text-text-secondary'
      "
    >
      <div class="flex min-w-0 items-center gap-1">
        <NIcon :size="12" class="shrink-0"><LocationOutline /></NIcon>
        <span class="truncate font-condensed font-medium">
          {{ studyStore.anchorEnabled ? anchorDisplayLabel : t('pages.study.anchorFreeChat') }}
        </span>
      </div>
      <button
        v-if="studyStore.anchorEnabled"
        type="button"
        class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-text-secondary hover:text-text-primary"
        :title="t('pages.study.anchorUnpinTitle')"
        @click="studyStore.setAnchorEnabled(false)"
      >
        <NIcon :size="13"><CloseOutline /></NIcon>
      </button>
      <button
        v-else
        type="button"
        class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-brand hover:text-text-primary"
        :title="t('pages.study.anchorPinTitle')"
        @click="studyStore.setAnchorEnabled(true)"
      >
        <NIcon :size="13"><LocationOutline /></NIcon>
      </button>
    </div>

    <!-- Pending New Chapter Badge -->
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

    <!-- Textarea & Send / Stop Controls -->
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
        @click="studyStore.abortStream(true)"
      >
        <NIcon :size="16"><StopCircleOutline /></NIcon>
      </button>

      <button
        v-else
        type="button"
        :disabled="!draftMessage.trim()"
        class="flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-brand px-2.5 text-xs font-semibold text-on-brand transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-45"
        :title="t('pages.study.send')"
        @click="submitDraft"
      >
        <NIcon :size="15"><SendOutline /></NIcon>
      </button>
    </div>
  </div>
</template>
