<script setup lang="ts">
import EngineEvaluationHeader from './EngineEvaluationHeader.vue'
import PgnMoveHistory from './PgnMoveHistory.vue'
import ControlBottomBar from './ControlBottomBar.vue'
import { MozerBook } from '@/features/mozer-book'
</script>

<template>
  <div class="mozer-explorer-widget">
    <!-- Engine Status & Eval -->
    <EngineEvaluationHeader />

    <!-- Scrollable Explorer Panels -->
    <div class="explorer-content">
      <PgnMoveHistory />
      
      <div class="mozer-book-wrapper">
        <MozerBook />
      </div>
    </div>

    <!-- Navigation & Settings Bottom Bar -->
    <ControlBottomBar />
  </div>
</template>

<style scoped lang="scss">
.mozer-explorer-widget {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--glass-bg, #0b0d17);
  border-radius: var(--panel-border-radius, 12px);
  border: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-blur);
  overflow: hidden;
  box-shadow: 
    inset 0 0 20px rgba(255, 255, 255, 0.02),
    0 10px 40px rgba(0, 0, 0, 0.5);
}

.explorer-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.mozer-book-wrapper {
  padding: 4px 14px 14px;
  background: var(--bg-1);
}
</style>
