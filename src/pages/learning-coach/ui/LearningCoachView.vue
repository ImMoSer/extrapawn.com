<!-- src/pages/learning-coach/ui/LearningCoachView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NText,
  useMessage,
} from 'naive-ui'

import { useAuthStore } from '@/entities/user'
import { useCoachStore, CoachSidebar } from '@/features/coach'
import { useAnalysisStore, AnalysisPanel } from '@/features/analysis'
import { useEndgameStore, type EndgamePuzzle } from '@/features/endgames'
import { ControlPanel, GameLayout, useControlsStore } from '@/widgets/game-layout'
import { pgnService, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { useGameStore, useBoardStore } from '@/entities/game'
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

function formatMoveWithNumber(node: PgnNode): string {
  if (!node.fenBefore) return node.san || node.uci
  const parts = node.fenBefore.split(' ')
  const turn = parts[1]
  const fullmove = parts[5] || '1'
  if (turn === 'w') {
    return `${fullmove}. ${node.san || node.uci}`
  } else {
    return `${fullmove}... ${node.san || node.uci}`
  }
}

// State
const { t } = useI18n()
const message = useMessage()
const boardStore = useBoardStore()
const coachStore = useCoachStore()
const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()
const authStore = useAuthStore()
const gameStore = useGameStore()
const endgameStore = useEndgameStore()

const isKing = computed(() => {
  return authStore.userProfile?.subscriptionTier === 'King' || authStore.userProfile?.activeTier === 'King'
})

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

// Move tracking for sparring/feedback
let prevPathLength = 0

function isBotTurn(plyIndex: number): boolean {
  return currentPuzzle.value?.first_move === 'bot' ? plyIndex % 2 === 0 : plyIndex % 2 === 1
}

// Define Stockfish Analysis Synchronizer
async function waitForAnalysis() {
  if (!coachStore.isAnalyzing && coachStore.currentExplanation?.fen === boardStore.fen) {
    return
  }
  return new Promise<void>((resolve) => {
    const unwatch = watch(
      [() => coachStore.isAnalyzing, () => coachStore.currentExplanation],
      ([isAnalyzing, explanation]) => {
        if (!isAnalyzing && explanation && explanation.fen === boardStore.fen) {
          unwatch()
          resolve()
        }
      }
    )
  })
}

// Watcher for board moves to reply as bot using n8n sparring loop
watch(() => boardStore.boardSyncCounter, async () => {
  if (!isKing.value) return
  if (!currentPuzzle.value) return

  const path = pgnService.getCurrentUciPath()
  const L = path.length
  if (L === 0) {
    prevPathLength = 0
    return
  }

  // Skip if we did a takeback / undo (current path is shorter than previous)
  if (L < prevPathLength) {
    prevPathLength = L
    return
  }

  const wasUserMove = !isBotTurn(L - 1)
  prevPathLength = L

  if (wasUserMove) {
    const currentNode = pgnService.getCurrentNode()
    if (currentNode) {
      coachStore.addRefereeMessage(formatMoveWithNumber(currentNode), 'userMove')
    }

    try {
      // 1. Wait for Stockfish analysis of the user's move to complete
      await waitForAnalysis()

      // 2. Fetch coach feedback for King users (chat and TTS only)
      const feedback = await coachStore.fetchCoachFeedback()
      if (feedback?.coach_fitback) {
        const fb = feedback.coach_fitback
        
        // Add user's move feedback to the chat
        if (fb.user_last_move_chat) {
          coachStore.addCoachMessage(fb.user_last_move_chat, 'coachFeedback')
        }

        // Speak user's move feedback
        if (fb.user_last_move_tts) {
          await coachStore.playMentorResponse(fb.user_last_move_tts)
        }
      }
    } catch (err) {
      console.error('[LearningCoachView] Sparring feedback cycle failed:', err)
    }
  } else {
    // It was a bot move
    const botNode = pgnService.getCurrentNode()
    if (botNode) {
      coachStore.addRefereeMessage(formatMoveWithNumber(botNode), 'coachMove')
    }
  }
})

// Handle position load callback from Sidebar
async function handlePositionLoaded(payload: { puzzle: LearningPuzzle; source: string }) {
  currentPuzzle.value = payload.puzzle
  currentSource.value = payload.source

  // Unify King and Non-King puzzle loading:
  boardStore.setAnalysisMode(false)
  coachStore.setCoachEnabled(false)
  endgameStore.startGameFromPuzzle(payload.puzzle as unknown as EndgamePuzzle)
  
  coachStore.initChatSession(payload.puzzle)
  coachStore.addRefereeMessage(payload.puzzle.initial_fen, 'startGame')
  coachStore.setCoachEnabled(true)

  // Reset prevPathLength for tracking moves
  prevPathLength = 0

  if (isKing.value) {
    // Start-of-puzzle greeting watch for King users
    const unwatch = watch(
      [() => coachStore.isAnalyzing, () => coachStore.currentExplanation],
      async ([isAnalyzing, explanation]) => {
        if (!isAnalyzing && explanation && explanation.fen === boardStore.fen) {
          unwatch()
          await coachStore.sendChatMessage()
        }
      },
      { immediate: true }
    )
  }
}

// Watchers for game phases and UI controls
watch(() => gameStore.gamePhase, (phase) => {
  if (phase === 'GAMEOVER') {
    boardStore.setAnalysisMode(true)
  }
})

watch(
  [() => gameStore.isGameActive, () => currentPuzzle.value],
  ([isGameActive, puzzle]) => {
    if (!puzzle) {
      controlsStore.setControls({
        canRequestNew: false,
        canRestart: false,
        canResign: false,
        canShare: false,
        canRequestHint: false,
      })
      return
    }

    controlsStore.setControls({
      canRequestNew: false,
      canRestart: true,
      canResign: isGameActive,
      canShare: false,
      canRequestHint: false,
      onRestart: () => {
        handlePositionLoaded({ puzzle: puzzle as unknown as LearningPuzzle, source: currentSource.value })
        message.success(t('features.gameplay.restartSuccess'))
      },
    })
  },
  { immediate: true }
)

// Lifecycle Hooks
onMounted(async () => {
  boardStore.setAnalysisMode(true)

  // Automatically load the first puzzle on mount
  isLoading.value = true
  try {
    const data = await apiClient<LearningPuzzle>('/finish-him/start?theme=pawn&difficulty=Novice')
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
  analysisStore.hidePanel()
})

const showAnalysisPanel = computed(() => {
  return true
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

    <template #controls>
      <ControlPanel />
    </template>

    <template #right-panel>
      <div class="right-panel-content-wrapper">
        <AnalysisPanel v-if="showAnalysisPanel" :show-pgn="true" style="margin-bottom: 12px; flex-shrink: 0" />
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
