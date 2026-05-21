<!-- src/pages/learning-coach/ui/LearningCoachView.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  NText,
  useMessage,
} from 'naive-ui'

import { useBoardStore } from '@/entities/game'
import { useCoachStore, CoachSidebar } from '@/features/coach'
import { useAnalysisStore, AnalysisPanel } from '@/features/analysis'
import { ControlPanel, GameLayout, useControlsStore } from '@/widgets/game-layout'
import { pgnService } from '@/shared/lib/pgn/PgnService'
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
const message = useMessage()
const boardStore = useBoardStore()
const coachStore = useCoachStore()
const controlsStore = useControlsStore()
const analysisStore = useAnalysisStore()

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

// Bot play solver state
const botMoveTimeout: ReturnType<typeof setTimeout> | null = null
let isBotPlaying = false

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
  if (isBotPlaying) return
  if (!currentPuzzle.value) return

  const path = pgnService.getCurrentUciPath()
  const L = path.length
  if (L === 0) return

  // If it is the bot's turn to respond:
  if (isBotTurn(L)) {
    isBotPlaying = true
    
    try {
      // 1. Wait for Stockfish analysis of the user's move to complete
      await waitForAnalysis()

      // 2. Call backend for coach_fitback
      const feedback = await coachStore.fetchCoachFeedback()
      if (feedback?.coach_fitback) {
        const fb = feedback.coach_fitback
        
        // Step 1: Add user's move feedback to the chat
        if (fb.user_last_move_chat) {
          coachStore.addCoachMessage(fb.user_last_move_chat)
        }

        // Step 1b: Speak user's move feedback
        if (fb.user_last_move_tts) {
          await coachStore.playMentorResponse(fb.user_last_move_tts)
        }
        
        // Step 2: Play the bot's move directly on the board
        if (fb.coach_next_move_uci) {
          boardStore.applyUciMove(fb.coach_next_move_uci)
        }
        
        // Step 3: Add the bot's move explanation/idea to the chat
        if (fb.coach_next_move_idea) {
          coachStore.addCoachMessage(fb.coach_next_move_idea)
        }
        
        // 3. Wait for Stockfish analysis of the resulting FEN to complete
        await waitForAnalysis()
        
        // 4. Call backend for coach_explained
        const explanation = await coachStore.fetchCoachExplanation()
        if (explanation?.coach_explained) {
          const exp = explanation.coach_explained
          
          // Step 4: Add coach explanation of the new position to the chat
          if (exp.chat) {
            coachStore.addCoachMessage(exp.chat)
          }
          
          // Step 5: Read out the TTS explanation via the speech synthesis engine
          if (exp.tts) {
            coachStore.playMentorResponse(exp.tts)
          }
        }
      }
    } catch (err) {
      console.error('[LearningCoachView] Sparring cycle failed:', err)
    } finally {
      isBotPlaying = false
    }
  }
})

// Determine orientation helper
const determineOrientation = (puzzle: LearningPuzzle): 'white' | 'black' => {
  if (puzzle.weak_side) {
    return puzzle.weak_side === 'black' ? 'white' : 'black'
  }
  if (puzzle.winner) {
    return puzzle.winner === 'black' ? 'black' : 'white'
  }
  const turn = puzzle.initial_fen.split(' ')[1] || 'w'
  const isWhiteTurn = turn === 'w'
  if (puzzle.first_move === 'bot') {
    return isWhiteTurn ? 'black' : 'white'
  }
  return isWhiteTurn ? 'white' : 'black'
}

// Handle position load callback from Sidebar
async function handlePositionLoaded(payload: { puzzle: LearningPuzzle; source: string }) {
  currentPuzzle.value = payload.puzzle
  currentSource.value = payload.source
  const orientation = determineOrientation(payload.puzzle)

  // 1. Setup board WITHOUT triggering automatic analysis immediately if possible
  // We temporarily disable coach to avoid the watch(boardStore.fen) trigger
  coachStore.setCoachEnabled(false)

  boardStore.resetBoardState()
  boardStore.setAnalysisMode(true)
  boardStore.setupPosition(payload.puzzle.initial_fen, orientation)

  // 2. Execute Bot Move if applicable BEFORE starting the session
  if (payload.puzzle.tactical_solution) {

    const moves = payload.puzzle.tactical_solution.split(' ').filter(Boolean)
    if (moves.length > 0 && isBotTurn(0)) {
      isBotPlaying = true
      // Apply move immediately for the internal state
      const firstMove = moves[0]
      if (firstMove) {
        boardStore.applyUciMove(firstMove)
      }
      isBotPlaying = false
    }
  }

  // 3. Now enable Coach and trigger analysis for the CORRECT position
  coachStore.setCoachEnabled(true)
  coachStore.initChatSession(payload.puzzle)

  // 4. Wait for the analysis of the final position to complete before greeting
  // We use a watch on isAnalyzing that checks if currentExplanation is ready
  const unwatch = watch(
    [() => coachStore.isAnalyzing, () => coachStore.currentExplanation],
    ([isAnalyzing, explanation]) => {
      if (!isAnalyzing && explanation && explanation.fen === boardStore.fen) {
        coachStore.sendChatMessage() 
        unwatch()
      }
    },
    { immediate: true }
  )

  // Configure Control Panel
  controlsStore.setControls({
    canRequestNew: false,
    canRestart: true,
    canResign: false,
    canShare: false,
    canRequestHint: false,
    onRestart: () => {
      // Re-use the same logic for restart
      handlePositionLoaded({ puzzle: payload.puzzle, source: payload.source })
      message.success(t('features.gameplay.restartSuccess'))
    },
  })
}

// Lifecycle Hooks
onMounted(async () => {
  boardStore.setAnalysisMode(true)
  controlsStore.setControls({
    canRequestNew: false,
    canRestart: false,
    canResign: false,
    canShare: false,
    canRequestHint: false,
  })

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
  if (botMoveTimeout) {
    clearTimeout(botMoveTimeout)
  }
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
