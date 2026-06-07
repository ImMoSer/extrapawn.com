<script setup lang="ts">
import { useGameStore, useBoardStore } from '@/entities/game'
import { NButtonGroup, NButton, NIcon } from 'naive-ui'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const gameStore = useGameStore()
const boardStore = useBoardStore()
</script>

<template>
  <div class="control-bottom-bar">
    <div class="control-row">
      <!-- Navigation controls -->
      <n-button-group class="nav-group">
        <n-button quaternary circle @click="gameStore.navigatePgn('start')" title="Start der Partie">
          <template #icon><n-icon><PlaySkipBackOutline /></n-icon></template>
        </n-button>
        <n-button quaternary circle @click="gameStore.navigatePgn('backward')" title="Zug zurück">
          <template #icon><n-icon><ChevronBackOutline /></n-icon></template>
        </n-button>
        <n-button quaternary circle @click="gameStore.navigatePgn('forward')" title="Zug vorwärts">
          <template #icon><n-icon><ChevronForwardOutline /></n-icon></template>
        </n-button>
        <n-button quaternary circle @click="gameStore.navigatePgn('end')" title="Ende der Partie">
          <template #icon><n-icon><PlaySkipForwardOutline /></n-icon></template>
        </n-button>
      </n-button-group>

      <!-- Board utilities (Flip board) -->
      <n-button quaternary circle class="flip-btn" @click="boardStore.flipBoard()" title="Brett drehen">
        <template #icon>
          <n-icon><SwapVerticalOutline /></n-icon>
        </template>
      </n-button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.control-bottom-bar {
  padding: 10px 14px 14px;
  background: var(--bg-1);
  border-top: 1px solid var(--glass-border);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
}

.nav-group {
  flex: 1;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 2px;
}

.nav-group .n-button {
  flex: 1;
  border-radius: 6px;
  color: var(--text-secondary);

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
  }
}

.flip-btn {
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  padding: 6px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.15);
  }
}
</style>
