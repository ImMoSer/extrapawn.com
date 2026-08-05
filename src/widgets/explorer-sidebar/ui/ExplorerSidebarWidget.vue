<script setup lang="ts">
import { MozerBook } from '@/features/mozer-book'
import { EngineEvaluationHeader } from '@/features/analysis'
import { PgnMoveHistory } from '@/features/coach'
</script>

<template>
  <div class="explorer-widget-container flex flex-col h-full w-full flex-1 p-2 gap-2 overflow-hidden bg-surface rounded-md border border-border">
    <!-- 1. Engine Evaluation Header (Stockfish lines & eval) -->
    <div class="shrink-0">
      <EngineEvaluationHeader />
    </div>

    <!-- 2. MozerBook Opening Explorer -->
    <div class="flex-1 min-h-[200px] overflow-hidden flex flex-col">
      <MozerBook />
    </div>

    <!-- 3. PGN Move History -->
    <div class="flex-1 min-h-[160px] overflow-hidden flex flex-col">
      <PgnMoveHistory class="h-full" />
    </div>
  </div>
</template>

<style scoped>
.explorer-widget-container {
  min-height: 0;
}
</style>
