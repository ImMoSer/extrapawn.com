<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { AnalysisPanel, useCoachStore } from '@/features/coach'
import { MozerBook, WikiBooksPanel } from '@/features/mozer-book'
import { EngineEvaluationHeader } from '@/features/analysis'
import { NButton } from 'naive-ui'
import { useTaskTodayStore } from '@/features/task-today'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    boardHeight?: number
  }>(),
  {
    boardHeight: 600,
  }
)


const { t } = useI18n()
const taskTodayStore = useTaskTodayStore()
const coachStore = useCoachStore()

onMounted(() => {
  coachStore.setCoachEnabled(true)
})

onUnmounted(() => {
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <div class="coach-widget-container flex flex-col h-full w-full flex-1">
    <div v-if="taskTodayStore.isHelpActive" class="help-done-header p-2 bg-warning/10 border-b border-warning/20 mb-2">
      <NButton block type="warning" class="done-btn font-bold" @click="taskTodayStore.stopHelpMode()">
        {{ t('features.taskToday.helpDone') }}
      </NButton>
    </div>
    <div class="sidebar-inner flex-1 min-h-0 w-full flex flex-col">

      <AnalysisPanel
        :boardHeight="boardHeight"
        :engineLoading="!coachStore.stockfishReady || !coachStore.wasmReady"
        :showLoadingBanner="coachStore.showLoadingBanner"
        :stockfishReady="coachStore.stockfishReady"
        :wasmReady="coachStore.wasmReady"
        :historyIndex="coachStore.historyIndex"
        :moveHistory="coachStore.moveHistory"
        :sideToMove="coachStore.sideToMove"
        :phase="coachStore.phase"
        :materialDelta="coachStore.materialDelta"
        :openingName="coachStore.openingName"
        :lastMoveAnalysis="coachStore.lastMoveAnalysis"
        :lastMoveConsequence="coachStore.lastMoveConsequence"
        :posExplanation="coachStore.activePosExplanation || coachStore.posExplanation"
        :topMoves="coachStore.topMoves"
        :topMovesLoading="coachStore.topMovesLoading"
        :selectedMoveIndex="coachStore.selectedMoveIndex"
        :explanation="coachStore.explanation"
        :explanationLoading="coachStore.explanationLoading"
        @settings-change="coachStore.handleSettingsChange"
        @select-history-move="coachStore.selectHistoryMove"
        @select-move="coachStore.selectMove"
      >
        <template #book>
          <MozerBook />
        </template>
        <template #wiki>
          <WikiBooksPanel />
        </template>
        <template #sf>
          <EngineEvaluationHeader />
        </template>
      </AnalysisPanel>
    </div>
  </div>
</template>
