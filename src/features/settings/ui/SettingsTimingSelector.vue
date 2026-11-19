<script setup lang="ts">
import { GAMEPLAY_TIMING_STEPS, type GameplayTimingMs } from '@/entities/user'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    steps?: readonly GameplayTimingMs[]
    unit?: string
    tone?: 'default' | 'danger'
  }>(),
  {
    steps: () => GAMEPLAY_TIMING_STEPS,
    unit: 'ms',
    tone: 'default',
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: GameplayTimingMs): void
}>()
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-2 mb-1.5">
      <span
        class="text-[11px] font-display font-medium uppercase tracking-wider truncate"
        :class="props.tone === 'danger' ? 'text-danger' : 'text-text-secondary'"
      >
        {{ props.label }}
      </span>
      <span
        v-if="props.unit"
        class="font-condensed text-[11px] font-semibold shrink-0"
        :class="props.tone === 'danger' ? 'text-danger/80' : 'text-text-disabled'"
      >
        {{ props.unit }}
      </span>
    </div>
    <div class="grid grid-cols-5 gap-1 p-1 rounded-md bg-canvas border border-border">
      <button
        v-for="stepMs in props.steps"
        :key="stepMs"
        type="button"
        class="min-w-0 overflow-hidden py-1 px-1 rounded-sm font-condensed font-bold text-xs transition-colors cursor-pointer border text-center"
        :class="
          props.modelValue === stepMs
            ? props.tone === 'danger'
              ? 'bg-danger/15 text-danger border-danger/40 shadow-xs'
              : 'bg-surface text-text-primary border-border-hover shadow-xs'
            : props.tone === 'danger'
              ? 'bg-transparent text-text-secondary border-transparent hover:text-danger'
              : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
        "
        @click="emit('update:modelValue', stepMs)"
      >
        <span class="truncate block">{{ stepMs }}</span>
      </button>
    </div>
  </div>
</template>
