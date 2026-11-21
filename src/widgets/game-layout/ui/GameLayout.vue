<script setup lang="ts">
import { useBoardStore, useGameStore, WebChessBoard } from '@/entities/game'
import { usePreferencesStore } from '@/entities/user'
import { useCoachStore, useCrashtestStore } from '@/features/coach'
import ControlCenter from './ControlCenter.vue'
import RightSidebarSlot from './RightSidebarSlot.vue'
import type { Key } from '@lichess-org/chessground/types'
import { computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    boardLocked?: boolean
  }>(),
  {
    boardLocked: false,
  },
)

const preferencesStore = usePreferencesStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const coachStore = useCoachStore()
const crashtestStore = useCrashtestStore()

onMounted(() => {
  crashtestStore.init()
})

onUnmounted(() => {
  gameStore.stop()
})

const effectiveAnimationDuration = computed(
  () =>
    boardStore.animationDurationOverrideMs ?? preferencesStore.preferences.theme.animationDuration,
)
const isAnimationEnabled = computed(() => effectiveAnimationDuration.value > 0)
const activeDests = computed(() => (props.boardLocked ? new Map() : boardStore.dests))

const isAnalysisMode = computed(() => gameStore.gamePhase === 'ANALYSIS')

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

      <!-- Center Stage: Top Info -> Board -> Controls -->
      <div class="center-stage">
        <!-- Top Sector -->
        <div class="cb-top-panel">
          <div class="top-info-slot">
            <slot name="top-info"></slot>
          </div>
        </div>

        <!-- Middle Row: Chessboard Sector -->
        <div class="board-row">
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
                  :animation-duration="effectiveAnimationDuration"
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

        <!-- Control Center Sector (hidden on mobile unless in active analysis) -->
        <div class="cb-bottom-panel" :class="{ 'is-fair-play-locked': coachStore.isFairPlayLocked }">
          <slot name="bottom-controls">
            <ControlCenter />
          </slot>
        </div>
      </div>

      <aside class="right-panel" :class="{ 'is-fair-play-locked': coachStore.isFairPlayLocked }">
        <slot name="right-panel">
          <RightSidebarSlot />
        </slot>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.game-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  width: 100%;
  padding: var(--layout-pad);
  box-sizing: border-box;
  overflow: hidden;
  background-color: var(--color-canvas);
}

.layout-main {
  display: grid;
  flex: 1;
  width: 100%;
  max-width: calc(var(--stage-shell-max-w) - var(--nav-rail-w) - (2 * var(--layout-pad)));
  grid-template-columns:
    minmax(var(--side-min-w), 1fr)
    var(--board-stage-w)
    minmax(var(--side-min-w), 1fr);
  gap: var(--layout-gap);
  min-height: 0;
  height: 100%;
}

/* --- Center Stage Area --- */
.center-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--board-gap);
  width: var(--board-stage-w);
  height: 100%;
  min-height: 0;
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
  width: 100%;
  height: var(--board-size);
  flex: 0 0 var(--board-size);
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
  border-radius: 0;
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
  padding: 0;
  min-width: 0;
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

/* --- Portrait / Compact Responsive Shell (matches DESKTOP_SHELL_MEDIA_QUERY complement) --- */
@media (max-width: 899px), (orientation: portrait) {
  .game-layout {
    height: 100%;
    overflow-y: auto;
    padding: 4px 4px calc(4px + env(safe-area-inset-bottom));
    display: block;
  }

  .layout-main {
    display: flex;
    flex-direction: column;
    max-width: 100%;
    height: auto;
    gap: 4px;
  }

  .center-stage {
    order: 1;
    width: 100%;
    height: auto;
    justify-content: flex-start;
    gap: 4px;
    overflow: hidden;
  }

  .board-row {
    width: 100%;
    height: auto;
    flex: 0 0 auto;
    align-items: stretch;
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

  .cb-top-panel,
  .cb-bottom-panel {
    width: 100%;
    height: 44px;
    flex: 0 0 44px;
  }

  .cb-bottom-panel.is-fair-play-locked,
  .right-panel.is-fair-play-locked {
    display: none;
  }

  .right-panel {
    order: 2;
    height: auto;
    min-height: 0;
    padding: 0;
    background: transparent;
    border: none;
  }

  .left-panel {
    order: 3;
    height: auto;
    min-height: 180px;
    padding: 0;
  }
}
</style>
