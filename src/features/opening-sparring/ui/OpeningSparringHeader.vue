<script setup lang="ts">
import { RefreshOutline, TrophyOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NGrid,
  NGridItem,
  NIcon,
  NPageHeader,
  NSpace,
  NStatistic,
  NTag,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  averagePopularity: number
  averageWinRate: number
  isTheoryOver: boolean
  isDeviation: boolean
  isPlayoutMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'restart'): void
  (e: 'playout'): void
}>()

const { t } = useI18n()
</script>

<template>
  <n-card class="header-card" :bordered="false">
    <n-page-header class="opening-header">
      <template #title>
        <!-- Title moved to top-info panel above the board -->
      </template>

      <template #extra>
        <n-space align="center">
          <n-tag type="warning" size="small" round uppercase>
            <template #icon>
              <n-icon>
                <TrophyOutline />
              </n-icon>
            </template>
            {{ t('nav.openingSparring') }}
          </n-tag>
          <n-tag v-if="isTheoryOver" type="warning" size="small" round uppercase>
            {{ t('features.diamondHunter.header.bookEnded') }}
          </n-tag>
          <n-tag v-if="isDeviation" type="error" size="small" round uppercase>
            {{ t('features.diamondHunter.header.deviation') }}
          </n-tag>
          <n-tag v-if="isPlayoutMode" type="success" size="small" round uppercase> PLAYOUT </n-tag>
        </n-space>
      </template>

      <div class="stats-section">
        <n-grid :cols="2" :x-gap="12">
          <n-grid-item>
            <n-statistic
              :label="t('openingTrainer.header.popularity') || 'Popularity'"
              :value="averagePopularity"
            >
              <template #suffix>%</template>
            </n-statistic>
          </n-grid-item>
          <n-grid-item>
            <n-statistic
              :label="t('features.diamondHunter.header.winRate')"
              :value="averageWinRate"
            >
              <template #suffix>%</template>
            </n-statistic>
          </n-grid-item>
        </n-grid>
      </div>

      <template #footer>
        <div class="controls-section">
          <n-space vertical :size="12">
            <n-button block secondary @click="emit('restart')">
              <template #icon
                ><n-icon> <RefreshOutline /> </n-icon
              ></template>
              {{ t('features.diamondHunter.header.newSession') }}
            </n-button>
          </n-space>
        </div>
      </template>
    </n-page-header>
  </n-card>
</template>

<style scoped lang="scss">
.header-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
}

/* Title styles removed as title moved to top-info panel */

.stats-section {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.controls-section {
  margin-top: 16px;
}

.playout-btn {
  width: 100%;
}

:deep(.n-statistic) {
  .n-statistic-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--color-text-secondary);
  }

  .n-statistic-value__content {
    font-size: 1.1rem;
    font-weight: 700;
  }

  .n-statistic-value__suffix {
    font-size: 0.8rem;
    opacity: 0.6;
  }
}
</style>
