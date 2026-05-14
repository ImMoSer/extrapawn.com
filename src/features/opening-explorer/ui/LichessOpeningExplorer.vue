<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import {
  theoryRepository,
  type LichessOpeningResponse,
  type LichessParams,
} from '@/entities/opening'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { SettingsOutline, TrophyOutline } from '@vicons/ionicons5'
import { NButton, NCollapseTransition, NIcon, NRadioButton, NRadioGroup, NText } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OpeningStatsTable from './OpeningStatsTable.vue'

defineProps<{
  blurred?: boolean
}>()

const { t } = useI18n()
const boardStore = useBoardStore()

const showSettings = ref(false)

// Local state for all modes when using this component
const localStats = ref<LichessOpeningResponse | null>(null)
const localLoading = ref(false)
const localLichessParams = ref({
  ratingRange: '1000-1499' as '1000-1499' | '1500-1799' | '1800-2200',
})

// Computed values that bridge Store vs Local (kept for compatibility, though activeStore is null)
const stats = computed(() => localStats.value)
const loading = computed(() => localLoading.value)

const lichessParams = computed(() => localLichessParams.value)

// Pending settings to avoid rate limits
const pendingLichessParams = ref({ ...lichessParams.value })

const isDirty = computed(() => {
  return JSON.stringify(pendingLichessParams.value) !== JSON.stringify(lichessParams.value)
})

watch(showSettings, (val) => {
  if (val) {
    pendingLichessParams.value = JSON.parse(JSON.stringify(lichessParams.value))
  }
})

function applySettings() {
  updateParams(pendingLichessParams.value)
}

function handleSelectMove(uci: string) {
  boardStore.applyUciMove(uci)
}

async function fetchLocalStats() {
  localLoading.value = true
  try {
    const fen = pgnService.getCurrentNavigatedFen()
    const data = await theoryRepository.getLichessStats(fen, localLichessParams.value)
    localStats.value = data
  } catch (e) {
    console.error('[LichessOpeningExplorer] Failed to fetch stats:', e)
  } finally {
    localLoading.value = false
  }
}

function updateParams(newParams: LichessParams) {
  localLichessParams.value = { ...localLichessParams.value, ...newParams }
  fetchLocalStats()
}

watch(
  [pgnTreeVersion, localLichessParams],
  () => {
    fetchLocalStats()
  },
  { deep: true },
)

onMounted(() => {
  fetchLocalStats()
})
</script>

<template>
  <div class="lichess-opening-explorer" :class="{ blurred: blurred }">
    <div v-if="blurred" class="overlay">
      <n-text strong depth="1">{{ t('features.diamondHunter.stats.reviewModeOverlay') }}</n-text>
    </div>
    <div class="explorer-header">
      <div class="header-left">
        <n-text strong>Lichess Players</n-text>
      </div>
      <div class="header-right">
        <n-button
          quaternary
          circle
          size="small"
          @click="showSettings = !showSettings"
          :color="showSettings ? 'var(--color-accent)' : undefined"
        >
          <template #icon>
            <n-icon>
              <SettingsOutline />
            </n-icon>
          </template>
        </n-button>
      </div>
    </div>

    <n-collapse-transition :show="showSettings">
      <div class="settings-panel">
        <div class="settings-group">
          <div class="compact-section" style="padding: 0 12px">
            <n-text depth="3" strong class="section-label">
              <n-icon>
                <TrophyOutline />
              </n-icon>
              Rating Range
            </n-text>
            <n-radio-group
              :value="pendingLichessParams.ratingRange"
              @update:value="(v: any) => (pendingLichessParams.ratingRange = v)"
              size="small"
              expand
            >
              <n-radio-button value="1000-1499">1000 - 1499</n-radio-button>
              <n-radio-button value="1500-1799">1500 - 1799</n-radio-button>
              <n-radio-button value="1800-2200">1800 - 2200</n-radio-button>
            </n-radio-group>
          </div>
        </div>

        <div class="settings-actions">
          <n-button type="primary" size="small" block :disabled="!isDirty" @click="applySettings">
            Set Parameters
          </n-button>
        </div>
      </div>
    </n-collapse-transition>

    <div class="table-container">
      <div v-if="!stats" class="empty-state">
        <n-text depth="3">{{
          t('openingTrainer.noStats', 'No statistics available for this position')
        }}</n-text>
      </div>
      <OpeningStatsTable
        v-if="stats"
        :moves="stats.moves"
        :isReviewMode="true"
        :total="stats.summary?.total || 0"
        :win_p="stats.summary?.win_p || 0"
        :draw_p="stats.summary?.draw_p || 0"
        :loss_p="stats.summary?.loss_p || 0"
        :avg-elo="stats.summary?.avgElo || 0"
        @select-move="handleSelectMove"
      />

      <div v-if="!loading && !stats" class="empty-state">
        <n-text depth="3">No statistics available for this position.</n-text>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lichess-opening-explorer {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  position: relative;
  flex: 1;
  min-height: 0;
}

.blurred {
  .explorer-header,
  .table-container {
    filter: blur(12px);
    opacity: 0.4;
    pointer-events: none;
  }
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
}

.explorer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--color-border);
}

.settings-panel {
  padding: 12px;
  background: rgba(var(--color-accent-rgb), 0.03);
  border-bottom: 1px solid var(--color-border);
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.settings-actions {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(var(--color-accent-rgb), 0.1);
}

.table-container {
  flex: 1;
  min-height: 100px;
  overflow-y: auto;
}

.top-games-section {
  padding: 0 12px 12px;
}

.section-divider {
  display: flex;
  align-items: center;
  margin: 16px 0 12px;
  opacity: 0.6;
}

.section-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--color-border);
  margin-left: 10px;
}

.divider-text {
  font-size: 0.7rem;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-text-secondary);
}

.games-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.game-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  color: var(--color-text-link);

  &:hover {
    background: rgba(var(--color-accent-rgb), 0.08);
    border-color: rgba(var(--color-accent-rgb), 0.2);
    transform: translateX(4px);
    color: var(--color-text-link-hover);
  }
}

.game-info {
  display: flex;
  align-items: center;
  gap: 12px;
  overflow: hidden;
}

.game-uci {
  font-family: 'Fira Code', monospace;
  font-size: 0.75rem;
  background: rgba(var(--color-accent-rgb), 0.1);
  color: var(--color-accent);
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 45px;
  text-align: center;
}

.game-players {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vs {
  opacity: 0.4;
  font-size: 0.7rem;
}

.game-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.game-result {
  font-family: 'Fira Code', monospace;
  font-size: 0.8rem;
  font-weight: bold;
  min-width: 35px;
  text-align: right;
}

.game-result.white {
  color: #fff;
}

.game-result.black {
  color: var(--color-accent);
}

.game-result.draw {
  color: var(--color-text-secondary);
}

.game-year {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  opacity: 0.6;
}

.loading-state,
.empty-state {
  padding: 40px 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner-tiny {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.n-checkbox) {
  --n-font-size: 0.8rem !important;
}
</style>
