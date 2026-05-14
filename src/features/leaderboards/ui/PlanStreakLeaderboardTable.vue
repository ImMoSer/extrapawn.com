<!-- src/features/leaderboards/ui/PlanStreakLeaderboardTable.vue -->
<script setup lang="ts">
import type { PlanStreakLeaderboardEntry } from '@/shared/types/api.types'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { computed, onMounted, onUnmounted, ref, type PropType } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent, TitleComponent])

interface TooltipParam {
  dataIndex: number
  value: number
  color: string
}

interface ClickParam {
  componentType: string
  dataIndex: number
}

const props = defineProps({
  title: { type: String, required: true },
  entries: {
    type: Array as PropType<PlanStreakLeaderboardEntry[]>,
    required: true,
  },
  colorClass: { type: String, required: true },
  isLoading: { type: Boolean, default: false },
})

const { t } = useI18n()

const STREAK_COLOR = '#9b59b6' // Violet color (Theory)

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
  Administrator: 'wK.svg',
}

const getTierIcon = (tierStr: string) => {
  const actualTier = tierStr && tierToPieceMap[tierStr] ? tierStr : 'Pawn'
  return `/piece/alpha/${tierToPieceMap[actualTier]}`
}

// Responsive logic
const isMobile = ref(false)
const canHover = ref(true)
const updateMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  updateMobile()
  canHover.value = window.matchMedia('(hover: hover)').matches
  window.addEventListener('resize', updateMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateMobile)
})

const chartOption = computed(() => {
  const displayEntries = [...props.entries].slice(0, 20)

  return {
    backgroundColor: 'transparent',
    tooltip: {
      show: canHover.value,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      appendTo: 'body',
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
        const entry = displayEntries[p[0].dataIndex]
        if (!entry) return ''

        const iconPath = getTierIcon(entry.tier)

        let html = `<div style="padding: 8px; min-width: 150px; background: rgba(10, 11, 20, 0.95); border: 1px solid var(--glass-border); border-radius: 8px;">
                      <b style="color: #FFFFFF; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; border-bottom: 1px solid var(--glass-border); padding-bottom: 4px;">
                        <img src="${iconPath}" alt="tier" style="width: 20px; height: 20px;" /> 
                        ${entry.username}
                      </b>`

        html += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
            <span style="color: ${STREAK_COLOR}; font-weight: bold;">Streak:</span>
            <span style="color: #FFF; margin-left: 12px;">${entry.current_streak} 🔥</span>
          </div>`

        html += `</div>`
        return html
      },
    },
    grid: {
      left: '3%',
      right: '12%',
      bottom: '3%',
      top: '5%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      show: false,
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      triggerEvent: true,
      data: displayEntries.map((e, idx) => {
        const rank = idx + 1
        return `${rank}. {icon${idx}| } ${e.username}`
      }),
      axisLabel: {
        color: '#CCC',
        fontSize: isMobile.value ? 9 : 12,
        fontWeight: 'bold',
        formatter: (value: string) => value,
        rich: displayEntries.reduce(
          (acc, entry, index) => {
            const iconUrl = getTierIcon(entry.tier)
            const iconSize = isMobile.value ? 20 : 32
            acc[`icon${index}`] = {
              backgroundColor: { image: iconUrl },
              height: iconSize,
              width: iconSize,
              align: 'center',
            }
            return acc
          },
          {} as Record<
            string,
            { backgroundColor: { image: string }; height: number; width: number; align: string }
          >,
        ),
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: 'Streak',
        type: 'bar',
        barWidth: isMobile.value ? 17 : 24,
        itemStyle: {
          color: STREAK_COLOR,
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right',
          distance: 10,
          color: STREAK_COLOR,
          fontWeight: 'bold',
          fontSize: isMobile.value ? 10 : 14,
          formatter: '{c} 🔥',
        },
        data: displayEntries.map((e) => e.current_streak),
      },
    ],
  }
})

const dynamicHeight = computed(() => {
  const count = Math.max(props.entries.length, 1)
  const displayCount = Math.min(count, 20)
  const perEntry = isMobile.value ? 32 : 45
  const padding = isMobile.value ? 28 : 40
  return `${displayCount * perEntry + padding}px`
})

const onChartClick = (params: unknown) => {
  const p = params as ClickParam
  if (p.componentType === 'yAxis' || p.componentType === 'series') {
    const entries = [...props.entries].slice(0, 20)
    const entry = entries[p.dataIndex]
    if (!entry) return

    if (p.componentType === 'yAxis' && entry.id) {
      window.open(`https://lichess.org/@/${entry.id}`, '_blank')
    }
  }
}
</script>

<template>
  <div class="records-card" :class="colorClass">
    <div class="card-header">
      <h3 class="card-title">
        {{ title }}
      </h3>
    </div>

    <div class="chart-container" :style="{ height: dynamicHeight }">
      <v-chart
        v-if="entries.length > 0"
        class="chart"
        :option="chartOption"
        @click="onChartClick"
        autoresize
      />
      <n-empty v-else :description="t('features.userCabinet.stats.noData')" />
    </div>
  </div>
</template>

<style scoped>
.records-card {
  background-color: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border-radius: var(--panel-border-radius);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  margin-bottom: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255, 255, 255, 0.03);
}

.planStreak .card-title {
  color: #9b59b6;
}

.card-title {
  font-size: 1.4rem;
  margin: 0;
  text-align: center;
  font-weight: 800;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.chart-container {
  width: 100%;
  position: relative;
  background-color: rgba(0, 0, 0, 0.1);
  padding: 16px 0;
}

.chart {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .card-header {
    padding: 11px 14px;
  }

  .card-title {
    font-size: 1rem;
    letter-spacing: 1px;
    gap: 8px;
  }

  .chart-container {
    padding: 11px 0;
  }
}
</style>
