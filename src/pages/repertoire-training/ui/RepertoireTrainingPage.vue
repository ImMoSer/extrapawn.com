<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useDialog, NText } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { GameLayout } from '@/widgets/game-layout'
import {
  StudyImportCard,
  TrainingStatsPanel,
  useRepertoireTrainingStore
} from '@/features/repertoire-training'
import { useGameStore, PgnTree } from '@/entities/game'

const { t } = useI18n()
const trainingStore = useRepertoireTrainingStore()
const gameStore = useGameStore()
const dialog = useDialog()

onMounted(() => {
  trainingStore.resetSession()
})

onUnmounted(() => {
  gameStore.stop()
})

const isTrainingActive = computed(() => trainingStore.isTrainingActive)

const confirmExit = (onConfirm: () => void) => {
  dialog.warning({
    title: t('features.study.replyTraining.session.exitDialog.title'),
    content: t('features.study.replyTraining.session.exitDialog.content'),
    positiveText: t('features.study.replyTraining.session.exitDialog.confirm'),
    negativeText: t('features.study.replyTraining.session.exitDialog.cancel'),
    onPositiveClick: () => {
      trainingStore.isTrainingActive = false
      trainingStore.trainingChapterId = null
      gameStore.stop()
      onConfirm()
    },
  })
}

// Tab unload warning
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (trainingStore.isTrainingActive) {
    e.preventDefault()
    e.returnValue = ''
  }
}

window.addEventListener('beforeunload', handleBeforeUnload)

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// Route change warning
onBeforeRouteLeave((to, from, next) => {
  if (trainingStore.isTrainingActive) {
    confirmExit(() => next())
  } else {
    next()
  }
})
</script>

<template>
  <GameLayout :board-locked="!isTrainingActive">
    <template #left-panel>
      <TrainingStatsPanel v-if="isTrainingActive" />
      <StudyImportCard v-else />
    </template>

    <template #top-info>
      <div class="active-mode-tag">
        <NText strong class="mode-label">
          {{
            isTrainingActive
              ? t('features.study.replyTraining.status.training')
              : t('features.study.replyTraining.status.idle')
          }}
        </NText>
      </div>
    </template>

    <template #right-panel>
      <div v-if="isTrainingActive" class="active-tree-panel">
        <PgnTree :read-only="true" />
      </div>
      <div v-else class="intro-sidebar">
        <div class="intro-card">
          <NText strong class="intro-title">
            {{ t('features.study.replyTraining.intro.title') }}
          </NText>
          <p class="intro-desc">
            {{ t('features.study.replyTraining.intro.desc1') }}
          </p>
          <div class="steps-list">
            <div class="step-item">
              <span class="step-num">1</span>
              <span>{{ t('features.study.replyTraining.intro.step1') }}</span>
            </div>
            <div class="step-item">
              <span class="step-num">2</span>
              <span>{{ t('features.study.replyTraining.intro.step2') }}</span>
            </div>
            <div class="step-item">
              <span class="step-num">3</span>
              <span>{{ t('features.study.replyTraining.intro.step3') }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.active-tree-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.lock-card {
  text-align: center;
  background: rgba(0, 0, 0, 0.2);
  border: 1px dashed var(--color-border);
}

.active-mode-tag {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.mode-label {
  font-size: 0.95rem;
  color: var(--neon-cyan, #1890ff);
}

.intro-sidebar {
  padding: 24px 16px;
  height: 100%;
  box-sizing: border-box;
}

.intro-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intro-title {
  font-size: 1.2rem;
  color: var(--neon-cyan, #1890ff);
}

.intro-desc {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--color-text-secondary, #cccccc);
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  color: var(--color-text-primary, #ffffff);
}

.step-num {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--neon-cyan, #1890ff);
  color: #000000;
  font-weight: bold;
  font-size: 0.8rem;
  flex-shrink: 0;
}
</style>
