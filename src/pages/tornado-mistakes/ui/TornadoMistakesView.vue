<!-- src/pages/TornadoMistakesView.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import ChessboardPreview from '@/shared/ui/board-preview/ChessboardPreview.vue'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { GameLayout } from '@/widgets/game-layout'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRouter } from 'vue-router'

import { useTornadoMistakesStore } from '@/features/tornado'
import type { GamePuzzle } from '@/shared/types/api.types'

import {
  AnalyticsOutline,
  CheckmarkDoneOutline,
  ConstructOutline,
  ExitOutline,
  FileTrayOutline,
  InformationCircleOutline,
  PlayForwardOutline,
  RibbonOutline,
} from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NScrollbar,
  NSpace,
  NStatistic,
  NTag,
  NText,
} from 'naive-ui'

// --- STORES ---
const gameStore = useGameStore()
const boardStore = useBoardStore()
const analysisStore = useAnalysisStore()
const uiStore = useUiStore()
const mistakesStore = useTornadoMistakesStore()
const router = useRouter()
const { t } = useI18n()

// --- COMPUTED ---
const formattedThemes = computed(() => {
  if (!mistakesStore.selectedPuzzle) return []

  let themesList: string[] = []
  const selectedPuzzle = mistakesStore.selectedPuzzle

  if (selectedPuzzle.Themes_PG && Array.isArray(selectedPuzzle.Themes_PG)) {
    themesList = selectedPuzzle.Themes_PG
  } else if (selectedPuzzle.Themes) {
    themesList = selectedPuzzle.Themes.split(/[ ,]+/).filter(Boolean)
  } else if (selectedPuzzle.themes && Array.isArray(selectedPuzzle.themes)) {
    themesList = selectedPuzzle.themes
  }

  return themesList
})

// --- METHODS ---
function selectNextUnsolvedPuzzle() {
  mistakesStore.selectNextUnsolvedPuzzle()
}

function handleSelectPuzzle(puzzle: GamePuzzle) {
  if (analysisStore.isPanelVisible) {
    analysisStore.hidePanel()
  }
  mistakesStore.selectPuzzle(puzzle)
}

function showAnalysis() {
  if (mistakesStore.isAttemptMade) {
    analysisStore.showPanel(true)
  }
}

// --- LIFECYCLE & ROUTE GUARDS ---
onMounted(() => {
  const loaded = mistakesStore.loadMistakes()
  if (loaded && mistakesStore.mistakes.length > 0) {
    const firstMistake = mistakesStore.mistakes[0]
    if (firstMistake) {
      handleSelectPuzzle(firstMistake)
    }
  } else if (!loaded) {
    mistakesStore.feedbackMessage = t('features.tornado.mistakes.feedback.noMistakes')
  }
})

onBeforeRouteLeave(async (to, from, next) => {
  analysisStore.hidePanel()
  const userResponse = await uiStore.showConfirmation(
    t('features.tornado.mistakes.exit.title'),
    t('features.tornado.mistakes.exit.message'),
  )
  if (userResponse === 'confirm') {
    mistakesStore.clearMistakes()
    gameStore.resetGame()
    next()
  } else {
    next(false)
  }
})

async function handleExit() {
  router.push('/tornado')
}
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <n-card class="mistakes-glass-panel" :bordered="false" size="small">
        <template #header>
          <n-space align="center" justify="center" :size="8">
            <n-icon color="var(--neon-pink)">
              <FileTrayOutline />
            </n-icon>
            <n-text strong class="panel-title">{{ t('features.tornado.mistakes.title') }}</n-text>
          </n-space>
        </template>

        <n-scrollbar style="max-height: calc(100vh - 200px)">
          <div v-if="mistakesStore.mistakes.length > 0" class="mistakes-grid">
            <div
              v-for="puzzle in mistakesStore.mistakes"
              :key="puzzle.PuzzleId || puzzle.puzzle_id"
              class="mistake-item-wrapper"
              :class="{
                active: (puzzle.PuzzleId || puzzle.puzzle_id) === mistakesStore.selectedPuzzleId,
                solved: mistakesStore.solvedStatus[puzzle.PuzzleId || puzzle.puzzle_id || ''],
              }"
              @click="handleSelectPuzzle(puzzle)"
            >
              <ChessboardPreview
                :fen="puzzle.FEN_0 || puzzle.initial_fen || ''"
                orientation="white"
                class="mini-board"
              />
              <div
                class="status-badge"
                :class="
                  mistakesStore.solvedStatus[puzzle.PuzzleId || puzzle.puzzle_id || '']
                    ? 'solved'
                    : 'unsolved'
                "
              >
                <n-icon size="18">
                  <CheckmarkDoneOutline
                    v-if="mistakesStore.solvedStatus[puzzle.PuzzleId || puzzle.puzzle_id || '']"
                  />
                  <ConstructOutline v-else />
                </n-icon>
              </div>
            </div>
          </div>
          <n-empty
            v-else
            :description="t('features.tornado.mistakes.feedback.noMistakes')"
            class="empty-mistakes"
          >
            <template #icon>
              <n-icon>
                <RibbonOutline />
              </n-icon>
            </template>
          </n-empty>
        </n-scrollbar>
      </n-card>
    </template>

    <template #top-info>
      <div class="top-feedback-panel glass-header">
        <n-text strong class="feedback-text neon-pulse">
          {{ mistakesStore.feedbackMessage }}
        </n-text>
      </div>
    </template>

    <template #controls>
      <div class="controls-glass-panel">
        <n-grid :cols="3" :x-gap="12">
          <n-grid-item>
            <n-button
              type="success"
              block
              secondary
              strong
              size="large"
              :disabled="mistakesStore.mistakes.length <= 1 || mistakesStore.allMistakesSolved"
              @click="selectNextUnsolvedPuzzle"
              class="action-button glass-btn lime"
            >
              <template #icon>
                <n-icon><PlayForwardOutline /></n-icon>
              </template>
              {{ t('features.tornado.mistakes.ui.nextButton') }}
            </n-button>
          </n-grid-item>

          <n-grid-item>
            <n-button
              type="primary"
              block
              secondary
              strong
              size="large"
              :disabled="!mistakesStore.isAttemptMade"
              @click="showAnalysis"
              class="action-button glass-btn cyan"
            >
              <template #icon>
                <n-icon><AnalyticsOutline /></n-icon>
              </template>
              {{ t('features.tornado.mistakes.ui.analysisButton') }}
            </n-button>
          </n-grid-item>

          <n-grid-item>
            <n-button
              type="error"
              block
              secondary
              strong
              size="large"
              @click="handleExit"
              class="action-button glass-btn pink"
            >
              <template #icon>
                <n-icon><ExitOutline /></n-icon>
              </template>
              {{ t('features.tornado.mistakes.ui.restartButton') }}
            </n-button>
          </n-grid-item>
        </n-grid>
      </div>
    </template>

    <template #right-panel>
      <div class="controls-container">
        <n-card v-if="mistakesStore.selectedPuzzle" class="info-glass-card" :bordered="false">
          <n-space vertical :size="20">
            <!-- ID & Rating -->
            <n-grid :cols="2" x-gap="12">
              <n-grid-item>
                <n-statistic :label="t('features.tornado.mistakes.info.id')">
                  <template #prefix>
                    <n-icon color="var(--neon-cyan)">
                      <InformationCircleOutline />
                    </n-icon>
                  </template>
                  <span class="stat-value"
                    >#{{
                      mistakesStore.selectedPuzzle.PuzzleId ||
                      mistakesStore.selectedPuzzle.puzzle_id
                    }}</span
                  >
                </n-statistic>
              </n-grid-item>
              <n-grid-item>
                <n-statistic :label="t('features.tornado.mistakes.info.rating')">
                  <template #prefix>
                    <n-icon color="var(--neon-orange)">
                      <RibbonOutline />
                    </n-icon>
                  </template>
                  <span class="stat-value">{{
                    mistakesStore.selectedPuzzle.Rating ||
                    mistakesStore.selectedPuzzle.tactical_rating ||
                    mistakesStore.selectedPuzzle.rating
                  }}</span>
                </n-statistic>
              </n-grid-item>
            </n-grid>

            <!-- Themes -->
            <div class="themes-section">
              <n-text depth="3" strong class="section-label">
                {{ t('features.tornado.mistakes.info.theme') }}
              </n-text>
              <n-space :size="[8, 8]" class="themes-container">
                <n-tag
                  v-for="theme in formattedThemes"
                  :key="theme"
                  :bordered="false"
                  type="primary"
                  size="small"
                  round
                  class="theme-tag"
                >
                  {{ t(`chess.tactics.${theme}`) }}
                </n-tag>
                <n-text v-if="formattedThemes.length === 0" depth="3" italic>
                  {{ t('common.none') }}
                </n-text>
              </n-space>
            </div>
          </n-space>
        </n-card>

        <ChessboardPreview
          v-if="mistakesStore.fenFinal"
          :fen="mistakesStore.fenFinal"
          :orientation="boardStore.orientation"
          class="final-position-preview"
        />

        <AnalysisPanel v-if="analysisStore.isPanelVisible" class="analysis-panel-overlay" />
      </div>
    </template>
  </GameLayout>
</template>

<style scoped lang="scss">
.mistakes-glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--panel-border-radius);
  height: 100%;
}

.panel-title {
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 0.9rem;
  color: var(--color-text-default);
}

.mistakes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 4px;
}

.mistake-item-wrapper {
  position: relative;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(0, 0, 0, 0.2);
  width: 100%;

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(0, 229, 255, 0.3);
    box-shadow: 0 4px 12px rgba(0, 229, 255, 0.1);
  }

  &.active {
    border-color: var(--neon-cyan);
    box-shadow: 0 0 15px rgba(0, 229, 255, 0.3);
    transform: scale(1.02);
    z-index: 1;
  }

  &.solved {
    border-color: var(--neon-lime);
    opacity: 0.8;
  }
}

.mini-board {
  display: block;
  width: 100%;
}

.status-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(4px);
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;

  &.solved {
    background: rgba(0, 255, 85, 0.2);
    color: var(--neon-lime);
    border-color: rgba(0, 255, 85, 0.3);
  }

  &.unsolved {
    background: rgba(255, 0, 122, 0.2);
    color: var(--neon-pink);
    border-color: rgba(255, 0, 122, 0.3);
  }
}

.glass-header,
.controls-glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-border-radius);
  padding: 12px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.controls-glass-panel {
  height: 100%;
  padding: 0 20px;
}

.feedback-text {
  font-size: 1.2rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.neon-pulse {
  color: var(--neon-yellow);
  text-shadow: 0 0 8px rgba(255, 230, 0, 0.4);
}

.controls-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.info-glass-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border) !important;
  border-radius: var(--panel-border-radius);
}

.stat-value {
  font-family: 'Ubuntu', sans-serif;
  font-weight: 800;
  font-size: 1.2rem;
}

.section-label {
  display: block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 12px;
}

.themes-container {
  max-height: 120px;
  overflow-y: auto;
  padding-right: 4px;
}

.theme-tag {
  background: rgba(0, 229, 255, 0.1) !important;
  color: var(--neon-cyan) !important;
  border: 1px solid rgba(0, 229, 255, 0.2) !important;
  font-weight: 600;
}

.glass-btn {
  border: 1px solid transparent !important;
  transition: all 0.3s ease;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &.cyan {
    background: rgba(0, 229, 255, 0.1) !important;
    border-color: rgba(0, 229, 255, 0.2) !important;
    &:hover:not(:disabled) {
      background: rgba(0, 229, 255, 0.15) !important;
      box-shadow: 0 0 15px rgba(0, 229, 255, 0.2);
    }
  }

  &.lime {
    background: rgba(0, 255, 85, 0.1) !important;
    border-color: rgba(0, 255, 85, 0.2) !important;
    &:hover:not(:disabled) {
      background: rgba(0, 255, 85, 0.15) !important;
      box-shadow: 0 0 15px rgba(0, 255, 85, 0.2);
    }
  }

  &.pink {
    background: rgba(255, 0, 122, 0.1) !important;
    border-color: rgba(255, 0, 122, 0.2) !important;
    &:hover:not(:disabled) {
      background: rgba(255, 0, 122, 0.15) !important;
      box-shadow: 0 0 15px rgba(255, 0, 122, 0.2);
    }
  }
}

.empty-mistakes {
  padding: 40px 0;
}

.final-position-preview {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--glass-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

:deep(.n-statistic) {
  .n-statistic-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
  }
}
</style>
