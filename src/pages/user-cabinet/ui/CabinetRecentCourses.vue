<script setup lang="ts">
import {
  formatElapsedDuration,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  type CourseDTO,
} from '@/entities/training'
import {
  CalendarOutline,
  CheckmarkCircleOutline,
  RibbonOutline,
  ShareSocialOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{
  courses: CourseDTO[]
}>()

const emit = defineEmits<{
  openDiploma: [course: CourseDTO]
}>()

const { t, locale } = useI18n()
const copiedCourseId = ref<string | null>(null)

function getCourseAccuracyPercent(course: CourseDTO): number {
  const total = course.solved_puzzles + course.failed_puzzles
  if (total <= 0) return 100
  return Math.round((course.solved_puzzles / total) * 100)
}

function getCourseElapsedSec(course: CourseDTO): number {
  const startMs = new Date(course.started_at).getTime()
  const endMs = course.completed_at ? new Date(course.completed_at).getTime() : Date.now()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs <= startMs) return 0
  return Math.round((endMs - startMs) / 1000)
}

function formatShortDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(d)
}

function formatRatingDelta(delta?: number): string {
  if (delta === undefined) return ''
  const rounded = Math.round(delta * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

async function handleCopyDiplomaLink(courseId: string): Promise<void> {
  if (typeof window === 'undefined') return
  const url = `${window.location.origin}/kursdiplom/${courseId}`
  try {
    await navigator.clipboard.writeText(url)
    copiedCourseId.value = courseId
    setTimeout(() => {
      if (copiedCourseId.value === courseId) {
        copiedCourseId.value = null
      }
    }, 2000)
  } catch {
    // Ignore clipboard permission errors
  }
}
</script>

<template>
  <section v-if="courses.length > 0" class="flex flex-col gap-3">
    <div class="flex items-center gap-2 px-0.5">
      <NIcon :component="CalendarOutline" class="text-lg text-accent shrink-0" />
      <h2 class="font-display text-base font-bold tracking-wider text-text-primary uppercase">
        {{ t('pages.userCabinet.macro.recentCoursesTitle') }}
      </h2>
    </div>

    <div class="grid grid-cols-1 gap-3 @2xl:grid-cols-2 @5xl:grid-cols-3">
      <div
        v-for="course in courses"
        :key="course.id"
        class="flex flex-col justify-between rounded-xl border bg-surface p-3.5 sm:p-4 transition-all"
        :class="
          course.status === 'completed'
            ? 'border-border hover:border-border-hover cursor-pointer'
            : 'border-border'
        "
        @click="emit('openDiploma', course)"
      >
        <div>
          <div class="flex items-start justify-between gap-2">
            <div>
              <div class="text-xs font-bold tracking-wider text-text-secondary uppercase">
                {{ resolveDisciplineLabel(course.discipline, t) }}
              </div>
              <div class="mt-0.5 text-sm font-bold text-text-primary">
                {{ resolveDifficultyLabel(course.difficulty, t) }} · {{ course.duration_days }}d
              </div>
            </div>

            <span
              class="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-condensed text-[11px] font-bold uppercase shrink-0"
              :class="
                course.status === 'completed'
                  ? 'border-success/40 bg-success/10 text-success'
                  : course.status === 'active'
                    ? 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-warning/40 bg-warning/10 text-warning'
              "
            >
              <NIcon
                :component="course.status === 'completed' ? CheckmarkCircleOutline : TimeOutline"
              />
              {{ t(`features.trainingCenter.course.status.${course.status}`) }}
            </span>
          </div>

          <div
            class="mt-3 flex items-center justify-between font-condensed text-xs text-text-secondary"
          >
            <span>
              {{ course.solved_puzzles }} / {{ course.target_puzzles }}
              {{ t('features.trainingCenter.course.puzzlesSolved') }}
            </span>
            <span class="font-bold text-text-primary">
              {{
                Math.min(
                  100,
                  Math.round(
                    (course.solved_puzzles / Math.max(1, course.target_puzzles)) * 100,
                  ),
                )
              }}%
            </span>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-sm bg-elevated">
            <div
              class="h-full transition-all"
              :class="course.status === 'completed' ? 'bg-success' : 'bg-brand'"
              :style="{
                width: `${Math.min(100, Math.round((course.solved_puzzles / Math.max(1, course.target_puzzles)) * 100))}%`,
              }"
            />
          </div>

          <div
            class="mt-3 flex flex-wrap items-center justify-between gap-2 font-condensed text-xs"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-text-primary font-bold">
                {{
                  t('features.trainingCenter.diploma.cardAccuracy', {
                    pct: getCourseAccuracyPercent(course),
                  })
                }}
              </span>
              <span class="text-text-secondary">
                {{
                  t('features.trainingCenter.diploma.cardMistakes', {
                    count: course.failed_puzzles,
                  })
                }}
              </span>
            </div>

            <span
              v-if="
                course.summary?.has_detailed_telemetry &&
                course.summary.rating_delta !== undefined
              "
              class="font-bold"
              :class="course.summary.rating_delta >= 0 ? 'text-success' : 'text-danger'"
            >
              Glicko {{ formatRatingDelta(course.summary.rating_delta) }}
            </span>
          </div>

          <div
            class="mt-2 flex items-center justify-between font-condensed text-[11px] text-text-secondary"
          >
            <span v-if="course.status === 'completed' && course.completed_at">
              {{
                t('features.trainingCenter.diploma.cardCompletedAt', {
                  date: formatShortDate(course.completed_at),
                })
              }}
            </span>
            <span v-else>
              {{
                t('features.trainingCenter.diploma.cardStartedAt', {
                  date: formatShortDate(course.started_at),
                })
              }}
            </span>

            <span v-if="course.status === 'completed'" class="text-success">
              {{
                t('features.trainingCenter.diploma.cardCompletedIn', {
                  duration: formatElapsedDuration(getCourseElapsedSec(course), t),
                })
              }}
            </span>
          </div>
        </div>

        <div
          v-if="course.status === 'completed'"
          class="mt-3.5 flex items-center justify-between gap-2 border-t border-border pt-2.5"
        >
          <span
            class="inline-flex items-center gap-1.5 font-condensed text-xs font-bold text-brand uppercase"
          >
            <NIcon :component="RibbonOutline" />
            {{ t('features.trainingCenter.diploma.openDiplomaBtn') }} ↗
          </span>

          <NButton size="tiny" secondary @click.stop="handleCopyDiplomaLink(course.id)">
            <template #icon>
              <NIcon
                :component="
                  copiedCourseId === course.id ? CheckmarkCircleOutline : ShareSocialOutline
                "
              />
            </template>
            {{
              copiedCourseId === course.id
                ? t('shared.board.copied')
                : t('shared.buttons.copyLink')
            }}
          </NButton>
        </div>
      </div>
    </div>
  </section>
</template>
