<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useLichessEndgameAnalysisStore } from '../model/lichess-endgame-analysis.store'
import { NText, NScrollbar, NList, NListItem, NButton, NSpace, NIcon } from 'naive-ui'
import { RefreshOutline as RestartIcon, ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

const { t } = useI18n()

const store = useLichessEndgameAnalysisStore()

interface DisplayPuzzleItem {
  puzzle_id: string
  game_id: string
  puzzle_type: 'my_dropps' | 'opp_blunders'
  user_target: 'win' | 'draw'
  ply: number
  isCurrent: boolean
  white_player?: string
  black_player?: string
  speed?: string
}

const displayList = computed<DisplayPuzzleItem[]>(() => {
  return store.puzzlesQueue.map(p => ({
    puzzle_id: p.puzzle_id,
    game_id: p.game_id,
    puzzle_type: p.puzzle_type,
    user_target: p.user_target,
    ply: p.ply,
    isCurrent: store.activePuzzle?.puzzle_id === p.puzzle_id,
    white_player: p.white_player,
    black_player: p.black_player,
    speed: p.speed
  }))
})

const getPuzzleStatus = (puzzleId: string) => {
  if (store.solvedPuzzles.has(puzzleId)) return 'solved'
  if (store.failedPuzzles.has(puzzleId)) return 'failed'
  return 'pending'
}

const selectPuzzle = (puzzle: DisplayPuzzleItem) => {
  if (store.isWaitingForBotBlunder) return
  // Finde das originale Puzzle-Objekt
  const orig = store.puzzlesQueue.find(p => p.puzzle_id === puzzle.puzzle_id)
  if (orig) {
    store.loadPuzzle(orig)
  }
}

const canGoPrev = computed(() => {
  const currentIdx = store.puzzlesQueue.findIndex(p => p.puzzle_id === store.activePuzzle?.puzzle_id)
  return currentIdx > 0
})

const canGoNext = computed(() => {
  const currentIdx = store.puzzlesQueue.findIndex(p => p.puzzle_id === store.activePuzzle?.puzzle_id)
  return currentIdx !== -1 && currentIdx + 1 < store.puzzlesQueue.length
})
</script>

<template>
  <div class="endgame-right-panel">
    <div class="task-list-header">
      <NText strong>{{ t('features.lichessEndgameAnalysis.puzzleQueue') }}</NText>
    </div>

    <!-- Coach / Trainer Feedback Box -->
    <div class="feedback-box" v-if="store.feedbackMessage">
      <div class="feedback-avatar">💬</div>
      <div class="feedback-text">
        <NText strong>{{ t(store.feedbackMessage) }}</NText>
      </div>
    </div>

    <NScrollbar class="task-list-scroll">
      <NList hoverable>
        <NListItem
          v-for="(puzzle, index) in displayList"
          :key="puzzle.puzzle_id"
          :class="{ 
            active: puzzle.isCurrent,
            'status-failed': getPuzzleStatus(puzzle.puzzle_id) === 'failed',
            'status-solved': getPuzzleStatus(puzzle.puzzle_id) === 'solved'
          }"
          class="puzzle-list-item"
          @click="selectPuzzle(puzzle)"
        >
          <div class="puzzle-row-compact">
            <div class="puzzle-index" :class="{ active: puzzle.isCurrent }">
              {{ index + 1 }}
            </div>
            
            <div class="puzzle-details">
              <div class="puzzle-title" :title="`${puzzle.white_player || t('features.lichessEndgameAnalysis.white')} vs ${puzzle.black_player || t('features.lichessEndgameAnalysis.black')}`">
                <span class="puzzle-speed" v-if="puzzle.speed">{{ puzzle.speed }}</span>
                <span class="puzzle-players">{{ puzzle.white_player || t('features.lichessEndgameAnalysis.white') }} vs {{ puzzle.black_player || t('features.lichessEndgameAnalysis.black') }}</span>
              </div>

              <div class="puzzle-action-row">
                <a 
                  :href="`https://lichess.org/${puzzle.game_id}#${puzzle.ply}`" 
                  target="_blank" 
                  class="lichess-link"
                  @click.stop
                >
                  {{ t('features.lichessEndgameAnalysis.open') }} ({{ t('features.lichessEndgameAnalysis.move') }} {{ Math.floor(puzzle.ply / 2) + 1 }})
                </a>

                <div class="puzzle-meta">
                  <span class="puzzle-type-label">
                    {{ puzzle.puzzle_type === 'my_dropps' ? t('features.lichessEndgameAnalysis.dropped') : t('features.lichessEndgameAnalysis.blunder') }}
                  </span>
                  <span class="puzzle-target-label" :class="puzzle.user_target">
                    {{ t('features.lichessEndgameAnalysis.target') }}: {{ puzzle.user_target.toUpperCase() }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </NListItem>
      </NList>
    </NScrollbar>

    <div class="sidebar-footer">
      <NSpace justify="space-between" align="center" style="width: 100%;">
        <NButton 
          secondary
          circle
          :disabled="!canGoPrev || store.isWaitingForBotBlunder" 
          @click="store.handlePrevPuzzle"
        >
          <template #icon><NIcon><ChevronBackOutline /></NIcon></template>
        </NButton>
        
        <NButton 
          type="warning" 
          :disabled="store.isWaitingForBotBlunder" 
          @click="store.handleRestart"
          style="flex: 1; margin: 0 12px;"
        >
          <template #icon><NIcon><RestartIcon /></NIcon></template>
          {{ t('features.lichessEndgameAnalysis.restart') }}
        </NButton>

        <NButton 
          secondary
          circle
          :disabled="!canGoNext || store.isWaitingForBotBlunder" 
          @click="store.handleNextPuzzle"
        >
          <template #icon><NIcon><ChevronForwardOutline /></NIcon></template>
        </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.endgame-right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
}

.task-list-header {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--color-border);
  letter-spacing: 1px;
}

.feedback-box {
  margin: 12px;
  padding: 12px;
  background: rgba(217, 0, 76, 0.06);
  border: 1px solid rgba(217, 0, 76, 0.2);
  border-radius: 8px;
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.feedback-avatar {
  font-size: 1.2rem;
}

.feedback-text {
  font-size: 0.85rem;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.85);
}

.task-list-scroll {
  flex: 1;
}

.puzzle-list-item {
  padding: 8px 12px !important;
  cursor: pointer;
}

.puzzle-row-compact {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.puzzle-index {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 0.75rem;
  flex-shrink: 0;
}

.puzzle-index.active {
  background: var(--neon-bordeaux);
  color: white;
}

.puzzle-details {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.puzzle-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.puzzle-speed {
  font-size: 0.65rem;
  background: rgba(255, 255, 255, 0.1);
  padding: 1px 4px;
  border-radius: 3px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
  flex-shrink: 0;
}

.puzzle-players {
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.puzzle-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.lichess-link {
  font-family: monospace;
  font-size: 0.8rem;
  color: var(--neon-cyan, #00e5ff);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lichess-link:hover {
  text-decoration: underline;
}

.puzzle-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.puzzle-type-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
}

.puzzle-target-label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.puzzle-target-label.win {
  color: #18a058;
}

.puzzle-target-label.draw {
  color: #f0a020;
}

.active {
  background-color: rgba(217, 0, 76, 0.05) !important;
}

.status-failed {
  background-color: rgba(209, 44, 44, 0.1) !important;
  border-left: 3px solid #d12c2c;
}

.status-solved {
  background-color: rgba(40, 167, 69, 0.1) !important;
  border-left: 3px solid #28a745;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--color-border);
}
</style>
