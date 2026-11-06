<script setup lang="ts">
import { useBoardStore, useGameStore, WebChessBoard } from '@/entities/game'
import { usePreferencesStore } from '@/entities/user'
import { useAnalysisStore } from '@/features/analysis'
import { EvalBar, useCoachStore, useCrashtestStore } from '@/features/coach'
import { useSidebarStore } from '../model/sidebar.store'
import ControlCenter from './ControlCenter.vue'
import RightSidebarSlot from './RightSidebarSlot.vue'
import type { Key } from '@lichess-org/chessground/types'
import { computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    boardLocked?: boolean
    hideEvalBar?: boolean
  }>(),
  {
    boardLocked: false,
    hideEvalBar: false,
  },
)

const preferencesStore = usePreferencesStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const analysisStore = useAnalysisStore()
const coachStore = useCoachStore()
const crashtestStore = useCrashtestStore()
const sidebarStore = useSidebarStore()

onMounted(() => {
  crashtestStore.init()
})

onUnmounted(() => {
  gameStore.stop()
})

const isAnimationEnabled = computed(() => preferencesStore.preferences.theme.animationDuration > 0)
const activeDests = computed(() => (props.boardLocked ? new Map() : boardStore.dests))

const isAnalysisMode = computed(() => gameStore.gamePhase === 'ANALYSIS')

const activeEvalCp = computed<number | null>(() => {
  if (coachStore.isFairPlayLocked) return 0
  if (sidebarStore.activeMode === 'explorer' && analysisStore.isAnalysisActive) {
    const topLine = analysisStore.analysisLines[0]
    if (!topLine || topLine.score.type !== 'cp') return null
    return topLine.score.value
  }
  return coachStore.evalCp
})

const activeEvalMate = computed<number | null>(() => {
  if (coachStore.isFairPlayLocked) return null
  if (sidebarStore.activeMode === 'explorer' && analysisStore.isAnalysisActive) {
    const topLine = analysisStore.analysisLines[0]
    if (!topLine || topLine.score.type !== 'mate') return null
    return topLine.score.value
  }
  return coachStore.evalMate
})

const activeEvalLoading = computed<boolean>(() => {
  if (coachStore.isFairPlayLocked) return false
  if (sidebarStore.activeMode === 'explorer') {
    return analysisStore.isAnalysisActive && analysisStore.analysisLines.length === 0
  }
  return coachStore.topMovesLoading
})

const handleUserMove = async ({ orig, dest }: { orig: Key; dest: Key }) => {
  await gameStore.handleUserMove(orig, dest)
}

const handleWheelNavigate = (direction: 'up' | 'down') => {
  gameStore.navigatePgn(direction === 'up' ? 'backward' : 'forward')
}
</script>

<template>
  <div class="game-layout">
    <!-- Main Grid Logic -->
    <div class="layout-main">
      <aside class="left-panel">
        <slot name="left-panel"></slot>
      </aside>

      <!-- Center Stage: Top Info -> (EvalBar + Board) -> Controls -->
      <div class="center-stage">
        <!-- Top Sector -->
        <div class="cb-top-panel">
          <div class="top-info-slot">
            <slot name="top-info"></slot>
          </div>
        </div>

        <!-- Middle Row: EvalBar + Board Sector -->
        <div class="board-row">
          <div v-if="!props.hideEvalBar" class="eval-bar-container">
            <slot name="eval-bar">
              <EvalBar
                :eval-cp="activeEvalCp"
                :mate="activeEvalMate"
                :result="coachStore.gameResult"
                :loading="activeEvalLoading"
                :orientation="boardStore.orientation"
              />
            </slot>
          </div>

          <div class="board-section">
            <div class="board-aspect-wrapper">
              <slot name="board">
                <WebChessBoard
                  :fen="boardStore.fen"
                  :orientation="boardStore.orientation"
                  :turn-color="boardStore.turn"
                  :dests="activeDests"
                  :last-move="boardStore.lastMove"
                  :check="boardStore.isCheck"
                  :promotion-state="boardStore.promotionState"
                  :drawable-shapes="boardStore.drawableShapes"
                  :is-analysis-mode="isAnalysisMode"
                  :animation-enabled="isAnimationEnabled"
                  :animation-duration="preferencesStore.preferences.theme.animationDuration"
                  :can-edit="true"
                  @user-move="handleUserMove"
                  @complete-promotion="boardStore.completePromotion"
                  @shapes-change="boardStore.setDrawableShapes"
                  @wheel-navigate="handleWheelNavigate"
                />
              </slot>

              <!-- Center slot for overlays or additional content -->
              <div class="center-column-overlay">
                <slot name="center-column"></slot>
              </div>
            </div>
          </div>
        </div>

        <!-- Control Center Sector -->
        <div class="cb-bottom-panel">
          <slot name="bottom-controls">
            <ControlCenter />
          </slot>
        </div>
      </div>

      <aside class="right-panel">
        <slot name="right-panel">
          <RightSidebarSlot />
        </slot>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.game-layout {
  --top-panel-h: 48px;
  --bottom-panel-h: 48px;
  --eval-bar-w: 16px;
  --gap-size: 8px;
  --board-size: min(
    calc(100vh - 20px - var(--top-panel-h) - var(--bottom-panel-h) - (2 * var(--gap-size))),
    calc(100vw - var(--eval-bar-w) - var(--gap-size) - 24px)
  );
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100%;
  padding: 10px;
  box-sizing: border-box;
  overflow: hidden;
  background-color: var(--color-canvas);
}

.layout-main {
  display: grid;
  flex: 1;
  grid-template-columns: 3fr auto 4fr;
  gap: 10px;
  min-height: 0;
  justify-content: center;
}

/* --- Center Stage Area --- */
.center-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--gap-size);
  width: calc(var(--eval-bar-w) + var(--gap-size) + var(--board-size));
  height: calc(100vh - 20px);
}

.cb-top-panel {
  width: 100%;
  height: var(--top-panel-h);
  flex: 0 0 var(--top-panel-h);
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 25;
}

.board-row {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: var(--gap-size);
  width: 100%;
  height: var(--board-size);
  flex: 0 0 var(--board-size);
}

.eval-bar-container {
  width: var(--eval-bar-w);
  height: 100%;
  flex: 0 0 var(--eval-bar-w);
  flex-shrink: 0;
}

.board-section {
  flex: 0 0 var(--board-size);
  height: var(--board-size);
  width: var(--board-size);
  aspect-ratio: 1 / 1;
  display: flex;
  align-items: stretch;
  gap: 0;
}

.cb-bottom-panel {
  width: 100%;
  height: var(--bottom-panel-h);
  flex: 0 0 var(--bottom-panel-h);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 25;
}

.top-info-slot {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.board-aspect-wrapper {
  height: 100%;
  width: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  background-color: var(--color-canvas);
  border-radius: 4px;
  flex-shrink: 0;
}

.center-column-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.center-column-overlay > * {
  pointer-events: auto;
}

/* --- Side Panels --- */
.left-panel,
.right-panel {
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  padding: 0px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
  height: 100%;
}

.left-panel::-webkit-scrollbar,
.right-panel::-webkit-scrollbar {
  display: none;
}

/* --- Responsive / Mobile --- */

@media (max-width: 1200px) {
  .layout-main {
    grid-template-columns: 250px auto 300px;
    gap: 10px;
  }
}

@media (orientation: portrait) {
  .game-layout {
    height: 100%;
    overflow-y: auto;
    padding: 4px;
    display: block;
  }

  .layout-main {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .center-stage {
    order: 1;
    width: 100%;
    height: auto;
    justify-content: center;
    gap: 6px;
    overflow: hidden;
  }

  .board-row {
    width: 100%;
    height: auto;
    flex: 0 0 auto;
    align-items: stretch;
  }

  .eval-bar-container {
    width: var(--eval-bar-w);
    flex: 0 0 var(--eval-bar-w);
    height: auto;
    align-self: stretch;
  }

  .board-section {
    flex: 1;
    min-width: 0;
    width: auto;
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .board-aspect-wrapper {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    margin: 0;
    flex-shrink: 0;
  }

  .right-panel {
    order: 2;
    height: auto;
    min-height: 0;
    padding: 6px;
    background: transparent;
    border: none;
  }

  .left-panel {
    order: 3;
    height: auto;
    min-height: 150px;
    padding: 6px;
    margin-top: 10px;
  }

  .cb-top-panel {
    width: 100%;
    height: 48px;
    flex: 0 0 48px;
  }
}
</style>
