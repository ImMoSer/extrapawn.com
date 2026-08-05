<script setup lang="ts">
import { NButton, NDivider, NText } from 'naive-ui'
import { computed, onUnmounted, watch, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

import { useCoachStore } from '@/features/coach'
import { usePuzzleStore, type PuzzleSubmode } from '@/features/puzzle'
import { GameLayout, RightSidebarSlot } from '@/widgets/game-layout'
import PuzzleSidebar from './PuzzleSidebar.vue'

const props = defineProps({
  submode: {
    type: String as PropType<PuzzleSubmode>,
    required: true,
  },
  puzzleId: {
    type: String,
    default: undefined,
  },
})

const { t } = useI18n()
const puzzleStore = usePuzzleStore()
const coachStore = useCoachStore()

function handleLoadRequested(payload: { type: string; category: string; difficulty: string; source: string }) {
  puzzleStore.loadNextPuzzle(payload.type, {
    category: payload.category,
    difficulty: payload.difficulty
  })
}

const activePuzzleTitle = computed(() => {
   return puzzleStore.topInfoDisplay.title
})

const badges = computed(() => {
   return puzzleStore.topInfoDisplay.badges
})

watch(
  () => [props.submode, props.puzzleId],
  ([newSubmode, newPuzzleId]) => {
    puzzleStore.initialize(newSubmode as PuzzleSubmode, newPuzzleId as string | undefined)
    coachStore.setCoachEnabled(true)
  },
  { immediate: true },
)

onUnmounted(() => {
  puzzleStore.reset()
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <PuzzleSidebar
        :submode="props.submode"
        @loadRequested="handleLoadRequested"
      />
    </template>

    <template #top-info>
      <div v-if="puzzleStore.activePuzzle" class="learning-top-panel-container">
        <div class="learning-top-info">
          <span v-for="badge in badges" :key="badge.text" class="premium-badge category badge-endings mobile-hide">
            {{ badge.text }}
          </span>
          <n-text class="active-puzzle-title">{{ activePuzzleTitle }}</n-text>

          <n-divider vertical class="mobile-hide" />

          <n-text
            class="mobile-hide"
            :class="puzzleStore.feedbackMessage === t('features.puzzle.feedback.win') ? 'text-success' : 'text-info'"
          >
            {{ puzzleStore.feedbackMessage }}
          </n-text>

          <n-button
            v-if="puzzleStore.gamePhase === 'GAMEOVER'"
            type="primary"
            size="small"
            secondary
            @click="
              puzzleStore.loadNextPuzzle(
                puzzleStore.activePuzzle?.puzzle_type || props.submode,
                puzzleStore.activeParams,
              )
            "
            style="margin-left: 12px"
          >
            Next
          </n-button>
        </div>
      </div>
      <div v-else class="learning-top-info-placeholder">
        <n-text class="status-indicator select-lesson-prompt">
          Select a lesson to begin training
        </n-text>
      </div>
    </template>

    <template #right-panel>
      <RightSidebarSlot />
    </template>
  </GameLayout>
</template>

<style scoped>
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

.text-success {
  color: #4caf50;
  font-weight: 600;
}
.text-info {
  color: #c77dff;
  font-weight: 600;
}

.active-puzzle-title {
  color: white;
  font-weight: bold;
  margin-left: 10px;
}

@media (max-width: 768px) {
  .mobile-hide {
    display: none !important;
  }
  .active-puzzle-title {
    margin-left: 0;
  }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
</style>
