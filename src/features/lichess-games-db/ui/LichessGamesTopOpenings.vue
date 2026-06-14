<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { NButton, NIcon, NTabs, NTab, NText } from 'naive-ui'
import { CloseOutline } from '@vicons/ionicons5'
import type { TabStats } from '../model/lichess-games-db.store'

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

const props = defineProps<{
  whiteStats: TabStats
  blackStats: TabStats
}>()

const activeTab = ref<'white' | 'black'>('white')
const sortBy = ref<'games' | 'winRate' | 'performance'>('games')

const currentStats = computed(() => {
  return activeTab.value === 'white' ? props.whiteStats : props.blackStats
})

const hasData = computed(() => {
  return currentStats.value && currentStats.value.gamesCount > 0
})

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
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('touchstart', handleClickOutside)
})

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
        radius: ['10%', '70%'],
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
    ],
    media: [
      {
        query: {
          maxWidth: 450
        },
        option: {
          series: [
            {
              radius: ['10%', '50%'],
              label: {
                fontSize: 9
              }
            }
          ]
        }
      },
      {
        query: {
          maxWidth: 350
        },
        option: {
          series: [
            {
              radius: ['5%', '42%'],
              label: {
                fontSize: 8
              }
            }
          ]
        }
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
</script>

<template>
  <div class="section-container border-top">
    <div class="header-row">
      <h4 class="section-subtitle">{{ $t('features.lichessGamesDb.statistics.topOpenings') }}</h4>
      <div class="opening-tabs-container">
        <NTabs type="segment" size="small" v-model:value="activeTab">
          <NTab name="white">{{ $t('features.lichessGamesDb.statistics.tabWhite') }}</NTab>
          <NTab name="black">{{ $t('features.lichessGamesDb.statistics.tabBlack') }}</NTab>
        </NTabs>
      </div>
    </div>

    <template v-if="hasData">
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
    </template>
    <template v-else>
      <div class="empty-openings">
        <NText depth="3">{{ $t('features.lichessGamesDb.statistics.noGamesPlayed') }}</NText>
      </div>
    </template>

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

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.opening-tabs-container {
  width: 150px;
}

.section-subtitle {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 1px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
}

.sort-tabs-container {
  margin-top: 4px;
  margin-bottom: 4px;
}

/* Rose Chart */
.chart-wrapper {
  width: 100%;
  height: 70vh;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}

.chart {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .chart-wrapper {
    height: 350px;
  }
}

.chart-tip {
  text-align: center;
  font-size: 11px;
  margin-top: -8px;
}

.empty-openings {
  padding: 40px 0;
  text-align: center;
  font-style: italic;
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
