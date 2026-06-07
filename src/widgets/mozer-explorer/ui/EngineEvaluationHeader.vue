<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { NSwitch, NButton, NIcon, NPopover, NText, NSlider, NCheckbox } from 'naive-ui'
import { SettingsOutline } from '@vicons/ionicons5'
import { useAnalysisStore } from '@/features/analysis'
import { EngineLines } from '@/features/analysis'

const analysisStore = useAnalysisStore()
const { t } = useI18n()

const {
  isAnalysisActive,
  isLoading,
  analysisLines,
  multiPv,
  searchTime,
  showArrows,
} = storeToRefs(analysisStore)

// Current best score formatted
const bestScore = computed(() => {
  if (!isAnalysisActive.value) return 'OFF'
  if (isLoading.value || analysisLines.value.length === 0) return '...'
  
  const line = analysisLines.value[0]
  if (!line) return '...'
  
  if (line.score.type === 'cp') {
    const val = line.score.value / 100
    return (val > 0 ? '+' : '') + val.toFixed(2)
  }
  return t('features.analysis.mateInShort', { value: Math.abs(line.score.value) })
})

const bestScoreClass = computed(() => {
  if (!isAnalysisActive.value) return 'is-off'
  if (isLoading.value || analysisLines.value.length === 0) return 'is-loading'
  
  const line = analysisLines.value[0]
  if (!line) return 'is-neutral'
  
  const val = line.score.value
  if (line.score.type === 'mate') {
    return val > 0 ? 'is-white-winning' : 'is-black-winning'
  }
  
  if (val > 50) return 'is-white-better'
  if (val < -50) return 'is-black-better'
  return 'is-neutral'
})

const engineDepth = computed(() => {
  if (!isAnalysisActive.value || analysisLines.value.length === 0) return 0
  return analysisLines.value[0]?.depth || 0
})

const handleToggle = () => {
  analysisStore.toggleAnalysis()
}

const handlePvChange = (value: number) => {
  analysisStore.setMultiPv(value)
}

const handleShowArrowsChange = (value: boolean) => {
  analysisStore.setShowArrows(value)
}

// Search Time slider helper
const sliderSearchTime = computed({
  get() {
    return searchTime.value === 99 ? 35 : searchTime.value
  },
  set(val: number) {
    analysisStore.setSearchTime(val === 35 ? 99 : val)
  }
})

const searchTimeMarks = {
  5: '5s',
  15: '15s',
  25: '25s',
  35: '∞'
}

const formatSearchTimeTooltip = (value: number) => {
  if (value === 35) return '∞'
  return `${value}s`
}
</script>

<template>
  <div class="engine-evaluation-header glass-panel">
    <!-- Header Control Bar -->
    <div class="header-control-row">
      <div class="engine-info">
        <div class="engine-toggle-block">
          <n-switch 
            :value="isAnalysisActive" 
            @update:value="handleToggle" 
            size="medium"
            class="neon-switch"
          />
          <span class="engine-label">Stockfish 18</span>
        </div>
        <div v-if="isAnalysisActive" class="engine-depth-badge">
          <n-text depth="3">d: {{ engineDepth }}</n-text>
        </div>
      </div>

      <!-- Evaluation Pill & Settings -->
      <div class="eval-and-settings">
        <div :class="['eval-pill', bestScoreClass]">
          {{ bestScore }}
        </div>

        <n-popover trigger="click" placement="bottom-end" class="glass popup-settings">
          <template #trigger>
            <n-button quaternary circle class="settings-btn">
              <template #icon>
                <n-icon><SettingsOutline /></n-icon>
              </template>
            </n-button>
          </template>
          
          <div class="settings-content">
            <n-text strong class="settings-title">{{ t('features.analysis.engineSettings') || 'Engine-Optionen' }}</n-text>
            
            <!-- MultiPV Slider -->
            <div class="settings-field">
              <div class="field-label-row">
                <span class="field-label">MultiPV</span>
                <span class="field-value">{{ multiPv }} Lines</span>
              </div>
              <n-slider
                v-model:value="multiPv"
                :min="1"
                :max="5"
                :step="1"
                class="settings-slider"
                @update:value="handlePvChange"
              />
            </div>

            <!-- Search Time Slider -->
            <div class="settings-field">
              <div class="field-label-row">
                <span class="field-label">Suchzeit</span>
                <span class="field-value">{{ searchTime === 99 ? 'Unbegrenzt (∞)' : `${searchTime}s` }}</span>
              </div>
              <n-slider
                v-model:value="sliderSearchTime"
                :min="5"
                :max="35"
                :step="5"
                :marks="searchTimeMarks"
                :format-tooltip="formatSearchTimeTooltip"
                class="settings-slider"
              />
            </div>

            <!-- Show Arrows Checkbox -->
            <div class="settings-field checkbox-field">
              <n-checkbox
                :checked="showArrows"
                @update:checked="handleShowArrowsChange"
              >
                Pfeile auf Brett anzeigen
              </n-checkbox>
            </div>
          </div>
        </n-popover>
      </div>
    </div>

    <!-- PV lines preview -->
    <div v-show="isAnalysisActive" class="pv-lines-container">
      <EngineLines />
    </div>
  </div>
</template>

<style scoped lang="scss">
.engine-evaluation-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 14px;
  background: var(--bg-1);
  border-bottom: 1px solid var(--glass-border);
}

.header-control-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.engine-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.engine-toggle-block {
  display: flex;
  align-items: center;
  gap: 8px;
}

.engine-label {
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
  color: #fff;
}

.engine-depth-badge {
  font-family: monospace;
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.eval-and-settings {
  display: flex;
  align-items: center;
  gap: 8px;
}

.eval-pill {
  font-family: 'Fira Code', monospace;
  font-weight: 800;
  font-size: 0.95rem;
  padding: 4px 10px;
  border-radius: 8px;
  min-width: 58px;
  text-align: center;
  transition: all 0.25s ease;
  user-select: none;
  box-shadow: inset 0 0 4px rgba(255, 255, 255, 0.05);
}

/* Dynamic Eval Pill Colors based on position evaluation */
.eval-pill.is-off {
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-disabled);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.eval-pill.is-loading {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.eval-pill.is-white-winning,
.eval-pill.is-white-better {
  background: rgba(0, 229, 255, 0.15);
  color: var(--color-primary);
  border: 1px solid rgba(0, 229, 255, 0.35);
  box-shadow: 0 0 10px rgba(0, 229, 255, 0.15);
}

.eval-pill.is-black-winning,
.eval-pill.is-black-better {
  background: rgba(255, 7, 58, 0.15);
  color: var(--color-error);
  border: 1px solid rgba(255, 7, 58, 0.35);
  box-shadow: 0 0 10px rgba(255, 7, 58, 0.15);
}

.eval-pill.is-neutral {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.settings-btn {
  color: var(--text-secondary);
  &:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
  }
}

.popup-settings {
  background: var(--glass-bg, #0b0d17) !important;
  border: 1px solid var(--glass-border) !important;
  backdrop-filter: var(--glass-blur);
  border-radius: 8px;
}

.settings-content {
  padding: 12px 8px;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-title {
  font-size: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 6px;
  margin-bottom: 4px;
  color: #fff;
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary, #a1a1aa);
}

.field-value {
  font-size: 0.8rem;
  font-family: monospace;
  color: var(--neon-cyan, #1890ff);
  font-weight: 700;
}

.settings-slider {
  padding: 4px 0 16px; /* give room for marks */
}

.checkbox-field {
  padding-top: 6px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
}

.pv-lines-container {
  margin-top: 4px;
  border-top: 1px dashed rgba(255, 255, 255, 0.05);
  padding-top: 10px;
}
</style>
