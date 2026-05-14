<!-- src/pages/TheoryEndingView.vue -->
<script setup lang="ts">
import { useGameStore } from '@/entities/game'
import { useAnalysisStore } from '@/features/analysis'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import { useSmartHintStore } from '@/features/smart-hint'
import { shareService } from '@/shared/lib/share.service'
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { useI18n } from 'vue-i18n'

import type {
  TheoryEndingType,
  GameLaunchOptions,
  TheoryEndingDifficulty,
  TheoryEndingCategory,
} from '@/shared/types/api.types'

import { AnalysisPanel } from '@/features/analysis'
import { SidebarLeaderboard } from '@/features/leaderboards'
import { ThemeRoseChart, UserProfileWidget } from '@/features/profile'
import { CoachSidebar } from '@/features/coach'
import { useActivePlanMatch } from '@/pages/user-cabinet/lib/composables/useActivePlanMatch'
import TrainingPlanWidget from '@/pages/user-cabinet/ui/TrainingPlanWidget.vue'
import { ControlPanel, GameLayout, TopInfoPanel, useControlsStore } from '@/widgets/game-layout'
import { useDetailedStatsQuery } from '@/shared/api/queries/userCabinet.queries'
import { normalizeProfileStats } from '@/shared/lib/statsNormalizer'
import { useAuthStore } from '@/entities/user'

const { t } = useI18n()
const theoryStore = useTheoryEndingsStore()
const gameStore = useGameStore()
const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()
const smartHintStore = useSmartHintStore()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

const { isTaskInActivePlan, activeTaskKey } = useActivePlanMatch(() => ({
  mode: 'THEORY_ENDING',
  subMode: theoryStore.activeType || 'win',
  theme: theoryStore.activeCategory || '',
}))

const { data: detailedStatsData } = useDetailedStatsQuery()

const normalizedStats = computed(() => {
  const baseRating = authStore.userProfile?.base_puzzle_rating || 1000
  return normalizeProfileStats(detailedStatsData.value || null, baseRating)
})

const currentTheoryThemes = computed(() => {
  const diff = theoryStore.activeDifficulty || 'Novice'
  if (theoryStore.activeType === 'win') {
    if (!normalizedStats.value?.theory?.modes?.win) return []
    return normalizedStats.value.theory.modes.win[diff] || []
  } else {
    if (!normalizedStats.value?.theory?.modes?.draw) return []
    return normalizedStats.value.theory.modes.draw[diff] || []
  }
})

const currentTheoryMode = computed(() => {
  return 'theory' as const
})

const currentTheorySubMode = computed(() => {
  return theoryStore.activeType === 'win' ? 'win' : 'draw'
})

const currentTheoryTitle = computed(() => {
  return (
    t('features.userCabinet.stats.modes.theory') +
    (theoryStore.activeType === 'win' ? ' (Win)' : ' (Draw)')
  )
})

const handleImprove = (options: GameLaunchOptions) => {
  if (options.mode === 'theory') {
    if (!options.theme || !options.difficulty) {
      throw new Error('[TheoryEndingView] handleImprove was called with missing options!')
    }
    const targetType = options.subMode === 'win' ? 'win' : 'draw'
    theoryStore.setParams(
      targetType as TheoryEndingType,
      options.difficulty as TheoryEndingDifficulty,
      options.theme as TheoryEndingCategory,
    )
    theoryStore.loadNewPuzzle(targetType as TheoryEndingType)
  }
}

onMounted(() => {
  const type = route.params.type as TheoryEndingType
  const puzzleId = route.params.puzzleId as string

  if (!type && !theoryStore.activeType) {
    router.push('/theory-endings')
    return
  }
  theoryStore.loadNewPuzzle(type, puzzleId)
})

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

watch(
  () => gameStore.gamePhase,
  (phase) => {
    if (phase === 'LOADING') {
      smartHintStore.resetHints(3)
    }
  },
)

watch(
  () => theoryStore.activePuzzle,
  (newPuzzle) => {
    if (newPuzzle?.puzzle_id && route.params.puzzleId !== newPuzzle.puzzle_id) {
      if (route.name === 'theory-endings-play' || route.name === 'theory-endings-puzzle') {
        router.replace({
          name: 'theory-endings-puzzle',
          params: {
            type: theoryStore.activeType || 'win',
            puzzleId: newPuzzle.puzzle_id,
          },
        })
      }
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
    } else if (isLoading && analysisStore.isPanelVisible) {
      analysisStore.hidePanel()
    }

    controlsStore.setControls({
      canRequestNew: isGameOver || isIdle,
      canRestart: gameStore.gamePhase === 'GAMEOVER' && !!theoryStore.activePuzzle,
      canResign: isPlaying,
      canShare: !!theoryStore.activePuzzle,
      canRequestHint: isPlaying,
      onRequestNew: () => {
        if (route.params.puzzleId) {
          router.push({ name: 'theory-endings-play' })
        } else {
          theoryStore.loadNewPuzzle()
        }
      },
      onRestart: theoryStore.handleRestart,
      onShare: async () => {
        if (theoryStore.activePuzzle && theoryStore.activeType) {
          await shareService.share('theory-endings', theoryStore.activePuzzle.puzzle_id, {
            theoryType: theoryStore.activeType,
          })
        }
      },
    })
  },
  { immediate: true, deep: true },
)

watch(
  () => route.params.puzzleId,
  (newId, oldId) => {
    if (oldId && !newId) {
      theoryStore.loadNewPuzzle()
    }
  },
)
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <div class="left-panel-content-wrapper">
        <UserProfileWidget />
        <ThemeRoseChart
          v-if="normalizedStats && normalizedStats.theory"
          :activeMode="theoryStore.activeDifficulty || 'Novice'"
          :mode="currentTheoryMode"
          :subMode="currentTheorySubMode"
          :themes="currentTheoryThemes"
          :title="currentTheoryTitle"
          @improve="handleImprove"
        />
      </div>
    </template>

    <template #top-info>
      <TopInfoPanel />
    </template>

    <template #center-column>
      <!-- Custom overlay for type/difficulty if needed -->
    </template>

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
            game-mode="theory"
            :sub-mode="theoryStore.activeType || 'win'"
            :theme="theoryStore.activeCategory || ''"
            :difficulty="theoryStore.activeDifficulty || 'Novice'"
          />
        </template>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.left-panel-content-wrapper,
.right-panel-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  overflow-y: auto;
}
</style>
