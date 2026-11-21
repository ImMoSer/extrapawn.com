<script setup lang="ts">
import {
  formatRemainingDuration,
  isEndgameCourseSlug,
  type CourseBatchStatusDTO,
  type TacticsCourseSlug,
  type WoodpeckerCheckpointDTO,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  FlameOutline,
  PlayOutline,
  RefreshOutline,
  TimeOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NAlert, NButton, NIcon, NPopconfirm } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CLASSICAL_COURSE_TITLES,
  CLASSICAL_WEEK_TITLES_BY_COURSE,
  type ClassicalCourseWeekGroup,
} from '../model/classicalCourseMeta'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import ClassicalCourseCrashTestPanel from './ClassicalCourseCrashTestPanel.vue'
import ClassicalCourseWeekGrid from './ClassicalCourseWeekGrid.vue'

const props = withDefaults(
  defineProps<{
    courseSlug?: TacticsCourseSlug
  }>(),
  {
    courseSlug: 'tactics_classical_1',
  },
)

const { t } = useI18n()
const authStore = useAuthStore()
const store = useTrainingSessionStore()

const isEndgameCourse = computed(() => isEndgameCourseSlug(props.courseSlug))
const ttlResetDismissed = ref(false)

const activeCourseTitle = computed(
  () => CLASSICAL_COURSE_TITLES[props.courseSlug] ?? 'КЛАССИЧЕСКИЙ КУРС',
)

const curriculum = computed(() => store.tacticsCourseCurriculum)
const crashTestTotal = computed(
  () => curriculum.value?.crash_test_total || (isEndgameCourse.value ? 3334 : 2252),
)

const totalProgressPercent = computed(() => {
  const c = curriculum.value
  if (!c || c.total_puzzles <= 0) return 0
  return Math.min(100, Math.round((c.solved_total / c.total_puzzles) * 1000) / 10)
})

const currentBatchMeta = computed<CourseBatchStatusDTO | null>(() => {
  const c = curriculum.value
  if (!c) return null
  return c.batches.find((b) => b.batch_id === c.current_batch_id) ?? null
})

const currentWoodpeckerMeta = computed<WoodpeckerCheckpointDTO | null>(() => {
  const c = curriculum.value
  if (!c) return null
  return c.woodpecker_days.find((w) => w.checkpoint_id === c.current_woodpecker_id) ?? null
})

const isCurrentStepFailedRetry = computed<boolean>(() => {
  const c = curriculum.value
  if (!c) return false
  if (c.current_step_type === 'batch') return Boolean(currentBatchMeta.value?.is_failed_attempt)
  if (c.current_step_type === 'woodpecker') {
    return Boolean(currentWoodpeckerMeta.value?.is_failed_attempt)
  }
  return false
})

const hasCourseProgressToReset = computed<boolean>(() => {
  const c = curriculum.value
  if (!c) return false
  return (
    c.solved_total > 0 ||
    c.failed_total > 0 ||
    Boolean(c.course_started_at) ||
    Boolean(c.active_course)
  )
})

const ttlRemainingSeconds = computed<number>(() => {
  const c = curriculum.value
  if (!c || c.current_step_type === 'completed' || !c.ttl_remaining_seconds) return 0
  return c.ttl_remaining_seconds
})

const isTtlUrgent = computed<boolean>(
  () => ttlRemainingSeconds.value > 0 && ttlRemainingSeconds.value <= 48 * 3600,
)

const showTtlResetAlert = computed<boolean>(
  () => Boolean(curriculum.value?.was_reset_by_ttl) && !ttlResetDismissed.value,
)

const weeksList = computed<ClassicalCourseWeekGroup[]>(() => {
  const c = curriculum.value
  if (!c) return []

  const cpByAfterBatch: Record<number, WoodpeckerCheckpointDTO> = {}
  for (const wp of c.woodpecker_days) {
    cpByAfterBatch[wp.after_batch_id] = wp
  }

  const activeSlug = (c.course_slug as TacticsCourseSlug) || props.courseSlug
  const weekTitles =
    CLASSICAL_WEEK_TITLES_BY_COURSE[activeSlug] ??
    CLASSICAL_WEEK_TITLES_BY_COURSE.tactics_classical_1

  const maxWeek = c.batches.reduce((acc, b) => Math.max(acc, b.week), 4)
  const groups: ClassicalCourseWeekGroup[] = []
  for (let w = 1; w <= maxWeek; w++) {
    const wBatches = c.batches.filter((b) => b.week === w)
    if (wBatches.length > 0) {
      groups.push({
        week: w,
        title: weekTitles[w] ?? `Неделя ${w}`,
        batches: wBatches,
        checkpoints: cpByAfterBatch,
      })
    }
  }
  return groups
})

watch(
  () => props.courseSlug,
  async (newSlug) => {
    ttlResetDismissed.value = false
    if (newSlug) {
      try {
        await store.fetchTacticsCourseCurriculum(newSlug)
      } catch {
        // Handled by store
      }
    }
  },
)

onMounted(async () => {
  try {
    await store.fetchTacticsCourseCurriculum(props.courseSlug)
  } catch {
    // Handled by store
  }
})

async function handleLaunchCurrentStep(): Promise<void> {
  const c = curriculum.value
  if (!c || c.current_step_type === 'completed') return
  await store.startClassicalCourseNextStep(props.courseSlug)
}

async function handleLaunchBatch(batch: CourseBatchStatusDTO): Promise<void> {
  if (!batch.is_unlocked) return
  const forceNew = batch.is_completed || Boolean(batch.is_failed_attempt)
  await store.startClassicalCourseBatch(batch.batch_id, forceNew, props.courseSlug)
}

async function handleLaunchWoodpecker(wp: WoodpeckerCheckpointDTO): Promise<void> {
  if (!wp.is_unlocked || wp.due_count <= 0) return
  await store.startClassicalCourseWoodpecker(wp.checkpoint_id, props.courseSlug)
}

async function handleStartOrResumeCrashTest(): Promise<void> {
  if (!authStore.isDeveloper) return
  await store.startCrashTestSession(false, undefined, props.courseSlug)
}

async function handleJumpCrashTest(zeroBased: number): Promise<void> {
  if (!authStore.isDeveloper) return
  await store.startCrashTestSession(false, zeroBased, props.courseSlug)
}

async function handleRestartCrashTest(): Promise<void> {
  if (!authStore.isDeveloper) return
  await store.startCrashTestSession(true, 0, props.courseSlug)
}

async function handleResetCourseProgress(): Promise<void> {
  await store.resetTacticsCourse(props.courseSlug)
}
</script>

<template>
  <div class="flex flex-col gap-4 sm:gap-5">
    <NAlert
      v-if="showTtlResetAlert"
      type="warning"
      closable
      @close="ttlResetDismissed = true"
    >
      {{ t('features.trainingCenter.classical.ttlResetBanner') }}
    </NAlert>

    <!-- Top Hero Card: Overall Course Progress + 7-Day TTL + Current Step CTA -->
    <div class="p-3.5 sm:p-5 rounded-lg bg-surface border border-border flex flex-col gap-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40"
            >
              {{ activeCourseTitle }}
            </span>
            <span
              class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-elevated border border-border text-text-secondary"
            >
              {{ weeksList.length || 4 }} недели · {{ curriculum?.batches?.length ?? 16 }} батчей ·
              {{ curriculum?.woodpecker_days?.length ?? 8 }} Дней Дятла
            </span>
            <span
              v-if="curriculum && curriculum.total_puzzles > 0"
              class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-elevated border border-border text-text-secondary"
            >
              {{ curriculum.total_puzzles }} позиций
            </span>
            <span
              v-if="ttlRemainingSeconds > 0"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold border"
              :class="
                isTtlUrgent
                  ? 'bg-danger/10 text-danger border-danger/40'
                  : 'bg-warning/10 text-warning border-warning/40'
              "
              :title="t('features.trainingCenter.classical.ttlTooltip')"
            >
              <NIcon size="13"><TimeOutline /></NIcon>
              {{
                t('features.trainingCenter.classical.ttlBadge', {
                  remaining: formatRemainingDuration(ttlRemainingSeconds, t),
                })
              }}
            </span>
          </div>

          <h2 class="font-display font-bold text-lg text-text-primary mt-1">
            <template v-if="curriculum?.current_step_type === 'woodpecker'">
              День Дятла #{{ curriculum.current_woodpecker_id }} — Очистка ошибок перед следующим
              блоком
            </template>
            <template v-else-if="curriculum?.current_step_type === 'completed'">
              Поздравляем! Все {{ curriculum?.batches?.length ?? 16 }} батчей и
              {{ curriculum?.woodpecker_days?.length ?? 8 }} Дней Дятла успешно пройдены!
            </template>
            <template v-else-if="currentBatchMeta">
              Текущий этап: Батч #{{ currentBatchMeta.batch_id }} —
              {{ currentBatchMeta.batch_title }}
            </template>
            <template v-else>
              Классическая программа от простого к сложному
            </template>
          </h2>

          <p class="text-xs text-text-secondary">
            {{ t('features.trainingCenter.classical.rulesSummary') }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <NPopconfirm
            v-if="hasCourseProgressToReset"
            :positive-text="t('features.trainingCenter.classical.resetBtn')"
            :negative-text="t('shared.buttons.cancel')"
            @positive-click="handleResetCourseProgress"
          >
            <template #trigger>
              <NButton
                secondary
                type="error"
                size="medium"
                class="min-w-0"
                :loading="store.isLoadingCurriculum"
              >
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
                <span class="truncate">{{ t('features.trainingCenter.classical.resetBtn') }}</span>
              </NButton>
            </template>
            {{ t('features.trainingCenter.classical.resetConfirm') }}
          </NPopconfirm>

          <NButton
            v-if="curriculum && curriculum.current_step_type !== 'completed'"
            :type="isCurrentStepFailedRetry ? 'error' : 'primary'"
            size="large"
            class="min-w-0"
            :loading="store.isStartingSession"
            @click="handleLaunchCurrentStep"
          >
            <template #icon>
              <NIcon>
                <RefreshOutline v-if="isCurrentStepFailedRetry" />
                <FlameOutline v-else-if="curriculum.current_step_type === 'woodpecker'" />
                <PlayOutline v-else />
              </NIcon>
            </template>
            <span class="truncate">
              <template v-if="curriculum.current_step_type === 'woodpecker'">
                {{
                  isCurrentStepFailedRetry
                    ? t('features.trainingCenter.classical.retryWoodpeckerShort', {
                        id: curriculum.current_woodpecker_id,
                      })
                    : t('features.trainingCenter.classical.startWoodpeckerShort', {
                        id: curriculum.current_woodpecker_id,
                      })
                }}
              </template>
              <template v-else>
                {{
                  isCurrentStepFailedRetry
                    ? t('features.trainingCenter.classical.retryBatchShort', {
                        id: curriculum.current_batch_id,
                      })
                    : t('features.trainingCenter.classical.startBatchShort', {
                        id: curriculum.current_batch_id,
                      })
                }}
              </template>
            </span>
          </NButton>
        </div>
      </div>

      <div v-if="curriculum" class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between gap-2 text-xs">
          <span class="text-text-secondary uppercase font-display font-semibold">
            {{
              t('features.trainingCenter.classical.overallProgress', {
                count: curriculum.batches.length,
              })
            }}
          </span>
          <span class="font-condensed font-bold text-base text-text-primary shrink-0">
            {{ curriculum.solved_total }} / {{ curriculum.total_puzzles }} ({{
              totalProgressPercent
            }}%)
          </span>
        </div>
        <div class="w-full h-2 rounded-xs bg-elevated overflow-hidden border border-border">
          <div
            class="h-full bg-brand transition-all duration-300"
            :style="{ width: `${totalProgressPercent}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Crash-Test & Flagged Queue Panel (Restricted to developer / owner roles) -->
    <ClassicalCourseCrashTestPanel
      v-if="authStore.isDeveloper"
      :course-slug="courseSlug"
      :is-endgame-course="isEndgameCourse"
      :curriculum="curriculum"
      :crash-test-total="crashTestTotal"
      :is-starting-session="store.isStartingSession"
      @start-or-resume="handleStartOrResumeCrashTest"
      @jump="handleJumpCrashTest"
      @restart="handleRestartCrashTest"
    />

    <!-- Pairwise Batches + Woodpecker Checkpoints Grid -->
    <ClassicalCourseWeekGrid
      :weeks-list="weeksList"
      :is-starting-session="store.isStartingSession"
      @launch-batch="handleLaunchBatch"
      @launch-woodpecker="handleLaunchWoodpecker"
    />
  </div>
</template>
