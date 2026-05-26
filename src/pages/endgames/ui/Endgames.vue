<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { NText, NButton, NIcon } from 'naive-ui'
import { CheckmarkCircle, CloseCircle } from '@vicons/ionicons5'

import { GameLayout } from '@/widgets/game-layout'
import { CoachSidebar, useCoachStore } from '@/features/coach'
import { useEndgamesStore, GuessColorSelection } from '@/features/endgames'
import EndgamesSidebar from './EndgamesSidebar.vue'

const { t } = useI18n()
const endgamesStore = useEndgamesStore()
const coachStore = useCoachStore()

// Handle position load callback from Sidebar
function handleLoadRequested(payload: { type: string; category: string; difficulty: string; source: string }) {
  endgamesStore.loadNewPuzzle(payload.type, {
    category: payload.category,
    difficulty: payload.difficulty
  })
}

const showColorGuess = computed(() => endgamesStore.isWaitingForColorGuess)

const activePuzzleTitle = computed(() => {
   return endgamesStore.topInfoDisplay.title
})
const badges = computed(() => {
   return endgamesStore.topInfoDisplay.badges
})

watch(() => endgamesStore.isWaitingForColorGuess, (isWaiting) => {
  if (isWaiting) {
    coachStore.setCoachEnabled(false)
  } else {
    coachStore.setCoachEnabled(true)
  }
})

onMounted(() => {
  if (endgamesStore.isWaitingForColorGuess) {
    coachStore.setCoachEnabled(false)
  } else {
    coachStore.setCoachEnabled(true)
  }
})

onUnmounted(() => {
  endgamesStore.reset()
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <EndgamesSidebar
        @loadRequested="handleLoadRequested"
      />
    </template>

    <template #top-info>
      <div v-if="endgamesStore.activePuzzle" class="learning-top-panel-container">
        <div class="learning-top-info">
          <span v-for="badge in badges" :key="badge.text" class="premium-badge category badge-endings">
            {{ badge.text }}
          </span>
          <n-text style="color: white; font-weight: bold; margin-left: 10px;">{{ activePuzzleTitle }}</n-text>
        </div>
      </div>
      <div v-else class="learning-top-info-placeholder">
        <n-text class="status-indicator select-lesson-prompt">
          Select an endgame training
        </n-text>
      </div>
    </template>

    <template #center-column>
      <div v-if="showColorGuess" class="guess-color-overlay">
        <GuessColorSelection />
      </div>
      <div v-else-if="endgamesStore.gamePhase === 'GAMEOVER'" class="result-overlay-container">
        <div class="result-overlay">
          <n-icon
            size="64"
            :class="
              endgamesStore.feedbackMessage === t('features.finishHim.feedback.win')
                ? 'icon-success'
                : 'icon-error'
            "
          >
            <CheckmarkCircle
              v-if="endgamesStore.feedbackMessage === t('features.finishHim.feedback.win')"
            />
            <CloseCircle v-else />
          </n-icon>
          <n-text class="result-text">{{ endgamesStore.feedbackMessage }}</n-text>

          <n-button
            type="primary"
            size="large"
            @click="
              endgamesStore.loadNewPuzzle(
                endgamesStore.activePuzzle?.puzzle_type || 'finish_him',
                endgamesStore.activeParams,
              )
            "
            style="margin-top: 1rem"
          >
            Next Training
          </n-button>
        </div>
      </div>
    </template>

    <template #right-panel>
      <CoachSidebar />
    </template>
  </GameLayout>
</template>

<style scoped>
.guess-color-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 15, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  border-radius: 4px;
}
.learning-top-panel-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 4px 16px;
  background: rgba(20, 20, 25, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(8px);
}

.learning-top-info-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
}

.select-lesson-prompt {
  font-family: 'Outfit', sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-muted);
  letter-spacing: 0.5px;
}

.learning-top-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.premium-badge {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 800;
  font-size: 0.72rem;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
  text-shadow: 0 0 8px rgba(255, 255, 255, 0.2);
  transition: all 0.3s ease;
}

.badge-endings {
  background: rgba(157, 78, 221, 0.15);
  color: #c77dff;
  border: 1px solid rgba(157, 78, 221, 0.3);
  box-shadow: 0 0 10px rgba(157, 78, 221, 0.15);
}

.result-overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(10, 10, 15, 0.85);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  border-radius: 4px;
}

.result-overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: var(--color-surface-2);
  padding: 32px 48px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.result-text {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  text-align: center;
}

.icon-success {
  color: #4caf50;
}
.icon-error {
  color: #f44336;
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
</style>
