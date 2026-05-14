<script setup lang="ts">
/**
 * TODO: Refactoring Recommendations for future maintenance:
 * 1. Extract Lichess sync actions (push, publish, delete) and cooldown logic into a separate composable (e.g. useChapterSync.ts).
 * 2. Consider splitting the TabPane contents (Templates, Raw PGN) into smaller sub-components to reduce file size.
 * 3. Keep the core form state and basic settings here as the central UI hub for chapter management.
 */
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useStudyStore, type StudyChapter } from '@/entities/study'
import { openingChaptersService, type OpeningChapterTemplate } from '@/entities/opening'
import { LinkOutline, ShareOutline, TrashOutline } from '@vicons/ionicons5'
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NSpace,
  NTabs,
  NTabPane,
  NList,
  NListItem,
  NThing,
  NText,
  NIcon,
  useDialog,
  useMessage,
} from 'naive-ui'

const props = defineProps<{
  show: boolean
  chapter: StudyChapter | null
  isCreating?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
}>()

const studyStore = useStudyStore()
const message = useMessage()
const { t } = useI18n()

const activeTab = ref<'settings' | 'templates' | 'raw_pgn'>('settings')
const searchQuery = ref('')
const templates = ref<OpeningChapterTemplate[]>([])
const isLoadingTemplates = ref(false)
const pgnInput = ref('')
const dialog = useDialog()

// Cooldown states
const DELETE_COOLDOWN_MS = 5 * 1000
const deleteCooldown = ref(0)
let cooldownTimer: number | null = null

function updateCooldowns() {
  if (!props.chapter) return
  const now = Date.now()

  const delLast = parseInt(localStorage.getItem(`del_${props.chapter.id}`) || '0', 10)
  deleteCooldown.value = Math.max(0, Math.ceil((DELETE_COOLDOWN_MS - (now - delLast)) / 1000))

  if (deleteCooldown.value === 0 && cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
}

function startCooldownTimer() {
  updateCooldowns()
  if (!cooldownTimer && deleteCooldown.value > 0) {
    cooldownTimer = window.setInterval(updateCooldowns, 1000)
  }
}

const formModel = ref({
  name: '',
  color: 'white' as 'white' | 'black' | undefined,
  eco: '',
  opening: '',
  result: '*',
})

const lichessStudyUrl = computed(() => {
  if (!studyStore.activeStudy?.lichessId) return null
  return `https://lichess.org/study/${studyStore.activeStudy.lichessId}`
})

const lichessChapterUrl = computed(() => {
  if (!studyStore.activeStudy?.lichessId || !props.chapter?.lichessChapterId) return null
  return `https://lichess.org/study/${studyStore.activeStudy.lichessId}/${props.chapter.lichessChapterId}`
})

const localAppUrl = computed(() => {
  const chapter = props.chapter || studyStore.activeChapter
  if (!chapter) return null

  const studyId = chapter.studyId || 'local'
  const chapterId = chapter.lichessChapterId || chapter.id

  return `${window.location.origin}/study/${studyId}/${chapterId}`
})

const resultOptions = computed(() => [
  { label: t('features.study.chapterSettings.form.results.whiteWins'), value: '1-0' },
  { label: t('features.study.chapterSettings.form.results.blackWins'), value: '0-1' },
  { label: t('features.study.chapterSettings.form.results.draw'), value: '1/2-1/2' },
  { label: t('features.study.chapterSettings.form.results.unknown'), value: '*' },
])

const isResultChanged = computed(() => {
  if (props.isCreating || !props.chapter) return false
  return formModel.value.result !== (props.chapter.tags['Result'] || '*')
})

const filteredTemplates = computed(() => {
  const query = searchQuery.value.toLowerCase()
  if (!query) return templates.value

  return templates.value.filter(
    (t) => t.name.toLowerCase().includes(query) || t.eco.toLowerCase().includes(query),
  )
})

const chaptersInStudyCount = computed(() => {
  const chapter = props.chapter
  if (!chapter?.studyId) return 0
  return studyStore.chapters.filter((c) => c.studyId === chapter.studyId).length
})

watch(
  () => props.show,
  async (isShown) => {
    if (isShown) {
      startCooldownTimer()
      if (props.isCreating) {
        activeTab.value = 'settings'
        pgnInput.value = ''
        formModel.value = {
          name: `${t('features.study.sidebar.addChapter')} ${studyStore.activeStudy?.chapterIds.length || 0 + 1}`,
          color: 'white',
          eco: 'NULL',
          opening: 'NULL',
          result: '*',
        }
        // Prefetch templates if not loaded
        if (templates.value.length === 0) {
          isLoadingTemplates.value = true
          await openingChaptersService.load()
          templates.value = openingChaptersService.getChapters()
          isLoadingTemplates.value = false
        }
      } else if (props.chapter) {
        activeTab.value = 'settings'
        pgnInput.value = ''
        formModel.value = {
          name: props.chapter.name,
          color: props.chapter.color || 'white',
          eco: props.chapter.tags['ECO'] || 'NULL',
          opening: props.chapter.tags['Opening'] || 'NULL',
          result: props.chapter.tags['Result'] || '*',
        }
      }
    }
  },
)

async function handleImportPgn() {
  if (!pgnInput.value.trim()) return

  try {
    if (!studyStore.activeStudy) return

    await studyStore.createChapterFromPgn(
      pgnInput.value,
      formModel.value.name !==
        `${t('features.study.sidebar.addChapter')} ${studyStore.activeStudy.chapterIds.length + 1}`
        ? formModel.value.name
        : undefined,
      formModel.value.color,
      studyStore.activeStudy.id,
    )
    pgnInput.value = ''
    message.success(t('features.study.chapterSettings.pgn.success'))
    emit('update:show', false)
  } catch (e) {
    message.error(t('features.study.chapterSettings.pgn.error'))
    console.error(e)
  }
}

async function handleSave() {
  if (!formModel.value.name.trim()) {
    message.error(t('features.study.chapterSettings.errors.emptyName'))
    return
  }

  if (props.isCreating) {
    const chapterId = await studyStore.createChapter(
      formModel.value.name,
      undefined,
      formModel.value.color,
    )
    if (!chapterId) {
      message.error(t('features.study.chapterSettings.errors.failedToCreate'))
      return
    }
    // Update newly created chapter's tags
    const chapter = studyStore.chapters.find((c) => c.id === chapterId)
    if (chapter) {
      const updatedTags = {
        ...chapter.tags,
        ECO: formModel.value.eco,
        Opening: formModel.value.opening,
        Result: formModel.value.result,
      }
      studyStore.updateChapterMetadata(chapterId, { tags: updatedTags })
    }
    studyStore.setActiveChapter(chapterId)
    message.success(t('features.study.chapterSettings.messages.created'))
  } else if (props.chapter) {
    const resultChanged = isResultChanged.value

    const updatedTags = {
      ...props.chapter.tags,
      Result: formModel.value.result,
    }

    studyStore.updateChapterMetadata(props.chapter.id, {
      tags: updatedTags,
    })

    if (resultChanged && props.chapter.lichessChapterId) {
      try {
        await studyStore.syncChapterTagsToLichess(props.chapter.id)
        message.success(t('features.study.chapterSettings.messages.updated'))
      } catch {
        message.error('Failed to sync changes to Lichess.')
      }
    } else {
      message.success(t('features.study.chapterSettings.messages.updated'))
    }
  }

  emit('update:show', false)
}

async function selectTemplate(template: OpeningChapterTemplate) {
  try {
    if (!studyStore.activeStudy) return

    await studyStore.createChapterFromPgn(
      template.pgn,
      template.name,
      formModel.value.color,
      studyStore.activeStudy.id,
    )
    message.success(
      t('features.study.chapterSettings.templates.createdFrom', { name: template.name }),
    )
    emit('update:show', false)
  } catch (e) {
    message.error(t('features.study.chapterSettings.templates.noTemplates'))
    console.error(e)
  }
}

async function handleCopyLink() {
  if (!localAppUrl.value) return
  try {
    await navigator.clipboard.writeText(localAppUrl.value)
    message.success(t('common.actions.linkCopied'))
  } catch {
    message.error(t('common.actions.copyFailed'))
  }
}

async function handleShare() {
  if (!localAppUrl.value) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: props.chapter?.name || 'Chess Study',
        url: localAppUrl.value,
      })
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') {
        handleCopyLink()
      }
    }
  } else {
    handleCopyLink()
  }
}

function openUrl(url: string | null) {
  if (url) window.open(url, '_blank')
}

// Actions from Sidebar
async function handleDelete() {
  if (!props.chapter) return

  if (deleteCooldown.value > 0) {
    message.warning(`Please wait ${deleteCooldown.value}s before deleting again.`)
    return
  }

  const deleteAction = async () => {
    const loadingMsg = message.loading(t('features.study.sidebar.deletingChapter'), { duration: 0 })
    try {
      await studyStore.deleteChapter(props.chapter!.id, !!props.chapter?.lichessChapterId)
      localStorage.setItem(`del_${props.chapter!.id}`, Date.now().toString())
      loadingMsg.destroy()
      message.success(t('features.study.sidebar.deleteSuccess'))
      emit('update:show', false)
    } catch {
      loadingMsg.destroy()
      message.error(t('features.study.sidebar.deleteError'))
    }
  }

  if (studyStore.activeStudy?.lichessId && props.chapter.lichessChapterId) {
    dialog.warning({
      title: t('features.study.sidebar.deleteChapterTitle'),
      content: t('features.study.sidebar.deleteChapterContent'),
      positiveText: t('features.study.sidebar.deleteChapterConfirm'),
      negativeText: t('features.study.sidebar.deleteChapterCancel'),
      onPositiveClick: deleteAction,
    })
  } else {
    await deleteAction()
  }
}
</script>

<template>
  <NModal
    :show="show"
    @update:show="(v) => emit('update:show', v)"
    preset="card"
    :title="
      isCreating
        ? t('features.study.chapterSettings.addChapter')
        : t('features.study.chapterSettings.settings')
    "
    style="width: 500px; max-width: 95vw"
    :auto-focus="false"
    :trap-focus="false"
  >
    <template v-if="!isCreating && chapter" #header-extra>
      <NSpace size="small" align="center">
        <!-- Delete Chapter -->
        <NButton
          v-if="chaptersInStudyCount > 1"
          size="small"
          quaternary
          circle
          type="error"
          :disabled="deleteCooldown > 0"
          :title="
            deleteCooldown > 0
              ? t('features.study.sidebar.cooldownWait', { seconds: deleteCooldown })
              : t('features.study.sidebar.deleteChapterTooltip')
          "
          @click="handleDelete"
        >
          <template #icon
            ><NIcon><TrashOutline /></NIcon
          ></template>
        </NButton>
      </NSpace>
    </template>
    <NTabs v-model:value="activeTab" type="segment" animated>
      <NTabPane name="settings" :tab="t('features.study.chapterSettings.tabs.basicInfo')">
        <div style="padding-top: 15px">
          <NForm :model="formModel" label-placement="left" label-width="100">
            <NFormItem :label="t('features.study.chapterSettings.form.name')" path="name">
              <NInput
                v-model:value="formModel.name"
                :disabled="!isCreating"
                :placeholder="t('features.study.chapterSettings.form.namePlaceholder')"
              />
            </NFormItem>

            <NFormItem :label="t('features.study.chapterSettings.form.color')" path="color">
              <NSelect
                v-model:value="formModel.color"
                :disabled="!isCreating"
                :options="[
                  { label: t('features.study.chapterSettings.form.white'), value: 'white' },
                  { label: t('features.study.chapterSettings.form.black'), value: 'black' },
                ]"
              />
            </NFormItem>

            <NFormItem :label="t('features.study.chapterSettings.form.eco')" path="eco">
              <NInput
                v-model:value="formModel.eco"
                :disabled="!isCreating"
                :placeholder="t('features.study.chapterSettings.form.ecoPlaceholder')"
              />
            </NFormItem>

            <NFormItem :label="t('features.study.chapterSettings.form.opening')" path="opening">
              <NInput
                v-model:value="formModel.opening"
                :disabled="!isCreating"
                :placeholder="t('features.study.chapterSettings.form.openingPlaceholder')"
              />
            </NFormItem>

            <NFormItem :label="t('features.study.chapterSettings.form.result')" path="result">
              <NSelect v-model:value="formModel.result" :options="resultOptions" />
            </NFormItem>

            <div class="lichess-links">
              <NSpace vertical size="small">
                <div v-if="localAppUrl" class="lichess-link-item">
                  <NText depth="3">{{ t('features.study.chapterSettings.links.localApp') }}</NText>
                  <NSpace size="small" style="margin-top: 4px">
                    <NButton size="small" tertiary class="action-btn" @click="handleCopyLink">
                      <template #icon
                        ><NIcon class="neon-icon"><LinkOutline /></NIcon
                      ></template>
                      {{ t('common.actions.copyLink') }}
                    </NButton>
                    <NButton size="small" tertiary class="action-btn" @click="handleShare">
                      <template #icon
                        ><NIcon class="neon-icon"><ShareOutline /></NIcon
                      ></template>
                      {{ t('common.controls.share') }}
                    </NButton>
                  </NSpace>
                </div>

                <div
                  v-if="lichessStudyUrl || lichessChapterUrl"
                  class="lichess-link-item"
                  style="margin-top: 12px"
                >
                  <NText depth="3">Lichess Links:</NText>
                  <NSpace size="small" style="margin-top: 4px; width: 100%">
                    <NButton
                      v-if="lichessStudyUrl"
                      size="small"
                      tertiary
                      class="action-btn"
                      @click="openUrl(lichessStudyUrl)"
                    >
                      <template #icon>
                        <NIcon class="lichess-orange-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="m21.91 13.43-4.73-8.59.61-2.59c.01-.06 0-.13-.05-.18-.04-.05-.11-.07-.17-.07-1.42.17-2.6.36-3.75 1.19-4.04-.27-7.27.75-9.35 2.95-2.18 2.31-2.67 5.46-2.39 7.63.64 4.71 4.33 7.19 7.57 7.94.83.19 1.64.28 2.44.28 2.79 0 5.25-1.15 6.62-3.21.06-.09.04-.2-.04-.27a.19.19 0 0 0-.27.02c-2.84 2.94-7.5 3.44-11.08 1.2-3.74-2.34-5.17-7.01-3.26-10.62 1.9-3.6 5.29-5.15 9.53-4.36.05 0 .1 0 .14-.02l.28-.16c.77-.46 1.63-.96 2.39-1.07l-.58 1.66c-.02.06-.01.12.02.17l5.07 8.49c-.16 1.69-1.42 2.09-1.85 2.18-.24-.54-.68-1.14-1.92-2.34-.35-.34-1.01-.78-1.77-1.3-1.97-1.33-4.95-3.35-4.49-4.99a.2.2 0 0 0-.14-.25.2.2 0 0 0-.25.14c-.67 2.32 2.35 4.65 4.35 6.19.54.42 1.01.78 1.33 1.08 1.45 1.37 2.14 2.38 2.28 2.65.04.08.14.13.23.1.04-.01 3.94-1.08 3.28-3.81 0-.02-.01-.03-.02-.05Z"
                            />
                          </svg>
                        </NIcon>
                      </template>
                      Open Study
                    </NButton>
                    <NButton
                      v-if="lichessChapterUrl"
                      size="small"
                      tertiary
                      class="action-btn"
                      @click="openUrl(lichessChapterUrl)"
                    >
                      <template #icon>
                        <NIcon class="lichess-orange-icon">
                          <svg
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="m21.91 13.43-4.73-8.59.61-2.59c.01-.06 0-.13-.05-.18-.04-.05-.11-.07-.17-.07-1.42.17-2.6.36-3.75 1.19-4.04-.27-7.27.75-9.35 2.95-2.18 2.31-2.67 5.46-2.39 7.63.64 4.71 4.33 7.19 7.57 7.94.83.19 1.64.28 2.44.28 2.79 0 5.25-1.15 6.62-3.21.06-.09.04-.2-.04-.27a.19.19 0 0 0-.27.02c-2.84 2.94-7.5 3.44-11.08 1.2-3.74-2.34-5.17-7.01-3.26-10.62 1.9-3.6 5.29-5.15 9.53-4.36.05 0 .1 0 .14-.02l.28-.16c.77-.46 1.63-.96 2.39-1.07l-.58 1.66c-.02.06-.01.12.02.17l5.07 8.49c-.16 1.69-1.42 2.09-1.85 2.18-.24-.54-.68-1.14-1.92-2.34-.35-.34-1.01-.78-1.77-1.3-1.97-1.33-4.95-3.35-4.49-4.99a.2.2 0 0 0-.14-.25.2.2 0 0 0-.25.14c-.67 2.32 2.35 4.65 4.35 6.19.54.42 1.01.78 1.33 1.08 1.45 1.37 2.14 2.38 2.28 2.65.04.08.14.13.23.1.04-.01 3.94-1.08 3.28-3.81 0-.02-.01-.03-.02-.05Z"
                            />
                          </svg>
                        </NIcon>
                      </template>
                      Open Chapter
                    </NButton>
                  </NSpace>
                </div>
              </NSpace>
            </div>

            <NSpace justify="end" style="margin-top: 20px">
              <NButton @click="emit('update:show', false)">{{
                t('features.study.chapterSettings.actions.cancel')
              }}</NButton>
              <NButton
                type="primary"
                :disabled="!isCreating && !isResultChanged"
                @click="handleSave"
              >
                {{
                  isCreating
                    ? t('features.study.chapterSettings.actions.create')
                    : t('features.study.chapterSettings.actions.save')
                }}
              </NButton>
            </NSpace>
          </NForm>
        </div>
      </NTabPane>

      <NTabPane
        v-if="isCreating"
        name="templates"
        :tab="t('features.study.chapterSettings.tabs.fromTemplate')"
      >
        <div style="padding-top: 15px">
          <NSpace vertical>
            <div class="color-hint">
              <NText depth="3">{{
                t('features.study.chapterSettings.templates.colorHint', { color: formModel.color })
              }}</NText>
            </div>
            <NInput
              v-model:value="searchQuery"
              :placeholder="t('features.study.chapterSettings.templates.search')"
              clearable
            />
            <div class="template-list-container">
              <NList hoverable clickable>
                <NListItem
                  v-for="template in filteredTemplates"
                  :key="template.name"
                  @click="selectTemplate(template)"
                >
                  <NThing :title="template.name">
                    <template #description>
                      <NText depth="3" class="eco-tag">{{ template.eco }}</NText>
                    </template>
                  </NThing>
                </NListItem>
                <div v-if="filteredTemplates.length === 0" class="empty-state">
                  {{ t('features.study.chapterSettings.templates.noTemplates') }}
                </div>
              </NList>
            </div>
          </NSpace>
        </div>
      </NTabPane>

      <NTabPane
        v-if="isCreating"
        name="raw_pgn"
        :tab="t('features.study.chapterSettings.tabs.rawPgn')"
      >
        <div style="padding-top: 15px">
          <NSpace vertical>
            <div class="color-hint">
              <NText depth="3">{{
                t('features.study.chapterSettings.pgn.colorHint', { color: formModel.color })
              }}</NText>
            </div>
            <NInput
              v-model:value="pgnInput"
              type="textarea"
              :placeholder="t('features.study.chapterSettings.pgn.placeholder')"
              :rows="8"
            />
            <NSpace justify="end" style="margin-top: 10px">
              <NButton @click="emit('update:show', false)">{{
                t('features.study.chapterSettings.actions.cancel')
              }}</NButton>
              <NButton type="primary" :disabled="!pgnInput.trim()" @click="handleImportPgn">
                {{ t('features.study.chapterSettings.actions.import') }}
              </NButton>
            </NSpace>
          </NSpace>
        </div>
      </NTabPane>
    </NTabs>
  </NModal>
</template>

<style scoped>
.template-list-container {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 4px;
}

.eco-tag {
  font-family: monospace;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.8em;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--color-text-muted);
}

.color-hint {
  background: rgba(var(--color-primary-rgb), 0.05);
  padding: 8px 12px;
  border-radius: 4px;
  border-left: 3px solid var(--color-accent-primary);
  margin-bottom: 8px;
}

.lichess-links {
  margin-top: 20px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--color-border);
  border-radius: 4px;
}

.lichess-link-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.link {
  color: var(--color-accent-primary);
  text-decoration: none;
  font-family: monospace;
  font-size: 0.85rem;
  word-break: break-all;
  display: flex;
  align-items: center;
  gap: 4px;
}

.link:hover {
  text-decoration: underline;
}

.action-btn {
  flex: 1;
}

.neon-icon {
  color: var(--neon-blue);
}

.lichess-orange-icon {
  color: var(--neon-orange);
}

.sync-icon {
  color: var(--color-primary-hover);
}
</style>
