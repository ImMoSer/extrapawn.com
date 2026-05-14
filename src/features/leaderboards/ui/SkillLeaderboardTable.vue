<!-- src/components/recordsPage/SkillLeaderboardTable.vue -->
<script setup lang="ts">
import type { LeaderboardEntry, SolveStreakLeaderboardEntry } from '@/shared/types/api.types'
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
  seriesName: string
}

interface LabelParam {
  dataIndex: number
}

interface ClickParam {
  componentType: string
  dataIndex: number
}

const props = defineProps({
  title: { type: String, required: true },
  entries: {
    type: Array as PropType<(LeaderboardEntry | SolveStreakLeaderboardEntry)[]>,
    required: true,
  },
  colorClass: { type: String, required: true },
  showStreak: { type: Boolean, default: false },
  showTimer: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
})

const { t } = useI18n()

const skillModes = [
  { key: 'finish_him', nameKey: 'gameModes.finishHim', color: '#42b883' }, // Green
  { key: 'tornado', nameKey: 'features.userCabinet.stats.modes.tornado', color: '#f39c12' }, // Orange
  { key: 'theory', nameKey: 'features.userCabinet.stats.modes.theory', color: '#9b59b6' }, // Purple
  { key: 'practical', nameKey: 'features.userCabinet.stats.modes.practical', color: '#3498db' }, // Blue
] as const

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

const getTierIconSize = () => {
  const varName = isMobile.value ? '--tier-icon-size-mobile' : '--tier-icon-size-desktop'
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  return parseInt(val, 10) || (isMobile.value ? 20 : 32)
}

// Helper to get total from different entry types
const getTotal = (entry: LeaderboardEntry | SolveStreakLeaderboardEntry) => {
  if ('score' in entry && entry.score && typeof entry.score === 'object') {
    return Object.values(entry.score).reduce((a, b) => a + b, 0)
  }
  if ('total_score' in entry && entry.total_score !== undefined) return entry.total_score
  return (entry as SolveStreakLeaderboardEntry).total_solved || 0
}

// Helper to get mode score
const getModeScore = (entry: LeaderboardEntry | SolveStreakLeaderboardEntry, modeKey: string) => {
  if ('score' in entry && entry.score && typeof entry.score === 'object') {
    return entry.score[modeKey] || 0
  }
  if ('solved_by_mode' in entry && entry.solved_by_mode) {
    // Adapter for old practical-chess key
    const key = modeKey === 'practical' ? 'practical-chess' : modeKey
    return entry.solved_by_mode[key] || 0
  }
  return 0
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

        const tierStr =
          'tier' in entry
            ? entry.tier
            : 'subscriptionTier' in entry
              ? entry.subscriptionTier
              : 'Pawn'
        const iconPath = getTierIcon(tierStr)

        let html = `<div style="padding: 8px; min-width: 150px; background: rgba(10, 11, 20, 0.95); border: 1px solid var(--glass-border); border-radius: 8px;">
                      <b style="color: #FFFFFF; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; border-bottom: 1px solid var(--glass-border); padding-bottom: 4px;">
                        <img src="${iconPath}" alt="tier" class="tier-icon" /> 
                        ${entry.username}
                      </b>`

        p.forEach((item) => {
          if (item.value > 0) {
            html += `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: ${item.color}; font-weight: bold;">${item.seriesName}:</span>
                <span style="color: #FFF; margin-left: 12px;">${item.value}</span>
              </div>`
          }
        })

        html += `<div style="margin-top: 8px; border-top: 1px solid #5A5A5A; padding-top: 4px; text-align: right;">
                   <b>Total: ${getTotal(entry)}</b>
                 </div></div>`
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
        const streak = props.showStreak && 'current_streak' in e ? ` (${e.current_streak}🔥)` : ''
        return `${rank}. {icon${idx}| } ${e.username}${streak}`
      }),
      axisLabel: {
        color: '#CCC',
        fontSize: isMobile.value ? 9 : 12,
        fontWeight: 'bold',
        formatter: (value: string) => value,
        rich: displayEntries.reduce(
          (acc, entry, index) => {
            const tierStr =
              'tier' in entry
                ? entry.tier
                : 'subscriptionTier' in entry
                  ? entry.subscriptionTier
                  : 'Pawn'
            const iconUrl = getTierIcon(tierStr)
            const iconSize = getTierIconSize()
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
    series: skillModes.map((mode, modeIdx) => ({
      name: t(mode.nameKey),
      type: 'bar',
      stack: 'total',
      barWidth: isMobile.value ? 17 : 24,
      itemStyle: {
        color: mode.color,
      },
      label: {
        show: modeIdx === skillModes.length - 1,
        position: 'right',
        distance: 10,
        color: '#f39c12',
        fontWeight: 'bold',
        fontSize: isMobile.value ? 10 : 14,
        formatter: (params: unknown) => {
          const p = params as LabelParam
          const entry = displayEntries[p.dataIndex]
          if (!entry) return ''
          return getTotal(entry)
        },
      },
      data: displayEntries.map((e) => getModeScore(e, mode.key)),
    })),
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

    const id = 'id' in entry ? entry.id : (entry as SolveStreakLeaderboardEntry).lichess_id

    if (p.componentType === 'yAxis' && id) {
      window.open(`https://lichess.org/@/${id}`, '_blank')
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

    <n-space vertical class="controls-area" :size="12">
      <div class="legend-row">
        <n-space justify="center">
          <div v-for="mode in skillModes" :key="mode.key" class="legend-item">
            <span class="dot" :style="{ backgroundColor: mode.color }"></span>
            <span class="label">{{ t(mode.nameKey) }}</span>
          </div>
        </n-space>
      </div>
    </n-space>

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

.skillStreak .card-title {
  color: var(--neon-cyan);
}
.skillStreakMega .card-title {
  color: var(--neon-purple);
}
.topToday .card-title {
  color: var(--color-accent-warning);
}
.overallSkill .card-title {
  color: var(--neon-pink);
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

.controls-area {
  background-color: rgba(255, 255, 255, 0.03);
  padding: 16px;
  border-bottom: 1px solid var(--glass-border);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-item .dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.legend-item .label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
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

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
}

.is-loading {
  filter: blur(1px);
  pointer-events: none;
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

  .controls-area {
    padding: 11px;
  }

  .legend-item .label {
    font-size: 0.6rem;
  }

  .chart-container {
    padding: 11px 0;
  }
}
</style>
