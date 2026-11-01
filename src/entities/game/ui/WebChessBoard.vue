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
import { tokens } from '@/shared/theme/tokens'
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
  canEdit: { type: Boolean, default: true },
  hideNag: { type: Boolean, default: false },
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
  green: { key: 'g', color: 'var(--color-success)', opacity: 1, lineWidth: 10 },
  red: { key: 'r', color: 'var(--color-danger)', opacity: 1, lineWidth: 10 },
  blue: { key: 'b', color: 'var(--color-info)', opacity: 1, lineWidth: 10 },
  yellow: { key: 'y', color: 'var(--color-warning)', opacity: 1, lineWidth: 10 },
  orange: { key: 'o', color: 'var(--color-orange)', opacity: 1, lineWidth: 10 },
  purple: { key: 'u', color: 'var(--color-neon-purple)', opacity: 1, lineWidth: 10 },
  enginePlan: { key: 'p', color: 'var(--color-highlight)', opacity: 1, lineWidth: 10 },
  bestmove: { key: 'p', color: 'var(--color-highlight)', opacity: 1, lineWidth: 10 },
  cyan: { key: 'c', color: 'var(--color-neon-cyan)', opacity: 1, lineWidth: 10 },
  pink: { key: 'k', color: 'var(--color-highlight)', opacity: 1, lineWidth: 10 },
  brown: { key: 'w', color: 'var(--color-orange-warm)', opacity: 1, lineWidth: 10 },
  gray: { key: 'x', color: 'var(--color-text-secondary)', opacity: 1, lineWidth: 10 },
  paleBlue: { key: 'pb', color: 'var(--color-info)', opacity: 0.4, lineWidth: 15 },
  paleGreen: { key: 'pg', color: 'var(--color-success)', opacity: 0.4, lineWidth: 15 },

  // Coach-specific thin brushes
  coachgreen: { key: 'G', color: 'var(--color-success)', opacity: 0.5, lineWidth: 5 },
  coachred: { key: 'R', color: 'var(--color-danger)', opacity: 0.5, lineWidth: 5 },
  coachblue: { key: 'B', color: 'var(--color-info)', opacity: 0.5, lineWidth: 5 },
  coachyellow: { key: 'Y', color: 'var(--color-warning)', opacity: 0.5, lineWidth: 5 },
  coachorange: { key: 'O', color: 'var(--color-orange)', opacity: 0.5, lineWidth: 5 },
  coachpurple: { key: 'U', color: 'var(--color-neon-purple)', opacity: 0.9, lineWidth: 5 },
  coachcyan: { key: 'C', color: 'var(--color-neon-cyan)', opacity: 0.5, lineWidth: 5 },
  coachpink: { key: 'K', color: 'var(--color-highlight)', opacity: 0.5, lineWidth: 5 },
  coachbrown: { key: 'W', color: 'var(--color-orange-warm)', opacity: 0.5, lineWidth: 5 },
  coachgray: { key: 'X', color: 'var(--color-text-disabled)', opacity: 0.5, lineWidth: 5 },
  coachpaleBlue: { key: 'PB', color: 'var(--color-info)', opacity: 0.4, lineWidth: 5 },
  coachpaleGreen: { key: 'PG', color: 'var(--color-success)', opacity: 0.4, lineWidth: 5 },
  coachenginePlan: { key: 'P', color: 'var(--color-highlight)', opacity: 0.5, lineWidth: 5 },
} as const

const NAG_SYMBOLS: Record<string, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  missed_mate: '✕',
}

function getNagSymbol(quality: string, nag?: string) {
  if (nag && NAG_SYMBOLS[nag]) return NAG_SYMBOLS[nag]
  if (quality && NAG_SYMBOLS[quality]) return NAG_SYMBOLS[quality]
  if (nag) return nag
  return '!'
}

const QUALITY_BG_COLOR: Record<string, string> = {
  brilliant: tokens.neonCyan,
  great: tokens.success,
  best: tokens.success,
  excellent: tokens.success,
  good: tokens.infoDeep,
  neutral: tokens.textSecondary,
  inaccuracy: tokens.warning,
  mistake: tokens.orange,
  blunder: tokens.danger,
  missed_mate: tokens.danger,
}

function getNagColor(quality: string): string {
  return QUALITY_BG_COLOR[quality] || tokens.success
}

type LooseShape = DrawShape & { stepBadge?: string; nag?: string; customNag?: string }

const combinedShapes = computed(() => {
  const raw = [...props.drawableShapes, ...boardStore.autoShapes] as LooseShape[]
  const result: DrawShape[] = []
  const nagAdded = new Set<string>()

  // 1. Last move NAG (if present and not hidden)
  if (!props.hideNag && boardStore.lastNag?.square) {
    const q = boardStore.lastNag.quality || 'brilliant'
    const sym = getNagSymbol(q, boardStore.lastNag.nag)
    const color = getNagColor(q)
    result.push({
      orig: boardStore.lastNag.square as Key,
      customSvg: {
        html: `<g><circle cx="82" cy="18" r="14" fill="${color}" stroke="${tokens.void}" stroke-width="2.5"/><text x="82" y="22.5" font-size="13" font-weight="900" font-family="sans-serif" fill="${tokens.void}" text-anchor="middle">${sym}</text></g>`,
        center: 'orig',
      },
    })
    nagAdded.add(boardStore.lastNag.square)
  }

  // 2. Iterate autoShapes and drawableShapes
  for (const s of raw) {
    if (s.orig && (s.nag || s.customNag) && !nagAdded.has(s.orig)) {
      const q = s.nag || s.customNag || 'brilliant'
      const sym = getNagSymbol(q, s.nag)
      const color = getNagColor(q)
      result.push({
        orig: s.orig as Key,
        customSvg: {
          html: `<g><circle cx="82" cy="18" r="14" fill="${color}" stroke="${tokens.void}" stroke-width="2.5"/><text x="82" y="22.5" font-size="13" font-weight="900" font-family="sans-serif" fill="${tokens.void}" text-anchor="middle">${sym}</text></g>`,
          center: 'orig',
        },
      })
      nagAdded.add(s.orig)
    } else if (s.orig && s.stepBadge) {
      const label = String(s.stepBadge)
      const badgeWidth = Math.max(26, label.length * 11)
      result.push({
        orig: s.orig as Key,
        customSvg: {
          html: `<g><rect x="4" y="4" width="${badgeWidth}" height="20" rx="4" fill="${tokens.warning}" stroke="${tokens.void}" stroke-width="1.5"/><text x="${4 + badgeWidth / 2}" y="17.5" font-size="12" font-weight="900" font-family="monospace" fill="${tokens.void}" text-anchor="middle">${label}</text></g>`,
          center: 'orig',
        },
      })
    } else if (s.orig && (s.dest || s.brush)) {
      const brushKey = typeof s.brush === 'string' ? s.brush : undefined
      const safeBrush = brushKey && brushKey in CHESSGROUND_BRUSHES ? brushKey : 'green'
      result.push({
        orig: s.orig as Key,
        dest: s.dest as Key | undefined,
        brush: safeBrush,
        modifiers: s.modifiers,
      })
    }
  }

  return result
})

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
          const autoKey = (s: DrawShape) => `${s.orig}-${s.dest || ''}-${s.brush || ''}`
          const autoKeys = new Set(boardStore.autoShapes.map(autoKey))
          const userShapes = (shapes as DrawShape[]).filter(
            (s) => !s.customSvg && !autoKeys.has(autoKey(s)),
          )
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

watch(
  [
    () => props.fen,
    () => props.orientation,
    () => props.turnColor,
    () => props.dests,
    () => props.lastMove,
    () => props.check,
    () => props.isAnalysisMode,
    () => props.canEdit,
    () => props.animationEnabled,
    () => props.animationDuration,
    combinedShapes,
  ],
  ([
    fen,
    orientation,
    turnColor,
    dests,
    lastMove,
    check,
    isAnalysisMode,
    canEdit,
    animationEnabled,
    animationDuration,
    shapes,
  ]) => {
    if (!ground.value) return

    boardStore.animationDurationMs = animationEnabled ? (animationDuration as number) : 0

    ground.value.set({
      fen,
      orientation,
      turnColor,
      check,
      lastMove,
      movable: {
        color: isAnalysisMode ? 'both' : orientation,
        dests: dests,
        free: false,
      },
      animation: {
        enabled: animationEnabled,
        duration: animationDuration,
      },
      drawable: {
        enabled: canEdit as boolean,
        brushes: CHESSGROUND_BRUSHES,
        shapes: shapes as DrawShape[],
      },
    })
  },
  { deep: true },
)
</script>

<template>
  <div class="absolute h-full w-full touch-none" @wheel.passive="handleWheel">
    <div ref="chessboardRef" class="h-full w-full"></div>

    <!-- Custom overlays slot -->
    <slot name="overlays"></slot>

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
/* Pulsating animation for the BEST MOVE (bestmove brush) */
@keyframes bestmove-arrow-pulse {
  0% {
    stroke-width: 0.3%;
  }
  50% {
    stroke-width: 0.5%;
  }
  100% {
    stroke-width: 0.3%;
  }
}

:deep(.cg-shapes) g.bestmove path,
:deep(.cg-shapes) g.bestmove line,
:deep(.cg-shapes) [stroke='var(--color-highlight)'] {
  animation: bestmove-arrow-pulse 1.8s infinite ease-in-out;
}

/* Make Coach-specific arrows thin and distinct */
:deep(.cg-shapes) g.coachgreen path,
:deep(.cg-shapes) g.coachgreen line,
:deep(.cg-shapes) g.coachred path,
:deep(.cg-shapes) g.coachred line,
:deep(.cg-shapes) g.coachblue path,
:deep(.cg-shapes) g.coachblue line,
:deep(.cg-shapes) g.coachyellow path,
:deep(.cg-shapes) g.coachyellow line,
:deep(.cg-shapes) g.coachorange path,
:deep(.cg-shapes) g.coachorange line,
:deep(.cg-shapes) g.coachpurple path,
:deep(.cg-shapes) g.coachpurple line,
:deep(.cg-shapes) g.coachcyan path,
:deep(.cg-shapes) g.coachcyan line,
:deep(.cg-shapes) g.coachpink path,
:deep(.cg-shapes) g.coachpink line,
:deep(.cg-shapes) g.coachbrown path,
:deep(.cg-shapes) g.coachbrown line,
:deep(.cg-shapes) g.coachgray path,
:deep(.cg-shapes) g.coachgray line,
:deep(.cg-shapes) g.coachpaleBlue path,
:deep(.cg-shapes) g.coachpaleBlue line,
:deep(.cg-shapes) g.coachpaleGreen path,
:deep(.cg-shapes) g.coachpaleGreen line {
  stroke-width: 0.35% !important;
}
</style>
