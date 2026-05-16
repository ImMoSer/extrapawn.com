<!-- src/components/WebChessBoard.vue -->
<script setup lang="ts">
import { Chessground } from '@lichess-org/chessground'
import type { Api } from '@lichess-org/chessground/api'
import type { Config } from '@lichess-org/chessground/config'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type {
  Color as ChessgroundColor,
  Dests,
  Key,
  MoveMetadata,
} from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops/types'
import { computed, onMounted, onUnmounted, ref, shallowRef, watch, type PropType } from 'vue'
import { useBoardStore, type PromotionState } from '../model/board.store'
import PromotionDialog from './PromotionDialog.vue'

const props = defineProps({
  fen: { type: String, required: true },
  orientation: { type: String as PropType<ChessgroundColor>, required: true },
  turnColor: { type: String as PropType<ChessgroundColor>, required: true },
  dests: { type: Map as PropType<Dests>, required: true },
  lastMove: { type: Array as PropType<Key[] | undefined>, default: undefined },
  check: { type: Boolean, default: false },
  promotionState: { type: Object as PropType<PromotionState | null>, default: null },
  drawableShapes: { type: Array as PropType<DrawShape[]>, default: () => [] },
  isAnalysisMode: { type: Boolean, default: false },
  animationEnabled: { type: Boolean, default: true },
  animationDuration: { type: Number, default: 200 },
  boardSyncCounter: { type: Number, default: 0 },
  canEdit: { type: Boolean, default: true },
})

const emit = defineEmits<{
  (e: 'user-move', payload: { orig: Key; dest: Key; metadata: MoveMetadata }): void
  (e: 'set-premove', payload: { orig: Key; dest: Key }): void
  (e: 'unset-premove'): void
  (e: 'complete-promotion', role: ChessopsRole): void
  (e: 'wheel-navigate', direction: 'up' | 'down'): void
  (e: 'shapes-change', shapes: DrawShape[]): void
}>()

const chessboardRef = ref<HTMLElement | null>(null)
const ground = shallowRef<Api | null>(null)
const boardStore = useBoardStore()

const CHESSGROUND_BRUSHES = {
  green: { key: 'g', color: '#15781B', opacity: 1, lineWidth: 10 },
  red: { key: 'r', color: '#882020', opacity: 1, lineWidth: 10 },
  blue: { key: 'b', color: '#0030C0', opacity: 1, lineWidth: 10 },
  yellow: { key: 'y', color: '#E6A000', opacity: 1, lineWidth: 10 },
  orange: { key: 'o', color: '#D56000', opacity: 1, lineWidth: 10 },
  purple: { key: 'p', color: '#6A2FB5', opacity: 1, lineWidth: 10 },
  cyan: { key: 'c', color: '#008BA1', opacity: 1, lineWidth: 10 },
  pink: { key: 'k', color: '#B3205D', opacity: 1, lineWidth: 10 },
  brown: { key: 'w', color: '#6D4C41', opacity: 1, lineWidth: 10 },
  gray: { key: 'x', color: '#616161', opacity: 1, lineWidth: 10 },
} as const

const nagMarkerStyle = computed(() => {
  if (!boardStore.lastNag) return null
  const square = boardStore.lastNag.square
  const file = square.charCodeAt(0) - 97 // a=0
  const rank = parseInt(square.charAt(1), 10) - 1 // 1=0

  let top, left
  if (props.orientation === 'white') {
    top = (7 - rank) * 12.5
    left = file * 12.5
  } else {
    top = rank * 12.5
    left = (7 - file) * 12.5
  }

  return {
    top: `${top}%`,
    left: `${left}%`,
    width: '12.5%',
    height: '12.5%',
  }
})

const getNagColor = (quality: string) => {
  switch (quality) {
    case 'blunder':
      return 'var(--color-nag-blunder)'
    case 'mistake':
      return 'var(--color-nag-mistake)'
    case 'inaccuracy':
      return 'var(--color-nag-inaccuracy)'
    case 'best':
      return 'var(--color-nag-best)'
    case 'brilliant':
      return 'var(--color-nag-brilliant)'
    case 'interesting':
      return 'var(--color-nag-interesting)'
    case 'better-white':
    case 'advantage-white':
    case 'winning-white':
    case 'decisive-white':
      return 'var(--color-success)'
    case 'better-black':
    case 'advantage-black':
    case 'winning-black':
    case 'decisive-black':
      return 'var(--color-error)'
    case 'equal':
      return 'var(--color-text-secondary)'
    case 'novelty':
      return 'var(--color-accent-primary)'
    case 'initiative':
    case 'attack':
    case 'counterplay':
      return 'var(--color-warning)'
    default:
      return 'var(--color-accent-primary)'
  }
}

const handleWheel = (event: WheelEvent) => {
  emit('wheel-navigate', event.deltaY > 0 ? 'down' : 'up')
}

onMounted(() => {
  if (chessboardRef.value) {
    const config: Config = {
      fen: props.fen,
      orientation: props.orientation,
      turnColor: props.turnColor,
      check: props.check,
      lastMove: props.lastMove,
      movable: {
        free: false,
        color: props.isAnalysisMode ? 'both' : props.orientation,
        dests: props.dests,
        showDests: true,
        events: {
          after: (orig, dest, metadata) => {
            emit('user-move', { orig, dest, metadata })
          },
        },
      },
      premovable: {
        enabled: true,
        showDests: true,
        castle: true,
        events: {
          set: (orig, dest) => {
            emit('set-premove', { orig, dest })
          },
          unset: () => {
            emit('unset-premove')
          },
        },
      },
      animation: {
        enabled: props.animationEnabled,
        duration: props.animationDuration,
      },
      highlight: {
        lastMove: true,
        check: true,
      },
      drawable: {
        enabled: true,
        brushes: CHESSGROUND_BRUSHES,
        shapes: combinedShapes.value as DrawShape[],
        onChange: (shapes) => {
          const autoKey = (s: DrawShape) => `${s.orig}-${s.dest}-${s.brush}`
          const autoKeys = new Set(boardStore.autoShapes.map(autoKey))
          const userShapes = (shapes as DrawShape[]).filter((s) => !autoKeys.has(autoKey(s)))
          emit('shapes-change', userShapes)
        },
      },
    }
    ground.value = Chessground(chessboardRef.value, config)
  }
})

onUnmounted(() => {
  ground.value?.destroy()
  ground.value = null
})

// --- Atomic Watchers ---

// 1. Critical Position Update and Premove Check
watch(
  () => props.fen,
  (newFen) => {
    if (!ground.value) return

    ground.value.set({
      fen: newFen,
      turnColor: props.turnColor, // Ensure turn color is synced with FEN
      drawable: {
        brushes: CHESSGROUND_BRUSHES,
        shapes: combinedShapes.value as DrawShape[]
      },
    })
  },
)

// 1b. Force sync from counter
watch(
  () => props.boardSyncCounter,
  () => {
    if (!ground.value) return
    ground.value.set({
      fen: props.fen,
      lastMove: props.lastMove,
      check: props.check,
      turnColor: props.turnColor,
      drawable: {
        brushes: CHESSGROUND_BRUSHES,
        shapes: combinedShapes.value as DrawShape[]
      },
    })
  },
)

// 2. Orientation
watch(
  () => props.orientation,
  (newOri) => {
    ground.value?.set({ orientation: newOri })
  },
)

// 3. Move Configuration
watch(
  [() => props.dests, () => props.turnColor, () => props.isAnalysisMode, () => props.canEdit],
  ([dests, turnColor, isAnalysis, canEdit]) => {
    ground.value?.set({
      turnColor,
      movable: {
        color: isAnalysis ? 'both' : props.orientation,
        dests: dests,
        free: false,
      },
      drawable: {
        enabled: canEdit as boolean,
        brushes: CHESSGROUND_BRUSHES,
      },
    })
  },
)

// 4. Visuals (Last Move, Check)
watch(
  () => props.lastMove,
  (lm) => {
    ground.value?.set({ lastMove: lm })
  },
)

watch(
  () => props.check,
  (val) => {
    ground.value?.set({ check: val })
  },
)

// 5. Shapes
const combinedShapes = computed(() => {
  return [...props.drawableShapes, ...boardStore.autoShapes]
})

watch(
  combinedShapes,
  (shapes) => {
    ground.value?.setShapes(shapes as DrawShape[])
  },
  { deep: true },
)

// 6. Animation Settings
watch([() => props.animationEnabled, () => props.animationDuration], ([enabled, duration]) => {
  ground.value?.set({
    animation: { enabled, duration },
  })
})
</script>

<template>
  <div class="board-wrapper" @wheel.passive="handleWheel">
    <div ref="chessboardRef" class="chessboard"></div>

    <!-- NAG Marker Overlay -->
    <div v-if="boardStore.lastNag && nagMarkerStyle" class="nag-container" :style="nagMarkerStyle">
      <div class="nag-badge" :style="{ backgroundColor: getNagColor(boardStore.lastNag.quality) }">
        {{ boardStore.lastNag.nag }}
      </div>
    </div>

    <PromotionDialog
      v-if="promotionState"
      :dest="promotionState.dest"
      :color="promotionState.color"
      :orientation="orientation"
      @piece-selected="(role) => emit('complete-promotion', role)"
    />
  </div>
</template>

<style scoped>
.board-wrapper {
  width: 100%;
  height: 100%;
  position: absolute;
  /* Блокируем системный скролл на доске */
  touch-action: none;
}

.chessboard {
  width: 100%;
  height: 100%;
}

.nag-container {
  position: absolute;
  pointer-events: none;
  z-index: 5; /* Higher than board but lower than promotion dialog */
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  box-sizing: border-box;
}

.nag-badge {
  width: 30%;
  height: 30%;
  min-width: 18px;
  min-height: 18px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #ffffff; /* White text */
  font-weight: 800; /* Bold */
  font-size: 1.5rem;
  box-shadow: 0 3px 6px rgba(0, 0, 0, 0.7);
  border: 1.8px solid #ffffff; /* White border */
  /* Remove outgoing transform to keep inside the square */
  user-select: none;
  z-index: 6;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5); /* Boost contrast for symbols */
}

@media (max-width: 768px) {
  .nag-badge {
    font-size: 0.9rem;
    min-width: 16px;
    min-height: 16px;
  }
}
</style>
