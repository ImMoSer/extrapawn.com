<!-- src/pages/FinishHimView.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { useAnalysisStore } from '@/features/analysis'
import { useFinishHimStore } from '@/features/finish-him'
import { useSmartHintStore } from '@/features/smart-hint'
import { shareService } from '@/shared/lib/share.service'
import ChessboardPreview from '@/shared/ui/board-preview/ChessboardPreview.vue'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '@/entities/user'
import { AnalysisPanel } from '@/features/analysis'
import { CoachSidebar } from '@/features/coach'
import { SidebarLeaderboard } from '@/features/leaderboards'
import { ThemeRoseChart, UserProfileWidget } from '@/features/profile'
import { useActivePlanMatch } from '@/pages/user-cabinet/lib/composables/useActivePlanMatch'
import TrainingPlanWidget from '@/pages/user-cabinet/ui/TrainingPlanWidget.vue'
import { useDetailedStatsQuery } from '@/shared/api/queries/userCabinet.queries'
import { normalizeProfileStats } from '@/shared/lib/statsNormalizer'
import type { FinishHimDifficulty, GameLaunchOptions } from '@/shared/types/api.types'
import { ControlPanel, GameLayout, TopInfoPanel, useControlsStore } from '@/widgets/game-layout'

const finishHimStore = useFinishHimStore()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()
const smartHintStore = useSmartHintStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const { isTaskInActivePlan, activeTaskKey } = useActivePlanMatch(() => ({
  mode: 'FINISH_HIM',
  subMode: 'win',
  theme: finishHimStore.selectedTheme || '',
}))

const { data: detailedStatsData } = useDetailedStatsQuery()

const normalizedStats = computed(() => {
  const baseRating = authStore.userProfile?.base_puzzle_rating || 1000
  return normalizeProfileStats(detailedStatsData.value || null, baseRating)
})

const currentFinishHimThemes = computed(() => {
  if (!normalizedStats.value?.finish_him?.modes?.win) return []
  return normalizedStats.value.finish_him.modes.win[finishHimStore.selectedDifficulty] || []
})

const handleImprove = (options: GameLaunchOptions) => {
  if (options.mode === 'finish_him') {
    if (!options.subMode) {
      throw new Error('[FinishHimView] handleImprove was called without a subMode (difficulty)!')
    }

    finishHimStore.setParams(options.theme, options.difficulty as FinishHimDifficulty)
    finishHimStore.loadNewPuzzle()
  }
}

onMounted(() => {
  finishHimStore.initialize()
  const puzzleId = route.params.puzzleId as string | undefined
  const fen = route.params.fen as string | undefined
  const color = route.params.color as 'white' | 'black' | undefined

  if (fen && color) {
    finishHimStore.startPlayoutFromFen(fen.replace(/_/g, ' '), color)
  } else if (puzzleId) {
    finishHimStore.loadNewPuzzle(puzzleId)
  } else if (finishHimStore.selectedTheme) {
    finishHimStore.loadNewPuzzle()
  } else {
    // If accessed without parameters, redirect to selection
    router.push('/finish-him')
  }
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

watch(
  () => finishHimStore.activePuzzle,
  (newPuzzle) => {
    if (newPuzzle?.puzzle_id && route.params.puzzleId !== newPuzzle.puzzle_id) {
      if (route.name === 'finish-him-play' || route.name === 'finish-him-puzzle') {
        router.replace({ name: 'finish-him-puzzle', params: { puzzleId: newPuzzle.puzzle_id } })
      }
    }
    // Every time a new puzzle is loaded or restarted (if we handle restart carefully) we reset hints
    // Wait, activePuzzle might not change on restart. Let's just watch puzzle_id or gamePhase
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
      canRestart: gameStore.gamePhase === 'GAMEOVER' && !!finishHimStore.activePuzzle,
      canResign: isPlaying,
      canShare: !!finishHimStore.activePuzzle,
      canRequestHint: isPlaying,
      onRequestNew: () => finishHimStore.loadNewPuzzle(),
      onRestart: finishHimStore.handleRestart,
      onShare: () => {
        if (finishHimStore.activePuzzle?.puzzle_id) {
          shareService.share('finish-him', finishHimStore.activePuzzle.puzzle_id)
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
        <ThemeRoseChart
          v-if="normalizedStats && normalizedStats.finish_him"
          v-model:activeMode="finishHimStore.selectedDifficulty"
          mode="finish_him"
          subMode="win"
          :modes="['Novice', 'Pro', 'Master']"
          :themes="currentFinishHimThemes"
          :title="t('features.userCabinet.stats.modes.finishHim')"
          @improve="handleImprove"
        />
        <ChessboardPreview
          v-if="finishHimStore.fenFinal"
          :fen="finishHimStore.fenFinal"
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
          <CoachSidebar />
          <SidebarLeaderboard
            game-mode="finish_him"
            sub-mode="win"
            :theme="finishHimStore.selectedTheme || ''"
            :difficulty="finishHimStore.selectedDifficulty"
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
