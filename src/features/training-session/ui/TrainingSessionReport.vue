<script setup lang="ts">
import {
  formatRemainingDuration,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  type HydratedSessionItem,
} from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import {
  ArrowBackOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  EyeOutline,
  PlayOutline,
  RibbonOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t, te } = useI18n()
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

function itemCategory(item: HydratedSessionItem): string {
  if (item.tactical) {
    const motif =
      item.tactical.geometry_motifs[0] ??
      item.tactical.operator_motifs[0] ??
      item.tactical.concept_motifs[0] ??
      item.tactical.trigger_motifs[0] ??
      item.tactical.cognitive_profile
    return resolveScopeLabel('scopes', motif, t, te)
  }
  if (item.endgame) {
    return resolveScopeLabel('scopes', item.endgame.class, t, te)
  }
  return item.puzzle_id
}

function itemRating(item: HydratedSessionItem): number {
  if (item.tactical) return item.tactical.rating
  if (item.endgame) return item.endgame.effective_rating
  return 1500
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

async function handleLaunchNextCourseBatch(): Promise<void> {
  if (!report.value) return
  await store.startOrResumeCourseBatch(report.value.discipline, undefined, true)
}

function handleGoToCabinet(): void {
  store.pauseToHub()
  void router.push('/user-cabinet')
}
</script>

<template>
  <div v-if="report" class="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 text-text-primary">
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
    <div class="p-6 rounded-lg bg-surface border border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40">
            {{
              report.mode === 'course'
                ? t('features.trainingCenter.modes.courseBadge')
                : t('features.trainingCenter.modes.warmupBadge')
            }}
          </span>
          <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-elevated text-text-secondary border border-border">
            {{ resolveDifficultyLabel(report.difficulty, t) }} · {{ ENGINE_NAMES[report.botEngine] }}
          </span>
        </div>
        <h1 class="font-display font-bold text-2xl text-text-primary mt-1">
          {{ resolveDisciplineLabel(report.discipline, t) }} —
          {{ t('features.trainingCenter.report.completedHeading') }}
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
          v-if="report.mode === 'course' && activeCourse && activeCourse.status === 'active'"
          type="primary"
          :loading="store.isStartingSession"
          @click="handleLaunchNextCourseBatch"
        >
          <template #icon>
            <NIcon><PlayOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.nextCourseBatch') }}
        </NButton>
      </div>
    </div>

    <!-- KPI Bento Row -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        <span class="font-condensed font-bold text-2xl text-text-primary">
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

      <div class="p-4 rounded-md bg-surface border border-border flex flex-col gap-1 col-span-2 md:col-span-1">
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

    <!-- Active Course Progress Bar (if in Course Mode) -->
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
    <div class="rounded-lg bg-surface border border-border overflow-hidden">
      <div class="px-4 py-3 bg-elevated border-b border-border flex items-center justify-between">
        <h2 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
          {{ t('features.trainingCenter.report.puzzleBreakdownTitle') }}
        </h2>
        <span class="text-xs text-text-secondary">
          {{ t('features.trainingCenter.report.clickToAnalyzeHint') }}
        </span>
      </div>

      <div class="divide-y divide-border">
        <div
          v-for="item in report.items"
          :key="item.puzzle_id"
          class="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-elevated/60 transition-colors"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="font-condensed text-xs text-text-secondary w-6">
              #{{ item.index + 1 }}
            </span>

            <NIcon
              size="18"
              :class="item.status === 'solved' ? 'text-success' : 'text-danger'"
            >
              <CheckmarkCircleOutline v-if="item.status === 'solved'" />
              <CloseCircleOutline v-else />
            </NIcon>

            <span class="font-medium text-sm text-text-primary truncate">
              {{ itemCategory(item) }}
            </span>

            <span
              v-if="item.endgame?.objective === 'hold_draw'"
              class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40"
            >
              {{ t('features.trainingCenter.badges.holdDrawFide') }}
            </span>

            <span
              v-if="item.is_woodpecker"
              class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40"
            >
              WP {{ item.woodpecker_streak }}/3
            </span>
          </div>

          <div class="flex items-center gap-4 shrink-0">
            <span class="font-condensed text-xs text-text-secondary">
              R: {{ itemRating(item) }}
            </span>

            <span
              v-if="item.rating_delta !== undefined"
              class="font-condensed font-bold text-xs min-w-12 text-right"
              :class="item.rating_delta >= 0 ? 'text-success' : 'text-danger'"
            >
              {{ formatDelta(item.rating_delta) }}
            </span>

            <span class="font-condensed text-xs text-warning min-w-14 text-right">
              {{ store.formatDurationMs(item.time_ms) }}
            </span>

            <NButton
              size="tiny"
              secondary
              @click="store.enterPuzzleAnalysis(item.puzzle_id, true)"
            >
              <template #icon>
                <NIcon><EyeOutline /></NIcon>
              </template>
              {{ t('features.trainingCenter.actions.analyze') }}
            </NButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

