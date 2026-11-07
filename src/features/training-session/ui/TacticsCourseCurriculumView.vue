<script setup lang="ts">
import {
  resolveScopeLabel,
  type CourseBatchStatusDTO,
  type TacticsCourseSlug,
  type WoodpeckerCheckpointDTO,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  CheckmarkCircleOutline,
  DownloadOutline,
  FlagOutline,
  FlameOutline,
  LockClosedOutline,
  PlayOutline,
  RefreshOutline,
  RibbonOutline,
  SparklesOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NInputNumber, NPopconfirm } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  downloadCrashTestReport,
  resetCrashTestReport,
  useCrashTestReport,
} from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const props = withDefaults(
  defineProps<{
    courseSlug?: TacticsCourseSlug
  }>(),
  {
    courseSlug: 'tactics_classical_1',
  },
)

const { t, te } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const store = useTrainingSessionStore()
const { report: crashTestReport, anomaliesCount } = useCrashTestReport()

const COURSE_TITLES: Readonly<Record<TacticsCourseSlug, string>> = {
  tactics_classical_1: 'КУРС ТАКТИКИ I · ГЕОМЕТРИЯ И МАТОВЫЕ КОНСТРУКЦИИ',
  tactics_classical_2: 'КУРС ТАКТИКИ II · ЖЕРТВЫ И КОМБИНАЦИОННЫЙ ВЗРЫВ',
  tactics_classical_3: 'КУРС ТАКТИКИ III · СТРАТЕГИЧЕСКАЯ ТАКТИКА И СПАСЕНИЕ',
}

const activeCourseTitle = computed(
  () => COURSE_TITLES[props.courseSlug] ?? 'КЛАССИЧЕСКИЙ КУРС ТАКТИКИ',
)

const jumpIndexInput = ref<number | null>(1)
const showFlagsPanel = ref<boolean>(false)

const curriculum = computed(() => store.tacticsCourseCurriculum)
const crashTestTotal = computed(() => curriculum.value?.crash_test_total || 6147)

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

const activeCourseDiplomaId = computed<string | null>(() => {
  const ac = curriculum.value?.active_course
  if (ac && ac.status === 'completed') return ac.id
  return null
})

const hasCourseProgressToReset = computed<boolean>(() => {
  const c = curriculum.value
  if (!c) return false
  return c.solved_total > 0 || c.failed_total > 0 || Boolean(c.active_course)
})

interface WeekGroup {
  week: number
  title: string
  batches: CourseBatchStatusDTO[]
  checkpoints: Record<number, WoodpeckerCheckpointDTO>
}

const WEEK_TITLES_BY_COURSE: Readonly<Record<TacticsCourseSlug, Readonly<Record<number, string>>>> = {
  tactics_classical_1: {
    1: 'Неделя 1 · Основы матовой геометрии, Матовые сети и выигрыш материала',
    2: 'Неделя 2 · Многоходовый выигрыш, ловля фигур и Двойной удар',
    3: 'Неделя 3 · Геометрия связки, Вскрытое нападение и Двойной шах',
    4: 'Неделя 4 · Линейный удар, Рентген, Практикум и Выпускной экзамен Курса I',
  },
  tactics_classical_2: {
    1: 'Неделя 1 · Жертвы ферзя и ладьи, Завлечение в матовую сеть',
    2: 'Неделя 2 · Комбинационные мотивы: Завлечение, Отвлечение и Перекрытие линий',
    3: 'Неделя 3 · Устранение защиты и Разрушение пешечного прикрытия короля',
    4: 'Неделя 4 · Тотальный штурм королевской резиденции и Выпускной экзамен Курса II',
  },
  tactics_classical_3: {
    1: 'Неделя 1 · Открытие и Освобождение линий и полей для решающего вторжения',
    2: 'Неделя 2 · Критические поля, Тактика проходной пешки и Борьба за темп',
    3: 'Неделя 3 · Цугцванг, Активная блокада, Крепости и Спасение патом',
    4: 'Неделя 4 · Искусство выживания: «Бешеная фигура», Вечный шах и Выпускной экзамен трилогии',
  },
}

const weeksList = computed<WeekGroup[]>(() => {
  const c = curriculum.value
  if (!c) return []

  const cpByAfterBatch: Record<number, WoodpeckerCheckpointDTO> = {}
  for (const wp of c.woodpecker_days) {
    cpByAfterBatch[wp.after_batch_id] = wp
  }

  const activeSlug = (c.course_slug as TacticsCourseSlug) || props.courseSlug
  const weekTitles = WEEK_TITLES_BY_COURSE[activeSlug] ?? WEEK_TITLES_BY_COURSE.tactics_classical_1

  const maxWeek = c.batches.reduce((acc, b) => Math.max(acc, b.week), 4)
  const groups: WeekGroup[] = []
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
    if (newSlug && store.tacticsCourseCurriculum?.course_slug !== newSlug) {
      try {
        await store.fetchTacticsCourseCurriculum(newSlug)
      } catch {
        // Handled by store
      }
    }
  },
)

onMounted(async () => {
  if (
    !store.tacticsCourseCurriculum ||
    store.tacticsCourseCurriculum.course_slug !== props.courseSlug
  ) {
    try {
      await store.fetchTacticsCourseCurriculum(props.courseSlug)
    } catch {
      // Handled by store
    }
  }
  if (store.tacticsCourseCurriculum && store.tacticsCourseCurriculum.crash_test_index > 0) {
    jumpIndexInput.value = store.tacticsCourseCurriculum.crash_test_index + 1
  }
})

async function handleLaunchCurrentStep(): Promise<void> {
  const c = curriculum.value
  if (!c) return
  if (c.current_step_type === 'woodpecker') {
    await store.startTacticsCourseBatch(0, true, props.courseSlug)
    return
  }
  await store.startTacticsCourseBatch(c.current_batch_id, false, props.courseSlug)
}

async function handleLaunchBatch(batch: CourseBatchStatusDTO): Promise<void> {
  if (!batch.is_unlocked) return
  await store.startTacticsCourseBatch(batch.batch_id, true, props.courseSlug)
}

async function handleLaunchWoodpecker(wp: WoodpeckerCheckpointDTO): Promise<void> {
  if (!wp.is_active && wp.due_count <= 0) return
  await store.startTacticsCourseBatch(0, true, props.courseSlug)
}

async function handleStartOrResumeCrashTest(): Promise<void> {
  if (!authStore.isMo3ep) return
  await store.startCrashTestSession(false)
}

async function handleJumpCrashTest(): Promise<void> {
  if (!authStore.isMo3ep) return
  const maxIdx = Math.max(0, crashTestTotal.value - 1)
  const targetOneBased = jumpIndexInput.value ?? 1
  const zeroBased = Math.max(0, Math.min(maxIdx, Math.floor(targetOneBased) - 1))
  await store.startCrashTestSession(false, zeroBased)
}

async function handleRestartCrashTest(): Promise<void> {
  if (!authStore.isMo3ep) return
  await store.startCrashTestSession(true, 0)
}

function handleDownloadCrashTestReport(): void {
  downloadCrashTestReport()
}

function handleClearCrashTestReport(): void {
  resetCrashTestReport(crashTestTotal.value)
}

async function handleResetCourseProgress(): Promise<void> {
  await store.resetTacticsCourse(props.courseSlug)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Top Hero Card: Overall Course Progress + Current Step CTA -->
    <div class="p-5 rounded-lg bg-elevated/50 border border-border flex flex-col gap-4">
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40">
              {{ activeCourseTitle }}
            </span>
            <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-surface border border-border text-text-secondary">
              {{ weeksList.length || 4 }} недели · {{ curriculum?.batches?.length ?? 16 }} батчей · {{ curriculum?.woodpecker_days?.length ?? 8 }} Дней Дятла
            </span>
            <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-surface border border-border text-text-secondary">
              {{ curriculum?.total_puzzles ?? 1300 }} задач · BlunderSpy Engine
            </span>
          </div>

          <h2 class="font-display font-bold text-lg text-text-primary mt-1">
            <template v-if="curriculum?.current_step_type === 'woodpecker'">
              День Дятла #{{ curriculum.current_woodpecker_id }} — Очистка ошибок перед следующим блоком
            </template>
            <template v-else-if="curriculum?.current_step_type === 'completed'">
              Поздравляем! Все {{ curriculum?.batches?.length ?? 16 }} батчей и {{ curriculum?.woodpecker_days?.length ?? 8 }} Дней Дятла успешно пройдены!
            </template>
            <template v-else-if="currentBatchMeta">
              Текущий этап: Батч #{{ currentBatchMeta.batch_id }} — {{ currentBatchMeta.batch_title }}
            </template>
            <template v-else>
              Классическая программа от простого к сложному
            </template>
          </h2>

          <p class="text-xs text-text-secondary">
            Пошаговое прохождение без ожидания по календарю: 2 тематических батча → День Дятла (работа над ошибками) → следующие 2 батча.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5 shrink-0">
          <NPopconfirm
            v-if="hasCourseProgressToReset"
            positive-text="Сбросить прогресс"
            negative-text="Отмена"
            @positive-click="handleResetCourseProgress"
          >
            <template #trigger>
              <NButton
                secondary
                type="error"
                size="medium"
                :loading="store.isLoadingCurriculum"
              >
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
                Сбросить курс
              </NButton>
            </template>
            Сбросить прогресс батчей и очередь Дня Дятла этого курса, чтобы начать с Батча #1?
          </NPopconfirm>

          <NButton
            v-if="activeCourseDiplomaId"
            secondary
            type="success"
            @click="router.push(`/kursdiplom/${activeCourseDiplomaId}`)"
          >
            <template #icon>
              <NIcon><RibbonOutline /></NIcon>
            </template>
            Открыть Диплом курса
          </NButton>

          <NButton
            v-if="curriculum && curriculum.current_step_type !== 'completed'"
            type="primary"
            size="large"
            :loading="store.isStartingSession"
            @click="handleLaunchCurrentStep"
          >
            <template #icon>
              <NIcon>
                <FlameOutline v-if="curriculum.current_step_type === 'woodpecker'" />
                <PlayOutline v-else />
              </NIcon>
            </template>
            <template v-if="curriculum.current_step_type === 'woodpecker'">
              Начать День Дятла #{{ curriculum.current_woodpecker_id }}
            </template>
            <template v-else>
              Начать Батч #{{ curriculum.current_batch_id }}
            </template>
          </NButton>
        </div>
      </div>

      <!-- Overall 3822 Progress Bar -->
      <div v-if="curriculum" class="flex flex-col gap-1.5">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-text-secondary uppercase font-display font-semibold">
            Общий прогресс курса (Диплом по закрытию {{ curriculum?.batches?.length ?? 28 }} батчей)
          </span>
          <span class="font-condensed font-bold text-base text-text-primary">
            {{ curriculum.solved_total }} / {{ curriculum.total_puzzles }} ({{ totalProgressPercent }}%)
          </span>
        </div>
        <div class="w-full h-2 rounded-xs bg-surface overflow-hidden border border-border">
          <div
            class="h-full bg-brand transition-all duration-300"
            :style="{ width: `${totalProgressPercent}%` }"
          />
        </div>
      </div>
    </div>

    <!-- Crash-Test (все 6147 задач трилогии в один батч) & Flagged Queue Panel (Developer MO3EP Only) -->
    <div
      v-if="authStore.isMo3ep"
      class="p-4 rounded-lg bg-surface border border-warning/40 flex flex-col gap-3"
    >
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div class="flex flex-col gap-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40">
              КРЭШ-ТЕСТ ТРИЛОГИИ · {{ crashTestTotal }} ЗАДАЧ В 1 ДАМП
            </span>
            <span
              v-if="curriculum"
              class="font-condensed font-bold text-sm text-text-primary"
            >
              Позиция: #{{ Math.min(crashTestTotal, (curriculum.crash_test_index ?? 0) + 1) }} / {{ crashTestTotal }}
              · Решено: {{ curriculum.crash_test_solved }} · Ошибок: {{ curriculum.crash_test_failed }}
            </span>
            <span
              class="px-2 py-0.5 rounded-sm text-[11px] font-condensed bg-elevated border border-border text-text-secondary"
            >
              Лог в браузере: проверено {{ crashTestReport.processed_count }} · аномалий {{ anomaliesCount }} · cache misses {{ crashTestReport.cache_misses_healed_count }}
            </span>
          </div>
          <p class="text-xs text-text-secondary">
            Сквозной прогон всех {{ crashTestTotal }} задач 3 курсов в одном дампе (BlunderSpy 100/110 → 111 + userLastMove). Все ошибки и cache-промахи сохраняются в браузере (`localStorage`) для выгрузки `craschTestReport.json`.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <div class="flex items-center gap-1.5">
            <span class="text-xs text-text-secondary font-condensed">Задача #:</span>
            <NInputNumber
              v-model:value="jumpIndexInput"
              size="small"
              :min="1"
              :max="crashTestTotal"
              class="w-24"
            />
            <NButton
              size="small"
              secondary
              :loading="store.isStartingSession"
              @click="handleJumpCrashTest"
            >
              Перейти
            </NButton>
          </div>

          <NButton
            v-if="curriculum?.crash_test_active"
            size="small"
            quaternary
            type="warning"
            :loading="store.isStartingSession"
            @click="handleRestartCrashTest"
          >
            <template #icon>
              <NIcon><RefreshOutline /></NIcon>
            </template>
            С начала (#1)
          </NButton>

          <NButton
            size="small"
            type="warning"
            :loading="store.isStartingSession"
            @click="handleStartOrResumeCrashTest"
          >
            <template #icon>
              <NIcon><PlayOutline /></NIcon>
            </template>
            {{
              curriculum?.crash_test_active
                ? `Продолжить Крэш-Тест (#${Math.min(crashTestTotal, curriculum.crash_test_index + 1)})`
                : `Запустить Крэш-Тест (${crashTestTotal})`
            }}
          </NButton>

          <NButton
            size="small"
            secondary
            type="info"
            @click="handleDownloadCrashTestReport"
          >
            <template #icon>
              <NIcon><DownloadOutline /></NIcon>
            </template>
            Скачать craschTestReport.json ({{ anomaliesCount }})
          </NButton>

          <NPopconfirm
            v-if="crashTestReport.processed_count > 0 || anomaliesCount > 0"
            positive-text="Очистить"
            negative-text="Отмена"
            @positive-click="handleClearCrashTestReport"
          >
            <template #trigger>
              <NButton size="small" quaternary type="error">
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
              </NButton>
            </template>
            Очистить локальный отчёт craschTestReport.json в браузере?
          </NPopconfirm>

          <NButton
            v-if="curriculum && curriculum.flagged_puzzles.length > 0"
            size="small"
            secondary
            @click="showFlagsPanel = !showFlagsPanel"
          >
            <template #icon>
              <NIcon><FlagOutline /></NIcon>
            </template>
            Флаги ({{ curriculum.flagged_puzzles.length }})
          </NButton>
        </div>
      </div>

      <!-- Collapsible Flagged Puzzles Table -->
      <div
        v-if="showFlagsPanel && curriculum && curriculum.flagged_puzzles.length > 0"
        class="pt-3 border-t border-border flex flex-col gap-2"
      >
        <div class="text-xs font-display font-semibold uppercase tracking-wider text-text-secondary">
          Отмеченные задачи на проверку ({{ curriculum.flagged_puzzles.length }})
        </div>
        <div class="max-h-48 overflow-y-auto divide-y divide-border/50 rounded-sm border border-border bg-elevated/30">
          <div
            v-for="fl in curriculum.flagged_puzzles"
            :key="fl.puzzle_id"
            class="px-3 py-1.5 flex items-center justify-between gap-3 text-xs"
          >
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-condensed font-bold text-warning">
                {{ fl.puzzle_id }}
              </span>
              <span class="px-1.5 py-0.2 rounded-sm text-[10px] font-condensed bg-surface border border-border text-text-secondary">
                Батч #{{ fl.batch_id }}
              </span>
              <span class="text-text-primary truncate">
                {{ fl.comment }}
              </span>
            </div>
            <span class="font-condensed text-[11px] text-text-secondary shrink-0">
              {{ fl.created_at }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 6-Week / 24-Batch + 12-Woodpecker Curriculum Roadmap -->
    <div v-if="weeksList.length > 0" class="flex flex-col gap-5">
      <div
        v-for="wg in weeksList"
        :key="wg.week"
        class="p-4 rounded-lg bg-elevated/30 border border-border flex flex-col gap-3"
      >
        <div class="flex items-center justify-between border-b border-border pb-2">
          <span class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
            {{ wg.title }}
          </span>
          <span class="text-xs font-condensed text-text-secondary">
            4 батча + 2 Дня Дятла
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <template v-for="batch in wg.batches" :key="batch.batch_id">
            <!-- Batch Card -->
            <div
              class="p-3.5 rounded-md border flex flex-col justify-between gap-2.5 transition-colors"
              :class="[
                batch.is_current
                  ? 'bg-elevated border-brand shadow-xs'
                  : batch.is_completed
                    ? 'bg-surface border-success/40'
                    : batch.is_unlocked
                      ? 'bg-surface border-border hover:border-border-hover'
                      : 'bg-surface/40 border-border opacity-60',
              ]"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex flex-col gap-1 min-w-0">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase border"
                      :class="
                        batch.is_current
                          ? 'bg-brand text-on-brand border-brand'
                          : batch.is_completed
                            ? 'bg-success/15 text-success border-success/40'
                            : 'bg-elevated text-text-secondary border-border'
                      "
                    >
                      Батч #{{ batch.batch_id }}
                    </span>

                    <span
                      v-if="batch.is_exam"
                      class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40"
                    >
                      ЭКЗАМЕН БЕЗ ПОДСКАЗОК
                    </span>
                    <span
                      v-else
                      class="px-2 py-0.5 rounded-sm text-[10px] font-condensed bg-surface border border-border text-text-secondary truncate"
                    >
                      {{ resolveScopeLabel('domain', batch.domain, t, te) }}
                    </span>
                  </div>

                  <div class="font-display font-semibold text-sm text-text-primary">
                    {{ batch.batch_title }}
                  </div>
                </div>

                <NIcon
                  size="18"
                  :class="
                    batch.is_completed
                      ? 'text-success'
                      : batch.is_unlocked
                        ? 'text-brand'
                        : 'text-text-disabled'
                  "
                >
                  <CheckmarkCircleOutline v-if="batch.is_completed" />
                  <SparklesOutline v-else-if="batch.is_current" />
                  <LockClosedOutline v-else-if="!batch.is_unlocked" />
                  <PlayOutline v-else />
                </NIcon>
              </div>

              <div class="flex items-center justify-between gap-2 pt-1 border-t border-border/60">
                <div class="flex items-center gap-2 font-condensed text-xs">
                  <span class="text-text-primary font-bold">
                    {{ batch.solved_count }} / {{ batch.total_puzzles }}
                  </span>
                  <span class="text-text-secondary">решено</span>
                  <span v-if="batch.failed_count > 0" class="text-warning">
                    · ошибок: {{ batch.failed_count }}
                  </span>
                </div>

                <NButton
                  size="tiny"
                  :type="batch.is_current ? 'primary' : 'default'"
                  :secondary="!batch.is_current"
                  :disabled="!batch.is_unlocked"
                  :loading="store.isStartingSession && batch.is_current"
                  @click="handleLaunchBatch(batch)"
                >
                  <template #icon>
                    <NIcon>
                      <PlayOutline v-if="batch.is_unlocked" />
                      <LockClosedOutline v-else />
                    </NIcon>
                  </template>
                  {{
                    batch.is_completed
                      ? 'Повторить'
                      : batch.is_current
                        ? 'Начать'
                        : batch.is_unlocked
                          ? 'Открыть'
                          : 'Закрыто'
                  }}
                </NButton>
              </div>
            </div>

            <!-- Woodpecker Checkpoint Banner after every 2nd batch -->
            <div
              v-if="batch.batch_id % 2 === 0 && wg.checkpoints[batch.batch_id]"
              class="md:col-span-2 px-3.5 py-2.5 rounded-md border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              :class="
                wg.checkpoints[batch.batch_id]?.is_active
                  ? 'bg-warning/10 border-warning/50'
                  : wg.checkpoints[batch.batch_id]?.is_completed
                    ? 'bg-success/5 border-success/30'
                    : 'bg-surface/60 border-border'
              "
            >
              <div class="flex items-center gap-2 text-xs">
                <NIcon
                  size="16"
                  :class="
                    wg.checkpoints[batch.batch_id]?.is_completed
                      ? 'text-success'
                      : wg.checkpoints[batch.batch_id]?.is_active
                        ? 'text-warning'
                        : 'text-text-secondary'
                  "
                >
                  <CheckmarkCircleOutline v-if="wg.checkpoints[batch.batch_id]?.is_completed" />
                  <FlameOutline v-else />
                </NIcon>
                <span class="font-display font-semibold text-text-primary">
                  День Дятла #{{ wg.checkpoints[batch.batch_id]?.checkpoint_id }}
                  (после Батчей #{{ batch.batch_id - 1 }}–#{{ batch.batch_id }})
                </span>
                <span class="font-condensed text-text-secondary">
                  · В очереди ошибок:
                  <strong
                    :class="
                      (wg.checkpoints[batch.batch_id]?.due_count ?? 0) > 0
                        ? 'text-warning'
                        : 'text-success'
                    "
                  >
                    {{ wg.checkpoints[batch.batch_id]?.due_count ?? 0 }}
                  </strong>
                </span>
              </div>

              <NButton
                v-if="
                  wg.checkpoints[batch.batch_id]?.is_active ||
                  (wg.checkpoints[batch.batch_id]?.due_count ?? 0) > 0
                "
                size="tiny"
                type="warning"
                :loading="store.isStartingSession"
                @click="handleLaunchWoodpecker(wg.checkpoints[batch.batch_id]!)"
              >
                <template #icon>
                  <NIcon><FlameOutline /></NIcon>
                </template>
                Очистить ошибки Дятла ({{ wg.checkpoints[batch.batch_id]?.due_count }})
              </NButton>
              <span
                v-else-if="wg.checkpoints[batch.batch_id]?.is_completed"
                class="font-condensed font-bold text-xs text-success"
              >
                ✓ Пройдено без долгов
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

