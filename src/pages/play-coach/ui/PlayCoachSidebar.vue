<script setup lang="ts">
import { NScrollbar, NText } from 'naive-ui'
import { LichessOpeningExplorer, PgnTree } from '@/features/play-coach'
import { pgnTreeVersion } from '@/shared/lib/pgn/PgnService'

// Component is now self-contained using OpeningExplorerStore
</script>

<template>
  <div class="play-coach-sidebar">
    <div class="sidebar-header">
      <n-text class="sidebar-title">Play Coach</n-text>
    </div>

    <div class="sidebar-content">
      <div class="active-game-section">
        <div class="coach-stats-section">
          <LichessOpeningExplorer :max-moves="10" />
        </div>

        <div class="pgn-section" style="margin-top: 20px">
          <n-text class="input-label" style="margin-bottom: 8px; display: block">Partieverlauf</n-text>
          <div class="pgn-container">
            <n-scrollbar style="max-height: 400px">
              <div class="pgn-content">
                <PgnTree :key="pgnTreeVersion" />
              </div>
            </n-scrollbar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.play-coach-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  background: var(--color-surface-2);
}

.sidebar-header {
  margin-bottom: 20px;
}

.sidebar-title {
  font-size: 1.2rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.active-game-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.coach-stats-section {
  flex: 1;
  min-height: 300px;
  display: flex;
  flex-direction: column;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-muted);
}

.pgn-container {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 12px;
}

.pgn-content {
  line-height: 1.5;
}
</style>
