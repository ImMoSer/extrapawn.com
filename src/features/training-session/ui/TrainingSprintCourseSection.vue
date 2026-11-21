<script setup lang="ts">
import {
  formatRemainingDuration,
  resolveDifficultyLabel,
  resolveScopeLabel,
  TRAINING_DIFFICULTIES,
  type CourseDurationDays,
  type DisciplineOverviewDTO,
  type TrainingDifficulty,
  type TrainingDiscipline,
} from '@/entities/training'
import {
  CheckmarkCircleOutline,
  LockClosedOutline,
  PlayOutline,
  TimeOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  activeDiscipline: TrainingDiscipline
  discOverview: DisciplineOverviewDTO | null
  isStartingSession: boolean
}>()

const emit = defineEmits<{
  startCourse: []
  launchBatch: []
  abortCourse: [courseId: string]
  openLaggingScope: [group: string, key: string]
}>()

const selectedTier = defineModel<TrainingDifficulty>('selectedTier', { required: true })
const selectedDuration = defineModel<CourseDurationDays>('selectedDuration', { required: true })
const selectedBatchSize = defineModel<number>('selectedBatchSize', { required: true })

const { t, te } = useI18n()

const TIER_RANK_ORDER: Readonly<Record<TrainingDifficulty, number>> = {
  Novice: 0,
  Pro: 1,
  Master: 2,
}

const unlockedTierOrder = computed(() => {
  const tier = props.discOverview?.unlocked_tier ?? 'Novice'
  return TIER_RANK_ORDER[tier]
})

function isCourseTierUnlocked(tier: TrainingDifficulty): boolean {
  return TIER_RANK_ORDER[tier] <= unlockedTierOrder.value
}

function getCourseTargetQuota(discipline: TrainingDiscipline, days: CourseDurationDays): number {
  if (discipline === 'tactics') {
    return days === 7 ? 700 : 3000
  }
  return days === 7 ? 150 : 600
}

const courseBatchSizes = computed<number[]>(() => {
  if (props.discOverview?.course_batch_sizes?.length) {
    return props.discOverview.course_batch_sizes
  }
  return props.activeDiscipline === 'tactics' ? [25, 50, 100] : [10, 20, 30]
})

const activeCourse = computed(() => props.discOverview?.active_course ?? null)
const nextTierGate = computed(() => props.discOverview?.next_tier_gate ?? null)

const activeCoursePercent = computed(() => {
  if (!activeCourse.value || activeCourse.value.target_puzzles <= 0) return 0
  return Math.min(
    100,
    Math.round((activeCourse.value.solved_puzzles / activeCourse.value.target_puzzles) * 100),
  )
})

const gateCurrentRating = computed(() => {
  if (!nextTierGate.value) return 1000
  return nextTierGate.value.current_rating ?? props.discOverview?.global_rating ?? 1000
})

const gateRatingQualified = computed(() => {
  if (!nextTierGate.value) return false
  if (typeof nextTierGate.value.rating_qualified === 'boolean') {
    return nextTierGate.value.rating_qualified
  }
  return gateCurrentRating.value >= nextTierGate.value.rating_threshold
})

const gateScopesPercent = computed(() => {
  if (!nextTierGate.value) return 0
  if (gateRatingQualified.value) return 100
  const threshold = nextTierGate.value.rating_threshold
  const baseRating = Math.max(600, threshold - 500)
  const span = Math.max(100, threshold - baseRating)
  return Math.min(
    100,
    Math.max(0, Math.round(((gateCurrentRating.value - baseRating) / span) * 100)),
  )
})
</script>

<template>
  <div class="p-3.5 @3xl:p-6 flex flex-col gap-4 @3xl:gap-6">
    <!-- Active Course HUD -->
    <template v-if="activeCourse">
      <div class="p-3.5 @3xl:p-5 rounded-lg bg-elevated/50 border border-border flex flex-col gap-3.5 @3xl:gap-4">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-surface text-text-primary border border-border">
              {{ resolveDifficultyLabel(activeCourse.difficulty, t) }}
            </span>
            <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-surface border border-border text-warning flex items-center gap-1">
              <NIcon size="13"><TimeOutline /></NIcon>
              {{ formatRemainingDuration(activeCourse.remaining_seconds, t) }}
            </span>
          </div>

          <NButton
            size="tiny"
            quaternary
            type="error"
            @click="emit('abortCourse', activeCourse.id)"
          >
            {{ t('features.trainingCenter.course.abortBtn') }}
          </NButton>
        </div>

        <div class="flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between">
            <span class="text-xs text-text-secondary uppercase font-display font-semibold">
              {{
                t('features.trainingCenter.course.activeProgressTitle', {
                  days: activeCourse.duration_days,
                })
              }}
            </span>
            <span class="font-condensed font-bold text-lg text-text-primary">
              {{ activeCourse.solved_puzzles }} / {{ activeCourse.target_puzzles }} ({{
                activeCoursePercent
              }}%)
            </span>
          </div>
          <div class="w-full h-2 rounded-xs bg-surface overflow-hidden border border-border">
            <div
              class="h-full bg-brand transition-all duration-300"
              :style="{ width: `${activeCoursePercent}%` }"
            />
          </div>
        </div>

        <!-- Batch Size Selection & Launch CTA -->
        <div class="pt-2 border-t border-border flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-secondary">
              {{ t('features.trainingCenter.course.batchSizeLabel') }}
            </span>
            <div class="flex items-center gap-1.5">
              <button
                v-for="size in courseBatchSizes"
                :key="size"
                type="button"
                class="px-3 py-1 rounded-sm font-condensed font-bold text-xs border transition-colors cursor-pointer"
                :class="
                  selectedBatchSize === size
                    ? 'bg-elevated text-text-primary border-border-hover'
                    : 'bg-surface text-text-secondary border-border hover:border-border-hover hover:text-text-primary'
                "
                @click="selectedBatchSize = size"
              >
                {{ size }}
              </button>
            </div>
          </div>

          <NButton
            type="primary"
            size="large"
            :loading="props.isStartingSession"
            @click="emit('launchBatch')"
          >
            <template #icon>
              <NIcon><PlayOutline /></NIcon>
            </template>
            {{
              t('features.trainingCenter.course.launchBatchBtn', {
                count: selectedBatchSize,
              })
            }}
          </NButton>
        </div>
      </div>
    </template>

    <!-- New Course Setup Builder -->
    <template v-else>
      <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-6">
        <!-- Left: Rank Tier & Duration Selection -->
        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-2">
            <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
              {{ t('features.trainingCenter.course.selectTierLabel') }}
            </label>
            <div class="grid grid-cols-3 gap-2.5">
              <button
                v-for="tier in TRAINING_DIFFICULTIES"
                :key="tier"
                type="button"
                :disabled="!isCourseTierUnlocked(tier)"
                class="p-3 rounded-md border flex flex-col items-start gap-1 transition-colors"
                :class="[
                  !isCourseTierUnlocked(tier)
                    ? 'bg-surface/40 border-border text-text-disabled cursor-not-allowed opacity-60'
                    : selectedTier === tier
                      ? 'bg-elevated border-border-hover text-text-primary cursor-pointer'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary cursor-pointer',
                ]"
                @click="isCourseTierUnlocked(tier) && (selectedTier = tier)"
              >
                <div class="w-full flex items-center justify-between">
                  <span class="font-display font-semibold text-sm">
                    {{ resolveDifficultyLabel(tier, t) }}
                  </span>
                  <NIcon v-if="!isCourseTierUnlocked(tier)" size="14">
                    <LockClosedOutline />
                  </NIcon>
                </div>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
              {{ t('features.trainingCenter.course.selectDurationLabel') }}
            </label>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="days in [7, 30] as CourseDurationDays[]"
                :key="days"
                type="button"
                class="p-3.5 rounded-md border flex flex-col items-start gap-1 transition-colors cursor-pointer"
                :class="
                  selectedDuration === days
                    ? 'bg-elevated border-border-hover text-text-primary'
                    : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                "
                @click="selectedDuration = days"
              >
                <span class="font-display font-semibold text-sm">
                  {{ t('features.trainingCenter.course.durationDays', { days }) }}
                </span>
                <span class="font-condensed text-xs text-text-secondary">
                  {{
                    t('features.trainingCenter.course.quotaTarget', {
                      count: getCourseTargetQuota(props.activeDiscipline, days),
                    })
                  }}
                </span>
              </button>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div class="flex items-center gap-2">
              <span class="text-xs text-text-secondary">
                {{ t('features.trainingCenter.course.batchSizeLabel') }}
              </span>
              <div class="flex items-center gap-1">
                <button
                  v-for="size in courseBatchSizes"
                  :key="size"
                  type="button"
                  class="px-2.5 py-1 rounded-sm font-condensed font-bold text-xs border cursor-pointer transition-colors"
                  :class="
                    selectedBatchSize === size
                      ? 'bg-elevated text-text-primary border-border-hover'
                      : 'bg-surface text-text-secondary border-border hover:border-border-hover hover:text-text-primary'
                  "
                  @click="selectedBatchSize = size"
                >
                  {{ size }}
                </button>
              </div>
            </div>

            <NButton
              type="primary"
              size="large"
              :loading="props.isStartingSession"
              @click="emit('startCourse')"
            >
              <template #icon>
                <NIcon><PlayOutline /></NIcon>
              </template>
              {{
                t('features.trainingCenter.course.startCourseBtn', {
                  days: selectedDuration,
                  quota: getCourseTargetQuota(props.activeDiscipline, selectedDuration),
                })
              }}
            </NButton>
          </div>
        </div>

        <!-- Right: Next Tier Unlock Gate Checklist -->
        <div class="p-4 rounded-lg bg-elevated/40 border border-border flex flex-col gap-3">
          <template v-if="nextTierGate">
            <div class="flex items-center justify-between">
              <span class="font-display font-semibold text-xs uppercase tracking-wider text-text-primary">
                {{
                  t('features.trainingCenter.gate.title', {
                    tier: resolveDifficultyLabel(nextTierGate.target_tier, t),
                  })
                }}
              </span>
              <span class="font-condensed font-bold text-xs text-text-secondary">
                ≥ {{ Math.round(nextTierGate.rating_threshold) }} Glicko-2
              </span>
            </div>

            <div class="flex flex-col gap-2 text-xs">
              <div class="flex items-center justify-between p-2 rounded-sm bg-surface border border-border">
                <span class="text-text-secondary">
                  {{
                    t('features.trainingCenter.gate.conditionQuota', {
                      days: selectedDuration,
                    })
                  }}
                </span>
                <span
                  class="font-condensed font-bold flex items-center gap-1"
                  :class="nextTierGate.course_completed ? 'text-success' : 'text-warning'"
                >
                  <NIcon v-if="nextTierGate.course_completed" size="14">
                    <CheckmarkCircleOutline />
                  </NIcon>
                  {{
                    nextTierGate.course_completed
                      ? t('features.trainingCenter.gate.done')
                      : t('features.trainingCenter.gate.pending')
                  }}
                </span>
              </div>

              <div class="p-2 rounded-sm bg-surface border border-border flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-text-secondary">
                    {{
                      t('features.trainingCenter.gate.conditionScopes', {
                        rating: Math.round(nextTierGate.rating_threshold),
                      })
                    }}
                  </span>
                  <span
                    class="font-condensed font-bold flex items-center gap-1"
                    :class="gateRatingQualified ? 'text-success' : 'text-text-primary'"
                  >
                    <NIcon v-if="gateRatingQualified" size="14">
                      <CheckmarkCircleOutline />
                    </NIcon>
                    {{ Math.round(gateCurrentRating) }} / {{ Math.round(nextTierGate.rating_threshold) }}
                  </span>
                </div>
                <div class="w-full h-1.5 rounded-xs bg-elevated overflow-hidden">
                  <div
                    class="h-full transition-all duration-300"
                    :class="gateRatingQualified ? 'bg-success' : 'bg-brand'"
                    :style="{ width: `${gateScopesPercent}%` }"
                  />
                </div>
              </div>
            </div>

            <div
              v-if="nextTierGate.lagging_scopes.length > 0"
              class="flex flex-col gap-1.5 mt-1"
            >
              <span class="text-[11px] text-text-secondary uppercase font-display font-semibold">
                {{
                  t('features.trainingCenter.gate.laggingScopesLabel', {
                    count: nextTierGate.lagging_scopes.length,
                  })
                }}
              </span>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="lag in nextTierGate.lagging_scopes.slice(0, 6)"
                  :key="`${lag.group}:${lag.key}`"
                  type="button"
                  class="px-2 py-0.5 rounded-sm text-[11px] font-condensed bg-surface border border-border text-text-secondary hover:border-border-hover hover:text-text-primary transition-colors cursor-pointer"
                  :title="t('pages.userCabinet.diagnostics.warmupAction')"
                  @click="emit('openLaggingScope', lag.group, lag.key)"
                >
                  {{ resolveScopeLabel(lag.group, lag.key, t, te) }}:
                  <strong class="text-warning">{{ Math.round(lag.rating) }}</strong>
                </button>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="h-full flex flex-col items-center justify-center text-center gap-2 py-6">
              <NIcon size="28" class="text-success"><TrophyOutline /></NIcon>
              <div class="font-display font-semibold text-sm text-text-primary">
                {{ t('features.trainingCenter.gate.masterUnlockedTitle') }}
              </div>
              <div class="text-xs text-text-secondary max-w-xs">
                {{ t('features.trainingCenter.gate.masterUnlockedDesc') }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
