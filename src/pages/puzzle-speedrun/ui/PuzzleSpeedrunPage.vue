<script setup lang="ts">
import { usePuzzleSpeedrunStore } from '../model/puzzleSpeedrun.store'
import { GameLayout } from '@/widgets/game-layout'
import { NButton, NIcon, NText, NProgress, NList, NListItem, NScrollbar, NThing } from 'naive-ui'
import { CloseCircleOutline, RefreshOutline as RestartIcon } from '@vicons/ionicons5'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { AnalysisPanel, useAnalysisStore } from '@/features/analysis'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const puzzleSpeedrunStore = usePuzzleSpeedrunStore()
const analysisStore = useAnalysisStore()
const router = useRouter()

onMounted(() => {
  if (!puzzleSpeedrunStore.isPlaying && !puzzleSpeedrunStore.isFinished) {
    puzzleSpeedrunStore.startSpeedrun()
  }
})

const formattedTime = computed(() => {
  return puzzleSpeedrunStore.formatMs(puzzleSpeedrunStore.currentTimeMs)
})

const progressPercentage = computed(() => {
  if (puzzleSpeedrunStore.totalPuzzles === 0) return 0
  return (puzzleSpeedrunStore.currentPuzzleIndex / puzzleSpeedrunStore.totalPuzzles) * 100
})

function handleQuit() {
  puzzleSpeedrunStore.quitSpeedrun()
  router.push('/')
}

function handleRestart() {
  puzzleSpeedrunStore.restartCurrentPuzzle()
}

function handleJump(index: number) {
  if (
    puzzleSpeedrunStore.puzzleTimes[index] === undefined ||
    puzzleSpeedrunStore.currentPuzzleIndex === index
  ) {
    puzzleSpeedrunStore.jumpToPuzzle(index)
  }
}

onBeforeRouteLeave(() => {
  analysisStore.hidePanel()
})

onUnmounted(() => {
  analysisStore.hidePanel()
  if (puzzleSpeedrunStore.isPlaying) {
    puzzleSpeedrunStore.quitSpeedrun()
  }
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <div class="speedrun-sidebar">
        <h2 class="speedrun-title">{{ t('features.speedrun.title') }}</h2>

        <div v-if="puzzleSpeedrunStore.isFinished" class="speedrun-finished">
          <NText type="success" strong>{{ t('features.speedrun.completed') }}</NText>
          <div class="total-time-label" style="margin-top: 16px; font-size: 0.9rem; opacity: 0.8">
            {{ t('features.speedrun.totalTime') }}
          </div>
          <div class="final-timer">{{ puzzleSpeedrunStore.formatMs(puzzleSpeedrunStore.totalTimeMs) }}</div>
          <NButton type="primary" @click="handleQuit" style="margin-top: 1rem">
            {{ t('common.actions.back') }}
          </NButton>
        </div>

        <div v-else-if="puzzleSpeedrunStore.currentPuzzle" class="speedrun-info">
          <div class="chapter-info">
            <NText depth="3" class="chapter-label">
              PUZZLE {{ puzzleSpeedrunStore.currentPuzzleIndex + 1 }}
              {{ t('features.speedrun.of') }} {{ puzzleSpeedrunStore.totalPuzzles }}
            </NText>
            <NProgress
              type="line"
              :percentage="progressPercentage"
              :show-indicator="false"
              status="success"
              class="progress-bar"
            />
            <h3 class="chapter-name">
              {{ puzzleSpeedrunStore.currentPuzzle.category }} - {{ puzzleSpeedrunStore.currentPuzzle.difficulty }}
            </h3>
            <NText depth="2" class="target-result">
              Rating: {{ puzzleSpeedrunStore.currentPuzzle.rating }}
            </NText>
          </div>

          <div class="timer-display">
            {{ formattedTime }}
          </div>
        </div>

        <div class="quit-section" v-if="!puzzleSpeedrunStore.isFinished">
          <NButton block type="warning" @click="handleRestart" style="margin-bottom: 12px">
            <template #icon>
              <NIcon><RestartIcon /></NIcon>
            </template>
            {{ t('features.speedrun.restartChapter') }}
          </NButton>

          <NButton block type="error" dashed @click="handleQuit">
            <template #icon>
              <NIcon><CloseCircleOutline /></NIcon>
            </template>
            {{ t('features.speedrun.quitRun') }}
          </NButton>
        </div>
      </div>
    </template>

    <template #top-info>
      <div class="top-info-banner" v-if="puzzleSpeedrunStore.currentPuzzle && !puzzleSpeedrunStore.isFinished">
        <div class="target-badge target-win">
          {{ puzzleSpeedrunStore.currentPuzzle.puzzle_type.toUpperCase() }}
        </div>
        <span class="top-timer">{{ formattedTime }}</span>
      </div>
    </template>

    <template #center-column>
      <!-- Game board is handled by GameLayout -->
    </template>

    <template #right-panel>
      <div class="right-panel-speedrun">
        <div class="chapter-list-header">
          <NText strong>PUZZLE LIST</NText>
        </div>

        <NScrollbar class="speedrun-list-scroll">
          <NList hoverable clickable>
            <NListItem
              v-for="(puzzle, index) in puzzleSpeedrunStore.puzzlesToPlay"
              :key="puzzle.puzzle_id"
              :class="{
                active: puzzleSpeedrunStore.currentPuzzleIndex === index,
                'is-clickable': puzzleSpeedrunStore.puzzleTimes[index] === undefined,
              }"
              @click="handleJump(index)"
            >
              <NThing>
                <template #avatar>
                  <div
                    class="chapter-index"
                    :class="{ completed: puzzleSpeedrunStore.puzzleTimes[index] !== undefined }"
                  >
                    {{ index + 1 }}
                  </div>
                </template>
                <template #header>
                  <span
                    class="chapter-name-list"
                    :class="{ active: puzzleSpeedrunStore.currentPuzzleIndex === index }"
                  >
                    {{ puzzle.category }} ({{ puzzle.difficulty }})
                  </span>
                </template>
                <template #header-extra>
                  <span
                    class="chapter-time"
                    :class="{ completed: puzzleSpeedrunStore.puzzleTimes[index] !== undefined }"
                  >
                    {{ puzzleSpeedrunStore.formatMs(puzzleSpeedrunStore.puzzleTimes[index]) }}
                  </span>
                </template>
              </NThing>
            </NListItem>
          </NList>
        </NScrollbar>

        <div class="analysis-toggle-section">
          <AnalysisPanel v-if="analysisStore.isPanelVisible" />
        </div>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.speedrun-sidebar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 24px;
}

.speedrun-title {
  color: var(--neon-bordeaux, #d9004c);
  font-weight: 900;
  letter-spacing: 2px;
  text-align: center;
  margin: 0;
  text-shadow: 0 0 10px rgba(217, 0, 76, 0.3);
}

.speedrun-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.chapter-info {
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.chapter-label {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.progress-bar {
  margin: 8px 0;
}

.chapter-name {
  margin: 0;
  font-size: 1.1rem;
  color: var(--color-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.target-result {
  font-size: 0.85rem;
  display: block;
  margin-top: 4px;
  font-weight: 600;
}

.timer-display {
  font-family: monospace;
  font-size: 3rem;
  font-weight: 800;
  text-align: center;
  color: var(--neon-yellow, #f7d547);
  background: #111;
  padding: 12px;
  border-radius: 8px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(247, 213, 71, 0.3);
}

.quit-section {
  margin-top: auto;
}

.top-info-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: rgba(0, 0, 0, 0.4);
  padding: 8px 24px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  backdrop-filter: blur(8px);
}

.target-badge {
  padding: 3px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-align: center;
  min-width: 80px;
  white-space: nowrap;
}

.target-win {
  background: rgba(0, 229, 255, 0.15);
  color: var(--neon-cyan);
  border: 1px solid var(--neon-cyan);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.3);
}

.top-timer {
  font-family: 'Fira Code', monospace;
  font-weight: 800;
  color: var(--neon-yellow);
  font-size: 1.1rem;
  min-width: 80px;
}

.speedrun-finished {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.final-timer {
  font-family: monospace;
  font-size: 2.5rem;
  color: var(--neon-yellow);
  margin: 16px 0;
}

.right-panel-speedrun {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chapter-list-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 1px;
}

.speedrun-list-scroll {
  flex: 1;
}

.chapter-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.8rem;
}

.chapter-index.completed {
  background: var(--color-success);
  color: white;
}

.chapter-name-list {
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chapter-name-list.active {
  color: var(--color-accent-primary);
  font-weight: bold;
  text-decoration: underline;
}

.chapter-time {
  font-family: monospace;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
}

.chapter-time.completed {
  color: var(--neon-yellow);
  font-weight: bold;
}

.active {
  background-color: rgba(var(--color-primary-rgb), 0.1) !important;
}

.is-clickable {
  cursor: pointer;
}

.is-clickable:hover {
  background-color: rgba(255, 255, 255, 0.05);
}

.analysis-toggle-section {
  border-top: 1px solid var(--color-border);
  padding: 8px;
}
</style>
