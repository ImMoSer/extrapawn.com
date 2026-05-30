<script setup lang="ts">
import { computed } from 'vue'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { useSparringStore } from '../model/sparring.store'
import { NInput, NButton, NIcon, NTooltip, NSpace } from 'naive-ui'
import { SwapVerticalOutline, RefreshOutline } from '@vicons/ionicons5'
import PgnTreeNode from './PgnTreeNode.vue'

const sparringStore = useSparringStore()

const rootNode = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getRootNode()
})
</script>

<template>
  <div class="pgn-tree-view">
    <div v-if="rootNode && rootNode.children.length > 0" class="tree-content">
      <PgnTreeNode :node="rootNode" :depth="0" />
    </div>
    <div v-else class="empty-pgn">
      Keine Züge vorhanden
    </div>

    <div class="sparring-controls">
      <n-space vertical :size="12">
        <n-space justify="center" :size="12">
          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                circle
                secondary
                size="medium"
                @click="sparringStore.handleFlip"
                class="flip-btn"
              >
                <template #icon>
                  <n-icon><SwapVerticalOutline /></n-icon>
                </template>
              </n-button>
            </template>
            Brett drehen (Farbe wechseln)
          </n-tooltip>

          <n-tooltip trigger="hover">
            <template #trigger>
              <n-button
                circle
                secondary
                size="medium"
                @click="sparringStore.restartGame"
                class="restart-btn"
              >
                <template #icon>
                  <n-icon><RefreshOutline /></n-icon>
                </template>
              </n-button>
            </template>
            Spiel neu starten
          </n-tooltip>
        </n-space>

        <n-space :wrap="false" align="center">
          <n-input
            v-model:value="sparringStore.localFen"
            placeholder="FEN eingeben"
            size="small"
            class="fen-input"
            @keyup.enter="sparringStore.applyFen(sparringStore.localFen)"
          />
          <n-button
            type="primary"
            secondary
            size="small"
            @click="sparringStore.applyFen(sparringStore.localFen)"
          >
            Laden
          </n-button>
        </n-space>
      </n-space>
    </div>
  </div>
</template>

<style scoped>
.pgn-tree-view {
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.6;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  text-align: left;
}

.tree-content {
  padding: 4px;
}

.empty-pgn {
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
  font-size: 0.9rem;
}

.sparring-controls {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.fen-input {
  flex: 1;
}

.flip-btn,
.restart-btn {
  transition: transform 0.3s ease;
}

.flip-btn:active {
  transform: scale(0.9) rotate(180deg);
}

.restart-btn:active {
  transform: scale(0.9) rotate(-90deg);
}
</style>
