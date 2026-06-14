<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useOpenCheckStore } from '@/features/open-check'
import { gamesDb } from '@/entities/game'
import { Chess } from 'chess.js'
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
  PlayOutline,
  SettingsOutline,
} from '@vicons/ionicons5'

const router = useRouter()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'success'): void
}>()

const openCheckStore = useOpenCheckStore()
const message = useMessage()

// Steps: 1 = Configure & Select Games, 2 = Select Root Move & Analyze
const step = ref<1 | 2>(1)
const selectedRootMove = ref<string | null>(null)
const localGamesCountInDb = ref(0)

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

// Reactively count matching games in local database
async function updateLocalGamesCount() {
  const user = openCheckStore.targetUsername.trim().toLowerCase()
  if (!user) {
    localGamesCountInDb.value = 0
    return
  }

  try {
    const games = await gamesDb.lichess_games
      .where('username')
      .equals(user)
      .toArray()

    const filtered = games.filter(g =>
      g.userColor === openCheckStore.userColor &&
      openCheckStore.perfTypes.includes(g.timeControl)
    )

    localGamesCountInDb.value = filtered.length
  } catch {
    localGamesCountInDb.value = 0
  }
}

watch(
  () => [openCheckStore.targetUsername, openCheckStore.userColor, openCheckStore.perfTypes],
  () => {
    updateLocalGamesCount()
  },
  { deep: true, immediate: true }
)

// Proceed to Step 2: Load local games matching filters, sort by date (newest first), respect max games limit
async function handleProceed() {
  if (!openCheckStore.targetUsername.trim()) {
    message.error('Please enter a Lichess username.')
    return
  }

  const user = openCheckStore.targetUsername.trim().toLowerCase()
  const games = await gamesDb.lichess_games
    .where('username')
    .equals(user)
    .toArray()

  // Filter games based on color & active speed perf modes
  let filtered = games.filter(g =>
    g.userColor === openCheckStore.userColor &&
    openCheckStore.perfTypes.includes(g.timeControl)
  )

  if (filtered.length === 0) {
    message.error('No games found locally for this configuration. Please sync your games database.')
    return
  }

  // Sort by createdAt descending (newest first)
  filtered.sort((a, b) => b.createdAt - a.createdAt)

  // Respect max games limit (take the newest N games)
  const limit = localGamesCount.value
  if (filtered.length > limit) {
    filtered = filtered.slice(0, limit)
  }

  // Map to openCheckStore downloadedGames format to reuse the rootMoveStats computation
  openCheckStore.downloadedGames = filtered.map(g => {
    const chess = new Chess()
    try {
      chess.loadPgn(g.pgn)
    } catch {
      // Ignore parsing errors
    }
    const movesList = chess.history()
    return {
      id: g.id,
      white: g.white,
      black: g.black,
      result: g.result,
      white_elo: g.white_elo,
      black_elo: g.black_elo,
      moves: movesList.join(' '),
      firstMoveSan: g.rootMove.replace('1. ', ''), // strip prefix for processing
      validatedMoves: movesList
    }
  })

  // Automatically select the most frequent root move
  const stats = openCheckStore.rootMoveStats
  if (stats && stats.length > 0 && stats[0]) {
    selectedRootMove.value = stats[0].value
  } else {
    selectedRootMove.value = null
  }

  step.value = 2
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

function handleGoToCabinet() {
  router.push('/user-cabinet')
}
</script>

<template>
  <div class="import-wizard-panel">
    <!-- Header banner with back button -->
    <div class="sidebar-header-banner">
      <div class="header-action-row">
        <NButton v-if="step === 2" quaternary circle size="small" @click="handleGoBack">
          <template #icon>
            <ArrowBackOutline />
          </template>
        </NButton>
        <span class="wizard-title">
          {{ step === 1 ? 'Configure Analysis' : 'Select Opening' }}
        </span>
        <span class="step-badge">Step {{ step }} of 2</span>
      </div>
    </div>

    <!-- Step 1: Filter Configuration -->
    <NCard
      v-if="step === 1"
      class="panel-card"
      title="Step 1: Configuration"
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
            disabled
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
            <label class="form-label">Max Games to Analyze</label>
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

        <!-- Local Cache Status Display -->
        <div class="cache-status-box" :class="{ empty: localGamesCountInDb === 0 }">
          <div class="status-header">Local Game Cache Status</div>
          <div class="status-content">
            <template v-if="localGamesCountInDb > 0">
              <span class="highlight-green">{{ localGamesCountInDb }}</span> games found matching these filters.
            </template>
            <template v-else>
              No games found. Please sync your database cache first.
            </template>
          </div>
          <NButton
            v-if="localGamesCountInDb === 0"
            text
            type="info"
            class="cache-link"
            @click="handleGoToCabinet"
          >
            <template #icon>
              <SettingsOutline />
            </template>
            Open Database Cache Settings
          </NButton>
        </div>

        <!-- Trigger local games proceed button -->
        <NButton
          type="primary"
          block
          size="large"
          class="glow-btn-teal"
          :disabled="localGamesCountInDb === 0"
          @click="handleProceed"
        >
          <template #icon>
            <PlayOutline />
          </template>
          Proceed to Move Selection
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
        <!-- Stats summary -->
        <div class="download-stats-summary">
          <div class="stat-bubble">
            <div class="bubble-val">{{ openCheckStore.downloadedGames.length }}</div>
            <div class="bubble-lbl">Games Selected</div>
          </div>
        </div>

        <!-- Root Move select dropdown populated dynamically from local stats -->
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

.checkbox-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.action-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.05);
  margin: 4px 0;
}

.input-lock-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.35);
  font-style: italic;
}

.help-hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.4);
}

.download-stats-summary {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.stat-bubble {
  background: linear-gradient(135deg, rgba(0, 245, 212, 0.1) 0%, rgba(0, 245, 212, 0.02) 100%);
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: 12px;
  padding: 12px 24px;
  text-align: center;
  min-width: 140px;
}

.bubble-val {
  font-family: 'Outfit', sans-serif;
  font-size: 1.8rem;
  font-weight: 900;
  color: #00f5d4;
  line-height: 1;
  margin-bottom: 4px;
}

.bubble-lbl {
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.6);
}

.cache-status-box {
  background: rgba(24, 160, 88, 0.06);
  border: 1px solid rgba(24, 160, 88, 0.2);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cache-status-box.empty {
  background: rgba(208, 48, 80, 0.06);
  border-color: rgba(208, 48, 80, 0.2);
}

.status-header {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.4);
}

.status-content {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}

.highlight-green {
  color: #18a058;
  font-weight: 700;
}

.cache-link {
  align-self: flex-start;
  font-size: 12px !important;
}
</style>
