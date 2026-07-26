<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NButton,
  NInput,
  NList,
  NListItem,
  NThing,
  NSpin,
  NAlert,
  useMessage,
  useDialog,
  NTag
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useStudyStore, type StudyChapter } from '@/entities/study'
import { useRepertoireTrainingStore } from '../model/repertoire-training.store'
import { useGameStore, useBoardStore } from '@/entities/game'
import { RepertoireTrainingStrategy } from '../model/RepertoireTrainingStrategy'
import { srsService } from '../lib/SrsService'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'

const { t } = useI18n()
const studyStore = useStudyStore()
const trainingStore = useRepertoireTrainingStore()
const gameStore = useGameStore()
const message = useMessage()
const dialog = useDialog()

const importUrl = ref('')
const selectedStudyId = ref<string | null>(null)
const isImporting = ref(false)

const getLinesCount = (ch: StudyChapter): number => {
  if (!ch.root) return 0
  return srsService.getLeafNodes(ch.root).length
}

onMounted(async () => {
  await studyStore.loadLibrary()
})

const handleImport = async () => {
  if (!importUrl.value.trim()) {
    message.error(t('features.study.replyTraining.import.emptyUrl'))
    return
  }

  isImporting.value = true
  try {
    const study = await studyStore.importStudy(importUrl.value)
    selectedStudyId.value = study.id
    importUrl.value = ''
    message.success(t('features.study.replyTraining.import.success', { name: study.name }))
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    dialog.error({
      title: t('features.study.replyTraining.import.failed'),
      content: errorMsg,
      positiveText: t('shared.buttons.close')
    })
  } finally {
    isImporting.value = false
  }
}

const handleDeleteStudy = (studyId: string, event: Event) => {
  event.stopPropagation()
  dialog.warning({
    title: t('features.study.replyTraining.delete.title'),
    content: t('features.study.replyTraining.delete.confirm'),
    positiveText: t('shared.buttons.delete'),
    negativeText: t('shared.buttons.cancel'),
    onPositiveClick: async () => {
      try {
        await studyStore.deleteStudy(studyId)
        if (selectedStudyId.value === studyId) {
          selectedStudyId.value = null
        }
        message.success(t('features.study.replyTraining.delete.success'))
      } catch (error) {
        logger.error('Failed to delete study:', error)
      }
    }
  })
}

const selectStudy = (studyId: string) => {
  selectedStudyId.value = selectedStudyId.value === studyId ? null : studyId
}

const handleStartTraining = async (chapterId: string) => {
  if (!selectedStudyId.value) return

  try {
    await studyStore.selectChapter(selectedStudyId.value, chapterId)
    const chapter = studyStore.activeChapter
    if (!chapter) throw new Error('Active chapter is null after selection')

    if (chapter.chapter_type !== 'repertoire') {
      message.error(t('features.study.replyTraining.errors.repertoireOnly'))
      return
    }

    const userColor = chapter.color || 'white'
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    trainingStore.resetSession()
    trainingStore.isTrainingActive = true
    trainingStore.trainingChapterId = chapterId

    const boardStore = useBoardStore()
    boardStore.setupPosition(startFen, userColor)

    // Start game store with the strategy
    gameStore.startWithStrategy(
      startFen,
      new RepertoireTrainingStrategy(userColor, startFen, (msg) => {
        message.success(msg, { duration: 2500 })
      }),
      userColor,
      true
    )

    message.success(t('features.study.replyTraining.session.started', { name: chapter.name }))
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    message.error(`${t('features.study.replyTraining.session.startFailed')}: ${errorMsg}`)
  }
}

const handleSelectChapter = async (studyId: string, chapterId: string) => {
  try {
    await studyStore.selectChapter(studyId, chapterId)
    const chapter = studyStore.activeChapter
    if (chapter) {
      const userColor = chapter.color || 'white'
      const boardStore = useBoardStore()
      boardStore.setupPosition(pgnService.getCurrentNavigatedFen(), userColor)
    }
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    message.error(`Kapitel konnte nicht geladen werden: ${errorMsg}`)
  }
}
</script>

<template>
  <div class="study-import-card">
    <div class="card-header">
      <NText strong class="title">{{ t('features.study.replyTraining.library.title') }}</NText>
    </div>

    <!-- paste link -->
    <div class="import-section">
      <NInput
        v-model:value="importUrl"
        placeholder="https://lichess.org/study/..."
        :disabled="isImporting"
        @keyup.enter="handleImport"
      />
      <NButton
        type="primary"
        class="import-btn"
        :loading="isImporting"
        @click="handleImport"
      >
        {{ t('features.study.replyTraining.library.importBtn') }}
      </NButton>
    </div>

    <!-- loader -->
    <div v-if="studyStore.isLoading" class="loading-state">
      <NSpin size="large" />
      <NText class="loading-text">{{ t('features.study.replyTraining.library.loading') }}</NText>
    </div>

    <!-- library list -->
    <div v-else class="library-container">
      <div v-if="studyStore.library.length === 0" class="empty-state">
        <NAlert type="info" :show-icon="false">
          {{ t('features.study.replyTraining.library.empty') }}
        </NAlert>
      </div>

      <NList v-else hoverable clickable class="study-list">
        <NListItem
          v-for="study in studyStore.library"
          :key="study.id"
          :class="['study-item', { active: selectedStudyId === study.id }]"
          @click="selectStudy(study.id)"
        >
          <NThing>
            <template #header>
              <div class="study-title-row">
                <span class="study-name">{{ study.name }}</span>
                <NButton
                  size="tiny"
                  type="error"
                  quaternary
                  @click="handleDeleteStudy(study.id, $event)"
                >
                  {{ t('shared.buttons.delete') }}
                </NButton>
              </div>
            </template>
            <template #description>
              <span class="chapters-count">
                {{ study.chapters.length }} {{ t('features.study.replyTraining.library.chapters') }}
              </span>
            </template>

            <!-- expanded chapters list -->
            <div v-if="selectedStudyId === study.id" class="chapters-drawer" @click.stop>
              <div class="chapters-title">
                {{ t('features.study.replyTraining.library.selectChapter') }}
              </div>
              <div class="chapters-list">
                <div
                  v-for="ch in study.chapters"
                  :key="ch.id"
                  :class="['chapter-row', { disabled: ch.chapter_type !== 'repertoire', active: studyStore.activeChapter?.id === ch.id }]"
                  @click="ch.chapter_type === 'repertoire' && handleSelectChapter(study.id, ch.id)"
                >
                  <div class="ch-info">
                    <span class="ch-name">{{ ch.name }}</span>
                    <div class="ch-tags">
                      <NTag
                        size="small"
                        :type="ch.color === 'white' ? 'default' : 'warning'"
                        class="color-tag"
                      >
                        {{ ch.color.toUpperCase() }}
                      </NTag>
                      <NTag
                        size="small"
                        :type="ch.chapter_type === 'repertoire' ? 'success' : 'error'"
                      >
                        {{ ch.chapter_type === 'repertoire' ? 'Repertoire' : 'Setup' }}
                      </NTag>
                      <NTag
                        v-if="ch.chapter_type === 'repertoire'"
                        size="small"
                        type="info"
                      >
                        {{ t('features.study.replyTraining.library.linesCount', { count: getLinesCount(ch) }) }}
                      </NTag>
                    </div>
                  </div>

                  <NButton
                    size="small"
                    type="primary"
                    secondary
                    :disabled="ch.chapter_type !== 'repertoire'"
                    @click="handleStartTraining(ch.id)"
                  >
                    {{ t('features.study.replyTraining.library.trainBtn') }}
                  </NButton>
                </div>
              </div>
            </div>
          </NThing>
        </NListItem>
      </NList>
    </div>
  </div>
</template>

<style scoped>
.study-import-card {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  box-sizing: border-box;
}

.card-header {
  margin-bottom: 16px;
}

.title {
  font-size: 1.1rem;
  color: var(--neon-cyan, #1890ff);
}

.import-section {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.import-btn {
  flex-shrink: 0;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  gap: 16px;
}

.loading-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

.library-container {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  padding: 20px 0;
}

.study-list {
  background: transparent;
}

.study-item {
  background: rgba(0, 0, 0, 0.15) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 8px;
  margin-bottom: 10px !important;
  transition: all 0.3s ease;
}

.study-item.active {
  border-color: var(--neon-cyan, #1890ff) !important;
  box-shadow: 0 0 8px rgba(24, 144, 255, 0.15);
}

.study-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.study-name {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--color-text-primary, #ffffff);
}

.chapters-count {
  font-size: 0.8rem;
  color: var(--color-text-secondary, #888888);
}

.chapters-drawer {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--color-border);
}

.chapters-title {
  font-size: 0.8rem;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.chapters-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chapter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.chapter-row:not(.disabled) {
  cursor: pointer;
  transition: all 0.2s ease;
}

.chapter-row:not(.disabled):hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.15);
}

.chapter-row.active {
  background: rgba(24, 144, 255, 0.15);
  border-color: var(--neon-cyan, #1890ff);
  box-shadow: 0 0 8px rgba(24, 144, 255, 0.1);
}

.chapter-row.disabled {
  opacity: 0.6;
}

.ch-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ch-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-primary, #ffffff);
}

.ch-tags {
  display: flex;
  gap: 6px;
}

.color-tag {
  font-weight: bold;
}
</style>
