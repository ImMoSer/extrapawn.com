<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    evalCp?: number | null
    mate?: number | null
    result?: string | null
    loading?: boolean
    orientation?: 'white' | 'black'
    showLabel?: boolean
  }>(),
  {
    orientation: 'white',
    evalCp: null,
    mate: null,
    result: null,
    loading: false,
    showLabel: false,
  }
)

const isMate = computed(() => props.mate !== null && props.mate !== undefined && props.mate !== 0)
const isResult = computed(() => !!props.result)

const cpForBar = computed(() => {
  if (isResult.value) {
    return props.result === '1-0' ? 1000 : props.result === '0-1' ? -1000 : 0
  }
  if (isMate.value) {
    return (props.mate ?? 0) > 0 ? 1000 : -1000
  }
  return props.evalCp || 0
})

const percentage = computed(() => {
  const clamped = Math.max(-1000, Math.min(1000, cpForBar.value))
  return 50 + (clamped / 1000) * 50
})

const label = computed(() => {
  if (props.loading) return '--'
  if (isResult.value) return props.result || ''
  if (isMate.value) {
    const m = props.mate ?? 0
    return m > 0 ? `+ M${m}` : m < 0 ? `- M${Math.abs(m)}` : 'M'
  }
  if (props.evalCp === null || props.evalCp === undefined) return '--'
  const v = (props.evalCp / 100).toFixed(2)
  return props.evalCp > 0 ? `+${v}` : `${v}`
})

const isWhiteAdvantage = computed(() => {
  if (isResult.value) {
    if (props.result === '1-0') return true
    if (props.result === '0-1') return false
    return true
  }
  if (isMate.value) {
    return (props.mate ?? 0) > 0
  }
  return (props.evalCp ?? 0) >= 0
})

const labelAtTop = computed(() => {
  return props.orientation === 'black' ? !isWhiteAdvantage.value : isWhiteAdvantage.value
})

const labelOnDark = computed(() => labelAtTop.value)
</script>

<template>
  <div
    class="w-full h-full bg-void border border-border rounded relative overflow-hidden flex shadow-inner"
    :class="orientation === 'black' ? 'flex-col-reverse' : 'flex-col'"
  >
    <!-- Black portion (top) -->
    <div
      class="transition-[flex] duration-350 ease-out bg-elevated"
      :style="{ flex: `${100 - percentage} 0 0` }"
    />
    <!-- White portion (bottom) -->
    <div
      class="transition-[flex] duration-350 ease-out bg-text-primary"
      :style="{ flex: `${percentage} 0 0` }"
    />

    <!-- Mid-rank tick: 0 line -->
    <div
      class="absolute top-1/2 left-[8%] right-[8%] h-[1px] pointer-events-none"
      :class="percentage >= 50 ? 'bg-black/20' : 'bg-white/20'"
    />

    <!-- Numeric label inside the bar (optional) -->
    <div
      v-if="showLabel"
      class="absolute left-0 right-0 text-center text-[12px] font-black font-mono tracking-tight pointer-events-none select-none"
      :style="{
        top: labelAtTop ? '8px' : 'auto',
        bottom: !labelAtTop ? '8px' : 'auto',
        color: labelOnDark ? 'var(--color-text-primary)' : 'var(--color-void)',
        textShadow: labelOnDark ? '0 1px 1px rgba(0,0,0,0.6)' : '0 1px 0 rgba(255,255,255,0.5)',
      }"
    >
      {{ label }}
    </div>
  </div>
</template>
