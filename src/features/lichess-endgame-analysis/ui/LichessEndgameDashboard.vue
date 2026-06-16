<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NCard,
  NButton,
  NUpload,
  NUploadDragger,
  NText,
  NP,
  NIcon,
  NSpin,
  NTable,
  NTag,
  NDivider,
  NSpace,
  NStatistic,
  NTabs,
  NTabPane,
  NProgress,
  useMessage
} from 'naive-ui'
import {
  CloudUploadOutline,
  RefreshOutline,
  CopyOutline,
  ChevronForwardOutline,
  WarningOutline,
  FlameOutline
} from '@vicons/ionicons5'
import { useLichessEndgameAnalysisStore } from '../model/lichess-endgame-analysis.store'
import type { MissedChance, TaskType } from '../model/lichess-endgame-analysis.types'

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
const message = useMessage()

const currentTab = ref<'dropped' | 'missed'>('dropped')

// Dateiupload-Handler
const handleUpload = async (options: { file: { file: File | null } }) => {
  const file = options.file.file
  if (!file) return

  try {
    const buffer = await file.arrayBuffer()
    await store.analyzeBackupBuffer(buffer)
    message.success('Endspiel-Analyse erfolgreich abgeschlossen!')
  } catch (err) {
    const errorObject = err as Error
    message.error(errorObject.message || 'Fehler beim Analysieren des Backups.')
  }
}

// Reset der Analyse
const handleReset = () => {
  store.resetResult()
}

// Berechne die Halbzugnummer (Ply) aus der FEN
const calculatePlyFromFen = (fen?: string): number => {
  if (!fen) return 0
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 6) return 0
  const activeColor = parts[1] // 'w' oder 'b'
  const fullmoveStr = parts[5]
  if (!fullmoveStr || !activeColor) return 0
  const fullmove = parseInt(fullmoveStr, 10)
  if (isNaN(fullmove)) return 0
  
  if (activeColor === 'w') {
    return (fullmove - 1) * 2
  } else {
    return (fullmove - 1) * 2 + 1
  }
}

interface DashboardMissedChance extends MissedChance {
  ply: number
  lichessUrl: string
}

const parsedMissedChances = computed<DashboardMissedChance[]>(() => {
  const result = store.analysisResult
  if (!result || !result.missed_chances) return []

  return result.missed_chances.map(task => {
    const ply = calculatePlyFromFen(task.chance_fen)
    return {
      ...task,
      ply,
      lichessUrl: `https://lichess.org/${task.game_id}#${ply}`
    }
  }).sort((a, b) => a.classification.localeCompare(b.classification))
})

const filteredChances = computed<DashboardMissedChance[]>(() => {
  if (currentTab.value === 'dropped') {
    return parsedMissedChances.value.filter(c =>
      c.task_type === 'dropped_win_to_draw' ||
      c.task_type === 'dropped_win_to_loss' ||
      c.task_type === 'dropped_draw_to_loss'
    )
  } else {
    return parsedMissedChances.value.filter(c =>
      c.task_type === 'missed_winning_chance' ||
      c.task_type === 'missed_saving_chance'
    )
  }
})

const countDroppedWinToDraw = computed(() => parsedMissedChances.value.filter(c => c.task_type === 'dropped_win_to_draw').length)
const countDroppedWinToLoss = computed(() => parsedMissedChances.value.filter(c => c.task_type === 'dropped_win_to_loss').length)
const countDroppedDrawToLoss = computed(() => parsedMissedChances.value.filter(c => c.task_type === 'dropped_draw_to_loss').length)
const countMissedWinningChance = computed(() => parsedMissedChances.value.filter(c => c.task_type === 'missed_winning_chance').length)
const countMissedSavingChance = computed(() => parsedMissedChances.value.filter(c => c.task_type === 'missed_saving_chance').length)

const countDropped = computed(() => countDroppedWinToDraw.value + countDroppedWinToLoss.value + countDroppedDrawToLoss.value)
const countMissed = computed(() => countMissedWinningChance.value + countMissedSavingChance.value)

const totalMissedWins = computed(() => countDroppedWinToDraw.value + countDroppedWinToLoss.value + countMissedWinningChance.value)
const totalMissedDraws = computed(() => countDroppedDrawToLoss.value + countMissedSavingChance.value)

const formatVerlauf = (taskType: TaskType): { text: string; type: 'success' | 'warning' | 'error' | 'default' } => {
  switch (taskType) {
    case 'dropped_win_to_draw':
      return { text: 'Win ➔ Draw', type: 'warning' }
    case 'dropped_win_to_loss':
      return { text: 'Win ➔ Loss', type: 'error' }
    case 'dropped_draw_to_loss':
      return { text: 'Draw ➔ Loss', type: 'error' }
    case 'missed_winning_chance':
      return { text: 'Win verpasst', type: 'success' }
    case 'missed_saving_chance':
      return { text: 'Draw verpasst', type: 'warning' }
    default:
      return { text: '', type: 'default' }
  }
}

const totalGames = computed(() => store.analysisResult?.total_games || store.analysisResult?.checked_games.length || 0)
const gamesWithEndings = computed(() => store.analysisResult?.checked_games.filter(g => g.founded_endings.length > 0).length || 0)
const totalEndings = computed(() => {
  if (!store.analysisResult) return 0
  return store.analysisResult.checked_games.reduce((sum, g) => sum + g.founded_endings.length, 0)
})
const successRate = computed(() => {
  if (totalEndings.value === 0) return 0
  const missed = parsedMissedChances.value.length
  return Math.round(((totalEndings.value - missed) / totalEndings.value) * 100)
})

const successRateColor = computed(() => {
  if (successRate.value > 80) return '#18a058'
  if (successRate.value > 50) return '#f0a020'
  return '#d03050'
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
  .sort((a, b) => b.total - a.total) // Oben die Gruppe, die am meisten Stellungen hat
})

interface GroupedChances {
  classification: string
  totalCount: number
  missedCount: number
  chances: DashboardMissedChance[]
}

const groupChances = (chances: DashboardMissedChance[]): GroupedChances[] => {
  const groupsMap: Record<string, DashboardMissedChance[]> = {}
  chances.forEach(c => {
    const key = c.classification
    if (!groupsMap[key]) {
      groupsMap[key] = []
    }
    const group = groupsMap[key]
    if (group) {
      group.push(c)
    }
  })

  return Object.entries(groupsMap).map(([classification, list]) => {
    const typeStat = detailedStats.value.find(s => s.name === classification)
    const sortedList = [...list].sort((a, b) => {
      const order: Record<TaskType, number> = {
        'dropped_win_to_draw': 1,
        'dropped_win_to_loss': 2,
        'dropped_draw_to_loss': 3,
        'missed_winning_chance': 4,
        'missed_saving_chance': 5
      }
      return (order[a.task_type] || 99) - (order[b.task_type] || 99)
    })
    return {
      classification,
      totalCount: typeStat?.total || list.length,
      missedCount: list.length,
      chances: sortedList
    }
  }).sort((a, b) => b.missedCount - a.missedCount)
}

const groupedFilteredChances = computed(() => groupChances(filteredChances.value))

// Formatierung des Endspielnamens
const formatEndgameName = (name: string): string => {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Vs', 'vs.')
}

// FEN kopieren
const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  message.success('FEN in die Zwischenablage kopiert!')
}
</script>

<template>
  <div class="endgame-analysis-container">
    <div class="dashboard-header">
      <h2 class="title">Lichess Endgame Performance Analyzer</h2>
      <p class="subtitle">
        Analysiere deine Endspiel-Performance basierend auf deinen Lichess-Partien.
      </p>
    </div>

    <!-- 1. INITIAL / UPLOAD STATE -->
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
              Analyse starten
            </NButton>
            <NP style="color: rgba(255, 255, 255, 0.6); margin-top: 10px; font-size: 14px;">
              Es wurden {{ props.localGamesCount }} importierte Partien im Cache gefunden.
            </NP>
            
            <NDivider style="margin: 24px 0;">Oder manuell hochladen</NDivider>
          </div>

          <NUpload
            @change="handleUpload"
            :show-file-list="false"
            accept=".json.gz,.json,.gz"
            class="uploader"
            style="width: 100%;"
          >
            <NUploadDragger class="dragger-box" style="padding: 20px;">
              <div class="icon-wrapper" style="margin-bottom: 8px;">
                <NIcon size="36" :component="CloudUploadOutline" />
              </div>
              <NText style="font-size: 14px; font-weight: bold;">
                Backup-Datei manuell hochladen
              </NText>
            </NUploadDragger>
          </NUpload>
        </NSpace>
      </NCard>
    </div>

    <!-- 2. LOADING STATE -->
    <div v-if="store.isLoading" class="loading-section">
      <NCard class="loading-card">
        <NSpace vertical align="center" size="large">
          <NSpin size="large" />
          <div style="text-align: center;">
            <h3 class="loading-text">Analysiere Spiele...</h3>
            <p class="loading-sub">
              Deine Partien werden analysiert und bewertet. Bitte hab einen Augenblick Geduld...
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
          Neue Analyse starten
        </NButton>
      </div>

      <!-- General Statistics Grid -->
      <NSpace class="stats-overview" justify="space-around" style="width: 100%; margin-bottom: 32px;">
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic label="Analysierte Spiele" :value="totalGames" />
        </NCard>
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic label="Spiele mit Endspielen" :value="gamesWithEndings" />
        </NCard>
        <NCard class="metric-card header-stat" style="width: 220px;">
          <NStatistic label="Endspiel Stellungen" :value="totalEndings" />
        </NCard>
        <NCard class="metric-card header-stat error-stat" style="width: 220px;">
          <template #header-extra>
            <NIcon color="#d03050" size="18"><FlameOutline /></NIcon>
          </template>
          <NStatistic label="Verpasste Gewinne" :value="totalMissedWins" />
        </NCard>
        <NCard class="metric-card header-stat warning-stat" style="width: 220px;">
          <template #header-extra>
            <NIcon color="#f0a020" size="18"><WarningOutline /></NIcon>
          </template>
          <NStatistic label="Verpasste Rettungen" :value="totalMissedDraws" />
        </NCard>
      </NSpace>

      <!-- 4. ENDGAME-PERFORMANCE SUMMARY -->
      <NCard title="📊 Endspiel-Performance Übersicht (Summary)" class="summary-card" style="margin-bottom: 32px;">
        <!-- 4 Kreisdiagramme nebeneinander -->
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
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">Zug-Präzision</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ totalEndings - parsedMissedChances.length }} / {{ totalEndings }} Züge
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
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">Gewinnstarts</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalRealizedWins }} / {{ globalWinStarts }} realisiert
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
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">Remisstarts</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalSavedDraws }} / {{ globalDrawStarts }} gehalten
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
                <div style="font-size: 9px; color: rgba(255,255,255,0.5)">Rettungen</div>
              </div>
            </NProgress>
            <div style="color: rgba(255, 255, 255, 0.6); font-size: 12px; margin-top: 8px; font-weight: 500;">
              {{ globalSavedLosses }} / {{ globalLossStarts }} gerettet
            </div>
          </div>
        </div>

        <NDivider style="margin: 24px 0; background-color: rgba(255,255,255,0.08);" />

        <!-- Tabelle über die volle Breite -->
        <div>
          <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
            <span>📊 Detaillierte Statistik nach Endspiel-Klassifizierung</span>
          </div>
          <div v-if="detailedStats.length === 0" class="empty-state" style="padding: 20px;">
            <NP>Keine Endspieldaten zur Auswertung vorhanden.</NP>
          </div>
          <NTable v-else striped size="small" class="summary-table" style="background: transparent;">
            <thead>
              <tr>
                <th>Endspieltyp</th>
                <th style="width: 100px; text-align: center;">Vorkommen</th>
                <th style="width: 140px; text-align: center;">Gewinnstarts</th>
                <th style="width: 140px; text-align: center;">Remisstarts</th>
                <th style="width: 140px; text-align: center;">Rettungen</th>
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
              </tr>
            </tbody>
          </NTable>
        </div>
      </NCard>

      <NCard class="report-card">
        <NTabs v-model:value="currentTab" type="segment" animated class="custom-tabs">
          <!-- Tab 1: Verpatzt (Dropped) -->
          <NTabPane name="dropped" :tab="`⚠️ Verpatzt (Dropped) (${countDropped})`">
            <div class="tab-content">
              <div v-if="groupedFilteredChances.length === 0" class="empty-state">
                <NP>Keine verpatzten Endspiel-Stellungen gefunden.</NP>
              </div>
              <div v-else>
                <div v-for="group in groupedFilteredChances" :key="group.classification" class="endgame-group-section" style="margin-bottom: 32px;">
                  <div class="endgame-group-header" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px; font-weight: bold; color: rgba(255,255,255,0.9);">
                      {{ formatEndgameName(group.classification) }}
                    </span>
                    <NTag size="small" type="error" :bordered="false">{{ group.missedCount }} Fehler</NTag>
                  </div>
                  
                  <NTable striped class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 140px;">Verlauf</th>
                        <th>Dein Fehlerzug</th>
                        <th>Richtiger Zug</th>
                        <th>FEN</th>
                        <th>Partie-Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(chance, index) in group.chances" :key="index">
                        <td>
                          <NTag size="small" :type="formatVerlauf(chance.task_type).type" :bordered="false" style="font-weight: bold;">
                            {{ formatVerlauf(chance.task_type).text }}
                          </NTag>
                        </td>
                        <td>
                          <span style="color: #d03050; font-weight: bold; font-family: monospace;">{{ chance.user_played_move }}</span>
                        </td>
                        <td>
                          <NTag size="small" type="success" :bordered="false" style="font-weight: bold; font-family: monospace;">
                            {{ chance.correct_move }}
                          </NTag>
                        </td>
                        <td>
                          <div class="fen-copy-wrapper">
                            <code class="fen-text">{{ chance.chance_fen.substring(0, 35) }}...</code>
                            <NButton size="tiny" quaternary circle @click="copyToClipboard(chance.chance_fen)">
                              <template #icon>
                                <NIcon><CopyOutline /></NIcon>
                              </template>
                            </NButton>
                          </div>
                        </td>
                        <td>
                          <a :href="chance.lichessUrl" target="_blank" class="lichess-action-link">
                            Lichess (Zug {{ Math.floor(chance.ply / 2) + 1 }})
                            <NIcon :component="ChevronForwardOutline" size="12" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </NTable>
                </div>
              </div>
            </div>
          </NTabPane>

          <!-- Tab 2: Verpasste Chancen (Missed) -->
          <NTabPane name="missed" :tab="`🎯 Verpasste Chancen (Missed) (${countMissed})`">
            <div class="tab-content">
              <div v-if="groupedFilteredChances.length === 0" class="empty-state">
                <NP>Keine verpassten Chancen nach gegnerischen Patzern gefunden.</NP>
              </div>
              <div v-else>
                <div v-for="group in groupedFilteredChances" :key="group.classification" class="endgame-group-section" style="margin-bottom: 32px;">
                  <div class="endgame-group-header" style="margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 16px; font-weight: bold; color: rgba(255,255,255,0.9);">
                      {{ formatEndgameName(group.classification) }}
                    </span>
                    <NTag size="small" type="error" :bordered="false">{{ group.missedCount }} Fehler</NTag>
                  </div>
                  
                  <NTable striped class="report-table">
                    <thead>
                      <tr>
                        <th style="width: 140px;">Verlauf</th>
                        <th>Dein Fehlerzug</th>
                        <th>Richtiger Zug</th>
                        <th>FEN</th>
                        <th>Partie-Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(chance, index) in group.chances" :key="index">
                        <td>
                          <NTag size="small" :type="formatVerlauf(chance.task_type).type" :bordered="false" style="font-weight: bold;">
                            {{ formatVerlauf(chance.task_type).text }}
                          </NTag>
                        </td>
                        <td>
                          <div>
                            <span style="color: #d03050; font-weight: bold; font-family: monospace;">{{ chance.user_played_move }}</span>
                            <div v-if="chance.opp_blunder_move" style="font-size: 11px; color: rgba(255,255,255,0.45); margin-top: 4px;">
                              Gegner patzte mit <span style="font-family: monospace; color: #f0a020;">{{ chance.opp_blunder_move }}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <NTag size="small" type="success" :bordered="false" style="font-weight: bold; font-family: monospace;">
                            {{ chance.correct_move }}
                          </NTag>
                        </td>
                        <td>
                          <div class="fen-copy-wrapper">
                            <code class="fen-text">{{ chance.chance_fen.substring(0, 35) }}...</code>
                            <NButton size="tiny" quaternary circle @click="copyToClipboard(chance.chance_fen)">
                              <template #icon>
                                <NIcon><CopyOutline /></NIcon>
                              </template>
                            </NButton>
                          </div>
                        </td>
                        <td>
                          <a :href="chance.lichessUrl" target="_blank" class="lichess-action-link">
                            Lichess (Zug {{ Math.floor(chance.ply / 2) + 1 }})
                            <NIcon :component="ChevronForwardOutline" size="12" />
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </NTable>
                </div>
              </div>
            </div>
          </NTabPane>
        </NTabs>
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

.uploader :deep(.n-upload-dragger) {
  border: 2px dashed rgba(255, 255, 255, 0.15);
  background: rgba(20, 20, 20, 0.4);
  border-radius: 12px;
  transition: border-color 0.3s;
}

.uploader :deep(.n-upload-dragger:hover) {
  border-color: #a067ff;
}

.icon-wrapper {
  color: #a067ff;
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

.metric-card {
  background: rgba(30, 30, 30, 0.4);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.error-stat :deep(.n-statistic-value) {
  color: #d03050;
}

.warning-stat :deep(.n-statistic-value) {
  color: #f0a020;
}

.report-card {
  background: rgba(30, 30, 30, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 16px;
}

.summary-card {
  background: rgba(30, 30, 30, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.precision-box {
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  padding-right: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .precision-box {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-right: 0;
    padding-bottom: 24px;
    margin-bottom: 24px;
  }
}

.custom-tabs :deep(.n-tabs-tab) {
  font-size: 16px;
  font-weight: 600;
  padding: 12px 20px;
}

.tab-content {
  padding-top: 20px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: rgba(255, 255, 255, 0.4);
}

.report-table {
  background: transparent;
}

.report-table th {
  background: rgba(255, 255, 255, 0.03) !important;
  font-weight: 600;
}

.dtm-val {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.fen-copy-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(20, 20, 20, 0.4);
  padding: 4px 8px;
  border-radius: 6px;
  max-width: 320px;
}

.fen-text {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.lichess-action-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #a067ff;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s;
}

.lichess-action-link:hover {
  color: #b78eff;
}
</style>
