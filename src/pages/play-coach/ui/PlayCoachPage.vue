<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { NInput, NButton, NIcon, NTooltip } from 'naive-ui'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebar, useCoachStore } from '@/features/coach'
import { useBoardStore, useGameStore } from '@/entities/game'
import { PlayCoachStrategy } from '@/features/play-coach'
import { SwapVerticalOutline } from '@vicons/ionicons5'
import PlayCoachSidebar from './PlayCoachSidebar.vue'

const coachStore = useCoachStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()

const localFen = ref(boardStore.fen)

watch(() => boardStore.fen, (newFen) => {
  localFen.value = newFen
})

function applyFen() {
  if (localFen.value) {
    gameStore.startWithStrategy(
      localFen.value,
      new PlayCoachStrategy(),
      boardStore.orientation,
      false
    )
  }
}

function handleFlip() {
  boardStore.flipBoard()
  if (boardStore.turn !== boardStore.orientation && gameStore.gamePhase === 'PLAYING') {
    gameStore.triggerBotMove()
  }
}

onMounted(() => {
  coachStore.setCoachEnabled(true)
  boardStore.orientation = 'white'
  
  gameStore.startWithStrategy(
    boardStore.fen,
    new PlayCoachStrategy(),
    boardStore.orientation,
    true
  )
})

onUnmounted(() => {
  gameStore.stop()
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
              @click="handleFlip"
              class="flip-btn"
            >
              <template #icon>
                <n-icon><SwapVerticalOutline /></n-icon>
              </template>
            </n-button>
          </template>
          Brett drehen (Farbe wechseln)
        </n-tooltip>

        <n-input
          v-model:value="localFen"
          placeholder="FEN eingeben (z.B. Eröffnungsposition)"
          size="medium"
          class="fen-input"
          @keyup.enter="applyFen"
        />
        <n-button type="primary" secondary @click="applyFen">
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

.flip-btn {
  transition: transform 0.3s ease;
}

.flip-btn:active {
  transform: scale(0.9) rotate(180deg);
}
</style>
