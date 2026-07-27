<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    role: 'k' | 'q' | 'r' | 'b' | 'n' | 'p' | string
    color?: 'white' | 'black'
    size?: number
  }>(),
  {
    color: 'white',
    size: 16,
  }
)

const SYMBOLS: Record<string, { w: string; b: string }> = {
  k: { w: '♔', b: '♚' },
  q: { w: '♕', b: '♛' },
  r: { w: '♖', b: '♜' },
  b: { w: '♗', b: '♝' },
  n: { w: '♘', b: '♞' },
  p: { w: '♙', b: '♟' },
}

const glyph = computed(() => {
  const r = props.role?.toLowerCase() || 'p'
  const entry = SYMBOLS[r] || SYMBOLS.p
  return props.color === 'black' ? entry.b : entry.w
})
</script>

<template>
  <span
    class="inline-flex items-center justify-center font-mono leading-none select-none"
    :style="{ fontSize: `${size}px`, width: `${size}px`, height: `${size}px` }"
  >
    {{ glyph }}
  </span>
</template>
