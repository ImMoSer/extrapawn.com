<script setup lang="ts">
import { BulbOutline } from '@vicons/ionicons5'
import { NBadge, NButton, NIcon, NTooltip } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useSmartHintStore } from '../model/smart-hint.store'

const { t } = useI18n()
const smartHintStore = useSmartHintStore()

function handleRequestHint() {
  smartHintStore.requestHint()
}
</script>

<template>
  <div class="smart-hint-container">
    <n-tooltip trigger="hover">
      <template #trigger>
        <n-badge :value="smartHintStore.hintsLeft" :max="99" type="info">
          <n-button
            quaternary
            circle
            size="large"
            class="hint-btn"
            :disabled="smartHintStore.hintsLeft <= 0 || smartHintStore.isLoading"
            :loading="smartHintStore.isLoading"
            @click="handleRequestHint"
          >
            <template #icon>
              <n-icon class="icon-hint"><BulbOutline /></n-icon>
            </template>
          </n-button>
        </n-badge>
      </template>
      {{ t('controls.smartHint', 'Smart Hint') }}
    </n-tooltip>
  </div>
</template>

<style scoped lang="scss">
.smart-hint-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.hint-btn {
  transition: all 0.3s ease;

  .icon-hint {
    color: var(--color-text-secondary);
    transition: color 0.3s ease;
  }

  &:not(:disabled):hover {
    .icon-hint {
      color: var(--color-primary); // Make it pop on hover
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4));
    }
  }
}
</style>
