<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { t } = useI18n()
import {
  NCard,
  NButton,
  NP,
  NIcon,
  NSpin,
  NTable,
  NDivider,
  NSpace,
  NStatistic,
  NProgress
} from 'naive-ui'
import {
  RefreshOutline,
  WarningOutline,
  FlameOutline,
  PlayOutline
} from '@vicons/ionicons5'
import { useLichessEndgameAnalysisStore } from '../model/lichess-endgame-analysis.store'

const props = withDefaults(
  defineProps<{
    localGamesCount?: number
  }>(),
  {
    localGamesCount: 0
  }
)

const emit = defineEmits<{
  (e: 'analyzeLocal'): void
}>()

const store = useLichessEndgameAnalysisStore()

// Reset der Analyse
const handleReset = () => {
  store.resetResult()
}

// Metadaten für das Dashboard
const totalGames = computed(() => store.analysisResult?.total_games || 0)
const gamesWithEndings = computed(() => store.analysisResult?.games_with_endings || 0)
const totalEndings = computed(() => store.analysisResult?.total_endings || 0)

// Gesamtanzahl der verpassten Siege (dropped_win und missed_winning_chance)
const totalMissedWins = computed(() => {
  if (!store.analysisResult?.puzzles) return 0
  return store.analysisResult.puzzles.filter(p => p.user_target === 'win').length
})

// Gesamtanzahl der verpassten Remis (dropped_draw und missed_saving_chance)
const totalMissedDraws = computed(() => {
  if (!store.analysisResult?.puzzles) return 0
  return store.analysisResult.puzzles.filter(p => p.user_target === 'draw').length
})

const successRate = computed(() => {
  if (totalEndings.value === 0) return 0
  const missed = store.analysisResult?.puzzles.length || 0
  return Math.round(((totalEndings.value - missed) / totalEndings.value) * 100)
})

const successRateColor = computed(() => {
  if (successRate.value > 80) return '#18a058'
  if (successRate.value > 50) return '#f0a020'
  return '#d03050'
})

interface EndgameDetailedRow {
  name: string
  total: number
  winStarts: number
  realizedWins: number
  drawStarts: number
  savedDraws: number
  lossStarts: number
  savedLosses: number
  errorRate: number
}

const detailedStats = computed<EndgameDetailedRow[]>(() => {
  const result = store.analysisResult
  if (!result || !result.stats) return []

  const stats = result.stats

  return Object.entries(stats).map(([name, catStats]) => {
    if (!catStats) return null

    const total = catStats.total || 0
    
    // Win Starts & Realized
    const win_perfect = catStats.win_perfect || 0
    const win_lucky = catStats.win_lucky || 0
    const win_dropped_draw = catStats.win_dropped_draw || 0
    const win_dropped_loss = catStats.win_dropped_loss || 0
    const winStarts = win_perfect + win_lucky + win_dropped_draw + win_dropped_loss
    const realizedWins = win_perfect + win_lucky

    // Draw Starts & Saved
    const draw_clean = catStats.draw_clean || 0
    const draw_exploited_win = catStats.draw_exploited_win || 0
    const draw_missed_win = catStats.draw_missed_win || 0
    const draw_saved_loss = catStats.draw_saved_loss || 0
    const draw_dropped_loss = catStats.draw_dropped_loss || 0
    const drawStarts = draw_clean + draw_exploited_win + draw_missed_win + draw_saved_loss + draw_dropped_loss
    const savedDraws = draw_clean + draw_exploited_win + draw_missed_win + draw_saved_loss

    // Loss Starts & Saved
    const loss_hopeless = catStats.loss_hopeless || 0
    const loss_saved = catStats.loss_saved || 0
    const loss_missed_save = catStats.loss_missed_save || 0
    const lossStarts = loss_hopeless + loss_saved + loss_missed_save
    const savedLosses = loss_saved

    // Fehlerquote
    const missed = win_dropped_draw + win_dropped_loss + draw_dropped_loss
    const errorRate = total > 0 ? (missed / total) * 100 : 0

    return {
      name,
      total,
      winStarts,
      realizedWins,
      drawStarts,
      savedDraws,
      lossStarts,
      savedLosses,
      errorRate: Math.round(errorRate)
    }
  })
  .filter((row): row is EndgameDetailedRow => row !== null)
  .sort((a, b) => b.total - a.total)
})

const globalWinStarts = computed(() => detailedStats.value.reduce((sum, s) => sum + s.winStarts, 0))
const globalRealizedWins = computed(() => detailedStats.value.reduce((sum, s) => sum + s.realizedWins, 0))
const globalWinRate = computed(() => {
  if (globalWinStarts.value === 0) return 0
  return Math.round((globalRealizedWins.value / globalWinStarts.value) * 100)
})
const globalWinRateColor = computed(() => {
  if (globalWinRate.value > 80) return '#18a058'
  if (globalWinRate.value > 50) return '#f0a020'
  return '#d03050'
})

const globalDrawStarts = computed(() => detailedStats.value.reduce((sum, s) => sum + s.drawStarts, 0))
const globalSavedDraws = computed(() => detailedStats.value.reduce((sum, s) => sum + s.savedDraws, 0))
const globalDrawRate = computed(() => {
  if (globalDrawStarts.value === 0) return 0
  return Math.round((globalSavedDraws.value / globalDrawStarts.value) * 100)
})
const globalDrawRateColor = computed(() => {
  if (globalDrawRate.value > 80) return '#18a058'
  if (globalDrawRate.value > 50) return '#f0a020'
  return '#d03050'
})

const globalLossStarts = computed(() => detailedStats.value.reduce((sum, s) => sum + s.lossStarts, 0))
const globalSavedLosses = computed(() => detailedStats.value.reduce((sum, s) => sum + s.savedLosses, 0))
const globalLossRate = computed(() => {
  if (globalLossStarts.value === 0) return 0
  return Math.round((globalSavedLosses.value / globalLossStarts.value) * 100)
})
const globalLossRateColor = computed(() => {
  if (globalLossRate.value > 80) return '#18a058'
  if (globalLossRate.value > 50) return '#f0a020'
  return '#d03050'
})

// Formatierung des Endspielnamens
const formatEndgameName = (name: string): string => {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Vs', 'vs.')
}
</script>

<template>
  <div class="endgame-analysis-container">
    <div class="dashboard-header">
      <h2 class="title">{{ t('features.lichessEndgameAnalysis.title') }}</h2>
      <p class="subtitle">
        {{ t('features.lichessEndgameAnalysis.subtitle') }}
      </p>
    </div>

    <!-- 1. INITIAL STATE -->
    <div v-if="!store.analysisResult && !store.isLoading" class="upload-section">
      <NCard class="upload-card">
        <NSpace vertical size="large" align="center" style="width: 100%">
          <div v-if="props.localGamesCount > 0" class="local-analyze-box" style="text-align: center; width: 100%;">
            <NButton 
              type="primary" 
              size="large" 
              @click="emit('analyzeLocal')" 
              style="width: 280px; height: 50px; font-size: 16px; font-weight: bold; border-radius: 8px;"
            >
              {{ t('features.lichessEndgameAnalysis.startAnalysis') }}
            </NButton>
            <NP style="color: rgba(255, 255, 255, 0.6); margin-top: 10px; font-size: 14px;">
              {{ t('features.lichessEndgameAnalysis.localGamesFound', { count: props.localGamesCount }) }}
            </NP>
          </div>
          <div v-else style="text-align: center; width: 100%;">
            <NIcon size="48" :component="WarningOutline" style="color: #f0a020; margin-bottom: 16px;" />
            <NP style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">
              {{ t('features.lichessEndgameAnalysis.noGamesInCache') }}
            </NP>
            <NP style="color: rgba(255, 255, 255, 0.6); font-size: 14px; max-width: 400px; margin: 0 auto 16px auto;">
              {{ t('features.lichessEndgameAnalysis.noGamesInCacheDesc') }}
            </NP>
          </div>
        </NSpace>
      </NCard>
    </div>

    <!-- 2. LOADING STATE -->
    <div v-if="store.isLoading" class="loading-section">
      <NCard class="loading-card">
        <NSpace vertical align="center" size="large">
          <NSpin size="large" />
          <div style="text-align: center;">
            <h3 class="loading-text">{{ t('features.lichessEndgameAnalysis.analyzingGames') }}</h3>
            <p class="loading-sub">
              {{ t('features.lichessEndgameAnalysis.analyzingGamesDesc') }}
            </p>
          </div>
        </NSpace>
      </NCard>
    </div>

    <!-- 3. RESULTS STATE -->
    <div v-if="store.analysisResult && !store.isLoading" class="results-section">
      <!-- Reset button -->
      <div class="actions-bar">
        <NButton type="primary" secondary @click="handleReset" :icon="RefreshOutline">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{ t('features.lichessEndgameAnalysis.startNewAnalysis') }}
        </NButton>
      </div>

      <!-- General Statistics Grid -->
      <NSpace class="stats-overview" justify="space-around" style="width: 100%; margin-bottom: 32px;">
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic :label="t('features.lichessEndgameAnalysis.gamesAnalyzed')" :value="totalGames" />
        </NCard>
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic :label="t('features.lichessEndgameAnalysis.gamesWithEndgames')" :value="gamesWithEndings" />
        </NCard>
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic :label="t('features.lichessEndgameAnalysis.endgamePositions')" :value="totalEndings" />
        </NCard>
        <NCard class="metric-card header-stat error-stat" style="width: 220px;">
          <template #header-extra>
            <NIcon color="#d03050" size="18"><FlameOutline /></NIcon>
          </template>
          <NStatistic :label="t('features.lichessEndgameAnalysis.missedWins')" :value="totalMissedWins" />
        </NCard>
        <NCard class="metric-card header-stat warning-stat" style="width: 220px;">
          <template #header-extra>
            <NIcon color="#f0a020" size="18"><WarningOutline /></NIcon>
          </template>
          <NStatistic :label="t('features.lichessEndgameAnalysis.missedDraws')" :value="totalMissedDraws" />
        </NCard>
      </NSpace>

      <!-- 4. ENDGAME-PERFORMANCE SUMMARY -->
      <NCard :title="t('features.lichessEndgameAnalysis.performanceOverview')" class="summary-card" style="margin-bottom: 32px;">
        <div style="display: flex; justify-content: space-around; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 24px; padding: 12px 0;">
          <!-- 1. Zug-Präzision -->
          <div style="text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 150px;">
            <NProgress
              type="circle"
              :percentage="successRate"
              :color="successRateColor"
              :rail-color="'rgba(255,255,255,0.06)'"
              :stroke-width="8"
              style="width: 100px;"
            >
              <div style="text-align: center">
                <div style="font-size: 18px; font-weight: bold;">{{ successRate }}%</div>
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">{{ t('features.lichessEndgameAnalysis.movePrecision') }}</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ t('features.lichessEndgameAnalysis.puzzlesLeft', { left: totalEndings - (store.analysisResult?.puzzles.length || 0), total: totalEndings }) }}
            </div>
          </div>

          <!-- 2. Gewinnstarts -->
          <div style="text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 150px;">
            <NProgress
              type="circle"
              :percentage="globalWinRate"
              :color="globalWinRateColor"
              :rail-color="'rgba(255,255,255,0.06)'"
              :stroke-width="8"
              style="width: 100px;"
            >
              <div style="text-align: center">
                <div style="font-size: 18px; font-weight: bold;">{{ globalWinRate }}%</div>
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">{{ t('features.lichessEndgameAnalysis.winStarts') }}</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalRealizedWins }} / {{ globalWinStarts }} {{ t('features.lichessEndgameAnalysis.realized') }}
            </div>
          </div>

          <!-- 3. Remisstarts -->
          <div style="text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 150px;">
            <NProgress
              type="circle"
              :percentage="globalDrawRate"
              :color="globalDrawRateColor"
              :rail-color="'rgba(255,255,255,0.06)'"
              :stroke-width="8"
              style="width: 100px;"
            >
              <div style="text-align: center">
                <div style="font-size: 18px; font-weight: bold;">{{ globalDrawRate }}%</div>
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">{{ t('features.lichessEndgameAnalysis.drawStarts') }}</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalSavedDraws }} / {{ globalDrawStarts }} {{ t('features.lichessEndgameAnalysis.saved') }}
            </div>
          </div>

          <!-- 4. Saved Hopeless (Rettungen) -->
          <div style="text-align: center; display: flex; flex-direction: column; align-items: center; min-width: 150px;">
            <NProgress
              type="circle"
              :percentage="globalLossRate"
              :color="globalLossRateColor"
              :rail-color="'rgba(255,255,255,0.06)'"
              :stroke-width="8"
              style="width: 100px;"
            >
              <div style="text-align: center">
                <div style="font-size: 18px; font-weight: bold;">{{ globalLossRate }}%</div>
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">{{ t('features.lichessEndgameAnalysis.rescues') }}</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalSavedLosses }} / {{ globalLossStarts }} {{ t('features.lichessEndgameAnalysis.rescued') }}
            </div>
          </div>
        </div>

        <NDivider style="margin: 24px 0; background-color: rgba(255,255,255,0.08);" />

        <!-- Detaillierte Tabelle -->
        <div>
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">
            {{ t('features.lichessEndgameAnalysis.detailedStats') }}
          </div>
          <NTable striped size="small" class="summary-table" style="background: transparent;">
            <thead>
              <tr>
                <th>{{ t('features.lichessEndgameAnalysis.endgameType') }}</th>
                <th style="width: 100px; text-align: center;">{{ t('features.lichessEndgameAnalysis.occurrences') }}</th>
                <th style="width: 140px; text-align: center;">{{ t('features.lichessEndgameAnalysis.winStarts') }}</th>
                <th style="width: 140px; text-align: center;">{{ t('features.lichessEndgameAnalysis.drawStarts') }}</th>
                <th style="width: 140px; text-align: center;">{{ t('features.lichessEndgameAnalysis.rescues') }}</th>
                <th style="width: 130px; text-align: center;">{{ t('features.lichessEndgameAnalysis.action') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="stat in detailedStats" :key="stat.name">
                <td>
                  <strong>{{ formatEndgameName(stat.name) }}</strong>
                </td>
                <td style="text-align: center; font-weight: bold;">{{ stat.total }}</td>
                <td style="text-align: center;">
                  <span v-if="stat.winStarts > 0" style="color: #18a058; font-weight: 600;">
                    {{ stat.realizedWins }} / {{ stat.winStarts }}
                  </span>
                  <span v-else style="color: rgba(255,255,255,0.2)">-</span>
                </td>
                <td style="text-align: center;">
                  <span v-if="stat.drawStarts > 0" style="color: #f0a020; font-weight: 600;">
                    {{ stat.savedDraws }} / {{ stat.drawStarts }}
                  </span>
                  <span v-else style="color: rgba(255,255,255,0.2)">-</span>
                </td>
                <td style="text-align: center;">
                  <span v-if="stat.lossStarts > 0" style="color: #d03050; font-weight: 600;">
                    {{ stat.savedLosses }} / {{ stat.lossStarts }}
                  </span>
                  <span v-else style="color: rgba(255,255,255,0.2)">-</span>
                </td>
                <td style="text-align: center;">
                  <NButton 
                    type="primary" 
                    size="tiny" 
                    secondary 
                    @click="store.startTraining(stat.name)"
                  >
                    <template #icon>
                      <NIcon><PlayOutline /></NIcon>
                    </template>
                    {{ t('features.lichessEndgameAnalysis.train') }}
                  </NButton>
                </td>
              </tr>
            </tbody>
          </NTable>
        </div>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.endgame-analysis-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 32px;
}

.title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px 0;
  background: linear-gradient(135deg, #a067ff, #4776e6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
  font-size: 15px;
}

.upload-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
}

.upload-card {
  max-width: 600px;
  width: 100%;
}

.local-analyze-box {
  text-align: center;
  width: 100%;
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 350px;
}

.loading-card {
  max-width: 500px;
  width: 100%;
}

.loading-text {
  margin: 0 0 8px 0;
  font-size: 18px;
}

.loading-sub {
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

.actions-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
}

.stats-overview {
  width: 100%;
  margin-bottom: 32px;
}

.metric-card {
  background: rgba(30, 30, 30, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.header-stat {
  width: 220px;
}

.error-stat :deep(.n-statistic-value) {
  color: #d03050;
}

.warning-stat :deep(.n-statistic-value) {
  color: #f0a020;
}

.summary-card {
  background: rgba(30, 30, 30, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  margin-bottom: 32px;
}

.summary-table {
  background: transparent;
}
</style>
