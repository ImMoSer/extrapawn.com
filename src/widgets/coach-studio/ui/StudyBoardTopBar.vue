<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import { FlashOutline, StopOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const titleText = computed(() => {
  if (studyStore.activeChapter) {
    return `${studyStore.activeChapter.chapter_order}. ${studyStore.activeChapter.title}`
  }
  return studyStore.activeStudy?.title || t('pages.study.title')
})

const statusLabel = computed(() => {
  if (studyStore.isStreaming) return t('pages.study.coachThinking')
  if (studyStore.isBotThinking) return t('pages.study.mozeroThinking')
  if (studyStore.isAutoPlaying) return t('pages.study.autoPlaying')
  if (studyStore.isSparringActive) return t('pages.study.sparringActive')
  return ''
})
</script>

<template>
  <div class="flex h-full w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3">
    <div class="flex min-w-0 items-center gap-2">
      <span class="truncate font-display text-sm font-semibold text-text-primary">
        {{ titleText }}
      </span>
      <span
        v-if="statusLabel"
        class="shrink-0 rounded-sm border border-brand/40 bg-elevated px-1.5 py-0.5 font-condensed text-[0.72rem] text-brand"
      >
        {{ statusLabel }}
      </span>
    </div>

    <div class="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        class="inline-flex min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
        :class="
          studyStore.isSparringActive
            ? 'border-warning/60 bg-elevated text-warning hover:bg-overlay'
            : 'border-border bg-elevated text-text-primary hover:border-border-hover hover:bg-overlay'
        "
        :disabled="studyStore.isStreaming"
        @click="studyStore.toggleSparring()"
      >
        <NIcon :size="14" class="shrink-0">
          <StopOutline v-if="studyStore.isSparringActive" />
          <FlashOutline v-else />
        </NIcon>
        <span class="truncate">
          {{ studyStore.isSparringActive ? t('pages.study.stopSparring') : t('pages.study.sparring') }}
        </span>
      </button>
    </div>
  </div>
</template>
