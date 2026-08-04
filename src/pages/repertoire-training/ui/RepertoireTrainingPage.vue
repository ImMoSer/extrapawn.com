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
import { useGameStore } from '@/entities/game'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'

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
      <div class="flex items-center justify-center h-full uppercase tracking-wider">
        <NText strong class="text-sm text-neon-cyan font-display">
          {{
            isTrainingActive
               ? t('features.study.replyTraining.status.training')
               : t('features.study.replyTraining.status.idle')
          }}
        </NText>
      </div>
    </template>

    <template #right-panel>
      <CoachSidebarWidget />
    </template>
  </GameLayout>
</template>
