<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NPopover, NText, NSlider, NCheckbox, NSelect } from 'naive-ui'
import { SettingsOutline } from '@vicons/ionicons5'
import { useAnalysisStore } from '../model/analysis.store'
import EngineLines from './EngineLines.vue'

const analysisStore = useAnalysisStore()
const { t } = useI18n()

const {
  isAnalysisActive,
  analysisLines,
  multiPv,
  searchTime,
  showArrows,
  engineVersion,
} = storeToRefs(analysisStore)

const bestScore = computed(() => {
  if (!isAnalysisActive.value || analysisLines.value.length === 0) return '...'

  const line = analysisLines.value[0]
  if (!line) return '...'

  if (line.score.type === 'cp') {
    const val = line.score.value / 100
    return (val > 0 ? '+' : '') + val.toFixed(2)
  }
  return t('features.analysis.mateInShort', { value: Math.abs(line.score.value) })
})

const bestScoreClass = computed(() => {
  if (!isAnalysisActive.value) {
    return 'bg-elevated/30 text-text-disabled border-border'
  }
  if (analysisLines.value.length === 0) {
    return 'bg-elevated/80 text-text-secondary border-border-hover'
  }

  const line = analysisLines.value[0]
  if (!line) {
    return 'bg-elevated/80 text-text-primary border-border-hover'
  }

  const val = line.score.value
  if (line.score.type === 'mate') {
    return val > 0
      ? 'bg-success/15 text-success border-success/35'
      : 'bg-danger/15 text-danger border-danger/35'
  }

  if (val > 50) {
    return 'bg-success/15 text-success border-success/35'
  }
  if (val < -50) {
    return 'bg-danger/15 text-danger border-danger/35'
  }
  return 'bg-elevated/80 text-text-primary border-border-hover'
})

const engineDepth = computed(() => {
  if (!isAnalysisActive.value || analysisLines.value.length === 0) return 0
  return analysisLines.value[0]?.depth || 0
})

const handlePvChange = (value: number) => {
  analysisStore.setMultiPv(value)
}

const handleShowArrowsChange = (value: boolean) => {
  analysisStore.setShowArrows(value)
}

const engineVersionOptions = [
  { label: 'Stockfish 19 Lite (~2 MB)', value: 'lite' },
  { label: 'Stockfish 19 Full (~95 MB)', value: 'full' },
]

const handleEngineVersionChange = (value: 'lite' | 'full') => {
  analysisStore.setEngineVersion(value)
}

const sliderSearchTime = computed({
  get() {
    return searchTime.value === 99 ? 35 : searchTime.value
  },
  set(val: number) {
    analysisStore.setSearchTime(val === 35 ? 99 : val)
  },
})

const searchTimeMarks = {
  5: '5s',
  15: '15s',
  25: '25s',
  35: '∞',
}

const formatSearchTimeTooltip = (value: number) => {
  if (value === 35) return '∞'
  return `${value}s`
}
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-border bg-surface px-3.5 py-3">
    <!-- Header Control Bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-[0.9rem] font-bold tracking-[0.5px] text-text-primary">
          Stockfish 19 {{ engineVersion === 'full' ? 'Full' : 'Lite' }}
        </span>
        <div
          v-if="isAnalysisActive"
          class="rounded border border-border bg-elevated/60 px-1.5 py-0.5 font-condensed text-xs"
        >
          <n-text depth="3">d: {{ engineDepth }}</n-text>
        </div>
      </div>

      <!-- Evaluation Pill & Settings -->
      <div class="flex items-center gap-2">
        <div
          class="min-w-[58px] rounded-md border px-2.5 py-1 text-center font-condensed text-[0.95rem] font-extrabold transition-all duration-200 select-none"
          :class="bestScoreClass"
        >
          {{ bestScore }}
        </div>

        <n-popover trigger="click" placement="bottom-end" class="glass">
          <template #trigger>
            <n-button
              quaternary
              circle
              class="text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
            >
              <template #icon>
                <n-icon><SettingsOutline /></n-icon>
              </template>
            </n-button>
          </template>

          <div class="flex min-w-[220px] flex-col gap-4 px-2 py-3">
            <n-text
              strong
              class="mb-1 border-b border-border pb-1.5 text-[0.85rem] text-text-primary"
            >
              {{ t('features.analysis.engineSettings') }}
            </n-text>

            <!-- Engine Version Select -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">
                  {{ t('features.analysis.engineVersion') }}
                </span>
              </div>
              <n-select
                :value="engineVersion"
                :options="engineVersionOptions"
                size="small"
                @update:value="handleEngineVersionChange"
              />
            </div>

            <!-- MultiPV Slider -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">MultiPV</span>
                <span class="font-condensed text-xs font-bold text-brand">
                  {{ t('features.analysis.lines', { count: multiPv }) }}
                </span>
              </div>
              <n-slider
                v-model:value="multiPv"
                :min="1"
                :max="5"
                :step="1"
                class="pt-1 pb-4"
                @update:value="handlePvChange"
              />
            </div>

            <!-- Search Time Slider -->
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">
                  {{ t('features.analysis.searchTime') }}
                </span>
                <span class="font-condensed text-xs font-bold text-brand">
                  {{ searchTime === 99 ? t('features.analysis.unlimited') : `${searchTime}s` }}
                </span>
              </div>
              <n-slider
                v-model:value="sliderSearchTime"
                :min="5"
                :max="35"
                :step="5"
                :marks="searchTimeMarks"
                :format-tooltip="formatSearchTimeTooltip"
                class="pt-1 pb-4"
              />
            </div>

            <!-- Show Arrows Checkbox -->
            <div class="flex flex-col gap-2 border-t border-dashed border-border pt-1.5">
              <n-checkbox :checked="showArrows" @update:checked="handleShowArrowsChange">
                {{ t('features.analysis.showArrows') }}
              </n-checkbox>
            </div>
          </div>
        </n-popover>
      </div>
    </div>

    <!-- PV lines preview -->
    <div v-show="isAnalysisActive" class="mt-1 border-t border-dashed border-border pt-2.5">
      <EngineLines />
    </div>
  </div>
</template>
