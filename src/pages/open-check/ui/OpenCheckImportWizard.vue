<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useOpenCheckStore } from '@/features/open-check'
import {
  NButton,
  NCard,
  NInput,
  NSelect,
  NSlider,
  NTag,
  NCheckboxGroup,
  NCheckbox,
  useMessage,
} from 'naive-ui'
import {
  ArrowBackOutline,
  CloudDownloadOutline,
  PlayOutline,
} from '@vicons/ionicons5'

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'success'): void
}>()

const openCheckStore = useOpenCheckStore()
const message = useMessage()

// Steps: 1 = Configure & Download, 2 = Select Root Move & Analyze
const step = ref<1 | 2>(1)
const selectedRootMove = ref<string | null>(null)

// Sliders temp state
const localGamesCount = ref(openCheckStore.gamesCount)
const localDepth = ref(openCheckStore.maxDepth)

// Watch store for updates (e.g. initial loads)
watch(() => openCheckStore.gamesCount, (val) => { localGamesCount.value = val })
watch(() => openCheckStore.maxDepth, (val) => { localDepth.value = val })

const isPremium = computed(() => openCheckStore.isPremium)

const colorOptions = [
  { label: 'White', value: 'white' },
  { label: 'Black (Premium)', value: 'black', disabled: !isPremium.value },
]

// Sync temp state back to store
function onGamesCountChange(val: number) {
  openCheckStore.gamesCount = val
}

function onDepthChange(val: number) {
  openCheckStore.maxDepth = val
}

// Download action (Step 1 -> Step 2)
async function handleDownload() {
  if (!openCheckStore.targetUsername.trim()) {
    message.error('Please enter a Lichess username.')
    return
  }

  await openCheckStore.downloadLichessGames()

  if (openCheckStore.error) {
    message.error(openCheckStore.error)
  } else if (openCheckStore.downloadedGames.length > 0) {
    message.success(`Successfully downloaded ${openCheckStore.downloadedGames.length} games.`)
    
    // Automatically select the most frequent root move if available
    const stats = openCheckStore.rootMoveStats
    if (stats && stats.length > 0 && stats[0]) {
      selectedRootMove.value = stats[0].value
    } else {
      selectedRootMove.value = null
    }

    step.value = 2
  }
}

// Analysis action (Step 2 -> Complete)
async function handleAnalyze() {
  if (!selectedRootMove.value) {
    message.error('Please select a root opening move.')
    return
  }

  message.loading('Analyzing games and generating opening tree...', { duration: 0 })
  await openCheckStore.runAnalysis(selectedRootMove.value)
  message.destroyAll()

  if (openCheckStore.error) {
    message.error(openCheckStore.error)
  } else {
    message.success('Analysis completed and saved successfully!')
    emit('success')
  }
}

function handleGoBack() {
  if (step.value === 2) {
    step.value = 1
  } else {
    emit('cancel')
  }
}
</script>

<template>
  <div class="import-wizard-panel">
    <!-- Header banner with back button -->
    <div class="sidebar-header-banner">
      <div class="header-action-row">
        <NButton quaternary circle size="small" @click="handleGoBack">
          <template #icon>
            <ArrowBackOutline />
          </template>
        </NButton>
        <span class="wizard-title">
          {{ step === 1 ? 'Import Games' : 'Select Opening' }}
        </span>
        <span class="step-badge">Step {{ step }} of 2</span>
      </div>
    </div>

    <!-- Step 1: Lichess Config & Download -->
    <NCard
      v-if="step === 1"
      class="panel-card"
      title="Step 1: Download from Lichess"
      size="small"
    >
      <div class="form-container">
        <!-- Lichess username -->
        <div class="form-group">
          <label class="form-label">Lichess Username</label>
          <NInput
            v-model:value="openCheckStore.targetUsername"
            placeholder="Enter Lichess ID"
            size="medium"
            clearable
          />
        </div>

        <!-- Color select -->
        <div class="form-group">
          <label class="form-label">Your Color</label>
          <NSelect
            v-model:value="openCheckStore.userColor"
            :options="colorOptions"
            size="medium"
          />
          <span v-if="!isPremium" class="input-lock-hint">
            Upgrade to Rook tier to analyze Black games.
          </span>
        </div>

        <!-- Max games count slider -->
        <div class="form-group">
          <div class="label-with-badge">
            <label class="form-label">Max Games to Fetch</label>
            <NTag size="small" type="info">{{ localGamesCount }}</NTag>
          </div>
          <NSlider
            v-model:value="localGamesCount"
            :min="openCheckStore.allowedGamesCountRange.min"
            :max="openCheckStore.allowedGamesCountRange.max"
            :step="openCheckStore.allowedGamesCountRange.step || 10"
            :disabled="!isPremium"
            @update:value="onGamesCountChange"
          />
          <span v-if="!isPremium" class="input-lock-hint">
            Standard limit is 100 games.
          </span>
        </div>

        <!-- Game Modes Checklist -->
        <div class="form-group">
          <label class="form-label">Game Modes</label>
          <NCheckboxGroup v-model:value="openCheckStore.perfTypes" :disabled="!isPremium">
            <div class="checkbox-grid">
              <NCheckbox value="bullet" label="Bullet" :disabled="!isPremium" />
              <NCheckbox value="blitz" label="Blitz" />
              <NCheckbox value="rapid" label="Rapid" />
              <NCheckbox value="classical" label="Classical" />
            </div>
          </NCheckboxGroup>
        </div>

        <div class="action-divider"></div>

        <!-- Trigger Download Button -->
        <NButton
          type="primary"
          block
          size="large"
          class="glow-btn-teal"
          :loading="openCheckStore.isDownloading"
          @click="handleDownload"
        >
          <template #icon>
            <CloudDownloadOutline />
          </template>
          Download Games
        </NButton>
      </div>
    </NCard>

    <!-- Step 2: Choose Root Move & Analysis Depth -->
    <NCard
      v-else-if="step === 2"
      class="panel-card"
      title="Step 2: Repertoire Settings"
      size="small"
    >
      <div class="form-container">
        <!-- Download stats summary -->
        <div class="download-stats-summary">
          <div class="stat-bubble">
            <div class="bubble-val">{{ openCheckStore.downloadedGames.length }}</div>
            <div class="bubble-lbl">Games parsed</div>
          </div>
        </div>

        <!-- Root Move select dropdown populated dynamically from download stats -->
        <div class="form-group">
          <label class="form-label">Root Opening Move</label>
          <NSelect
            v-model:value="selectedRootMove"
            :options="openCheckStore.rootMoveStats"
            placeholder="Select starting move to analyze"
            size="medium"
          />
          <span class="help-hint">
            Only games starting with this move will be analyzed in your tree.
          </span>
        </div>

        <!-- Analysis ply depth slider -->
        <div class="form-group">
          <div class="label-with-badge">
            <label class="form-label">Analysis Depth</label>
            <NTag size="small" type="info">{{ localDepth }} ply</NTag>
          </div>
          <NSlider
            v-model:value="localDepth"
            :min="openCheckStore.allowedDepthRange.min"
            :max="openCheckStore.allowedDepthRange.max"
            :step="openCheckStore.allowedDepthRange.step || 5"
            :disabled="!isPremium"
            @update:value="onDepthChange"
          />
          <span v-if="!isPremium" class="input-lock-hint">
            Standard depth is 10 plies.
          </span>
        </div>

        <div class="action-divider"></div>

        <!-- Trigger backend analysis button -->
        <NButton
          type="primary"
          block
          size="large"
          class="glow-btn-teal"
          :loading="openCheckStore.isAnalyzing"
          @click="handleAnalyze"
        >
          <template #icon>
            <PlayOutline />
          </template>
          Start Tree Analysis
        </NButton>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.import-wizard-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.sidebar-header-banner {
  background: rgba(25, 25, 35, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.header-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wizard-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.1rem;
  font-weight: 800;
  color: #ffffff;
  flex: 1;
}

.step-badge {
  font-size: 0.75rem;
  font-weight: bold;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 20px;
}

.panel-card {
  background: rgba(25, 25, 35, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
  backdrop-filter: blur(8px) !important;
  border-radius: 12px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.n-card-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 16px !important;
}

:deep(.n-card-header__title) {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  color: #00f5d4 !important;
  font-size: 1rem;
}

:deep(.n-card__content) {
  padding: 16px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.6);
}

.label-with-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-lock-hint {
  font-size: 0.75rem;
  color: var(--neon-orange, #ff5500);
  margin-top: 2px;
}

.help-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.action-divider {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 4px;
}

.glow-btn-teal {
  background-color: transparent !important;
  border: 1px solid #00f5d4 !important;
  color: #00f5d4 !important;
  transition: all 0.3s ease;
  font-weight: 700;
}

.glow-btn-teal:hover {
  background-color: rgba(0, 245, 212, 0.1) !important;
  box-shadow: 0 0 15px rgba(0, 245, 212, 0.4);
}

.download-stats-summary {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.stat-bubble {
  background: rgba(0, 245, 212, 0.05);
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: 8px;
  padding: 10px 20px;
  text-align: center;
  min-width: 120px;
}

.bubble-val {
  font-family: 'Outfit', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: #00f5d4;
  line-height: 1.2;
}

.bubble-lbl {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.5px;
}

.form-container::-webkit-scrollbar {
  width: 4px;
}

.form-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}
</style>
