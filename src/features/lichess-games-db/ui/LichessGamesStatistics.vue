<script setup lang="ts">
import { useOpenCheckStore } from '@/features/open-check'
import { CloseOutline } from '@vicons/ionicons5'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NTab,
  NTabs,
  NText,
} from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import VChart from 'vue-echarts'
import { useLichessGamesDbStore } from '../model/lichess-games-db.store'

use([CanvasRenderer, PieChart, TooltipComponent, LegendComponent, TitleComponent])

interface RoseParam {
  data: {
    name: string
    value: number
    raw: {
      openingNameBase: string
      gamesCount: number
      wins: number
      draws: number
      losses: number
      avgUserRating: number
      avgOpponentRating: number
      primarySpeed: string
    }
  }
  name: string
  event: {
    event: MouseEvent
  }
}

interface PopupData {
  openingName: string
  gamesCount: number
  wins: number
  draws: number
  losses: number
  winRate: number
  avgUserRating: number
  avgOpponentRating: number
  primarySpeed: string
  performance: number
}

const store = useLichessGamesDbStore()
const openCheckStore = useOpenCheckStore()
const username = computed(() => openCheckStore.targetUsername)

const activeTab = ref<'all' | 'white' | 'black'>('all')

const activePopup = ref<{ visible: boolean; x: number; y: number; data: PopupData | null }>({
  visible: false,
  x: 0,
  y: 0,
  data: null,
})

const popupRef = ref<HTMLElement | null>(null)
const lastOpenTime = ref(0)

const handleClickOutside = (event: MouseEvent | TouchEvent) => {
  if (Date.now() - lastOpenTime.value < 100) return

  if (
    activePopup.value.visible &&
    popupRef.value &&
    !popupRef.value.contains(event.target as Node)
  ) {
    activePopup.value.visible = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('touchstart', handleClickOutside, { passive: true })
  if (username.value) {
    store.loadStats(username.value)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
})

watch(username, () => {
  if (username.value) {
    store.loadStats(username.value)
  }
})

const currentStats = computed(() => {
  if (!store.detailedStats) return null
  return store.detailedStats[activeTab.value]
})

const hasData = computed(() => {
  return currentStats.value && currentStats.value.gamesCount > 0
})

const sortBy = ref<'games' | 'winRate' | 'performance'>('games')

function getOpeningPerformance(op: { wins: number; draws: number; losses: number; gamesCount: number; avgOpponentRating: number }): number {
  const gamesCount = op.gamesCount
  if (gamesCount === 0) return 0
  const scorePercent = (op.wins + 0.5 * op.draws) / gamesCount
  let diff = 0
  if (scorePercent === 1) {
    diff = 400
  } else if (scorePercent === 0) {
    diff = -400
  } else {
    diff = Math.round((scorePercent - 0.5) * 800)
  }
  return op.avgOpponentRating + diff
}

function getOpeningWinRate(op: { wins: number; gamesCount: number }): number {
  return op.gamesCount > 0 ? (op.wins / op.gamesCount) * 100 : 0
}

const sortedOpeningsForChart = computed(() => {
  if (!currentStats.value) return []
  const list = [...currentStats.value.topOpenings]
  
  if (sortBy.value === 'games') {
    list.sort((a, b) => b.gamesCount - a.gamesCount)
  } else if (sortBy.value === 'winRate') {
    list.sort((a, b) => getOpeningWinRate(b) - getOpeningWinRate(a))
  } else if (sortBy.value === 'performance') {
    list.sort((a, b) => getOpeningPerformance(b) - getOpeningPerformance(a))
  }
  
  return list
})

const chartData = computed(() => {
  const list = sortedOpeningsForChart.value
  const N = list.length
  return list.map((op, i) => {
    // Rank-based visual value: Place 1 gets 100, Place N gets 50, others distributed evenly.
    let visualValue = 100
    if (N > 1) {
      visualValue = 100 - (i * 50) / (N - 1)
    }
    return {
      name: op.openingNameBase,
      value: visualValue,
      raw: op
    }
  })
})

const chartOption = computed(() => {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: false
    },
    series: [
      {
        name: 'Top Openings',
        type: 'pie',
        radius: ['10%', '65%'],
        center: ['50%', '50%'],
        roseType: 'radius',
        itemStyle: {
          borderRadius: 6
        },
        label: {
          show: true,
          color: '#CCCCCC',
          fontSize: 11,
          formatter: (params: { name: string; value: number }) => {
            const name = params.name
            return name.length > 20 ? name.slice(0, 18) + '..' : name
          }
        },
        emphasis: {
          label: {
            show: true,
            fontWeight: 'bold'
          }
        },
        data: chartData.value
      }
    ]
  }
})

const onChartClick = (params: unknown) => {
  const p = params as RoseParam
  if (!p.data || !p.data.raw) return

  const raw = p.data.raw
  const gamesCount = raw.gamesCount
  const wins = raw.wins
  const draws = raw.draws
  const losses = raw.losses

  const winRate = gamesCount > 0 ? (wins / gamesCount) * 100 : 0
  const scorePercent = gamesCount > 0 ? (wins + 0.5 * draws) / gamesCount : 0

  let diff = 0
  if (scorePercent === 1) {
    diff = 400
  } else if (scorePercent === 0) {
    diff = -400
  } else {
    diff = Math.round((scorePercent - 0.5) * 800)
  }
  const performance = Math.round(raw.avgOpponentRating + diff)

  const ev = p.event.event as Event
  let x = window.innerWidth / 2
  let y = window.innerHeight / 2

  if ('clientX' in ev) {
    x = (ev as MouseEvent).clientX
    y = (ev as MouseEvent).clientY
  }

  if (p.event.event.stopImmediatePropagation) {
    p.event.event.stopImmediatePropagation()
  }

  lastOpenTime.value = Date.now()

  activePopup.value = {
    visible: true,
    x: x + 10,
    y: y + 10,
    data: {
      openingName: raw.openingNameBase,
      gamesCount,
      wins,
      draws,
      losses,
      winRate,
      avgUserRating: raw.avgUserRating,
      avgOpponentRating: raw.avgOpponentRating,
      primarySpeed: raw.primarySpeed,
      performance
    }
  }

  nextTick(() => {
    if (popupRef.value) {
      const rect = popupRef.value.getBoundingClientRect()
      let safeX = activePopup.value.x
      let safeY = activePopup.value.y
      const padding = 8
      if (safeX + rect.width + padding > window.innerWidth) safeX = window.innerWidth - rect.width - padding
      if (safeY + rect.height + padding > window.innerHeight) safeY = window.innerHeight - rect.height - padding
      if (safeX < padding) safeX = padding
      if (safeY < padding) safeY = padding
      activePopup.value.x = safeX
      activePopup.value.y = safeY
    }
  })
}

const wdlGlobalPercentage = computed(() => {
  if (!currentStats.value || currentStats.value.gamesCount === 0) return { win: 0, draw: 0, loss: 0 }
  const total = currentStats.value.gamesCount
  return {
    win: (currentStats.value.wins / total) * 100,
    draw: (currentStats.value.draws / total) * 100,
    loss: (currentStats.value.losses / total) * 100
  }
})
</script>

<template>
  <div class="lichess-games-statistics">
    <NCard class="panel-card stats-dashboard-card" :title="$t('features.lichessGamesDb.statistics.title')" size="small">
      <div class="tabs-container">
        <NTabs type="segment" size="small" v-model:value="activeTab">
          <NTab name="all">{{ $t('features.lichessGamesDb.statistics.tabAll') }}</NTab>
          <NTab name="white">{{ $t('features.lichessGamesDb.statistics.tabWhite') }}</NTab>
          <NTab name="black">{{ $t('features.lichessGamesDb.statistics.tabBlack') }}</NTab>
        </NTabs>
      </div>

      <template v-if="hasData && currentStats">
        <div class="stats-overview">
          <!-- Overall stats summary -->
          <div class="overall-summary-card">
            <div class="games-count-row">
              <span class="label">{{ $t('features.lichessGamesDb.statistics.totalGames') }}</span>
              <span class="val">{{ currentStats.gamesCount }}</span>
            </div>

            <div class="wdl-bar-container global-bar">
              <div class="wdl-bar">
                <div class="wdl-segment win" :style="{ width: wdlGlobalPercentage.win + '%' }">
                  <span class="wdl-val" v-if="wdlGlobalPercentage.win > 12">
                    {{ currentStats.wins }} ({{ Math.round(wdlGlobalPercentage.win) }}%)
                  </span>
                </div>
                <div class="wdl-segment draw" :style="{ width: wdlGlobalPercentage.draw + '%' }">
                  <span class="wdl-val" v-if="wdlGlobalPercentage.draw > 12">
                    {{ currentStats.draws }} ({{ Math.round(wdlGlobalPercentage.draw) }}%)
                  </span>
                </div>
                <div class="wdl-segment loss" :style="{ width: wdlGlobalPercentage.loss + '%' }">
                  <span class="wdl-val" v-if="wdlGlobalPercentage.loss > 12">
                    {{ currentStats.losses }} ({{ Math.round(wdlGlobalPercentage.loss) }}%)
                  </span>
                </div>
              </div>
              <div class="wdl-labels">
                <span class="wdl-label-item win-label"><span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.wins') }}</span>
                <span class="wdl-label-item draw-label"><span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.draws') }}</span>
                <span class="wdl-label-item loss-label"><span class="dot"></span>{{ $t('features.lichessGamesDb.statistics.losses') }}</span>
              </div>
            </div>
          </div>

          <!-- Speed WDL horizontal bars table -->
          <div class="section-container">
            <h4 class="section-subtitle">{{ $t('features.lichessGamesDb.statistics.performanceBySpeed') }}</h4>
            <div class="speed-wdl-table">
              <div v-for="perf in currentStats.perfStats" :key="perf.speed" class="speed-row">
                <div class="speed-header-row">
                  <span class="speed-name">{{ perf.speed }}</span>
                  <div class="speed-meta">
                    <span class="speed-rating" v-if="perf.gamesCount > 0">{{ perf.avgRating }} {{ $t('features.lichessGamesDb.statistics.avgRating') }}</span>
                    <span class="speed-games-count">({{ $t('features.lichessGamesDb.statistics.gamesCount', { count: perf.gamesCount }) }})</span>
                  </div>
                </div>
                <div v-if="perf.gamesCount > 0" class="wdl-bar-container row-bar">
                  <div class="wdl-bar">
                    <div class="wdl-segment win" :style="{ width: perf.winRate + '%' }">
                      <span class="wdl-val" v-if="perf.winRate > 15">{{ Math.round(perf.winRate) }}% W</span>
                    </div>
                    <div class="wdl-segment draw" :style="{ width: perf.drawRate + '%' }">
                      <span class="wdl-val" v-if="perf.drawRate > 15">{{ Math.round(perf.drawRate) }}% D</span>
                    </div>
                    <div class="wdl-segment loss" :style="{ width: perf.lossRate + '%' }">
                      <span class="wdl-val" v-if="perf.lossRate > 15">{{ Math.round(perf.lossRate) }}% L</span>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-perf-bar">
                  {{ $t('features.lichessGamesDb.statistics.noGamesPlayed') }}
                </div>
              </div>
            </div>
          </div>

          <!-- Top Openings Rose Chart -->
          <div class="section-container border-top">
            <h4 class="section-subtitle">{{ $t('features.lichessGamesDb.statistics.topOpenings') }}</h4>
            <div class="sort-tabs-container">
              <NTabs type="segment" size="small" v-model:value="sortBy">
                <NTab name="games">{{ $t('features.lichessGamesDb.statistics.sortByGames') }}</NTab>
                <NTab name="winRate">{{ $t('features.lichessGamesDb.statistics.sortByWinRate') }}</NTab>
                <NTab name="performance">{{ $t('features.lichessGamesDb.statistics.sortByPerformance') }}</NTab>
              </NTabs>
            </div>
            <div class="chart-wrapper">
              <VChart class="chart" :option="chartOption" @click="onChartClick" autoresize />
            </div>
            <div class="chart-tip">
              <NText depth="3">{{ $t('features.lichessGamesDb.statistics.clickToView') }}</NText>
            </div>
          </div>
        </div>
      </template>
      <template v-else>
        <div class="empty-stats">
          <NEmpty :description="$t('features.lichessGamesDb.statistics.noLocalDb')">
          </NEmpty>
        </div>
      </template>
    </NCard>

    <!-- Teleport Popup for Opening Details -->
    <Teleport to="body">
      <div
        v-if="activePopup.visible && activePopup.data"
        ref="popupRef"
        class="chart-popup"
        :style="{ top: `${activePopup.y}px`, left: `${activePopup.x}px` }"
      >
        <div class="popup-header">
          <span class="popup-title">{{ $t('features.lichessGamesDb.statistics.openingDetails') }}</span>
          <NButton circle size="tiny" type="error" ghost @click="activePopup.visible = false" class="close-btn">
            <template #icon><NIcon :component="CloseOutline" /></template>
          </NButton>
        </div>
        <div class="popup-content">
          <div class="popup-opening-name">{{ activePopup.data.openingName }}</div>
          <div class="popup-row font-large">
            <span>{{ $t('features.lichessGamesDb.statistics.totalGames') }}</span>
            <span class="value-highlight">{{ activePopup.data.gamesCount }}</span>
          </div>
          <div class="popup-row">
            <span>{{ $t('features.lichessGamesDb.statistics.wdl') }}</span>
            <span>
              <span class="color-win">{{ activePopup.data.wins }}</span> /
              <span>{{ activePopup.data.draws }}</span> /
              <span class="color-loss">{{ activePopup.data.losses }}</span>
            </span>
          </div>
          <div class="popup-row">
            <span>{{ $t('features.lichessGamesDb.statistics.winRate') }}</span>
            <span class="color-win font-bold">{{ Math.round(activePopup.data.winRate) }}%</span>
          </div>
          <div class="popup-row">
            <span>{{ $t('features.lichessGamesDb.statistics.avgUserRating') }}</span>
            <span>{{ activePopup.data.avgUserRating }}</span>
          </div>
          <div class="popup-row">
            <span>{{ $t('features.lichessGamesDb.statistics.avgOpponentRating') }}</span>
            <span>{{ activePopup.data.avgOpponentRating }}</span>
          </div>
          <div class="popup-row">
            <span>{{ $t('features.lichessGamesDb.statistics.primaryTimeControl') }}</span>
            <span>{{ activePopup.data.primarySpeed }}</span>
          </div>
          <div class="popup-row border-top-row">
            <span>{{ $t('features.lichessGamesDb.statistics.performanceTpr') }}</span>
            <span class="perf-val">{{ activePopup.data.performance }}</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lichess-games-statistics {
  display: flex;
  flex-direction: column;
}

.panel-card {
  background: rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.panel-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.tabs-container {
  margin-bottom: 20px;
}

.overall-summary-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.games-count-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 700;
}

.games-count-row .label {
  color: rgba(255, 255, 255, 0.7);
}

.games-count-row .val {
  color: #fff;
  font-size: 20px;
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
}

.section-container {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.border-top {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 16px;
}

.section-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

/* WDL Progress Bars */
.wdl-bar-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wdl-bar {
  display: flex;
  height: 20px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.wdl-segment {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: width 0.4s ease;
}

.wdl-segment.win {
  background: #18a058;
}

.wdl-segment.draw {
  background: rgba(255, 255, 255, 0.2);
}

.wdl-segment.loss {
  background: #d03050;
}

.wdl-val {
  font-size: 10px;
  font-weight: bold;
  color: #fff;
  white-space: nowrap;
}

.global-bar .wdl-bar {
  height: 26px;
}

.global-bar .wdl-val {
  font-size: 12px;
}

.wdl-labels {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 4px;
  font-size: 11px;
}

.wdl-label-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.6);
}

.wdl-label-item .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.win-label .dot { background: #18a058; }
.draw-label .dot { background: rgba(255, 255, 255, 0.4); }
.loss-label .dot { background: #d03050; }

/* Speed Table */
.speed-wdl-table {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.speed-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.speed-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.speed-name {
  font-weight: 700;
  color: #fff;
}

.speed-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

.speed-rating {
  color: #f39c12;
  font-weight: 600;
}

.empty-perf-bar {
  height: 18px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  font-style: italic;
}

.sort-tabs-container {
  margin-top: 4px;
  margin-bottom: 4px;
}

/* Rose Chart */
.chart-wrapper {
  width: 100%;
  height: 600px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.chart {
  width: 100%;
  height: 100%;
}

.chart-tip {
  text-align: center;
  font-size: 11px;
  margin-top: -8px;
}

.empty-stats {
  padding: 40px 0;
  text-align: center;
}

/* Teleport Popup */
.chart-popup {
  position: fixed;
  z-index: 9999;
  background-color: rgba(10, 11, 20, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(24, 160, 88, 0.3);
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  min-width: 220px;
  color: #ccc;
  font-family: sans-serif;
  pointer-events: auto;
}

.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  padding-bottom: 6px;
}

.popup-title {
  font-weight: 700;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.popup-opening-name {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  color: #18a058;
  line-height: 1.3;
}

.popup-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 12px;
}

.font-large {
  font-size: 13px;
  font-weight: 600;
}

.border-top-row {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 8px;
  margin-top: 8px;
  font-weight: 700;
  font-size: 13px;
  color: #fff;
}

.value-highlight {
  color: #fff;
}

.color-win {
  color: #18a058;
}

.color-loss {
  color: #d03050;
}

.font-bold {
  font-weight: bold;
}

.perf-val {
  color: #f39c12;
  text-shadow: 0 0 8px rgba(243, 156, 18, 0.3);
}

.close-btn {
  width: 18px !important;
  height: 18px !important;
  min-height: 18px !important;
  min-width: 18px !important;
}
</style>
