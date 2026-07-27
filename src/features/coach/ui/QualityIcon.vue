<template>
  <span
    v-if="symbol"
    class="quality-icon"
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

<style scoped>
.quality-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-weight: 800;
  line-height: 1;
  user-select: none;
  text-align: center;
  font-style: normal;
}
</style>
