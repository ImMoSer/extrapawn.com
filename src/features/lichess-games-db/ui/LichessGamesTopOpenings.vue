<script setup lang="ts">
import { computed, ref } from 'vue'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TitleComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { NTabs, NTab, NText } from 'naive-ui'
import type { TabStats } from '../model/lichess-games-db.store'
import LichessGamesOpeningDetailsDashboard from './LichessGamesOpeningDetailsDashboard.vue'

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
}

const props = defineProps<{
  username: string
  whiteStats: TabStats
  blackStats: TabStats
}>()

const activeTab = ref<'white' | 'black'>('white')
const sortBy = ref<'games' | 'performance'>('games')

// Dashboard view states
const showDashboard = ref(false)
const selectedOpening = ref('')
const selectedColor = ref<'white' | 'black'>('white')

const currentStats = computed(() => {
  return activeTab.value === 'white' ? props.whiteStats : props.blackStats
})

const hasData = computed(() => {
  return currentStats.value && currentStats.value.gamesCount > 0
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

const sortedOpeningsForChart = computed(() => {
  if (!currentStats.value) return []
  const list = [...currentStats.value.topOpenings]
  
  if (sortBy.value === 'games') {
    list.sort((a, b) => b.gamesCount - a.gamesCount)
  } else if (sortBy.value === 'performance') {
    list.sort((a, b) => getOpeningPerformance(b) - getOpeningPerformance(a))
  }
  
  return list
})

const PALETTE = [
  '#00e5ff', // 1. Cyan (Extrem hell/kalt)
  '#ff073a', // 2. Red (Dunkler/heiß) -> Maximaler Split zu Cyan
  '#39ff14', // 3. Acid Green (Grell/Leuchtend)
  '#7a00ff', // 4. Violet (Dunkel/Absorbierend) -> Schluckt das Grün
  '#ffe600', // 5. Yellow (Maximaler Helligkeits-Schnitt zu Violett)
  '#0055ff', // 6. Blue (Tiefblau gegen Gelb)
  '#ff5500', // 7. Orange (Komplementär zu Blau)
  '#b000ff', // 8. Purple (Wechsel zu Dunkel-Magenta-Ton)
  '#aaff00', // 9. Toxic (Grellgelb-Grün gegen Lila)
  '#ff00c8', // 10. Magenta (Heißer Kontrast zu Toxic)
  '#00ffcc', // 11. Mint (Eisiger Kontrast zu Magenta)
  '#d9004c', // 12. Bordeaux (Dunkel/Satt gegen Mint)
  '#66ccff', // 13. Ice Blue (Hell gegen Bordeaux)
  '#ff9900', // 14. Amber (Warm/Dunkelorange gegen Ice Blue)
  '#ff007a', // 15. Pink (Knallig gegen Amber)
  '#00ff99', // 16. Green Mint (Kalt gegen Pink)
  '#ff3366', // 17. Raspberry (Dunkles Pink-Rot)
  '#00aaff', // 18. Sky (Hellblau gegen Raspberry)
  '#ff66cc', // 19. Bubblegum (Hellpink)
  '#00ff55'  // 20. Lime (Grellgrün - schließt perfekt ab zu Cyan auf Position 1)
]

const chartData = computed(() => {
  const list = sortedOpeningsForChart.value
  const N = list.length
  return list.map((op, i) => {
    let visualValue = 100
    if (N > 1) {
      visualValue = 100 - (i * 50) / (N - 1)
    }
    const colorIdx = i % PALETTE.length
    return {
      name: op.openingNameBase,
      value: visualValue,
      raw: op,
      itemStyle: {
        color: PALETTE[colorIdx]
      }
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
          formatter: (params: { name: string }) => {
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

  selectedOpening.value = p.data.raw.openingNameBase
  selectedColor.value = activeTab.value
  showDashboard.value = true
}
</script>

<template>
  <div class="section-container border-top">
    <template v-if="!showDashboard">
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
    </template>

    <template v-else>
      <LichessGamesOpeningDetailsDashboard
        :username="username"
        :opening-name="selectedOpening"
        :color="selectedColor"
        @back="showDashboard = false"
      />
    </template>
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
</style>
