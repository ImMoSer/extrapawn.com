<script setup lang="ts">
import { formatDisplayChapterTitle, useCoachStudyStore } from '@/features/ai-coach'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { AddOutline, ArrowBackOutline, FlashOutline, TrashOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const studyStore = useCoachStudyStore()
const uiStore = useUiStore()

const emit = defineEmits<{
  (e: 'request-new-chapter'): void
}>()

const handleBack = () => {
  void router.push('/study')
}

const handleSelectChapter = (chapterId: string) => {
  void studyStore.selectChapter(chapterId)
}

const handleNewChapter = () => {
  studyStore.triggerNewChapterPrompt()
  emit('request-new-chapter')
}

const handleDeleteChapter = async (chapterId: string, rawTitle: string) => {
  const cleanTitle = formatDisplayChapterTitle(rawTitle)
  const confirmed = await uiStore.showConfirmation(
    t('pages.study.deleteChapterTitle'),
    t('pages.study.deleteChapterMessage', { title: cleanTitle }),
    { confirmText: t('shared.buttons.delete'), showCancel: true },
  )
  if (confirmed === 'confirm') {
    await studyStore.removeChapter(chapterId)
  }
}
</script>

<template>
  <section class="flex min-h-0 flex-col rounded-lg border border-border bg-surface">
    <!-- Top Header -->
    <div class="flex items-center justify-between gap-2 border-b border-border px-2.5 py-2">
      <button
        type="button"
        class="inline-flex min-w-0 cursor-pointer items-center gap-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary"
        @click="handleBack"
      >
        <NIcon :size="14" class="shrink-0"><ArrowBackOutline /></NIcon>
        <span class="truncate">{{ t('pages.study.allStudies') }}</span>
      </button>

      <span class="shrink-0 font-condensed text-xs text-text-secondary">
        {{ t('pages.study.chaptersCount', { count: studyStore.chapters.length }) }}
      </span>
    </div>

    <!-- Chapters List -->
    <div class="flex-1 overflow-y-auto p-1.5">
      <div v-if="studyStore.chapters.length === 0" class="px-2 py-3 text-xs text-text-secondary">
        {{ t('pages.study.noChaptersYet') }}
      </div>

      <ul v-else class="m-0 flex list-none flex-col gap-1 p-0">
        <li
          v-for="ch in studyStore.chapters"
          :key="ch.id"
          class="group flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors"
          :class="
            ch.id === studyStore.activeChapterId
              ? 'border-brand/50 bg-elevated font-semibold text-text-primary'
              : 'border-transparent text-text-secondary hover:border-border hover:bg-elevated/60 hover:text-text-primary'
          "
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-left text-inherit"
            @click="handleSelectChapter(ch.id)"
          >
            <span class="shrink-0 font-condensed text-[0.75rem] text-text-secondary">
              {{ ch.chapter_order }}
            </span>
            <NIcon
              v-if="ch.chapter_kind === 'drill'"
              :size="12"
              class="shrink-0 text-warning"
            >
              <FlashOutline />
            </NIcon>
            <span
              v-else-if="ch.chapter_kind === 'live_game'"
              class="h-1.5 w-1.5 shrink-0 rounded-full bg-brand"
              aria-hidden="true"
            />
            <span class="truncate">{{ formatDisplayChapterTitle(ch.title) }}</span>
          </button>

          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-sm border-none bg-transparent p-0.5 text-text-disabled opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
            :title="t('shared.buttons.delete')"
            @click.stop="handleDeleteChapter(ch.id, ch.title)"
          >
            <NIcon :size="14"><TrashOutline /></NIcon>
          </button>
        </li>
      </ul>
    </div>

    <!-- Footer "+ Chapter" Action -->
    <div class="border-t border-border p-1.5">
      <button
        type="button"
        class="flex w-full min-w-0 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-border-hover hover:bg-overlay"
        @click="handleNewChapter"
      >
        <NIcon :size="14" class="shrink-0 text-brand"><AddOutline /></NIcon>
        <span class="truncate">{{ t('pages.study.newChapter') }}</span>
      </button>
    </div>
  </section>
</template>
