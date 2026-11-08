<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { PgnMoveHistory, useBoardStore } from '@/entities/game'
import { EngineEvaluationHeader, useAnalysisStore } from '@/features/analysis'

const analysisStore = useAnalysisStore()
const boardStore = useBoardStore()

let isMounted = true

async function initAndStartAnalysis(): Promise<void> {
  try {
    await analysisStore.initialize()
    if (!isMounted) return
    await analysisStore.startNewGame()
    if (!isMounted) return
    if (boardStore.fen) {
      await analysisStore.startAnalysis(boardStore.fen)
    }
  } catch {
    // Error state is handled and displayed via analysisStore.engineLoadingState
  }
}

onMounted(() => {
  isMounted = true
  void initAndStartAnalysis()
})

onUnmounted(() => {
  isMounted = false
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
