<!-- src/pages/FinishHimView.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { useAnalysisStore } from '@/features/analysis'
import { useEndgameStore } from '@/features/endgames'
import { useSmartHintStore } from '@/features/smart-hint'
import { shareService } from '@/shared/lib/share.service'
import ChessboardPreview from '@/shared/ui/board-preview/ChessboardPreview.vue'
import { onMounted, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { AnalysisPanel } from '@/features/analysis'
import { SidebarLeaderboard } from '@/features/leaderboards'
import { UserProfileWidget } from '@/features/profile'
import { useActivePlanMatch } from '@/pages/user-cabinet/lib/composables/useActivePlanMatch'
import TrainingPlanWidget from '@/pages/user-cabinet/ui/TrainingPlanWidget.vue'
import { ControlPanel, GameLayout, TopInfoPanel, useControlsStore } from '@/widgets/game-layout'

const endgameStore = useEndgameStore()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()
const smartHintStore = useSmartHintStore()
const route = useRoute()
const router = useRouter()

const { isTaskInActivePlan, activeTaskKey } = useActivePlanMatch(() => ({
  mode: 'FINISH_HIM',
  subMode: 'win',
  theme: endgameStore.activeParams.category || '',
}))

onMounted(() => {
  endgameStore.initialize()
  const puzzleId = route.params.puzzleId as string | undefined
  const fen = route.params.fen as string | undefined
  const color = route.params.color as 'white' | 'black' | undefined

  if (fen && color) {
    endgameStore.startPlayoutFromFen(fen.replace(/_/g, ' '), color)
  } else if (puzzleId) {
    endgameStore.loadNewPuzzle('finish_him', { puzzleId })
  } else if (endgameStore.activeParams.theme) {
    endgameStore.loadNewPuzzle('finish_him')
  } else {
    // If accessed without parameters, redirect to selection
    router.push('/finish-him')
  }
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

watch(
  () => endgameStore.activePuzzle,
  (newPuzzle) => {
    if (newPuzzle?.puzzle_id && route.params.puzzleId !== newPuzzle.puzzle_id) {
      if (route.name === 'finish-him-play' || route.name === 'finish-him-puzzle') {
        router.replace({ name: 'finish-him-puzzle', params: { puzzleId: newPuzzle.puzzle_id } })
      }
    }
  },
)

watch(
  () => gameStore.gamePhase,
  (phase) => {
    if (phase === 'LOADING') {
      smartHintStore.resetHints(3)
    }
  },
)

watch(
  () => [gameStore.gamePhase, gameStore.isGameActive],
  () => {
    const isGameOver = gameStore.gamePhase === 'GAMEOVER'
    const isIdle = gameStore.gamePhase === 'IDLE'
    const isPlaying = gameStore.gamePhase === 'PLAYING'
    const isLoading = gameStore.gamePhase === 'LOADING'

    if (isGameOver) {
      analysisStore.showPanel()
    } else if (isLoading || isPlaying) {
      if (analysisStore.isPanelVisible) {
        analysisStore.hidePanel()
      }
    }

    controlsStore.setControls({
      canRequestNew: isGameOver || isIdle,
      canRestart: gameStore.gamePhase === 'GAMEOVER' && !!endgameStore.activePuzzle,
      canResign: isPlaying,
      canShare: !!endgameStore.activePuzzle,
      canRequestHint: isPlaying,
      onRequestNew: () => endgameStore.loadNewPuzzle('finish_him'),
      onRestart: endgameStore.handleRestart,
      onShare: () => {
        if (endgameStore.activePuzzle?.puzzle_id) {
          shareService.share('finish-him', endgameStore.activePuzzle.puzzle_id)
        }
      },
    })
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <div class="left-panel-content-wrapper">
        <UserProfileWidget />
        <ChessboardPreview
          v-if="endgameStore.fenFinal"
          :fen="endgameStore.fenFinal"
          :orientation="boardStore.orientation"
          class="final-position-preview"
        />
      </div>
    </template>

    <template #top-info>
      <TopInfoPanel />
    </template>

    <template #center-column> </template>

    <template #controls>
      <ControlPanel />
    </template>

    <template #right-panel>
      <div class="right-panel-content-wrapper">
        <AnalysisPanel v-if="analysisStore.isPanelVisible" />
        <template v-if="isTaskInActivePlan">
          <TrainingPlanWidget compact :active-task-key="activeTaskKey" />
        </template>
        <template v-else>
          <SidebarLeaderboard
            game-mode="finish_him"
            sub-mode="win"
            :theme="endgameStore.activeParams.theme || ''"
            :difficulty="endgameStore.activeParams.difficulty || 'Novice'"
          />
        </template>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.right-panel-content-wrapper,
.left-panel-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.final-position-preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
</style>
