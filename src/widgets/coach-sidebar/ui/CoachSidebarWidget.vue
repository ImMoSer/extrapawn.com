<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { AnalysisPanel, useCoachStore } from '@/features/coach'
import { NButton } from 'naive-ui'

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
    <div v-if="coachStore.isDecisionRequired" class="decision-banner p-3 bg-warning/15 border-b-2 border-warning rounded-md mb-2 flex flex-col gap-2 shadow-md shrink-0">
      <div class="decision-title font-bold text-warning text-sm flex items-center gap-2">
        ⚠️ {{ coachStore.pendingMove?.quality?.toUpperCase() || 'PATZER DETEKTIRT' }}!
      </div>
      <div class="decision-desc text-xs text-text-secondary">
        {{ coachStore.pendingMove?.summary || 'Überleg noch mal, dieser Zug hat ein hohes Verlustrisiko.' }}
      </div>
      <div class="decision-actions flex gap-2 mt-1">
        <NButton size="small" type="warning" class="flex-1 font-bold" @click="coachStore.acceptTakeback()">
          ↩️ Zug zurücknehmen (B1)
        </NButton>
        <NButton size="small" secondary type="default" class="flex-1" @click="coachStore.insistUserMove()">
          ▶ Trotzdem spielen (B2)
        </NButton>
      </div>
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
      />
    </div>
  </div>
</template>
