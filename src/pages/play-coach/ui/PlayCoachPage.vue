<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { NInput, NButton, NIcon, NTooltip } from 'naive-ui'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebar } from '@/features/coach'
import { useBoardStore } from '@/entities/game'
import { usePlayCoachStore } from '@/features/play-coach'
import { SwapVerticalOutline, RefreshOutline } from '@vicons/ionicons5'
import PlayCoachSidebar from './PlayCoachSidebar.vue'

const boardStore = useBoardStore()
const playCoachStore = usePlayCoachStore()

watch(() => boardStore.fen, (newFen) => {
  playCoachStore.localFen = newFen
})

onMounted(() => {
  playCoachStore.initialize()
})

onUnmounted(() => {
  playCoachStore.terminate()
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <PlayCoachSidebar />
    </template>

    <template #top-info>
      <div class="play-coach-top-panel">
        <span class="mode-badge">PLAY COACH</span>
        <span class="mode-description">Tritt gegen die Maia Engine an und lerne Eröffnungen aus dem Lichess Book.</span>
      </div>
    </template>

    <template #center-column>
      <!-- Placeholder for center column if needed -->
    </template>

    <template #controls>
      <div class="play-coach-controls">
        <n-tooltip trigger="hover">
          <template #trigger>
            <n-button 
              circle 
              secondary 
              size="medium" 
              @click="playCoachStore.handleFlip"
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
              @click="playCoachStore.restartGame"
              class="restart-btn"
            >
              <template #icon>
                <n-icon><RefreshOutline /></n-icon>
              </template>
            </n-button>
          </template>
          Spiel neu starten
        </n-tooltip>

        <n-input
          v-model:value="playCoachStore.localFen"
          placeholder="FEN eingeben (z.B. Eröffnungsposition)"
          size="medium"
          class="fen-input"
          @keyup.enter="playCoachStore.applyFen(playCoachStore.localFen)"
        />
        <n-button type="primary" secondary @click="playCoachStore.applyFen(playCoachStore.localFen)">
          Position laden
        </n-button>
      </div>
    </template>

    <template #right-panel>
      <CoachSidebar />
    </template>
  </GameLayout>
</template>

<style scoped>
.play-coach-top-panel {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 8px 16px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
}

.mode-badge {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 0.75rem;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(var(--color-accent-rgb), 0.15);
  color: var(--color-accent);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  letter-spacing: 1px;
}

.mode-description {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.play-coach-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  max-width: 700px;
  margin: 0 auto;
  padding: 12px;
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
