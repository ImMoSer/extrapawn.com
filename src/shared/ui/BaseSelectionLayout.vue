<script setup lang="ts">
import { NButton, NCard, NH1, NSpace, NText } from 'naive-ui'
import { computed } from 'vue'

interface Props {
  title: string
  subtitle?: string
  accentType?: 'primary' | 'warning' | 'error' | 'success' | 'info'
  isTornado?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accentType: 'primary',
  isTornado: false,
})

const emit = defineEmits<{
  (e: 'start'): void
}>()

const accentColorVar = computed(() => `var(--color-${props.accentType})`)
</script>

<template>
  <div class="selection-container">
    <n-card class="glass selection-card" :bordered="false" content-style="padding: 12px">
      <n-space vertical :size="24" style="width: 100%">
        <div class="header" :class="{ 'tornado-header': isTornado }">
          <n-h1
            class="title"
            :class="{ 'tornado-title': isTornado }"
            :style="{ color: accentColorVar, margin: 0 }"
          >
            <slot name="title">{{ title }}</slot>
          </n-h1>
          <n-text depth="3" class="subtitle">
            <slot name="subtitle">{{ subtitle }}</slot>
          </n-text>
        </div>

        <div class="selection-sections">
          <slot name="sections"></slot>
        </div>

        <div class="actions">
          <n-button
            type="primary"
            size="large"
            block
            class="start-btn"
            @click="emit('start')"
            :style="
              accentType === 'warning' || accentType === 'error'
                ? {
                    backgroundColor: accentColorVar,
                    borderColor: accentColorVar,
                    boxShadow: `0 0 10px ${accentColorVar}`,
                  }
                : {}
            "
          >
            <slot name="start-button-label">START SESSION</slot>
          </n-button>
        </div>
      </n-space>
    </n-card>
  </div>
</template>

<style scoped>
.selection-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 85vh;
  padding: 5px;
}

.selection-card {
  width: 100%;
  max-width: 650px;
  border-radius: 20px;
  background: var(--bg-0, rgba(16, 16, 20, 0.7));
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.header {
  text-align: center;
  margin-bottom: 5px;
}

.title {
  font-size: 2.5rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.subtitle {
  font-size: 1rem;
  margin: 0;
  padding: 0;
}

.selection-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

:deep(.section) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  text-align: left;
}

:deep(.section-label) {
  font-weight: 600;
  color: var(--text-secondary, #999);
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.actions {
  width: 100%;
  margin-top: 16px;
}

.start-btn {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  height: 52px;
  border-radius: 12px;
  font-size: 1.1rem;
}

@media (max-width: 600px) {
  :deep(.n-card__content) {
    padding: 10px !important;
  }
  .title {
    font-size: 1.4rem;
  }

  .subtitle {
    display: none;
  }
  .selection-sections {
    gap: 5px;
  }
  :deep(.section-label) {
    font-weight: 600;
    color: var(--text-secondary, #999);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }
}
</style>
