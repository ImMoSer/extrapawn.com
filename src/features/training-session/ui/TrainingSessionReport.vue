<script setup lang="ts">
import {
  formatRemainingDuration,
  isClassicalCourseDiscipline,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
} from '@/entities/training'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import {
  AlertCircleOutline,
  ArrowBackOutline,
  FlameOutline,
  PlayOutline,
  RefreshOutline,
  RibbonOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import TrainingSessionReportBreakdown from './TrainingSessionReportBreakdown.vue'

const { t } = useI18n()
const router = useRouter()
const store = useTrainingSessionStore()

const report = computed(() => store.sessionReportSummary)

const activeCourse = computed(() => {
  const disc = report.value?.discipline
  if (!disc || !store.overview) return null
  return store.overview.disciplines[disc]?.active_course ?? null
})

const completedCourseInSession = computed(() => {
  const c = store.lastAttemptResult?.course
  return c?.status === 'completed' ? c : null
})

const courseProgressPercent = computed(() => {
  if (!activeCourse.value || activeCourse.value.target_puzzles <= 0) return 0
  return Math.min(
    100,
    Math.round((activeCourse.value.solved_puzzles / activeCourse.value.target_puzzles) * 100),
  )
})

function formatDelta(val: number): string {
  const rounded = Math.round(val * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

async function handleReturnToHub(): Promise<void> {
  if (report.value) {
    try {
      await store.dismissActiveSession(report.value.sessionId)
      return
    } catch {
      store.pauseToHub()
      return
    }
  }
  store.pauseToHub()
}

const isClassicalCourseReport = computed(() =>
  Boolean(report.value && isClassicalCourseDiscipline(report.value.discipline)),
)

const isClassicalThresholdFailed = computed<boolean>(() => {
  if (!isClassicalCourseReport.value || !report.value || report.value.mode !== 'course') {
    return false
  }
  return report.value.totalCount > 0 && report.value.solvedCount * 2 < report.value.totalCount
})

const isNextClassicalStepWoodpecker = computed(
  () =>
    isClassicalCourseReport.value &&
    store.tacticsCourseCurriculum?.current_step_type === 'woodpecker',
)

const canLaunchNextCourseStep = computed(() => {
  if (!report.value || report.value.mode !== 'course') return false
  if (isClassicalCourseReport.value) {
    const cur = store.tacticsCourseCurriculum
    return cur ? cur.current_step_type !== 'completed' : true
  }
  return Boolean(activeCourse.value && activeCourse.value.status === 'active')
})

const nextCourseStepLabel = computed(() => {
  if (isClassicalCourseReport.value && store.tacticsCourseCurriculum) {
    const cur = store.tacticsCourseCurriculum
    if (isClassicalThresholdFailed.value) {
      return cur.current_step_type === 'woodpecker'
        ? t('features.trainingCenter.classical.retryWoodpeckerShort', {
            id: cur.current_woodpecker_id,
          })
        : t('features.trainingCenter.classical.retryBatchShort', {
            id: cur.current_batch_id,
          })
    }
    if (cur.current_step_type === 'woodpecker') {
      return t('features.trainingCenter.actions.nextWoodpeckerStep', {
        id: cur.current_woodpecker_id,
      })
    }
    if (cur.current_step_type === 'batch') {
      return t('features.trainingCenter.actions.nextClassicalBatch', {
        id: cur.current_batch_id,
      })
    }
  }
  return t('features.trainingCenter.actions.nextCourseBatch')
})

async function handleLaunchNextCourseBatch(): Promise<void> {
  if (!report.value) return
  if (isClassicalCourseDiscipline(report.value.discipline)) {
    await store.startClassicalCourseNextStep()
    return
  }
  await store.startOrResumeCourseBatch(report.value.discipline, undefined, true)
}

function handleGoToCabinet(): void {
  store.pauseToHub()
  void router.push('/user-cabinet')
}
</script>

<template>
  <AppPageShell v-if="report">
    <div class="flex w-full flex-col gap-5 text-text-primary">
      <!-- Classical Course < 50% Failed Threshold Banner (TD-07) -->
      <div
        v-if="isClassicalThresholdFailed"
        class="p-4 rounded-lg bg-danger/10 border border-danger/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <NIcon size="28" class="text-danger shrink-0"><AlertCircleOutline /></NIcon>
          <div>
            <div class="font-display font-bold text-base text-danger">
              {{
                t('features.trainingCenter.classical.reportFailedTitle', {
                  pct: report.accuracyPercent,
                })
              }}
            </div>
            <div class="text-xs text-text-secondary">
              {{ t('features.trainingCenter.classical.reportFailedSubtitle') }}
            </div>
          </div>
        </div>
        <NButton
          type="error"
          size="small"
          class="min-w-0 shrink-0"
          :loading="store.isStartingSession"
          @click="handleLaunchNextCourseBatch"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          <span class="truncate">{{ nextCourseStepLabel }}</span>
        </NButton>
      </div>

      <!-- Course Completed Diploma Celebration Banner -->
      <div
        v-if="completedCourseInSession"
        class="p-4 rounded-lg bg-success/15 border border-success flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <NIcon size="28" class="text-success"><RibbonOutline /></NIcon>
          <div>
            <div class="font-display font-bold text-base text-text-primary">
              {{ t('features.trainingCenter.diploma.bannerCompletedTitle') }}
            </div>
            <div class="text-xs text-text-secondary">
              {{ t('features.trainingCenter.diploma.bannerCompletedSubtitle') }}
            </div>
          </div>
        </div>
        <NButton
          type="primary"
          size="small"
          @click="router.push(`/kursdiplom/${completedCourseInSession.id}`)"
        >
          <template #icon>
            <NIcon><RibbonOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.diploma.openDiplomaBtn') }}
        </NButton>
      </div>

      <!-- Promotion Celebration Banner -->
      <div
        v-if="store.promotionBannerTier"
        class="p-4 rounded-lg bg-accent/15 border border-accent flex items-center justify-between gap-4"
      >
        <div class="flex items-center gap-3">
          <NIcon size="28" class="text-accent"><TrophyOutline /></NIcon>
          <div>
            <div class="font-display font-bold text-base text-text-primary">
              {{
                t('features.trainingCenter.promotion.unlockedTitle', {
                  tier: resolveDifficultyLabel(store.promotionBannerTier, t),
                })
              }}
            </div>
            <div class="text-xs text-text-secondary">
              {{ t('features.trainingCenter.promotion.unlockedSubtitle') }}
            </div>
          </div>
        </div>
        <NButton size="small" secondary @click="store.dismissPromotionBanner()">
          {{ t('shared.buttons.close') }}
        </NButton>
      </div>

      <!-- Header Card -->
      <div
        class="p-5 @3xl:p-6 rounded-lg bg-surface border border-border flex flex-col @4xl:flex-row @4xl:items-center @4xl:justify-between gap-4"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span
              class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40"
            >
              {{
                store.isWoodpeckerBatch
                  ? t('features.trainingCenter.woodpecker.batchBadge')
                  : report.mode === 'course'
                    ? t('features.trainingCenter.modes.courseBadge')
                    : t('features.trainingCenter.modes.warmupBadge')
              }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-elevated text-text-secondary border border-border"
            >
              {{ resolveDifficultyLabel(report.difficulty, t) }}
            </span>
          </div>
          <h1 class="font-display font-bold text-2xl text-text-primary mt-1">
            {{ resolveDisciplineLabel(report.discipline, t) }} —
            {{
              report.mode === 'warmup'
                ? t('features.trainingCenter.report.warmupCompletedHeading')
                : t('features.trainingCenter.report.completedHeading')
            }}
          </h1>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <NButton secondary @click="handleGoToCabinet">
            {{ t('features.trainingCenter.actions.openCabinet') }}
          </NButton>
          <NButton secondary @click="handleReturnToHub">
            <template #icon>
              <NIcon><ArrowBackOutline /></NIcon>
            </template>
            {{ t('features.trainingCenter.actions.backToHub') }}
          </NButton>
          <NButton
            v-if="canLaunchNextCourseStep"
            :type="
              isClassicalThresholdFailed
                ? 'error'
                : isNextClassicalStepWoodpecker
                  ? 'warning'
                  : 'primary'
            "
            :loading="store.isStartingSession"
            @click="handleLaunchNextCourseBatch"
          >
            <template #icon>
              <NIcon>
                <RefreshOutline v-if="isClassicalThresholdFailed" />
                <FlameOutline v-else-if="isNextClassicalStepWoodpecker" />
                <PlayOutline v-else />
              </NIcon>
            </template>
            {{ nextCourseStepLabel }}
          </NButton>
        </div>
      </div>

      <!-- KPI Bento Row -->
      <div class="grid grid-cols-2 @3xl:grid-cols-5 gap-3">
        <div class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1">
          <span class="text-xs text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.solvedTotal') }}
          </span>
          <span class="font-condensed font-bold text-2xl text-text-primary">
            {{ report.solvedCount }} / {{ report.totalCount }}
          </span>
        </div>

        <div class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1">
          <span class="text-xs text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.accuracy') }}
          </span>
          <span
            class="font-condensed font-bold text-2xl"
            :class="isClassicalThresholdFailed ? 'text-danger' : 'text-text-primary'"
          >
            {{ report.accuracyPercent }}%
          </span>
        </div>

        <div class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1">
          <span class="text-xs text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.netDelta') }}
          </span>
          <span
            class="font-condensed font-bold text-2xl"
            :class="report.netGlobalRatingDelta >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ formatDelta(report.netGlobalRatingDelta) }}
          </span>
        </div>

        <div class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1">
          <span class="text-xs text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.avgTime') }}
          </span>
          <span class="font-condensed font-bold text-2xl text-warning">
            {{ store.formatDurationMs(report.avgTimeMs) }}
          </span>
        </div>

        <div
          class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1 col-span-2 @3xl:col-span-1"
        >
          <span class="text-xs text-text-secondary uppercase">
            {{ t('features.trainingCenter.woodpecker.title') }}
          </span>
          <div class="flex items-center gap-3 font-condensed font-bold text-lg">
            <span class="text-accent" :title="t('features.trainingCenter.woodpecker.graduated')">
              3/3: {{ report.woodpeckerGraduatedCount }}
            </span>
            <span class="text-text-secondary">·</span>
            <span class="text-warning" :title="t('features.trainingCenter.woodpecker.queued24h')">
              +24h: {{ report.woodpeckerQueuedCount }}
            </span>
          </div>
        </div>
      </div>

      <!-- Active Course Progress Bar (if in Sprint Course Mode) -->
      <div
        v-if="activeCourse"
        class="p-4 rounded-md bg-surface border border-border flex flex-col gap-2"
      >
        <div class="flex items-center justify-between text-xs">
          <span class="font-display font-bold uppercase tracking-wider text-text-secondary">
            {{
              t('features.trainingCenter.course.activeProgressTitle', {
                days: activeCourse.duration_days,
              })
            }}
          </span>
          <span class="font-condensed font-bold text-sm text-brand">
            {{ activeCourse.solved_puzzles }} / {{ activeCourse.target_puzzles }} ({{
              courseProgressPercent
            }}%) · {{ formatRemainingDuration(activeCourse.remaining_seconds, t) }}
          </span>
        </div>
        <div class="w-full h-2 rounded-sm bg-elevated overflow-hidden border border-border">
          <div
            class="h-full bg-brand transition-all duration-300"
            :style="{ width: `${courseProgressPercent}%` }"
          />
        </div>
      </div>

      <!-- Detailed Session Puzzle Log with 1-Click Board Analysis -->
      <TrainingSessionReportBreakdown
        :items="report.items"
        :format-duration-ms="store.formatDurationMs"
        @practice-replay="(pid) => store.startPracticeReplay(pid)"
        @analyze-puzzle="(pid) => store.enterPuzzleAnalysis(pid, true)"
      />
    </div>
  </AppPageShell>
</template>
