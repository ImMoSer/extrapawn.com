<script setup lang="ts">
import { useCoachStudyStore, type StudySessionRecord } from '@/features/ai-coach'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  AddOutline,
  BookOutline,
  CreateOutline,
  SchoolOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NIcon, NInput, NModal, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t, locale } = useI18n()
const router = useRouter()
const studyStore = useCoachStudyStore()
const uiStore = useUiStore()

const isCreating = ref(false)
const loadError = ref<string | null>(null)
const renameModalOpen = ref(false)
const renameTargetId = ref<string | null>(null)
const renameDraft = ref('')

const formatDate = (iso: string): string => {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 10)
  }
}

onMounted(async () => {
  loadError.value = null
  try {
    await studyStore.fetchStudies()
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : t('shared.errors.unknown')
  }
})

const handleCreateStudy = async () => {
  if (isCreating.value) return
  isCreating.value = true
  loadError.value = null
  try {
    const created = await studyStore.createNewStudy(t('pages.study.defaultTitle'))
    await router.push(`/study/${created.id}`)
  } catch (err: unknown) {
    loadError.value = err instanceof Error ? err.message : t('shared.errors.unknown')
  } finally {
    isCreating.value = false
  }
}

const handleOpenStudy = (studyId: string) => {
  void router.push(`/study/${studyId}`)
}

const openRenameModal = (study: StudySessionRecord) => {
  renameTargetId.value = study.id
  renameDraft.value = study.title
  renameModalOpen.value = true
}

const confirmRename = async () => {
  if (!renameTargetId.value || !renameDraft.value.trim()) return
  await studyStore.renameExistingStudy(renameTargetId.value, renameDraft.value.trim())
  renameModalOpen.value = false
}

const handleDeleteStudy = async (study: StudySessionRecord) => {
  const confirmed = await uiStore.showConfirmation(
    t('pages.study.deleteStudyTitle'),
    t('pages.study.deleteStudyMessage', { title: study.title }),
    { confirmText: t('shared.buttons.delete'), showCancel: true },
  )
  if (confirmed === 'confirm') {
    await studyStore.removeStudy(study.id)
  }
}
</script>

<template>
  <AppPageShell>
    <div class="flex flex-col gap-5 py-4">
      <!-- Header -->
      <header class="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand/40 bg-surface text-brand"
          >
            <NIcon :size="22"><SchoolOutline /></NIcon>
          </div>
          <div class="min-w-0">
            <h1 class="m-0 truncate font-display text-xl font-bold text-text-primary">
              {{ t('pages.study.title') }}
            </h1>
            <p class="m-0 truncate text-xs text-text-secondary">
              {{ t('pages.study.managerSubtitle') }}
            </p>
          </div>
        </div>

        <button
          type="button"
          :disabled="isCreating"
          class="inline-flex min-w-0 shrink-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border-none bg-brand px-4 py-2 font-display text-xs font-semibold text-on-brand transition-colors hover:bg-brand-deep disabled:opacity-50"
          @click="handleCreateStudy"
        >
          <NIcon :size="16" class="shrink-0"><AddOutline /></NIcon>
          <span class="truncate">{{ t('pages.study.newStudy') }}</span>
        </button>
      </header>

      <!-- Error Banner -->
      <div
        v-if="loadError"
        class="rounded-md border border-danger/50 bg-surface px-3 py-2 text-xs text-danger"
      >
        {{ loadError }}
      </div>

      <!-- Loading -->
      <div v-if="studyStore.isLoadingStudies" class="flex justify-center py-12">
        <NSpin size="medium" />
      </div>

      <!-- Empty State -->
      <div
        v-else-if="studyStore.studies.length === 0"
        class="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface px-6 py-12 text-center"
      >
        <NIcon :size="36" class="text-text-disabled"><BookOutline /></NIcon>
        <p class="m-0 max-w-md text-sm text-text-secondary">
          {{ t('pages.study.emptyManagerHint') }}
        </p>
        <button
          type="button"
          :disabled="isCreating"
          class="inline-flex min-w-0 cursor-pointer items-center gap-1.5 overflow-hidden rounded-md border-none bg-brand px-4 py-2 font-display text-xs font-semibold text-on-brand transition-colors hover:bg-brand-deep"
          @click="handleCreateStudy"
        >
          <NIcon :size="16" class="shrink-0"><AddOutline /></NIcon>
          <span class="truncate">{{ t('pages.study.newStudy') }}</span>
        </button>
      </div>

      <!-- Studies Grid -->
      <div v-else class="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @4xl:grid-cols-3">
        <article
          v-for="study in studyStore.studies"
          :key="study.id"
          class="group flex cursor-pointer flex-col justify-between gap-3 rounded-lg border border-border bg-surface p-4 transition-all hover:border-border-hover hover:bg-elevated"
          @click="handleOpenStudy(study.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <h2 class="m-0 line-clamp-2 font-display text-sm font-semibold text-text-primary">
              {{ study.title }}
            </h2>
            <div class="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                class="cursor-pointer rounded-sm border-none bg-transparent p-1 text-text-secondary hover:bg-overlay hover:text-text-primary"
                :title="t('pages.study.rename')"
                @click.stop="openRenameModal(study)"
              >
                <NIcon :size="14"><CreateOutline /></NIcon>
              </button>
              <button
                type="button"
                class="cursor-pointer rounded-sm border-none bg-transparent p-1 text-text-secondary hover:bg-overlay hover:text-danger"
                :title="t('shared.buttons.delete')"
                @click.stop="handleDeleteStudy(study)"
              >
                <NIcon :size="14"><TrashOutline /></NIcon>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5 font-condensed text-xs text-text-secondary">
            <span>{{ t('pages.study.chaptersCount', { count: study.chapter_count }) }}</span>
            <span>{{ formatDate(study.updated_at) }}</span>
          </div>
        </article>
      </div>
    </div>

    <!-- Rename Study Modal -->
    <NModal v-model:show="renameModalOpen" preset="card" :title="t('pages.study.rename')" class="max-w-md">
      <div class="flex flex-col gap-3">
        <NInput
          v-model:value="renameDraft"
          :maxlength="120"
          @keydown.enter="confirmRename"
        />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="min-w-0 cursor-pointer overflow-hidden rounded-md border border-border bg-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-overlay"
            @click="renameModalOpen = false"
          >
            <span class="truncate">{{ t('shared.buttons.cancel') }}</span>
          </button>
          <button
            type="button"
            :disabled="!renameDraft.trim()"
            class="min-w-0 cursor-pointer overflow-hidden rounded-md border-none bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand hover:bg-brand-deep disabled:opacity-45"
            @click="confirmRename"
          >
            <span class="truncate">{{ t('shared.buttons.confirm') }}</span>
          </button>
        </div>
      </div>
    </NModal>
  </AppPageShell>
</template>
