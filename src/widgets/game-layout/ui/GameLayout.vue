<!-- src/widgets/game-layout/GameLayout.vue -->
<script setup lang="ts">
import { useBoardStore, useGameStore, WebChessBoard } from '@/entities/game'
import { EvalBar, useAnalysisStore } from '@/features/analysis'
import { useThemeStore } from '@/features/settings'
import type { Key } from '@lichess-org/chessground/types'
import { storeToRefs } from 'pinia'
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps<{
  boardLocked?: boolean
}>()

const themeStore = useThemeStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const analysisStore = useAnalysisStore()
const { analysisLines } = storeToRefs(analysisStore)
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
  --board-size: calc(100vh - 20px - var(--top-panel-h) - 4px);
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
  /* Use the calculated board size for the center column to ensure wings get proper space */
  grid-template-columns: 2fr var(--board-size) 3fr;
  gap: 10px;
  min-height: 0;
  justify-content: center;
}

/* --- Center Stage Area --- */
.center-stage {
  --eval-bar-width: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 0;
  width: var(--board-size);
  height: calc(100vh - 20px);
}

.cb-top-panel {
  width: 100%;
  height: var(--top-panel-h);
  flex: 0 0 var(--top-panel-h);
  display: flex;
  justify-content: center;
  align-items: center;
  padding-bottom: 8px;
}

/* Board always square, sized by --board-size */
.board-section {
  flex: 0 0 var(--board-size);
  height: var(--board-size);
  width: var(--board-size);
  display: flex;
  align-items: stretch;
  gap: 0;
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

  .cb-top-panel {
    width: 100%;
    height: 48px;
    flex: 0 0 48px;
    padding-bottom: 0;
  }

  .board-section {
    /* Always reserve space for eval bar exactly */
    --board-size-mobile: calc(100vw - var(--eval-bar-width));
    height: var(--board-size-mobile);
    flex: 0 0 var(--board-size-mobile);
    justify-content: center;
  }

  .board-aspect-wrapper {
    width: calc(100vw - var(--eval-bar-width));
    height: calc(100vw - var(--eval-bar-width));
    aspect-ratio: 1 / 1;
    margin: 0;
    flex-shrink: 0;
  }
}
</style>
