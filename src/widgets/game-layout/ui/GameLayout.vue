<!-- src/widgets/game-layout/GameLayout.vue -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useBoardStore, useGameStore, WebChessBoard } from '@/entities/game'
import { EvalBar, useAnalysisStore } from '@/features/analysis'
import { useReplyTrainingStore, trainingController } from '@/features/study-reply-training'
import { useThemeStore } from '@/features/settings'
import type { Key } from '@lichess-org/chessground/types'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'

const props = defineProps<{
  boardLocked?: boolean
}>()

const themeStore = useThemeStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const trainingStore = useReplyTrainingStore()
const analysisStore = useAnalysisStore()
const { analysisLines } = storeToRefs(analysisStore)
const route = useRoute()

const isAnimationEnabled = computed(() => themeStore.currentTheme.animationDuration > 0)

const activeDests = computed(() => (props.boardLocked ? new Map() : boardStore.dests))

// Force analysis mode if we are in study views, to prevent race conditions or store resets
const effectiveAnalysisMode = computed(() => {
  return (
    boardStore.isAnalysisModeActive ||
    (route.path.startsWith('/study') && !route.path.startsWith('/study-speedrun'))
  )
})

const canUserEdit = computed(() => true)

const handleUserMove = async ({ orig, dest }: { orig: Key; dest: Key }) => {
  let uci: string | null = null
  if (effectiveAnalysisMode.value) {
    if (trainingStore.isReplyTrainingActive) {
      // Check if move is wrong. If wrong, trainingController reverts it and returns true.
      const isIntercepted = trainingController.handleWrongMoveIntercept(orig, dest)
      if (isIntercepted) return
    }

    uci = await boardStore.handleAnalysisMove({ orig, dest })

    if (uci && trainingStore.isReplyTrainingActive) {
      // Move was correct and mapped directly to PGN. Let trainingController process variation sequence.
      trainingController.onMoveSuccessfullyApplied()
    }
  } else {
    await gameStore.handleUserMove(orig, dest)
  }
}

const handleBoardWheel = (direction: 'up' | 'down') => {
  if (analysisStore.isAnalysisActive || effectiveAnalysisMode.value) {
    // Разрешаем скролл и v режиме анализа
    if (direction === 'up') {
      boardStore.navigatePgn('backward')
    } else {
      boardStore.navigatePgn('forward')
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
      boardStore.navigatePgn('backward')
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      boardStore.navigatePgn('forward')
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

      <!-- Center Stage: Top Info -> Board -> Controls -->
      <div class="center-stage" ref="centerColumnRef">
        <div class="cb-top-panel">
          <slot name="top-info"></slot>
        </div>

        <div class="board-section">
          <div class="eval-bar-wrapper">
            <EvalBar
              v-if="analysisStore.isAnalysisActive"
              :score="analysisLines[0]?.score ?? null"
              :wdl="analysisLines[0]?.wdl ?? null"
              :turn="analysisLines[0]?.initialTurn"
              :orientation="boardStore.orientation"
            />
          </div>

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
              @set-premove="({ orig, dest }) => boardStore.setPremove(orig, dest)"
              @unset-premove="() => boardStore.clearPremove()"
              @complete-promotion="boardStore.completePromotion"
              @wheel-navigate="handleBoardWheel"
              @shapes-change="(shapes) => boardStore.setDrawableShapes(shapes)"
            />
            <!-- Center slot for overlays or additional content -->
            <div class="center-column-overlay">
              <slot name="center-column"></slot>
            </div>
          </div>
        </div>

        <div class="cb-down-panel">
          <slot name="controls"></slot>
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
  /* Columns: Left (flex) | Center (Auto/Fit Content) | Right (flex) */
  /* Using minmax for center to prevent it from disappearing, but ideally it drives the width */
  grid-template-columns: 2fr auto 3fr;
  gap: 10px;
  min-height: 0;
  justify-content: center;
}

/* --- Center Stage Area --- */
.center-stage {
  --eval-bar-width: 4px;
  --board-size: 88vh; /* Single source of truth for board height */
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  min-width: min-content;
  height: calc(100vh - 20px); /* Adjust for padding */
}

.cb-top-panel,
.cb-down-panel {
  width: 100%;
  flex: 1; /* Space divided equally */
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 20px;
}

/* Board always square, sized by --board-size height on desktop */
.board-section {
  flex: 0 0 var(--board-size);
  height: var(--board-size);
  display: flex;
  align-items: stretch;
  gap: 0; /* No gaps allowed */
}

.board-aspect-wrapper {
  height: 100%; /* Fill parent Height */
  width: auto;
  aspect-ratio: 1 / 1; /* Maintain perfect square */
  position: relative;
  background-color: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  flex-shrink: 0;
}

.eval-bar-wrapper {
  width: var(--eval-bar-width);
  height: 100%;
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
  padding: 10px;
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
    /* Shrink side panels on smaller desktops */
    grid-template-columns: 250px auto 300px;
    gap: 10px;
  }
}

@media (orientation: portrait) {
  .game-layout {
    height: 100%;
    overflow-y: auto; /* Enable scroll for the whole page on mobile */
    padding: 0;
    display: block; /* Stack everything */
  }

  .layout-main {
    display: flex;
    flex-direction: column;
    gap: 4px; /* Minimal gap for mobile */
  }

  /* Reorder for Mobile: Board/Controls -> Analysis (Right) -> Stats (Left) */
  .center-stage {
    /* Always reserve space for eval bar exactly */
    --board-size: calc(100vw - var(--eval-bar-width));
    order: 1;
    width: 100vw;
    height: auto;
    justify-content: flex-start;
    gap: 0; /* Tightly fit */
    overflow: hidden;
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

  .cb-top-panel,
  .cb-down-panel {
    width: 100%;
    height: 48px;
    flex: 0 0 48px;
  }

  .board-section {
    height: var(--board-size);
    flex: 0 0 var(--board-size);
    justify-content: center;
  }

  .board-aspect-wrapper {
    width: var(--board-size);
    height: var(--board-size);
    aspect-ratio: 1 / 1;
    margin: 0;
    flex-shrink: 0;
  }
}
</style>
