<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { PgnMoveHistory, useBoardStore } from '@/entities/game'
import { EngineEvaluationHeader, useAnalysisStore } from '@/features/analysis'

const analysisStore = useAnalysisStore()
const boardStore = useBoardStore()

onMounted(async () => {
  await analysisStore.initialize()
  await analysisStore.startNewGame()
  if (boardStore.fen) {
    await analysisStore.startAnalysis(boardStore.fen)
  }
})

onUnmounted(() => {
  void analysisStore.stopAnalysis()
})
</script>

<template>
  <div
    class="flex h-full min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden rounded-md border border-border bg-surface p-2"
  >
    <!-- 1. Engine Evaluation Header (Stockfish lines & eval) -->
    <div class="shrink-0">
      <EngineEvaluationHeader />
    </div>

    <!-- 2. PGN Move History (Partieverlauf) -->
    <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PgnMoveHistory class="h-full" />
    </div>
  </div>
</template>
