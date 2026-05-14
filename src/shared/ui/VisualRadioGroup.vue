<script setup lang="ts" generic="T extends string | number">
import { NText } from 'naive-ui'
import { computed } from 'vue'

interface Option<V> {
  label: string
  value: V
  icon?: string
  svg?: string
}

const props = defineProps<{
  value: T
  options: Option<T>[]
  columns?: number
  minWidth?: number
}>()

const emit = defineEmits<{
  (e: 'update:value', val: T): void
}>()

const gridStyle = computed(() => {
  if (props.columns) {
    return { gridTemplateColumns: `repeat(${props.columns}, 1fr)` }
  }
  if (props.minWidth) {
    return { gridTemplateColumns: `repeat(auto-fit, minmax(${props.minWidth}px, 1fr))` }
  }
  return {}
})
</script>

<template>
  <div class="visual-grid" :style="gridStyle">
    <div
      v-for="opt in options"
      :key="String(opt.value)"
      class="visual-card"
      :class="{ active: value === opt.value }"
      @click="emit('update:value', opt.value)"
    >
      <div v-if="opt.svg" class="icon-wrapper">
        <img :src="opt.svg" class="visual-svg" :alt="opt.label" />
      </div>
      <div v-else-if="opt.icon" class="icon-wrapper">
        <span class="visual-icon">{{ opt.icon }}</span>
      </div>
      <n-text class="visual-label" strong :depth="value === opt.value ? 1 : 2">
        {{ opt.label }}
      </n-text>
    </div>
  </div>
</template>

<style scoped>
.visual-grid {
  display: grid;
  gap: 12px;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
}

@media (max-width: 700px) {
  .visual-grid {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 8px;
  }
}

.visual-card {
  cursor: pointer;
  border-radius: 12px;
  background: var(--bg-1, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  padding: 16px 12px;
  text-align: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.visual-card:hover {
  background: var(--bg-2, rgba(255, 255, 255, 0.08));
  border-color: var(--color-primary, #63e2b7);
  transform: translateY(-2px);
}

.visual-card.active {
  background: rgba(var(--color-primary-rgb, 99, 226, 183), 0.1);
  border-color: var(--color-primary, #63e2b7);
  box-shadow: 0 0 0 1px var(--color-primary, #63e2b7);
}

.icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
}

.visual-icon {
  font-size: 1.8rem;
  line-height: 1;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.visual-svg {
  width: 32px;
  height: 32px;
}

.visual-card.active .visual-icon,
.visual-card.active .visual-svg {
  filter: drop-shadow(0 0 8px var(--neon-blue)) brightness(1.1) invert(0);
}

.visual-label {
  font-size: 0.85rem;
  line-height: 1.2;
}

/* Mobile Adaptation */
@media (max-width: 600px) {
  .visual-card {
    padding: 5px 5px;
  }
  .visual-icon {
    font-size: 1.5rem;
  }
  .visual-svg {
    width: 35px;
    height: 35px;
  }
  .visual-label {
    font-size: 0.75rem;
  }
}
</style>
