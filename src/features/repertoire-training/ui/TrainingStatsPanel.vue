<script setup lang="ts">
import { computed } from 'vue'
import { NButton, NProgress, NText, useDialog } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useRepertoireTrainingStore } from '../model/repertoire-training.store'
import { useStudyStore } from '@/entities/study'
import { srsService } from '../lib/SrsService'
import { useGameStore } from '@/entities/game'

const { t } = useI18n()
const trainingStore = useRepertoireTrainingStore()
const studyStore = useStudyStore()
const dialog = useDialog()
const gameStore = useGameStore()

const activeChapter = computed(() => studyStore.activeChapter)

// Calculate cleanliness, triggered whenever a variant ends (variantsPlayed increments)
const chapterCleanliness = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _trigger = trainingStore.sessionStats.variantsPlayed
  if (!activeChapter.value?.root) return 0
  return srsService.getChapterCleanliness(activeChapter.value.root)
})

const totalVariantsCount = computed(() => {
  if (!activeChapter.value?.root) return 0
  return srsService.getLeafNodes(activeChapter.value.root).length
})

const getProgressBarColor = (progress: number): string => {
  if (progress < 0.3) return '#ff4d4f' // Neon red equivalent
  if (progress < 0.7) return '#faad14' // Neon yellow equivalent
  return '#1890ff' // Neon blue/cyan equivalent
}

const handleExitClick = () => {
  dialog.warning({
    title: t('features.study.replyTraining.session.exitDialog.title'),
    content: t('features.study.replyTraining.session.exitDialog.content'),
    positiveText: t('features.study.replyTraining.session.exitDialog.confirm'),
    negativeText: t('features.study.replyTraining.session.exitDialog.cancel'),
    onPositiveClick: () => {
      trainingStore.isTrainingActive = false
      trainingStore.trainingChapterId = null
      gameStore.stop()
    },
  })
}
</script>

<template>
  <div class="reply-session-window">
    <div class="session-header">
      <NText strong class="session-title">{{ t('features.study.replyTraining.title') }}</NText>
      <div v-if="activeChapter" class="chapter-name">{{ activeChapter.name }}</div>
    </div>

    <div class="stats-section">
      <div class="stat-card">
        <NText depth="3" class="stat-label">
          {{ t('features.study.replyTraining.session.gardenCleanliness') }}
        </NText>
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
        <NText depth="3" class="stat-label">
          {{ t('features.study.replyTraining.session.sessionTotal') }}
        </NText>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.variantsPlayed') }}</span>
          <span class="stat-value">
            {{ trainingStore.sessionStats.variantsPlayed }} / {{ totalVariantsCount }}
          </span>
        </div>
        <div class="stat-row">
          <span>{{ t('features.study.replyTraining.session.variantsSolved') }}</span>
          <span class="stat-value">{{ trainingStore.sessionStats.variantsSolved }}</span>
        </div>
      </div>

      <div class="stat-card">
        <NText depth="3" class="stat-label">
          {{ t('features.study.replyTraining.session.currentVariant') }}
        </NText>
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
  color: var(--neon-cyan, #1890ff);
  letter-spacing: 1px;
}

.chapter-name {
  margin-top: 8px;
  font-size: 0.9rem;
  color: var(--color-text-primary, #ffffff);
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
  border: 1px solid var(--color-border-hover, rgba(255, 255, 255, 0.09));
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
  color: var(--color-text-secondary, #cccccc);
}

.stat-value {
  font-weight: bold;
  font-family: monospace;
  color: var(--color-text-primary, #ffffff);
}

.error-val {
  color: var(--neon-red, #ff4d4f);
}

.progress-wrapper {
  margin-top: 8px;
}

.session-actions {
  margin-top: auto;
  padding-top: 20px;
}
</style>
