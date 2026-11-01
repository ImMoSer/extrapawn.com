<template>
  <span
    v-if="symbol"
    class="inline-flex items-center justify-center text-center font-display leading-none font-extrabold not-italic select-none"
    :style="computedStyle"
    aria-hidden="true"
  >
    {{ symbol }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  quality: string
  size?: number | string
  color?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  color: 'currentColor',
})

const SYMBOLS: Record<string, string> = {
  brilliant: '!!',
  great: '!',
  best: '★',
  excellent: '✓',
  good: '✓',
  neutral: 'ok',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  missed_mate: '✕',
}

const symbol = computed(() => SYMBOLS[props.quality] || '')

const computedStyle = computed(() => {
  const sizeVal = typeof props.size === 'number' ? `${props.size}px` : props.size
  return {
    fontSize: sizeVal,
    color: props.color,
  }
})
</script>
