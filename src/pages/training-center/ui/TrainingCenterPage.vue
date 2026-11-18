<script setup lang="ts">
import {
  EndgameAutomatOverlay,
  TrainingHubDashboard,
  TrainingPlayTopInfo,
  TrainingSessionReport,
  TrainingSessionSidebar,
  useTrainingSessionStore,
} from '@/features/training-session'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import { onUnmounted, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    mode?: 'course' | 'warmup'
  }>(),
  {
    mode: 'course',
  },
)

const store = useTrainingSessionStore()

watch(
  () => props.mode,
  () => {
    if (store.viewState !== 'hub') {
      store.pauseToHub()
    }
  },
)

onUnmounted(() => {
  if (store.isBoardSessionActive) {
    store.pauseToHub()
  }
})
</script>

<template>
  <TrainingHubDashboard v-if="store.viewState === 'hub'" :mode="props.mode" />
  <TrainingSessionReport v-else-if="store.viewState === 'report'" />
  <GameLayout v-else :board-locked="store.isAutomatLocked">
    <template #left-panel>
      <TrainingSessionSidebar />
    </template>
    <template #top-info>
      <TrainingPlayTopInfo />
    </template>
    <template #center-column>
      <EndgameAutomatOverlay />
    </template>
    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>

