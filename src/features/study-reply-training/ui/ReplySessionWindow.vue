<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { NButton, NProgress, NText, useDialog } from 'naive-ui'
import { onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useReplyTrainingStore } from '../model/reply-training.store'
import { useStudyStore } from '@/entities/study'
import { srsService } from '../lib/SrsService'
import { trainingController } from '../lib/TrainingController'

const { t } = useI18n()
const trainingStore = useReplyTrainingStore()
const studyStore = useStudyStore()
const dialog = useDialog()

onMounted(() => {
  trainingStore.resetSession()
  trainingController.checkOpponentReply()
})

onUnmounted(() => {
  // Logic moved to store-level permissions
})

const activeChapter = computed(() => studyStore.activeChapter)

// Reactivity trigger for progress update when variant ends
const chapterCleanliness = computed(() => {
  // We trigger re-eval whenever a variant ends (variantsPlayed changes)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _trigger = trainingStore.sessionStats.variantsPlayed
  if (!activeChapter.value) return 0
  return srsService.getChapterCleanliness(activeChapter.value.root)
})

const getProgressBarColor = (progress: number): string => {
  if (progress < 0.3) return 'var(--neon-red)'
  if (progress < 0.7) return 'var(--neon-yellow)'
  return 'var(--neon-cyan)'
}

const confirmExit = (onConfirm: () => void) => {
  dialog.warning({
    title: t('features.study.replyTraining.session.exitDialog.title'),
    content: t('features.study.replyTraining.session.exitDialog.content'),
    positiveText: t('features.study.replyTraining.session.exitDialog.confirm'),
    negativeText: t('features.study.replyTraining.session.exitDialog.cancel'),
    onPositiveClick: () => {
      trainingStore.isReplyTrainingActive = false
      trainingStore.trainingChapterId = null
      onConfirm()
    },
  })
}

const handleExitClick = () => {
  confirmExit(() => {})
}

// Warn on tab close
window.addEventListener('beforeunload', (e) => {
  if (trainingStore.isReplyTrainingActive) {
    e.preventDefault()
    e.returnValue = ''
  }
})

// Warn on route leave
onBeforeRouteLeave((to, from, next) => {
  if (trainingStore.isReplyTrainingActive) {
    confirmExit(() => next())
  } else {
    next()
  }
})
</script>

<template>
  <div class="reply-session-window">
    <div class="session-header">
      <NText strong class="session-title">{{ t('features.study.replyTraining.title') }}</NText>
      <div v-if="activeChapter" class="chapter-name">{{ activeChapter.name }}</div>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <NText depth="3" class="stat-label">{{
          t('features.study.replyTraining.session.gardenCleanliness')
        }}</NText>
        <div class="progress-wrapper">
          <NProgress
            type="line"
            :percentage="Math.round(chapterCleanliness * 100)"
            :color="getProgressBarColor(chapterCleanliness)"
            :indicator-text-color="getProgressBarColor(chapterCleanliness)"
          />
        </div>
      </div>

      <div class="stat-card">
        <NText depth="3" class="stat-label">{{
          t('features.study.replyTraining.session.sessionTotal')
        }}</NText>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.variantsPlayed') }}</span>
          <span class="stat-value">{{ trainingStore.sessionStats.variantsPlayed }}</span>
        </div>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.variantsSolved') }}</span>
          <span class="stat-value">{{ trainingStore.sessionStats.variantsSolved }}</span>
        </div>
      </div>

      <div class="stat-card">
        <NText depth="3" class="stat-label">{{
          t('features.study.replyTraining.session.currentVariant')
        }}</NText>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.errors') }}</span>
          <span class="stat-value error-val">{{ trainingStore.variantStats.wrong }}</span>
        </div>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.accuracy') }}</span>
          <span class="stat-value">{{ trainingStore.variantAccuracy }}%</span>
        </div>
      </div>
    </div>

    <div class="session-actions">
      <NButton type="error" ghost block @click="handleExitClick">
        {{ t('features.study.replyTraining.session.exitButton') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.reply-session-window {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--color-bg-secondary);
  border-radius: var(--panel-border-radius);
  padding: 16px;
  box-sizing: border-box;
}

.session-header {
  margin-bottom: 24px;
  text-align: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.session-title {
  font-size: 1.1rem;
  color: var(--neon-cyan);
  letter-spacing: 1px;
}

.chapter-name {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--color-text-primary);
  font-weight: 500;
  word-break: break-word;
}

.stats-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-card {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--color-border-hover);
}

.stat-label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: bold;
  font-family: monospace;
}

.error-val {
  color: var(--neon-red);
}

.progress-wrapper {
  margin-top: 8px;
}

.session-actions {
  margin-top: auto;
  padding-top: 20px;
}
</style>
