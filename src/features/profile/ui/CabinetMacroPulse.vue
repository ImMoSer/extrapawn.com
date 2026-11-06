<script setup lang="ts">
import {
  formatRemainingDuration,
  getVisibleTrainingDisciplines,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  type CabinetDTO,
  type TrainingDiscipline,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { tokens } from '@/shared/theme/tokens'
import { FlashOutline, PersonCircleOutline, TrendingUpOutline } from '@vicons/ionicons5'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const props = defineProps<{
  cabinet: CabinetDTO
  selectedDiscipline: TrainingDiscipline
  username: string
}>()

const emit = defineEmits<{
  selectDiscipline: [discipline: TrainingDiscipline]
  openTrainingHub: [discipline: TrainingDiscipline]
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const visibleDisciplines = computed(() => getVisibleTrainingDisciplines(authStore.isMo3ep))

const disciplineTimeline = computed(() => {
  return props.cabinet.weekly_timeline.filter(
    (pt) => pt.discipline === props.selectedDiscipline && pt.scope_key === 'all',
  )
})

const yearlyStats = computed(() => {
  let activeDays = 0
  let totalSolved = 0
  let totalFailed = 0
  let totalGraduated = 0
  for (const day of props.cabinet.daily_activity) {
    if (day.solved + day.failed > 0) activeDays++
    totalSolved += day.solved
    totalFailed += day.failed
    totalGraduated += day.woodpecker_graduated
  }
  const totalAttempts = totalSolved + totalFailed
  const acc = totalAttempts > 0 ? Math.round((totalSolved / totalAttempts) * 100) : 100
  return { activeDays, totalSolved, totalFailed, totalGraduated, acc }
})

const chartOption = computed(() => {
  const points = disciplineTimeline.value
  const weeks = points.map((p) => p.week_start)
  const ratings = points.map((p) => Math.round(p.rating_end))
  const accuracies = points.map((p) => Math.round(p.ema_accuracy * 100))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: tokens.elevated,
      borderColor: tokens.border,
      textStyle: {
        color: tokens.textPrimary,
        fontFamily: 'Ubuntu Condensed, sans-serif',
      },
    },
    legend: {
      data: [
        t('pages.userCabinet.macro.chartRating'),
        t('pages.userCabinet.macro.chartAccuracy'),
      ],
      textStyle: {
        color: tokens.textSecondary,
        fontFamily: 'Ubuntu, sans-serif',
        fontSize: 11,
      },
      top: 0,
      right: 0,
    },
    grid: {
      left: 42,
      right: 42,
      top: 32,
      bottom: 24,
    },
    xAxis: {
      type: 'category',
      data: weeks,
      axisLine: { lineStyle: { color: tokens.border } },
      axisLabel: {
        color: tokens.textSecondary,
        fontFamily: 'Ubuntu Condensed, sans-serif',
        fontSize: 11,
      },
    },
    yAxis: [
      {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { color: tokens.border, type: 'dashed' } },
        axisLabel: {
          color: tokens.textSecondary,
          fontFamily: 'Ubuntu Condensed, sans-serif',
          fontSize: 11,
        },
      },
      {
        type: 'value',
        min: 0,
        max: 100,
        splitLine: { show: false },
        axisLabel: {
          color: tokens.textSecondary,
          fontFamily: 'Ubuntu Condensed, sans-serif',
          fontSize: 11,
          formatter: '{value}%',
        },
      },
    ],
    series: [
      {
        name: t('pages.userCabinet.macro.chartRating'),
        type: 'line',
        yAxisIndex: 0,
        smooth: true,
        symbolSize: 6,
        itemStyle: { color: tokens.brand },
        lineStyle: { width: 2.5, color: tokens.brand },
        data: ratings,
      },
      {
        name: t('pages.userCabinet.macro.chartAccuracy'),
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 5,
        itemStyle: { color: tokens.accent },
        lineStyle: { width: 2, type: 'dashed', color: tokens.accent },
        data: accuracies,
      },
    ],
  }
})
</script>

<template>
  <section class="flex flex-col gap-4">
    <!-- Top Identity & Woodpecker Vault Row -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Player Identity Card -->
      <div class="lg:col-span-2 p-5 rounded-lg bg-surface border border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-md bg-elevated border border-border-hover flex items-center justify-center text-text-primary shrink-0">
            <NIcon size="28"><PersonCircleOutline /></NIcon>
          </div>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <h1 class="font-display font-bold text-2xl text-text-primary tracking-wide">
                {{ username }}
              </h1>
              <span class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-elevated text-text-secondary border border-border">
                HUD 2.0
              </span>
            </div>
            <span class="text-xs text-text-secondary">
              {{
                t('pages.userCabinet.macro.yearlySummary', {
                  days: yearlyStats.activeDays,
                  solved: yearlyStats.totalSolved,
                  acc: yearlyStats.acc,
                })
              }}
            </span>
          </div>
        </div>

        <NButton type="primary" @click="emit('openTrainingHub', selectedDiscipline)">
          <template #icon>
            <NIcon><FlashOutline /></NIcon>
          </template>
          {{ t('pages.userCabinet.macro.goToTrainingCenter') }}
        </NButton>
      </div>

      <!-- Woodpecker Vault Card ([D3]) -->
      <div class="p-5 rounded-lg bg-surface border border-border flex flex-col justify-between gap-3">
        <div class="flex items-center justify-between">
          <span class="font-display font-bold text-xs uppercase tracking-wider text-accent">
            {{ t('features.trainingCenter.woodpecker.vaultTitle') }}
          </span>
          <span class="font-condensed text-xs text-text-secondary">
            {{ t('pages.userCabinet.macro.woodpeckerRuleHint') }}
          </span>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="p-2 rounded-sm bg-elevated border border-border">
            <div class="font-condensed font-bold text-xl text-warning">
              {{ cabinet.overview.woodpecker.due_now }}
            </div>
            <div class="text-[10px] text-text-secondary uppercase">
              {{ t('features.trainingCenter.woodpecker.dueShort') }}
            </div>
          </div>

          <div class="p-2 rounded-sm bg-elevated border border-border">
            <div class="font-condensed font-bold text-xl text-text-primary">
              {{ cabinet.overview.woodpecker.on_cooldown }}
            </div>
            <div class="text-[10px] text-text-secondary uppercase">24h</div>
          </div>

          <div class="p-2 rounded-sm bg-elevated border border-border">
            <div class="font-condensed font-bold text-xl text-success">
              {{ cabinet.overview.woodpecker.mastered_total }}
            </div>
            <div class="text-[10px] text-text-secondary uppercase">
              {{ t('features.trainingCenter.woodpecker.masteredShort') }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Discipline Selector Cards -->
    <div
      class="grid grid-cols-2 gap-3"
      :class="visibleDisciplines.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'"
    >
      <button
        v-for="disc in visibleDisciplines"
        :key="disc"
        type="button"
        class="p-4 rounded-md border text-left transition-all cursor-pointer flex flex-col gap-2"
        :class="
          selectedDiscipline === disc
            ? 'bg-elevated border-border-hover shadow-sm'
            : 'bg-surface border-border hover:border-border-hover hover:bg-elevated/50'
        "
        @click="emit('selectDiscipline', disc)"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="font-display font-bold text-sm uppercase tracking-wider truncate"
            :class="selectedDiscipline === disc ? 'text-text-primary' : 'text-text-secondary'"
          >
            {{ resolveDisciplineLabel(disc, t) }}
          </span>
          <span
            v-if="cabinet.overview.disciplines[disc]"
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-surface border border-border text-text-secondary shrink-0"
          >
            {{ resolveDifficultyLabel(cabinet.overview.disciplines[disc].unlocked_tier, t) }}
          </span>
        </div>

        <div
          v-if="cabinet.overview.disciplines[disc]"
          class="flex items-baseline justify-between font-condensed"
        >
          <span class="text-2xl font-bold text-text-primary">
            {{ Math.round(cabinet.overview.disciplines[disc].global_rating) }}
            <span class="text-xs font-normal text-text-secondary">
              ±{{ Math.round(cabinet.overview.disciplines[disc].global_rd) }}
            </span>
          </span>
          <span class="text-xs text-text-secondary">
            EMA {{ Math.round(cabinet.overview.disciplines[disc].ema_accuracy * 100) }}%
          </span>
        </div>

        <div
          v-if="cabinet.overview.disciplines[disc]"
          class="flex items-center justify-between text-[11px] font-condensed text-text-secondary"
        >
          <span>
            {{ cabinet.overview.disciplines[disc].solved_total }}✓ /
            {{ cabinet.overview.disciplines[disc].failed_total }}✕
          </span>
          <span
            v-if="cabinet.overview.disciplines[disc].active_course"
            class="text-brand"
          >
            {{ cabinet.overview.disciplines[disc].active_course?.solved_puzzles }}/{{
              cabinet.overview.disciplines[disc].active_course?.target_puzzles
            }}
            ·
            {{
              formatRemainingDuration(
                cabinet.overview.disciplines[disc].active_course?.remaining_seconds ?? 0,
                t,
              )
            }}
          </span>
        </div>
      </button>
    </div>

    <!-- 12-Month Weekly Pulse Chart -->
    <div class="p-5 rounded-lg bg-surface border border-border flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <NIcon size="18" class="text-brand"><TrendingUpOutline /></NIcon>
          <h2 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
            {{
              t('pages.userCabinet.macro.timelineTitle', {
                discipline: resolveDisciplineLabel(selectedDiscipline, t),
              })
            }}
          </h2>
        </div>
        <span class="text-xs text-text-secondary font-condensed">
          {{ t('pages.userCabinet.macro.rolling52Weeks') }}
        </span>
      </div>

      <div v-if="disciplineTimeline.length > 0" class="w-full h-48">
        <VChart :option="chartOption" autoresize class="w-full h-full" />
      </div>
      <div
        v-else
        class="h-28 rounded-md bg-elevated/40 border border-border flex items-center justify-center text-xs text-text-secondary"
      >
        {{ t('pages.userCabinet.macro.noTimelineYet') }}
      </div>
    </div>
  </section>
</template>

