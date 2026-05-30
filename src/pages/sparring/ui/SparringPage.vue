<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebar } from '@/features/coach'
import { useBoardStore } from '@/entities/game'
import { useSparringStore } from '@/features/play-coach'
import SparringSidebar from './SparringSidebar.vue'

const boardStore = useBoardStore()
const sparringStore = useSparringStore()

watch(() => boardStore.fen, (newFen) => {
  sparringStore.localFen = newFen
})

onMounted(() => {
  sparringStore.initialize()
})

onUnmounted(() => {
  sparringStore.terminate()
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <SparringSidebar />
    </template>

    <template #top-info>
      <div class="sparring-top-panel">
        <span class="mode-badge">SPARRING</span>
        <span class="mode-description">Tritt gegen die Maia Engine an und lerne Eröffnungen aus dem Lichess Book.</span>
      </div>
    </template>

    <template #center-column>
      <!-- Placeholder for center column if needed -->
    </template>

    <template #right-panel>
      <CoachSidebar />
    </template>
  </GameLayout>
</template>

<style scoped>
.sparring-top-panel {
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
</style>
