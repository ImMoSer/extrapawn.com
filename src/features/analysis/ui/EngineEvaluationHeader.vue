<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { NButton, NIcon, NPopover, NText, NCheckbox } from 'naive-ui'
import { RefreshOutline, SettingsOutline } from '@vicons/ionicons5'
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
  engineLoadingState,
  isEngineLoading,
  isTablebaseMode,
} = storeToRefs(analysisStore)

const downloadPercent = computed<number | null>(() => {
  const prog = engineLoadingState.value.progress
  if (!prog || prog.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round(prog.percent * 100)))
})

const downloadSizeText = computed<string>(() => {
  const prog = engineLoadingState.value.progress
  if (!prog || prog.total <= 0) return ''
  const loadedMb = (prog.loaded / 1048576).toFixed(1)
  const totalMb = (prog.total / 1048576).toFixed(1)
  return `${loadedMb} / ${totalMb} MB`
})

const downloadSpeedAndEtaText = computed<string>(() => {
  const prog = engineLoadingState.value.progress
  if (!prog) return ''
  const parts: string[] = []
  if (prog.speedText) parts.push(prog.speedText)
  if (prog.etaText) parts.push(prog.etaText)
  return parts.join(' · ')
})

const bestScore = computed(() => {
  if (!isAnalysisActive.value || analysisLines.value.length === 0) return '...'

  const line = analysisLines.value[0]
  if (!line) return '...'

  if (line.score.type === 'cp') {
    const val = line.score.value / 100
    return (val > 0 ? '+' : '') + val.toFixed(2)
  }
  const sign = line.score.value > 0 ? '+' : line.score.value < 0 ? '-' : ''
  return `${sign}${t('features.analysis.mateInShort', { value: Math.abs(line.score.value) })}`
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

const handleRetryEngineLoad = () => {
  void analysisStore.retryEngineLoad()
}

const MULTI_PV_STEPS = [1, 2, 3, 4, 5] as const

const SEARCH_TIME_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 15, label: '15s' },
  { value: 25, label: '25s' },
  { value: 99, label: '∞' },
]

const handleSearchTimeChange = (value: number) => {
  analysisStore.setSearchTime(value)
}
</script>

<template>
  <div class="flex flex-col gap-3 border-b border-border bg-surface px-3.5 py-3">
    <!-- Header Control Bar -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="text-[0.9rem] font-bold tracking-[0.5px] text-text-primary">
          {{ isTablebaseMode ? 'Gaviota TB' : 'Stockfish 19' }}
        </span>
        <div
          v-if="isTablebaseMode"
          class="rounded border border-brand/40 bg-brand/10 px-1.5 py-0.5 font-condensed text-xs font-bold text-brand"
        >
          DTM ≤5
        </div>
        <div
          v-else-if="isEngineLoading"
          class="inline-flex items-center gap-1.5 rounded border border-brand/35 bg-brand/10 px-2 py-0.5 font-condensed text-xs font-bold text-brand"
        >
          <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
          <span>
            {{
              downloadPercent !== null
                ? `${downloadPercent}%`
                : t('features.analysis.initializingShort')
            }}
          </span>
        </div>
        <div
          v-else-if="isAnalysisActive"
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
              :title="t('features.analysis.engineSettings')"
              :aria-label="t('features.analysis.engineSettings')"
              class="text-text-secondary hover:bg-elevated/60 hover:text-text-primary"
            >
              <template #icon>
                <n-icon><SettingsOutline /></n-icon>
              </template>
            </n-button>
          </template>

          <div class="flex min-w-[240px] flex-col gap-3.5 px-2 py-3">
            <n-text
              strong
              class="mb-1 border-b border-border pb-1.5 text-[0.85rem] text-text-primary"
            >
              {{ t('features.analysis.engineSettings') }}
            </n-text>

            <!-- MultiPV Presets -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">MultiPV</span>
                <span class="font-condensed text-xs font-bold text-brand">
                  {{ t('features.analysis.lines', { count: multiPv }) }}
                </span>
              </div>
              <div class="grid grid-cols-5 gap-1 p-1 rounded-md bg-canvas border border-border">
                <button
                  v-for="pv in MULTI_PV_STEPS"
                  :key="pv"
                  type="button"
                  class="min-w-0 overflow-hidden py-1 px-1 rounded-sm font-condensed font-bold text-xs transition-colors cursor-pointer border text-center"
                  :class="
                    multiPv === pv
                      ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                      : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                  "
                  @click="handlePvChange(pv)"
                >
                  <span class="truncate block">{{ pv }}</span>
                </button>
              </div>
            </div>

            <!-- Search Time Presets -->
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-text-secondary">
                  {{ t('features.analysis.searchTime') }}
                </span>
                <span class="font-condensed text-xs font-bold text-brand">
                  {{ searchTime === 99 ? t('features.analysis.unlimited') : `${searchTime}s` }}
                </span>
              </div>
              <div class="grid grid-cols-5 gap-1 p-1 rounded-md bg-canvas border border-border">
                <button
                  v-for="opt in SEARCH_TIME_OPTIONS"
                  :key="opt.value"
                  type="button"
                  class="min-w-0 overflow-hidden py-1 px-1 rounded-sm font-condensed font-bold text-xs transition-colors cursor-pointer border text-center"
                  :class="
                    searchTime === opt.value
                      ? 'bg-surface text-text-primary border-border-hover shadow-xs'
                      : 'bg-transparent text-text-secondary border-transparent hover:text-text-primary'
                  "
                  @click="handleSearchTimeChange(opt.value)"
                >
                  <span class="truncate block">{{ opt.label }}</span>
                </button>
              </div>
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

    <!-- WASM Download / Initialization Progress Panel -->
    <div
      v-if="isEngineLoading"
      class="mt-1 border-t border-dashed border-border pt-2.5"
    >
      <div class="flex min-h-[90px] flex-col justify-center gap-2.5 rounded-md border border-border bg-canvas px-3.5 py-3">
        <div class="flex items-center justify-between gap-2 text-xs">
          <span class="font-semibold text-text-primary">
            {{
              engineLoadingState.phase === 'initializing'
                ? t('features.analysis.initializingEngine')
                : t('features.analysis.downloadingEngine')
            }}
          </span>
          <span
            v-if="downloadPercent !== null"
            class="font-condensed font-bold text-brand"
          >
            {{ downloadPercent }}%
          </span>
        </div>

        <div class="h-2 w-full overflow-hidden rounded-full bg-elevated">
          <div
            class="h-full rounded-full bg-brand transition-all duration-150"
            :class="{
              'animate-pulse':
                engineLoadingState.phase === 'initializing' || downloadPercent === null,
            }"
            :style="{
              width: `${downloadPercent !== null ? Math.max(4, downloadPercent) : 100}%`,
            }"
          />
        </div>

        <div class="flex items-center justify-between gap-2 font-condensed text-[11px] text-text-secondary">
          <span v-if="downloadSizeText">
            {{ downloadSizeText }}
          </span>
          <span v-else>
            {{ t('features.analysis.downloadingEngineHint') }}
          </span>

          <span v-if="downloadSpeedAndEtaText" class="text-text-secondary">
            {{ downloadSpeedAndEtaText }}
          </span>
        </div>
      </div>
    </div>

    <!-- Engine Load Error Panel -->
    <div
      v-else-if="engineLoadingState.phase === 'error'"
      class="mt-1 border-t border-dashed border-border pt-2.5"
    >
      <div class="flex min-h-[90px] flex-col items-center justify-center gap-2 rounded-md border border-danger/35 bg-canvas px-3.5 py-3 text-center">
        <span class="text-xs font-semibold text-danger">
          {{ t('features.analysis.engineLoadError') }}
        </span>
        <n-button size="tiny" secondary type="error" @click="handleRetryEngineLoad">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
          {{ t('shared.actions.retry') }}
        </n-button>
      </div>
    </div>

    <!-- PV lines preview -->
    <div v-else-if="isAnalysisActive" class="mt-1 border-t border-dashed border-border pt-2.5">
      <EngineLines />
    </div>
  </div>
</template>
