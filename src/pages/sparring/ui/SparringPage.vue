<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { MozerExplorerWidget } from '@/widgets/mozer-explorer'
import { useBoardStore } from '@/entities/game'
import { useSparringStore, SparringControlsPanel } from '@/features/sparring'
import { useCoachStore } from '@/features/coach'
import { useAnalysisStore } from '@/features/analysis'

const boardStore = useBoardStore()
const sparringStore = useSparringStore()
const coachStore = useCoachStore()
const analysisStore = useAnalysisStore()

watch(() => boardStore.fen, (newFen) => {
  sparringStore.localFen = newFen
})

onMounted(() => {
  sparringStore.initialize()
  coachStore.setCoachEnabled(true)
})

onUnmounted(async () => {
  sparringStore.terminate()
  await analysisStore.hidePanel()
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <MozerExplorerWidget />
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

<style scoped lang="scss">

</style>
