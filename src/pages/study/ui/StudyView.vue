<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import { MozerBook } from '@/features/mozer-book'
import { LichessOpeningExplorer } from '@/features/opening-explorer'
import { useAuthStore } from '@/entities/user'
import {
  LichessApiError,
  LichessErrorModal,
  LichessStudyAuthModal,
  StudyControls,
  StudyHeader,
  StudySidebar,
  StudyTree,
  useStudyStore,
} from '@/features/study'
import { useReplyTrainingStore, ReplySessionWindow } from '@/features/study-reply-training'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { GameLayout } from '@/widgets/game-layout'
import { useDialog, useMessage } from 'naive-ui'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'

import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const boardStore = useBoardStore()
const studyStore = useStudyStore()
const analysisStore = useAnalysisStore()
const trainingStore = useReplyTrainingStore()
const authStore = useAuthStore()

watch(
  () => [authStore.userProfile?.id, authStore.userProfile?.username] as const,
  ([id, username]) => {
    studyStore.setOwner(id || null, username || null)
  },
  { immediate: true },
)

const explorerMode = ref<'lichess' | 'mozer' | 'study'>('study')

// Error modal state
const showErrorModal = ref(false)
const errorStatus = ref<number | undefined>(undefined)
const errorMessage = ref('')

const handleToggleAnalysis = () => {
  if (analysisStore.isAnalysisActive) {
    analysisStore.hidePanel()
  } else {
    analysisStore.showPanel(true)
  }
}

const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
  if (studyStore.cloudLoading) {
    event.preventDefault()
    event.returnValue = t('features.study.manager.messages.syncInProgress')
  }
}

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnloadHandler)
  studyStore.isActiveMode = true
  boardStore.setAnalysisMode(true)
  await analysisStore.showPanel() // Initialize analysis (threads, etc.) and set visible flag for watcher

  const routeStudyId = route.params.studyId as string | undefined
  const routeChapterId = route.params.chapterId as string | undefined

  if (!routeStudyId || routeStudyId === 'local') {
    const hasAccess = await studyStore.requireLichessAccess()
    if (!hasAccess) {
      return // Wait for user to authorize or cancel
    }
  }
  await studyStore.initialize()

  if (routeStudyId && routeStudyId !== 'local') {
    // 1. Check if study exists locally
    const localStudy = studyStore.studies.find((s) => s.id === routeStudyId)

    if (!localStudy) {
      // Study is missing! Show import dialog
      dialog.info({
        title: t('features.study.deepLink.title'),
        content: t('features.study.deepLink.content', { id: routeStudyId }),
        positiveText: t('features.study.manager.buttons.import'),
        negativeText: t('common.actions.cancel'),
        onPositiveClick: async () => {
          const loadingMsg = message.loading(t('features.study.deepLink.importing'), {
            duration: 0,
          })
          try {
            await studyStore.importFromLichess(routeStudyId, 'community')
            loadingMsg.destroy()
            message.success(t('features.study.deepLink.success'))

            // Try to activate the specific chapter if provided
            if (routeChapterId) {
              const chapterExists = studyStore.chapters.some(
                (c) => c.lichessChapterId === routeChapterId || c.id === routeChapterId,
              )
              if (chapterExists) {
                studyStore.setActiveChapter(routeChapterId)
              } else {
                message.warning(t('features.study.deepLink.chapterNotFound'))
                const newStudy = studyStore.studies.find((s) => s.id === routeStudyId)
                if (newStudy && newStudy.chapterIds.length > 0)
                  studyStore.setActiveChapter(newStudy.chapterIds[0]!)
              }
            } else {
              const newStudy = studyStore.studies.find((s) => s.id === routeStudyId)
              if (newStudy && newStudy.chapterIds.length > 0)
                studyStore.setActiveChapter(newStudy.chapterIds[0]!)
            }
          } catch (error: unknown) {
            console.error('Failed to auto-import community study:', error)
            loadingMsg.destroy()
            if (error instanceof LichessApiError) {
              errorStatus.value = error.status
              errorMessage.value = error.message
              showErrorModal.value = true
            } else {
              message.error(t('features.study.deepLink.error'))
            }
            if (studyStore.activeChapterId) updateUrl(studyStore.activeChapterId)
          }
        },
        onNegativeClick: () => {
          if (studyStore.activeChapterId) {
            updateUrl(studyStore.activeChapterId)
          } else {
            router.push('/')
          }
        },
      })
      return // Wait for user decision
    } else {
      // Study exists locally
      if (routeChapterId) {
        const chapterExists = studyStore.chapters.some(
          (c) => c.lichessChapterId === routeChapterId || c.id === routeChapterId,
        )
        if (chapterExists) {
          studyStore.setActiveChapter(routeChapterId)
        } else {
          message.warning(t('features.study.deepLink.chapterNotFoundInStudy'))
          if (localStudy.chapterIds.length > 0)
            studyStore.setActiveChapter(localStudy.chapterIds[0]!)
        }
      } else {
        if (localStudy.chapterIds.length > 0) studyStore.setActiveChapter(localStudy.chapterIds[0]!)
      }
    }
  } else if (routeChapterId && !routeStudyId) {
    studyStore.setActiveChapter(routeChapterId)
  } else if (studyStore.activeChapterId) {
    updateUrl(studyStore.activeChapterId)
  }
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

const handleCancelAuth = () => {
  studyStore.isAuthModalVisible = false
  router.push('/') // Redirect away from protected route
}

function updateUrl(id: string) {
  const chapter = studyStore.chapters.find((c) => c.id === id)
  if (!chapter) return

  const studyId = chapter.studyId || 'local'
  const displayChapterId = chapter.lichessChapterId || chapter.id

  router.replace({
    name: 'study-view',
    params: { studyId, chapterId: displayChapterId },
  })
}

// Watch for active chapter changes to update URL
watch(
  () => studyStore.activeChapterId,
  (newId) => {
    if (newId) {
      updateUrl(newId)
      boardStore.syncBoardWithPgn()
      if (studyStore.activeChapter?.color) {
        boardStore.orientation = studyStore.activeChapter.color
      }
    }
  },
)

onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnloadHandler)
  studyStore.isActiveMode = false
  boardStore.setAnalysisMode(false)
  analysisStore.resetAnalysisState()
})

// Auto-update node evaluation from engine
watch(
  () => analysisStore.analysisLines,
  (lines) => {
    if (analysisStore.isAnalysisActive && lines.length > 0) {
      const topMove = lines[0]
      const currentNode = pgnService.getCurrentNode()
      if (topMove && currentNode && currentNode.id !== '__ROOT__') {
        // Convert score to centipawns or mate value
        let scoreVal = topMove.score.value
        if (topMove.score.type === 'mate') {
          scoreVal =
            topMove.score.value > 0 ? 100000 + topMove.score.value : -100000 - topMove.score.value
        }
        pgnService.updateNode(currentNode, { eval: scoreVal })
      }
    }
  },
  { deep: true },
)
</script>

<template>
  <GameLayout>
    <template #top-info>
      <StudyHeader />
    </template>

    <template #left-panel>
      <ReplySessionWindow v-if="trainingStore.isReplyTrainingActive" />
      <div v-else class="explorer-wrapper">
        <div class="explorer-toggle">
          <button :class="{ active: explorerMode === 'study' }" @click="explorerMode = 'study'">
            Study
          </button>
          <button :class="{ active: explorerMode === 'mozer' }" @click="explorerMode = 'mozer'">
            MozerBook
          </button>
          <button :class="{ active: explorerMode === 'lichess' }" @click="explorerMode = 'lichess'">
            Lichess
          </button>
        </div>
        <StudySidebar v-if="explorerMode === 'study'" class="explorer-component" />
        <MozerBook v-else-if="explorerMode === 'mozer'" class="explorer-component" />
        <LichessOpeningExplorer v-else class="explorer-component" />
      </div>
    </template>

    <template #controls>
      <StudyControls
        :is-analysis-active="analysisStore.isAnalysisActive"
        @toggle-analysis="handleToggleAnalysis"
      />
    </template>

    <template #right-panel>
      <div class="right-panel-content">
        <AnalysisPanel :show-pgn="false" />
        <StudyTree />
      </div>
    </template>
  </GameLayout>

  <LichessStudyAuthModal :show="studyStore.isAuthModalVisible" @cancel="handleCancelAuth" />

  <LichessErrorModal v-model:show="showErrorModal" :status="errorStatus" :message="errorMessage" />
</template>

<style scoped>
/* Explorer Styles */
.explorer-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.explorer-toggle {
  display: flex;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.explorer-toggle button {
  flex: 1;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}

.explorer-toggle button.active {
  color: var(--color-accent-primary);
  border-bottom-color: var(--color-accent-primary);
}

.explorer-component {
  flex: 1;
  min-height: 0;
}

/* Right Panel */
.right-panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 10px;
}

:deep(.study-tree-container) {
  flex: 1;
  min-height: 0;
}
</style>
