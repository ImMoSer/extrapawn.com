<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import { useBoardStore } from '@/entities/game'
import { useSparringStore, SparringControlsPanel, NewGameModal } from '@/features/sparring'
import { useCoachStore } from '@/features/coach'

const route = useRoute()
const router = useRouter()
const boardStore = useBoardStore()
const sparringStore = useSparringStore()
const coachStore = useCoachStore()

watch(() => boardStore.fen, (newFen) => {
  sparringStore.localFen = newFen
})

watch(() => route.params.gameId, (newGameId) => {
  sparringStore.initializeFromRoute(newGameId as string | undefined, router)
})

onMounted(() => {
  sparringStore.initializeFromRoute(route.params.gameId as string | undefined, router)
  coachStore.setCoachEnabled(true)
})

onUnmounted(() => {
  sparringStore.terminate()
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <GameLayout hide-engine-selector>
    <template #top-info>
      <SparringControlsPanel />
    </template>

    <template #center-column>
      <!-- New Game Setup Modal -->
      <NewGameModal />
    </template>

    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>

<style scoped lang="scss">

</style>
