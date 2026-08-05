<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { AnalysisPanel, useCoachStore } from '@/features/coach'

withDefaults(
  defineProps<{
    boardHeight?: number
  }>(),
  {
    boardHeight: 600,
  }
)

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
    <div class="sidebar-inner flex-1 min-h-0 w-full flex flex-col">
      <AnalysisPanel
        :boardHeight="boardHeight"
        :sideToMove="coachStore.sideToMove"
        :phase="coachStore.phase"
        :materialDelta="coachStore.materialDelta"
        :openingName="coachStore.openingName"
        :lastMoveAnalysis="coachStore.lastMoveAnalysis"
        :lastMoveConsequence="coachStore.lastMoveConsequence"
        :posExplanation="coachStore.posExplanation"
        :topMoves="coachStore.topMoves"
        :topMovesLoading="coachStore.isAnalyzing"
        :selectedMoveIndex="coachStore.selectedMoveIndex"
        @settings-change="coachStore.handleSettingsChange"
        @select-move="coachStore.selectMove"
      />
    </div>
  </div>
</template>
