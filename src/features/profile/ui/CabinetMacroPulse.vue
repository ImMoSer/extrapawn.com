<script setup lang="ts">
import {
  formatRemainingDuration,
  getVisibleTrainingDisciplines,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  stepDiscipline,
  type CabinetDTO,
  type TrainingDiscipline,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { useHorizontalSwipe } from '@/shared/lib/touch/useHorizontalSwipe'
import { tokens } from '@/shared/theme/tokens'
import {
  CaretBackSharp,
  CaretForwardSharp,
  FlashOutline,
  PersonCircleOutline,
  TrendingUpOutline,
} from '@vicons/ionicons5'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { NButton, NIcon } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
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
  selectorVisibilityChange: [visible: boolean]
}>()

const { t } = useI18n()
const authStore = useAuthStore()
const visibleDisciplines = computed(() => getVisibleTrainingDisciplines(authStore.canAccessCourses))

const activeDisciplineOverview = computed(
  () => props.cabinet.overview.disciplines[props.selectedDiscipline] ?? null,
)

function goPrevDiscipline(): void {
  emit('selectDiscipline', stepDiscipline(visibleDisciplines.value, props.selectedDiscipline, -1))
}

function goNextDiscipline(): void {
  emit('selectDiscipline', stepDiscipline(visibleDisciplines.value, props.selectedDiscipline, 1))
}

const mobileCardSwipe = useHorizontalSwipe({
  onSwipeLeft: goNextDiscipline,
  onSwipeRight: goPrevDiscipline,
})

const mobileSelectorRef = ref<HTMLElement | null>(null)
let selectorObserver: IntersectionObserver | null = null

onMounted(() => {
  const el = mobileSelectorRef.value
  if (!el || typeof IntersectionObserver === 'undefined') return
  const scrollRoot = el.closest('.app-page-scroll')
  selectorObserver = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (!entry) return
      emit('selectorVisibilityChange', entry.isIntersecting)
    },
    {
      root: scrollRoot ?? null,
      threshold: 0.05,
    },
  )
  selectorObserver.observe(el)
})

onUnmounted(() => {
  selectorObserver?.disconnect()
  selectorObserver = null
})

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
  <section class="flex flex-col gap-2.5 @3xl:gap-4">
    <!-- Player Identity Card (Full Width) -->
    <div
      class="p-3.5 @3xl:p-5 rounded-lg bg-surface border border-border flex flex-col @xl:flex-row @xl:items-center @xl:justify-between gap-3 @3xl:gap-4"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 @3xl:w-12 @3xl:h-12 rounded-md bg-elevated border border-border-hover flex items-center justify-center text-text-primary shrink-0"
        >
          <NIcon size="24"><PersonCircleOutline /></NIcon>
        </div>
        <div class="flex flex-col min-w-0">
          <div class="flex items-center gap-2">
            <h1
              class="font-display font-bold text-xl @3xl:text-2xl text-text-primary tracking-wide truncate"
            >
              {{ username }}
            </h1>
            <span
              class="px-1.5 py-0.5 rounded-sm text-[10px] @3xl:text-[11px] font-condensed font-bold uppercase bg-elevated text-text-secondary border border-border shrink-0"
            >
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

    <!-- Mobile / Compact Discipline Swipe Carousel Card (< @5xl) -->
    <div ref="mobileSelectorRef" class="@5xl:hidden select-none">
      <div
        class="rounded-md border border-border-hover bg-elevated overflow-hidden flex items-stretch"
        @touchstart.passive="mobileCardSwipe.onTouchstart"
        @touchend="mobileCardSwipe.onTouchend"
        @touchcancel="mobileCardSwipe.onTouchcancel"
      >
        <button
          type="button"
          class="w-10 shrink-0 flex items-center justify-center border-r border-border bg-surface/60 text-text-secondary hover:text-text-primary active:bg-surface active:text-brand transition-colors cursor-pointer"
          :aria-label="t('pages.userCabinet.macro.prevDiscipline')"
          @click="goPrevDiscipline"
        >
          <NIcon size="18"><CaretBackSharp /></NIcon>
        </button>

        <div class="flex-1 min-w-0 p-3 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2">
            <span
              class="font-display font-bold text-sm uppercase tracking-wider text-text-primary truncate"
            >
              {{ resolveDisciplineLabel(selectedDiscipline, t) }}
            </span>
            <span
              v-if="activeDisciplineOverview"
              class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-surface border border-border text-text-secondary shrink-0"
            >
              {{ resolveDifficultyLabel(activeDisciplineOverview.unlocked_tier, t) }}
            </span>
          </div>

          <div
            v-if="activeDisciplineOverview"
            class="flex items-baseline justify-between font-condensed"
          >
            <span class="text-2xl font-bold text-text-primary">
              {{ Math.round(activeDisciplineOverview.global_rating) }}
              <span class="text-xs font-normal text-text-secondary">
                ±{{ Math.round(activeDisciplineOverview.global_rd) }}
              </span>
            </span>
            <span class="text-xs text-text-secondary">
              EMA {{ Math.round(activeDisciplineOverview.ema_accuracy * 100) }}%
            </span>
          </div>

          <div
            v-if="activeDisciplineOverview"
            class="flex items-center justify-between text-[11px] font-condensed text-text-secondary"
          >
            <span>
              {{ activeDisciplineOverview.solved_total }}✓ /
              {{ activeDisciplineOverview.failed_total }}✕
            </span>
            <span v-if="activeDisciplineOverview.active_course" class="text-brand">
              {{ activeDisciplineOverview.active_course.solved_puzzles }}/{{
                activeDisciplineOverview.active_course.target_puzzles
              }}
              ·
              {{
                formatRemainingDuration(
                  activeDisciplineOverview.active_course.remaining_seconds ?? 0,
                  t,
                )
              }}
            </span>
          </div>

          <!-- Compact Discipline Position Indicator (Tap or Swipe) -->
          <div class="flex items-center justify-center gap-1.5 pt-1">
            <button
              v-for="disc in visibleDisciplines"
              :key="disc"
              type="button"
              :aria-label="resolveDisciplineLabel(disc, t)"
              class="h-1.5 rounded-xs transition-all cursor-pointer"
              :class="
                disc === selectedDiscipline
                  ? 'w-5 bg-brand'
                  : 'w-2 bg-border-hover hover:bg-text-secondary'
              "
              @click="emit('selectDiscipline', disc)"
            />
          </div>
        </div>

        <button
          type="button"
          class="w-10 shrink-0 flex items-center justify-center border-l border-border bg-surface/60 text-text-secondary hover:text-text-primary active:bg-surface active:text-brand transition-colors cursor-pointer"
          :aria-label="t('pages.userCabinet.macro.nextDiscipline')"
          @click="goNextDiscipline"
        >
          <NIcon size="18"><CaretForwardSharp /></NIcon>
        </button>
      </div>
    </div>

    <!-- Desktop Discipline Selector Cards (4 in 1 Row) -->
    <div
      class="hidden @5xl:grid gap-3"
      :class="visibleDisciplines.length >= 5 ? '@5xl:grid-cols-5' : '@5xl:grid-cols-4'"
    >
      <button
        v-for="disc in visibleDisciplines"
        :key="disc"
        type="button"
        class="p-4 rounded-md border text-left transition-all cursor-pointer flex flex-col gap-2"
        :class="
          selectedDiscipline === disc
            ? 'bg-elevated border-brand/60 shadow-sm'
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
          <span v-if="cabinet.overview.disciplines[disc].active_course" class="text-brand">
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
    <div class="p-3.5 @3xl:p-5 rounded-lg bg-surface border border-border flex flex-col gap-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <NIcon size="18" class="text-brand shrink-0"><TrendingUpOutline /></NIcon>
          <h2
            class="font-display font-bold text-sm uppercase tracking-wider text-text-primary truncate"
          >
            {{
              t('pages.userCabinet.macro.timelineTitle', {
                discipline: resolveDisciplineLabel(selectedDiscipline, t),
              })
            }}
          </h2>
        </div>
        <span class="text-xs text-text-secondary font-condensed shrink-0">
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
