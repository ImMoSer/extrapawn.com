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

import { tokens } from '@/shared/theme/tokens'

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
  { key: 'finish_him', nameKey: 'shared.gameModes.finishHim', color: tokens.neonPurple },
  { key: 'theory_endings', nameKey: 'shared.gameModes.theoryEndgames', color: tokens.danger },
  { key: 'practical_chess', nameKey: 'shared.gameModes.practicalChess', color: tokens.neonCyan },
  { key: 'tactics', nameKey: 'shared.gameModes.tactics', color: tokens.success },
] as const

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'rubyDiamond.svg',
  VIP: 'rubyDiamond.svg',
  vip: 'rubyDiamond.svg',
  Queen: 'wQ.svg',
  queen: 'wQ.svg',
  King: 'wK.svg',
  king: 'wK.svg',
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
    if (entry.score[modeKey] !== undefined) return entry.score[modeKey]
    if (modeKey === 'theory_endings' && entry.score['theory'] !== undefined) return entry.score['theory']
    if (modeKey === 'practical_chess' && entry.score['practical'] !== undefined) return entry.score['practical']
    return 0
  }
  if ('solved_by_mode' in entry && entry.solved_by_mode) {
    let key = modeKey
    if (modeKey === 'practical_chess' || modeKey === 'practical') key = 'practical-chess'
    if (modeKey === 'theory_endings') key = 'theory'
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
      backgroundColor: tokens.elevated,
      borderColor: tokens.border,
      textStyle: { color: tokens.textPrimary },
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

        let html = `<div style="padding: 8px; min-width: 150px; background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 8px;">
                      <b style="color: ${tokens.textPrimary}; display: flex; align-items: center; gap: 6px; margin-bottom: 8px; border-bottom: 1px solid ${tokens.border}; padding-bottom: 4px;">
                        <img src="${iconPath}" alt="tier" class="tier-icon" /> 
                        ${entry.username}
                      </b>`

        p.forEach((item) => {
          if (item.value > 0) {
            html += `
              <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span style="color: ${item.color}; font-weight: bold;">${item.seriesName}:</span>
                <span style="color: ${tokens.textPrimary}; margin-left: 12px;">${item.value}</span>
              </div>`
          }
        })

        html += `<div style="margin-top: 8px; border-top: 1px solid ${tokens.border}; padding-top: 4px; text-align: right; color: ${tokens.warning};">
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
  <div class="bg-surface border border-border rounded-xl shadow-flat overflow-hidden flex flex-col mb-5">
    <div class="px-5 py-4 max-md:px-3.5 max-md:py-2.5 border-b border-border bg-elevated/40">
      <h3 class="m-0 text-center font-display font-extrabold text-xl max-md:text-base tracking-wider uppercase text-warning flex justify-center items-center gap-3">
        {{ title }}
      </h3>
    </div>

    <n-space vertical class="bg-elevated/20 p-4 max-md:p-3 border-b border-border" :size="12">
      <div>
        <n-space justify="center" align="center">
          <div v-for="mode in skillModes" :key="mode.key" class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" :style="{ backgroundColor: mode.color }"></span>
            <span class="text-xs text-text-secondary max-md:text-[10px]">{{ t(mode.nameKey) }}</span>
          </div>
        </n-space>
      </div>
    </n-space>

    <div class="w-full relative bg-void/30 py-4 max-md:py-2.5" :style="{ height: dynamicHeight }">
      <v-chart
        v-if="entries.length > 0"
        class="w-full h-full"
        :option="chartOption"
        @click="onChartClick"
        autoresize
      />
      <n-empty v-else :description="t('pages.userCabinet.stats.noData')" />
    </div>
  </div>
</template>
