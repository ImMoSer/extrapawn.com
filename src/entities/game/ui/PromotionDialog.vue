<script setup lang="ts">
import type { Key } from '@lichess-org/chessground/types'
import { key2pos } from '@lichess-org/chessground/util'
import type { Role as ChessopsRole } from 'chessops/types'
import { computed } from 'vue'

const props = defineProps<{
  dest: Key
  color: 'white' | 'black'
  orientation: 'white' | 'black'
}>()

const emit = defineEmits<{
  (e: 'piece-selected', role: ChessopsRole): void
}>()

const promotionRoles: ChessopsRole[] = ['queen', 'knight', 'rook', 'bishop']

const squareStyles = computed(() => {
  const [file, rank] = key2pos(props.dest)

  return (role: ChessopsRole) => {
    const roleIndex = promotionRoles.indexOf(role)

    let col: number
    let row: number

    if (props.orientation === 'white') {
      col = file + 1
      const startRankIdx = rank
      const targetRankIdx =
        props.color === 'white' ? startRankIdx - roleIndex : startRankIdx + roleIndex
      row = 8 - targetRankIdx
    } else {
      col = 8 - file
      const startRankIdx = rank
      const targetRankIdx =
        props.color === 'white' ? startRankIdx - roleIndex : startRankIdx + roleIndex
      row = targetRankIdx + 1
    }

    return {
      gridColumn: col,
      gridRow: row,
    }
  }
})

function onPieceSelected(role: ChessopsRole) {
  emit('piece-selected', role)
}
</script>

<template>
  <div
    class="absolute inset-0 z-100 grid cursor-default touch-none grid-cols-8 grid-rows-8 bg-canvas/65"
    @click.stop
  >
    <div
      v-for="role in promotionRoles"
      :key="role"
      class="m-0.5 flex cursor-pointer items-center justify-center overflow-hidden rounded-full border border-border-hover bg-eval-white transition-transform duration-100 hover:scale-105 hover:border-brand"
      :style="squareStyles(role)"
      @click="onPieceSelected(role)"
    >
      <piece :class="`${color} ${role}`" class="h-full w-full bg-cover"></piece>
    </div>
  </div>
</template>
