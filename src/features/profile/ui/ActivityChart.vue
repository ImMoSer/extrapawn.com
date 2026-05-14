<!-- src/components/userCabinet/sections/ActivityChart.vue -->
<script setup lang="ts">
export type ActivityPeriod = 'daily' | 'weekly' | 'monthly'

import { BarChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, ref } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

interface TooltipParam {
  axisValue: string
  value: number
  color: string
  data: {
    value: number
    itemStyle: { color: string }
    requested: number
    cost: number
  }
}

import type {
  ActivityPeriodStats,
  PersonalActivityStatsResponse,
  ActivityHistoryEntry,
} from '@/shared/types/api.types'

const props = defineProps<{
  stats: PersonalActivityStatsResponse | null | undefined
  isLoading: boolean
}>()

const { t } = useI18n()

// Local state for the selected period tab
const selectedActivityPeriod = ref<ActivityPeriod>('daily')

const handlePeriodChange = (period: string) => {
  selectedActivityPeriod.value = period as ActivityPeriod
}

const canHover = ref(true)

onMounted(() => {
  canHover.value = window.matchMedia('(hover: hover)').matches
})

const aggregateActivity = (
  activities: ActivityHistoryEntry[],
  days: number,
): ActivityPeriodStats => {
  const result: ActivityPeriodStats = {
    finish_him: { puzzles_requested: 0, puzzles_solved: 0 },
    tornado: { puzzles_requested: 0, puzzles_solved: 0 },
    theory: { puzzles_requested: 0, puzzles_solved: 0 },
    'practical-chess': { puzzles_requested: 0, puzzles_solved: 0 },
    rep_generator: { puzzles_requested: 0, puzzles_solved: 0 },
    'diamond-hunter': { puzzles_requested: 0, puzzles_solved: 0 },
    'opening-sparring': { puzzles_requested: 0, puzzles_solved: 0 },
    'study-reply': { puzzles_requested: 0, puzzles_solved: 0 },
    speedrun: { puzzles_requested: 0, puzzles_solved: 0 },
  }

  if (!activities) return result

  const now = new Date()
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  for (const activity of activities) {
    const activityDate = new Date(activity.date)
    if (activityDate >= cutoff) {
      const mode = activity.game_mode as keyof ActivityPeriodStats
      if (result[mode]) {
        result[mode]!.puzzles_requested += activity.costs_trigger || 0
        result[mode]!.puzzles_solved += activity.puzzles_solved || 0
      }
    }
  }

  return result
}

const aggregatedStats = computed(() => {
  const activities = props.stats?.activities || []
  return {
    daily: aggregateActivity(activities, 1),
    weekly: aggregateActivity(activities, 7),
    monthly: aggregateActivity(activities, 30),
  }
})

const chartOption = computed(() => {
  if (!props.stats) return {}

  const periodData = aggregatedStats.value[selectedActivityPeriod.value]

  const modes = [
    { key: 'theory', name: t('nav.theoryEndgames'), cost: 5, color: '#9b59b6' },
    { key: 'tornado', name: t('nav.tornado'), cost: 10, color: '#f39c12' },
    { key: 'finish_him', name: t('nav.finishHim'), cost: 10, color: '#42b883' },
    { key: 'practical-chess', name: t('nav.practicalChess'), cost: 5, color: '#3498db' },
    {
      key: 'rep_generator',
      name: t('features.study.repertoireGenerator.title'),
      cost: 50,
      color: '#e74c3c',
    },
    { key: 'diamond-hunter', name: t('nav.diamondHunter'), cost: 25, color: '#1abc9c' },
    { key: 'opening-sparring', name: t('nav.openingExam'), cost: 25, color: '#e67e22' },
    {
      key: 'study-reply',
      name: t('features.study.sidebar.replyTraining', 'Reply Training'),
      cost: 25,
      color: '#f1c40f',
    },
    { key: 'speedrun', name: t('nav.speedrun'), cost: 25, color: '#8e44ad' },
  ] as const

  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: canHover.value,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      confine: true,
      triggerOn: 'mousemove',
      hideDelay: 0,
      enterable: false,
      backgroundColor: '#2a2a2e',
      borderColor: '#5A5A5A',
      textStyle: { color: '#CCCCCC' },
      formatter: (params: unknown) => {
        const p = params as TooltipParam[]
        if (!p || !p[0]) return ''
        const modeName = p[0].axisValue
        const spent = p[0].value
        const color = p[0].color
        const requested = p[0].data.requested
        const cost = p[0].data.cost

        return `<div style="padding: 4px; min-width: 140px;">
                  <b style="color: #FFFFFF; display: block; margin-bottom: 8px; border-bottom: 1px solid #5A5A5A; padding-bottom: 4px;">${modeName}</b>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: #888;">${modeName}:</span>
                    <span style="color: #FFF; margin-left: 12px;">${requested}x${cost}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span style="color: ${color}; font-weight: bold;">PawnCoins:</span>
                    <span style="color: #FFF; margin-left: 12px; font-weight: bold;">${spent}</span>
                  </div>
                </div>`
      },
    },
    grid: {
      left: '3%',
      right: '8%',
      bottom: '5%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      splitLine: {
        lineStyle: { color: '#333' },
      },
      axisLabel: { color: '#888' },
    },
    yAxis: {
      type: 'category',
      data: modes.map((m) => m.name),
      axisLabel: {
        color: '#CCC',
        fontSize: 12,
        fontWeight: 'bold',
        interval: 0,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'PawnCoins',
        type: 'bar',
        barWidth: 20,
        data: modes.map((m) => {
          const requested =
            (periodData as ActivityPeriodStats)?.[m.key as keyof ActivityPeriodStats]
              ?.puzzles_requested || 0
          return {
            value: requested * m.cost,
            itemStyle: { color: m.color },
            requested: requested,
            cost: m.cost,
          }
        }),
      },
    ],
  }
})
</script>

<template>
  <div class="activity-chart-container" v-if="!isLoading">
    <div class="chart-header">
      <div class="header-left-group">
        <span class="chart-title">{{ t('features.userCabinet.stats.global.title') }}</span>
      </div>
      <n-tabs
        type="segment"
        :value="selectedActivityPeriod"
        @update:value="handlePeriodChange"
        class="period-tabs"
        size="small"
      >
        <n-tab-pane name="daily" :tab="t('features.userCabinet.stats.periods.day')" />
        <n-tab-pane name="weekly" :tab="t('features.userCabinet.stats.periods.week')" />
        <n-tab-pane name="monthly" :tab="t('features.userCabinet.stats.periods.month')" />
      </n-tabs>
    </div>

    <div class="chart-wrapper">
      <v-chart v-if="stats" class="chart" :option="chartOption" autoresize />
      <n-empty v-else :description="t('features.userCabinet.stats.noData')" />
    </div>
  </div>
  <n-card v-else class="activity-chart-container" :loading="true" />
</template>

<style scoped>
.activity-chart-container {
  width: 100%;
  background-color: var(--color-bg-tertiary);
  border-radius: 12px;
  padding: 10px;
  border: 1px solid var(--color-border);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1px;
  flex-wrap: wrap;
  gap: 2px;
}

.header-left-group {
  display: flex;
  align-items: center;
}

.chart-title {
  margin: 0;
  color: var(--color-accent-success);
  font-family: var(--font-family-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.period-tabs {
  width: 250px;
}

.chart-wrapper {
  width: 100%;
  height: 400px;
}

.chart {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .activity-chart-container {
    padding: 10px;
  }

  .chart-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .chart-title {
    font-size: 0.88rem;
  }

  .chart-wrapper {
    height: 280px;
  }

  .period-tabs {
    width: 100%;
  }
}
</style>
