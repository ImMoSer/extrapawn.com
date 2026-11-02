<script setup lang="ts">
import { isValidTrainingDiscipline, type TrainingDiscipline } from '@/entities/training'
import {
  ChallengeSidebar,
  ChallengeTopInfo,
  useChallengeStore,
} from '@/features/training-session'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import { AlertCircleOutline, RefreshOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NSpin } from 'naive-ui'
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const store = useChallengeStore()

const rawDiscipline = computed(() => String(route.params.discipline ?? '').trim())
const rawPuzzleId = computed(() => String(route.params.puzzleId ?? '').trim())
const rawEdition = computed(() => String(route.params.edition ?? '').trim())

const isBoardLocked = computed(() => {
  return store.viewState !== 'playing' && store.viewState !== 'analyzing'
})

async function initFromRoute(): Promise<void> {
  const disc = rawDiscipline.value
  const pid = rawPuzzleId.value
  const edition = rawEdition.value
  if (!isValidTrainingDiscipline(disc) || !pid) {
    store.viewState = 'error'
    store.error = t('features.trainingCenter.challenge.notFoundError')
    return
  }
  await store.loadChallenge(disc as TrainingDiscipline, pid, edition)
}

onMounted(() => {
  void initFromRoute()
})

watch([rawDiscipline, rawPuzzleId, rawEdition], () => {
  void initFromRoute()
})

onUnmounted(() => {
  store.stopChallenge()
})
</script>

<template>
  <!-- Loading State -->
  <div
    v-if="store.viewState === 'loading'"
    class="h-full w-full flex flex-col items-center justify-center gap-3 p-6 text-text-secondary"
  >
    <NSpin size="large" />
    <span class="font-display text-sm uppercase tracking-wider">
      {{ t('features.trainingCenter.challenge.loading') }}
    </span>
  </div>

  <!-- Error / Not Found State -->
  <div
    v-else-if="store.viewState === 'error'"
    class="h-full w-full flex flex-col items-center justify-center p-6"
  >
    <div
      class="max-w-md w-full p-6 rounded-lg bg-surface/90 border border-danger/40 flex flex-col items-center text-center gap-4"
    >
      <NIcon size="40" class="text-danger"><AlertCircleOutline /></NIcon>
      <div class="flex flex-col gap-1">
        <h2 class="font-display font-bold text-lg uppercase tracking-wider text-text-primary m-0">
          {{ t('features.trainingCenter.challenge.errorTitle') }}
        </h2>
        <p class="text-xs text-text-secondary m-0">
          {{ store.error || t('features.trainingCenter.challenge.notFoundError') }}
        </p>
      </div>
      <div class="flex items-center gap-2 pt-2">
        <NButton size="small" secondary @click="router.push('/training')">
          {{ t('features.trainingCenter.actions.backToHub') }}
        </NButton>
        <NButton size="small" type="primary" @click="initFromRoute()">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{ t('shared.buttons.retry') }}
        </NButton>
      </div>
    </div>
  </div>

  <!-- Challenge GameLayout -->
  <GameLayout
    v-else
    :hide-engine-selector="true"
    :board-locked="isBoardLocked"
  >
    <template #left-panel>
      <ChallengeSidebar />
    </template>
    <template #top-info>
      <ChallengeTopInfo />
    </template>
    <template #center-column>
      <!-- Board rendered by GameLayout -->
    </template>
    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>

