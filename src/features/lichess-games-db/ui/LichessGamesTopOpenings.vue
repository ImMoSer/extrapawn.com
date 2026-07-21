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

import { tokens } from '@/shared/theme/tokens'

const PALETTE = [
  tokens.neonCyan,
  tokens.danger,
  tokens.acidGreen,
  tokens.purpleDeep,
  tokens.warning,
  tokens.info,
  tokens.orange,
  tokens.neonPurple,
  tokens.mint,
  tokens.magenta,
  tokens.amber,
  tokens.dangerDeep,
  tokens.highlight,
  tokens.orangeWarm,
  tokens.highlightLight,
  tokens.success,
  tokens.infoDeep,
  tokens.successDeep,
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
  <div class="mb-5 flex flex-col gap-3 border-t border-border pt-4">
    <template v-if="!showDashboard">
      <div class="flex justify-between items-center mb-3">
        <h4 class="m-0 text-xs font-bold font-display uppercase tracking-wider text-text-secondary">{{ $t('features.lichessGamesDb.statistics.topOpenings') }}</h4>
        <div class="w-[150px]">
          <NTabs type="segment" size="small" v-model:value="activeTab">
            <NTab name="white">{{ $t('features.lichessGamesDb.statistics.tabWhite') }}</NTab>
            <NTab name="black">{{ $t('features.lichessGamesDb.statistics.tabBlack') }}</NTab>
          </NTabs>
        </div>
      </div>

      <template v-if="hasData">
        <div class="my-1">
          <NTabs type="segment" size="small" v-model:value="sortBy">
            <NTab name="games">{{ $t('features.lichessGamesDb.statistics.sortByGames') }}</NTab>
            <NTab name="performance">{{ $t('features.lichessGamesDb.statistics.sortByPerformance') }}</NTab>
          </NTabs>
        </div>
        <div class="w-full h-[70vh] max-md:h-[350px] flex justify-center items-center relative">
          <VChart class="w-full h-full" :option="chartOption" @click="onChartClick" autoresize />
        </div>
        <div class="text-center text-[11px] -mt-2">
          <NText depth="3">{{ $t('features.lichessGamesDb.statistics.clickToView') }}</NText>
        </div>
      </template>
      <template v-else>
        <div class="py-10 text-center italic text-text-disabled">
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
