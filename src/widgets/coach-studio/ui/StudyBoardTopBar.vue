<script setup lang="ts">
import {
  STUDY_BOT_PROFILES,
  formatDisplayChapterTitle,
  useCoachStudyStore,
  type StudyEngineProfile,
} from '@/features/ai-coach'
import { FlashOutline, StopOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const PROFILE_LABELS: Record<StudyEngineProfile, string> = {
  mozero: 'mozero',
  maia_1500: 'Maia 1500',
  maia_1700: 'Maia 1700',
  maia_1900: 'Maia 1900',
  maia_2200: 'Maia 2200',
}

const availableProfiles = computed<StudyEngineProfile[]>(() => {
  const current = studyStore.engineProfile
  if (STUDY_BOT_PROFILES.includes(current)) {
    return [...STUDY_BOT_PROFILES]
  }
  return [...STUDY_BOT_PROFILES, current]
})

const titleText = computed(() => {
  if (studyStore.activeChapter) {
    return `${studyStore.activeChapter.chapter_order}. ${formatDisplayChapterTitle(studyStore.activeChapter.title)}`
  }
  return studyStore.activeStudy?.title || t('pages.study.title')
})

const statusLabel = computed(() => {
  if (studyStore.isStreaming) {
    return studyStore.coachStatusLabel || t('pages.study.coachThinking')
  }
  if (studyStore.isBotThinking) return `${PROFILE_LABELS[studyStore.engineProfile]}...`
  if (studyStore.isAutoPlaying) return t('pages.study.autoPlaying')
  return ''
})

const handleProfileChange = (ev: Event) => {
  const select = ev.target as HTMLSelectElement | null
  const val = select?.value as StudyEngineProfile | undefined
  if (val && val in PROFILE_LABELS) {
    studyStore.setEngineProfile(val)
  }
}
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

    <!-- Silent $0 Bot Auto-Reply Controls -->
    <div class="flex shrink-0 items-center gap-1.5">
      <select
        :value="studyStore.engineProfile"
        :aria-label="t('pages.study.botProfileLabel')"
        :title="t('pages.study.botProfileLabel')"
        :disabled="studyStore.isBotThinking || studyStore.isStreaming"
        class="cursor-pointer rounded-md border border-border bg-elevated px-1.5 py-1 font-condensed text-[0.72rem] text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus:border-brand focus:outline-none disabled:opacity-45"
        @change="handleProfileChange"
      >
        <option v-for="prof in availableProfiles" :key="prof" :value="prof">
          {{ PROFILE_LABELS[prof] }}
        </option>
      </select>

      <button
        type="button"
        class="inline-flex min-w-0 cursor-pointer items-center gap-1 overflow-hidden rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-45"
        :class="
          studyStore.isBotAutoReplyActive
            ? 'border-warning/60 bg-elevated text-warning hover:bg-overlay'
            : 'border-border bg-elevated text-text-primary hover:border-border-hover hover:bg-overlay'
        "
        :disabled="studyStore.isStreaming"
        @click="studyStore.toggleBotAutoReply()"
      >
        <NIcon :size="14" class="shrink-0">
          <StopOutline v-if="studyStore.isBotAutoReplyActive" />
          <FlashOutline v-else />
        </NIcon>
        <span class="truncate">
          {{ studyStore.isBotAutoReplyActive ? t('pages.study.stopBot') : t('pages.study.botAuto') }}
        </span>
      </button>
    </div>
  </div>
</template>
