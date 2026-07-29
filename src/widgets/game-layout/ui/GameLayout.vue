<!-- src/widgets/game-layout/GameLayout.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore, WebChessBoard } from '@/entities/game'
import { useAnalysisStore } from '@/features/analysis'
import { EvalBar, useCoachStore } from '@/features/coach'
import { EngineSelector } from '@/features/engine'
import { useThemeStore } from '@/features/settings'
import ControlCenter from './ControlCenter.vue'
import type { Key } from '@lichess-org/chessground/types'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  boardLocked?: boolean
}>()

const themeStore = useThemeStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const analysisStore = useAnalysisStore()
const coachStore = useCoachStore()
const route = useRoute()


const isAnimationEnabled = computed(() => themeStore.currentTheme.animationDuration > 0)

const activeDests = computed(() => (props.boardLocked ? new Map() : boardStore.dests))

// Force analysis mode if we are in study views or analysis panel is visible, to prevent race conditions or store resets
const effectiveAnalysisMode = computed(() => {
  return (
    analysisStore.isPanelVisible ||
    (route.path.startsWith('/study') && !route.path.startsWith('/study-speedrun'))
  )
})

const canUserEdit = computed(() => true)


const handleUserMove = async ({ orig, dest }: { orig: Key; dest: Key }) => {
  await gameStore.handleUserMove(orig, dest)
}

const handleBoardWheel = (direction: 'up' | 'down') => {
  if (analysisStore.isAnalysisActive || effectiveAnalysisMode.value) {
    if (direction === 'up') {
      gameStore.navigatePgn('backward')
    } else {
      gameStore.navigatePgn('forward')
    }
  }
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    // Don't navigate if user is typing in an input or textarea
    if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
      return
    }

    event.preventDefault()

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      gameStore.navigatePgn('backward')
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      gameStore.navigatePgn('forward')
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="game-layout">
    <!-- Main Grid Logic -->
    <div class="layout-main">
      <aside class="left-panel">
        <slot name="left-panel"></slot>
      </aside>

      <!-- Center Stage: Top Info -> (EvalBar + Board) -> Controls -->
      <div class="center-stage" ref="centerColumnRef">
        <!-- Top Sector -->
        <div class="cb-top-panel">
          <div class="top-info-slot">
            <slot name="top-info"></slot>
          </div>
          <div class="top-engine-slot">
            <EngineSelector />
          </div>
        </div>

        <!-- Middle Row: EvalBar + Board Sector -->
        <div class="board-row">
          <div class="eval-bar-container">
            <EvalBar
              :eval-cp="coachStore.evalCp"
              :mate="coachStore.evalMate"
              :result="coachStore.gameResult"
              :loading="coachStore.topMovesLoading"
              :orientation="boardStore.orientation"
            />
          </div>

          <div class="board-section">
            <div class="board-aspect-wrapper">
              <WebChessBoard
                :fen="boardStore.fen"
                :orientation="boardStore.orientation"
                :turn-color="boardStore.turn"
                :dests="activeDests"
                :last-move="boardStore.lastMove"
                :check="boardStore.isCheck"
                :promotion-state="boardStore.promotionState"
                :drawable-shapes="boardStore.drawableShapes"
                :is-analysis-mode="effectiveAnalysisMode"
                :animation-enabled="isAnimationEnabled"
                :animation-duration="themeStore.currentTheme.animationDuration"
                :board-sync-counter="boardStore.boardSyncCounter"
                :can-edit="canUserEdit"
                @user-move="handleUserMove"

                @complete-promotion="boardStore.completePromotion"
                @wheel-navigate="handleBoardWheel"
                @shapes-change="(shapes: any) => boardStore.setDrawableShapes(shapes)"
              />

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
        <slot name="right-panel"></slot>
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
  background-color: var(--color-bg-primary);
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

.top-engine-slot {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.board-aspect-wrapper {
  height: 100%;
  width: 100%;
  aspect-ratio: 1 / 1;
  position: relative;
  background-color: rgba(0, 0, 0, 0.1);
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
  background-color: var(--color-bg-secondary);
  border-radius: var(--panel-border-radius);
  border: 1px solid var(--color-border-hover);
  padding: 0px;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  scrollbar-width: none;
  height: 100%;
}

/* Hide scrollbars */
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

/* Coach Quality Badge Styles */
.coach-badge-container {
  position: absolute;
  pointer-events: none;
  z-index: 5;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  box-sizing: border-box;
}

.coach-board-badge {
  width: 32%;
  height: 32%;
  min-width: 18px;
  min-height: 18px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.7);
  border: 1.8px solid #ffffff;
  user-select: none;
  z-index: 6;
  container-type: size; /* Establish container context for responsive child elements */
}

@media (max-width: 768px) {
  .coach-board-badge {
    min-width: 16px;
    min-height: 16px;
    border-width: 1.5px;
  }
}
</style>
