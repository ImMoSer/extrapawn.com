<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { useBoardStore } from '@/entities/game'
import { useSparringStore, SparringControlsPanel } from '@/features/sparring'
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
      <SparringControlsPanel />
    </template>

    <template #center-column>
      <!-- Placeholder for center column if needed -->
    </template>

    <template #right-panel>
      <CoachSidebarWidget />
    </template>
  </GameLayout>
</template>

<style scoped>

</style>
