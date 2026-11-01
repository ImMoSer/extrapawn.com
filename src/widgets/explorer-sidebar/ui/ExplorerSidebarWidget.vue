<script setup lang="ts">
import { PgnMoveHistory } from '@/entities/game'
import { EngineEvaluationHeader } from '@/features/analysis'
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
