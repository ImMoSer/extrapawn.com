<!-- src/pages/learning-coach/ui/LearningCoachView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NText,
} from 'naive-ui'

import { useCoachStore, CoachSidebar } from '@/features/coach'
import { GameLayout } from '@/widgets/game-layout'
import { useBoardStore } from '@/entities/game'
import { apiClient } from '@/shared/api/client'
import TrainingsSidebar from './TrainingsSidebar.vue'

// Types
type LearningPuzzle = {
  puzzle_id: string
  initial_fen: string
  weak_side?: string
  winner?: string
  first_move?: string
  difficulty: string
  rating?: number
  tactical_rating?: number
  engm_rating?: number
  tactical_solution?: string
  category?: string
  sub_category?: string
  themes?: string[]
  game_modus?: string
}

// State
const { t } = useI18n()
const boardStore = useBoardStore()
const coachStore = useCoachStore()

const categoryBadgeText = computed(() => {
  if (!currentPuzzle.value) return ''
  const modus = currentPuzzle.value.game_modus
  if (modus === 'theory_endings' || modus === 'practical_chess' || modus === 'finish_him') {
    return 'ENDINGS'
  }
  if (modus === 'tactics') {
    return 'TACTICS'
  }
  return 'OPENINGS'
})

const subBadgeText = computed(() => {
  if (!currentPuzzle.value) return ''
  const modus = currentPuzzle.value.game_modus
  if (modus === 'theory_endings') return 'THEORETICAL'
  if (modus === 'practical_chess') return 'PRACTICAL'
  if (modus === 'finish_him') return 'GOTO'
  return ''
})

const categoryBadgeClass = computed(() => {
  if (!currentPuzzle.value) return ''
  const modus = currentPuzzle.value.game_modus
  if (modus === 'theory_endings' || modus === 'practical_chess' || modus === 'finish_him') {
    return 'badge-endings'
  }
  if (modus === 'tactics') {
    return 'badge-tactics'
  }
  return 'badge-openings'
})

const subBadgeClass = computed(() => {
  if (!currentPuzzle.value) return ''
  const modus = currentPuzzle.value.game_modus
  if (modus === 'theory_endings') return 'badge-theoretical'
  if (modus === 'practical_chess') return 'badge-practical'
  if (modus === 'finish_him') return 'badge-goto'
  return ''
})

// Current loaded puzzle state
const currentPuzzle = ref<LearningPuzzle | null>(null)
const currentSource = ref<string>('')
const isLoading = ref<boolean>(false)

// Handle position load callback from Sidebar
async function handlePositionLoaded(payload: { puzzle: LearningPuzzle; source: string }) {
  currentPuzzle.value = payload.puzzle
  currentSource.value = payload.source

  // Pure Analysis Flow:
  boardStore.setAnalysisMode(true)
  boardStore.setupPosition(payload.puzzle.initial_fen)
  coachStore.setCoachEnabled(true)
}

// Lifecycle Hooks
onMounted(async () => {
  boardStore.setAnalysisMode(true)

  // Automatically load the first puzzle on mount
  isLoading.value = true
  try {
    const data = await apiClient<LearningPuzzle>('/play-puzzle/start?puzzle_type=finish_him&difficulty=Novice&category=pawn')
    if (data && data.initial_fen) {
      handlePositionLoaded({ 
        puzzle: data, 
        source: t('features.learningCoach.modes.goto') 
      })
    }
  } catch (err) {
    console.error('[LearningCoachView] Initial load failed:', err)
  } finally {
    isLoading.value = false
  }
})

onUnmounted(() => {
  boardStore.setAnalysisMode(false)
  boardStore.resetBoardState()
  coachStore.setCoachEnabled(false)
})
</script>

<template>
  <GameLayout>
    <template #left-panel>
      <TrainingsSidebar
        v-model:isLoading="isLoading"
        @positionLoaded="handlePositionLoaded"
      />
    </template>

    <template #top-info>
      <div v-if="currentPuzzle" class="learning-top-panel-container">
        <!-- Badges on the left -->
        <div class="learning-top-info">
          <span class="premium-badge category" :class="categoryBadgeClass">
            {{ categoryBadgeText }}
          </span>
          <span v-if="subBadgeText" class="premium-badge subcategory" :class="subBadgeClass">
            {{ subBadgeText }}
          </span>
        </div>
      </div>
      <div v-else class="learning-top-info-placeholder">
        <n-text class="status-indicator select-lesson-prompt">
          {{ t('features.learningCoach.topInfo.selectLesson') }}
        </n-text>
      </div>
    </template>

    <!-- Controls removed: we are in analysis mode only -->
    <template #controls>
      <div />
    </template>

    <template #right-panel>
      <div class="right-panel-content-wrapper">
        <CoachSidebar />
      </div>
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

/* Premium Badges */
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

/* Category Badges */
.badge-endings {
  background: rgba(157, 78, 221, 0.15);
  color: #c77dff;
  border: 1px solid rgba(157, 78, 221, 0.3);
  box-shadow: 0 0 10px rgba(157, 78, 221, 0.15);
}

.badge-tactics {
  background: rgba(0, 242, 255, 0.15);
  color: #00f2ff;
  border: 1px solid rgba(0, 242, 255, 0.3);
  box-shadow: 0 0 10px rgba(0, 242, 255, 0.15);
}

.badge-openings {
  background: rgba(57, 255, 20, 0.15);
  color: #39ff14;
  border: 1px solid rgba(57, 255, 20, 0.3);
  box-shadow: 0 0 10px rgba(57, 255, 20, 0.15);
}

/* Sub-category Badges */
.badge-theoretical {
  background: rgba(255, 179, 0, 0.15);
  color: #ffb300;
  border: 1px solid rgba(255, 179, 0, 0.3);
}

.badge-practical {
  background: rgba(76, 175, 80, 0.15);
  color: #4caf50;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.badge-goto {
  background: rgba(244, 67, 54, 0.15);
  color: #f44336;
  border: 1px solid rgba(244, 67, 54, 0.3);
}

.right-panel-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
</style>
