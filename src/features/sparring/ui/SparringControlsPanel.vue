<script setup lang="ts">
import { RefreshOutline, SwapVerticalOutline } from '@vicons/ionicons5';
import { NButton, NIcon, NInput, NSpace, NText, NTooltip } from 'naive-ui';
import { useSparringStore } from '../model/sparring.store';

const sparringStore = useSparringStore()
</script>

<template>
  <div class="sparring-controls-panel">
    <div class="panel-left">
      <span class="mode-badge">SPARRING</span>
      <n-text class="mode-description">Gegen Maia trainieren & Eröffnungen lernen</n-text>
    </div>

    <div class="panel-right">
      <n-space :size="12" align="center">
        <!-- Flip Board Button -->
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button
              circle
              secondary
              size="medium"
              @click="sparringStore.handleFlip"
              class="control-btn flip-btn"
            >
              <template #icon>
                <n-icon><SwapVerticalOutline /></n-icon>
              </template>
            </n-button>
          </template>
          Brett drehen (Farbe wechseln)
        </n-tooltip>

        <!-- Restart Button -->
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button
              circle
              secondary
              size="medium"
              @click="sparringStore.restartGame"
              class="control-btn restart-btn"
            >
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
            </n-button>
          </template>
          Spiel neu starten
        </n-tooltip>

        <!-- FEN Input and Load -->
        <div class="fen-input-wrapper">
          <n-input
            v-model:value="sparringStore.localFen"
            placeholder="FEN eingeben"
            size="medium"
            class="fen-input"
            @keyup.enter="sparringStore.applyFen(sparringStore.localFen)"
          />
          <n-button
            type="primary"
            secondary
            size="medium"
            class="load-btn"
            @click="sparringStore.applyFen(sparringStore.localFen)"
          >
            Laden
          </n-button>
        </div>
      </n-space>
    </div>
  </div>
</template>

<style scoped>
.sparring-controls-panel {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
}

.panel-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mode-badge {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(123, 44, 191, 0.15);
  color: #9d4edd;
  border: 1px solid rgba(123, 44, 191, 0.3);
  letter-spacing: 1px;
}

.mode-description {
  color: var(--color-text-muted, #71717a);
  font-size: 0.9rem;
  font-weight: 500;
}

.panel-right {
  display: flex;
  align-items: center;
}

.control-btn {
  background-color: rgba(255, 255, 255, 0.03) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  color: #d4d4d8 !important;
  transition: all 0.3s ease;
}

.control-btn:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: #fff !important;
}

.fen-input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fen-input {
  width: 260px;
}

.load-btn {
  font-weight: 600;
}
</style>
