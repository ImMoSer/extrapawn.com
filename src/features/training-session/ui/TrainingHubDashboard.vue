<script setup lang="ts">
import {
  DisciplineStickyBar,
  formatRemainingDuration,
  getVisibleTrainingDisciplines,
  isDisciplineVisibleForUser,
  isValidTrainingDifficulty,
  isValidTrainingDiscipline,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  stepDiscipline,
  type CourseDurationDays,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { useHorizontalSwipe } from '@/shared/lib/touch/useHorizontalSwipe'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  AnalyticsOutline,
  CaretBackSharp,
  CaretForwardSharp,
  FlameOutline,
  FlashOutline,
  PlayOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NAlert, NButton, NIcon } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import TrainingSprintCourseSection from './TrainingSprintCourseSection.vue'
import TrainingWarmupConfigurator from './TrainingWarmupConfigurator.vue'

const props = withDefaults(
  defineProps<{
    mode?: 'course' | 'warmup'
  }>(),
  {
    mode: 'course',
  },
)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const store = useTrainingSessionStore()

const selectedCourseTier = ref<TrainingDifficulty>('Novice')
const selectedCourseDuration = ref<CourseDurationDays>(30)
const selectedBatchSize = ref<number>(50)

const selectedWarmupTier = ref<TrainingDifficulty>('Novice')
const selectedWarmupCount = ref<number>(50)
const selectedFocusGroup = ref<string>('all')
const selectedFocusKey = ref<string>('all')
const selectedObjective = ref<TrainingObjective | ''>('')

const visibleDisciplines = computed(() => getVisibleTrainingDisciplines(authStore.canAccessCourses))
const discOverview = computed(() => store.activeDisciplineOverview)

const activeDisciplineRating = computed<number | null>(() => {
  const ov = discOverview.value
  return ov ? ov.global_rating : null
})

const activeSession = computed(() => {
  const s = discOverview.value?.active_session ?? null
  if (s?.mode === 'crashtest' && !authStore.isDeveloper) return null
  return s
})

function syncDefaultsForDiscipline(disc: TrainingDiscipline): void {
  const ov = store.overview?.disciplines?.[disc]
  const unlocked = ov?.unlocked_tier ?? 'Novice'
  selectedCourseTier.value = unlocked
  selectedWarmupTier.value = unlocked
  selectedBatchSize.value = ov?.default_course_batch ?? (disc === 'tactics' ? 50 : 20)
  selectedWarmupCount.value = ov?.warmup_allowed_sizes?.[0] ?? (disc === 'tactics' ? 50 : 10)
  selectedFocusGroup.value = 'all'
  selectedFocusKey.value = 'all'
  selectedObjective.value = disc === 'theoretical_endgames' ? 'win' : ''
}

function applyRouteQueryOverrides(): void {
  const qDisc = typeof route.query.discipline === 'string' ? route.query.discipline : ''
  if (
    qDisc &&
    isValidTrainingDiscipline(qDisc) &&
    isDisciplineVisibleForUser(qDisc, authStore.canAccessCourses)
  ) {
    store.selectDiscipline(qDisc)
    syncDefaultsForDiscipline(qDisc)
  }

  const qDiff = typeof route.query.difficulty === 'string' ? route.query.difficulty : ''
  if (qDiff && isValidTrainingDifficulty(qDiff)) {
    selectedWarmupTier.value = qDiff
  }

  const qFocusGroup = typeof route.query.focusGroup === 'string' ? route.query.focusGroup : ''
  const qFocusKey = typeof route.query.focusKey === 'string' ? route.query.focusKey : ''
  if (qFocusGroup) {
    if (
      store.activeDiscipline === 'theoretical_endgames' &&
      qFocusGroup === 'objective' &&
      (qFocusKey === 'win' || qFocusKey === 'hold_draw')
    ) {
      selectedFocusGroup.value = 'all'
      selectedFocusKey.value = 'all'
      selectedObjective.value = qFocusKey
    } else if (
      store.activeDiscipline === 'tactics' &&
      (qFocusGroup === 'geometry' ||
        qFocusGroup === 'operator' ||
        qFocusGroup === 'concept' ||
        qFocusGroup === 'trigger')
    ) {
      if (!qFocusKey || qFocusKey === 'all' || qFocusKey === qFocusGroup) {
        selectedFocusGroup.value = 'motif_group'
        selectedFocusKey.value = qFocusGroup
      } else {
        selectedFocusGroup.value = 'motif'
        selectedFocusKey.value = qFocusKey
      }
    } else {
      selectedFocusGroup.value = qFocusGroup
      selectedFocusKey.value = qFocusKey || 'all'
    }
  }

  const qObj = typeof route.query.objective === 'string' ? route.query.objective : ''
  if (qObj === 'win' || qObj === 'hold_draw') {
    selectedObjective.value = qObj
  }
}

watch(
  () => route.query,
  () => {
    applyRouteQueryOverrides()
  },
)

const isMobileSelectorVisible = ref(true)
const mobileSelectorRef = ref<HTMLElement | null>(null)
let selectorObserver: IntersectionObserver | null = null

onMounted(async () => {
  const el = mobileSelectorRef.value
  if (el && typeof IntersectionObserver !== 'undefined') {
    const scrollRoot = el.closest('.app-page-scroll')
    selectorObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        isMobileSelectorVisible.value = entry.isIntersecting
      },
      {
        root: scrollRoot ?? null,
        threshold: 0.05,
      },
    )
    selectorObserver.observe(el)
  }

  try {
    await store.fetchOverview()
  } catch {
    // Error is already captured in store.error and displayed via NAlert
  }
  syncDefaultsForDiscipline(store.activeDiscipline)
  applyRouteQueryOverrides()
})

onUnmounted(() => {
  selectorObserver?.disconnect()
  selectorObserver = null
})

function handleDisciplineSelect(disc: TrainingDiscipline): void {
  store.selectDiscipline(disc)
  syncDefaultsForDiscipline(disc)
  if (Object.keys(route.query).length > 0) {
    void router.replace({ path: route.path, query: { discipline: disc } })
  }
}

function goPrevDiscipline(): void {
  handleDisciplineSelect(stepDiscipline(visibleDisciplines.value, store.activeDiscipline, -1))
}

function goNextDiscipline(): void {
  handleDisciplineSelect(stepDiscipline(visibleDisciplines.value, store.activeDiscipline, 1))
}

const mobileCardSwipe = useHorizontalSwipe({
  onSwipeLeft: goNextDiscipline,
  onSwipeRight: goPrevDiscipline,
})

async function handleStartCourse(): Promise<void> {
  await store.startCourse({
    discipline: store.activeDiscipline,
    difficulty: selectedCourseTier.value,
    duration_days: selectedCourseDuration.value,
  })
  await store.startOrResumeCourseBatch(store.activeDiscipline, selectedBatchSize.value, false)
}

async function handleLaunchCourseBatch(): Promise<void> {
  await store.startOrResumeCourseBatch(store.activeDiscipline, selectedBatchSize.value, false)
}

async function handleAbortCourse(courseId: string): Promise<void> {
  const confirmed = await uiStore.showConfirmation(
    t('features.trainingCenter.course.abortConfirmTitle'),
    t('features.trainingCenter.course.abortConfirmMessage'),
  )
  if (confirmed === 'confirm') {
    await store.abortCourse(courseId)
  }
}

async function handleStartWarmup(): Promise<void> {
  await store.startWarmupSession({
    discipline: store.activeDiscipline,
    difficulty: selectedWarmupTier.value,
    count: selectedWarmupCount.value,
    focus_group: selectedFocusGroup.value,
    focus_key: selectedFocusGroup.value === 'all' ? 'all' : selectedFocusKey.value,
    objective:
      store.activeDiscipline === 'theoretical_endgames' ? selectedObjective.value : '',
    force_replace: true,
  })
}

async function handleResumeActiveSession(): Promise<void> {
  await store.resumeDisciplineSession(store.activeDiscipline)
}

async function handleDismissActiveSession(sessionId: string): Promise<void> {
  await store.dismissActiveSession(sessionId)
}

function handleOpenLaggingScopeInWarmup(group: string, key: string): void {
  void router.push({
    path: '/warmup',
    query: {
      discipline: store.activeDiscipline,
      focusGroup: group,
      focusKey: key,
    },
  })
}
</script>

<template>
  <AppPageShell>
    <div class="relative">
      <DisciplineStickyBar
        :visible="!isMobileSelectorVisible"
        :disciplines="visibleDisciplines"
        :selected-discipline="store.activeDiscipline"
        :rating="activeDisciplineRating"
        @select-discipline="handleDisciplineSelect"
      />

      <div class="flex w-full flex-col gap-2.5 sm:gap-5 text-text-primary select-none">
        <!-- Top Header -->
        <div
          class="flex flex-col @5xl:flex-row @5xl:items-center @5xl:justify-between gap-3 @3xl:gap-4 p-3.5 @3xl:p-5 rounded-lg bg-surface border border-border"
        >
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-2">
              <NIcon
                size="22"
                :class="props.mode === 'warmup' ? 'text-accent' : 'text-brand'"
              >
                <FlameOutline v-if="props.mode === 'warmup'" />
                <FlashOutline v-else />
              </NIcon>
              <h1 class="font-display font-semibold text-xl @3xl:text-2xl text-text-primary tracking-tight">
                {{
                  props.mode === 'warmup'
                    ? t('features.trainingCenter.warmupPage.title')
                    : t('features.trainingCenter.title')
                }}
              </h1>
            </div>
            <p class="text-xs @3xl:text-sm text-text-secondary">
              {{
                props.mode === 'warmup'
                  ? t('features.trainingCenter.warmupPage.subtitle')
                  : t('features.trainingCenter.subtitle')
              }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <NButton
              v-if="props.mode === 'course'"
              size="small"
              secondary
              @click="
                router.push({ path: '/warmup', query: { discipline: store.activeDiscipline } })
              "
            >
              <template #icon>
                <NIcon><FlameOutline /></NIcon>
              </template>
              {{ t('shared.nav.warmup') }}
            </NButton>

            <NButton
              v-else
              size="small"
              secondary
              @click="
                router.push({ path: '/training', query: { discipline: store.activeDiscipline } })
              "
            >
              <template #icon>
                <NIcon><FlashOutline /></NIcon>
              </template>
              {{ t('shared.nav.trainingCenter') }}
            </NButton>

            <NButton size="small" secondary @click="router.push('/user-cabinet')">
              <template #icon>
                <NIcon><AnalyticsOutline /></NIcon>
              </template>
              {{ t('features.trainingCenter.actions.openCabinet') }}
            </NButton>
          </div>
        </div>

        <NAlert v-if="store.error" type="error" closable>
          {{ store.error }}
        </NAlert>

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
                  {{ resolveDisciplineLabel(store.activeDiscipline, t) }}
                </span>
                <span
                  v-if="discOverview"
                  class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-surface border border-border text-text-secondary shrink-0"
                >
                  {{ resolveDifficultyLabel(discOverview.unlocked_tier, t) }}
                </span>
              </div>

              <div v-if="discOverview" class="flex items-baseline justify-between font-condensed">
                <span class="text-2xl font-bold text-text-primary">
                  {{ Math.round(discOverview.global_rating) }}
                  <span class="text-xs font-normal text-text-secondary">
                    ±{{ Math.round(discOverview.global_rd) }}
                  </span>
                </span>
                <span class="text-xs text-text-secondary">
                  EMA {{ Math.round(discOverview.ema_accuracy * 100) }}%
                </span>
              </div>

              <div class="min-h-4 flex items-center">
                <span
                  v-if="discOverview?.active_course"
                  class="inline-flex items-center gap-1.5 text-[11px] font-condensed text-brand"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-brand" />
                  {{ discOverview.active_course.solved_puzzles }} /
                  {{ discOverview.active_course.target_puzzles }} ·
                  {{ formatRemainingDuration(discOverview.active_course.remaining_seconds ?? 0, t) }}
                </span>
                <span
                  v-else-if="discOverview?.active_session"
                  class="inline-flex items-center gap-1.5 text-[11px] font-condensed text-warning"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-warning" />
                  {{ t('features.trainingCenter.session.unfinishedBadge') }}
                </span>
                <span v-else class="text-[11px] text-text-secondary">
                  {{ t('features.trainingCenter.course.noActiveCourseShort') }}
                </span>
              </div>

              <div class="flex items-center justify-center gap-1.5 pt-1">
                <button
                  v-for="disc in visibleDisciplines"
                  :key="disc"
                  type="button"
                  :aria-label="resolveDisciplineLabel(disc, t)"
                  class="h-1.5 rounded-xs transition-all cursor-pointer"
                  :class="
                    disc === store.activeDiscipline
                      ? 'w-5 bg-brand'
                      : 'w-2 bg-border-hover hover:bg-text-secondary'
                  "
                  @click="handleDisciplineSelect(disc)"
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

        <!-- Desktop Discipline Tabs (4 in 1 Row) -->
        <div
          class="hidden @5xl:grid gap-3"
          :class="visibleDisciplines.length >= 5 ? '@5xl:grid-cols-5' : '@5xl:grid-cols-4'"
        >
          <button
            v-for="disc in visibleDisciplines"
            :key="disc"
            type="button"
            class="p-4 rounded-lg border text-left transition-colors cursor-pointer flex flex-col gap-2"
            :class="
              store.activeDiscipline === disc
                ? 'bg-elevated border-brand/60 shadow-xs'
                : 'bg-surface border-border hover:border-border-hover hover:bg-elevated/50'
            "
            @click="handleDisciplineSelect(disc)"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="font-display font-semibold text-sm uppercase tracking-wider truncate"
                :class="
                  store.activeDiscipline === disc ? 'text-text-primary' : 'text-text-secondary'
                "
              >
                {{ resolveDisciplineLabel(disc, t) }}
              </span>
              <span
                v-if="store.overview?.disciplines?.[disc]"
                class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-surface border border-border text-text-secondary shrink-0"
              >
                {{ resolveDifficultyLabel(store.overview.disciplines[disc].unlocked_tier, t) }}
              </span>
            </div>

            <div
              v-if="store.overview?.disciplines?.[disc]"
              class="flex items-baseline justify-between font-condensed"
            >
              <span class="text-xl font-bold text-text-primary">
                {{ Math.round(store.overview.disciplines[disc].global_rating) }}
                <span class="text-xs font-normal text-text-secondary">
                  ±{{ Math.round(store.overview.disciplines[disc].global_rd) }}
                </span>
              </span>
              <span class="text-xs text-text-secondary">
                EMA {{ Math.round(store.overview.disciplines[disc].ema_accuracy * 100) }}%
              </span>
            </div>

            <div class="min-h-5 flex items-center">
              <span
                v-if="store.overview?.disciplines?.[disc]?.active_course"
                class="inline-flex items-center gap-1.5 text-[11px] font-condensed text-brand"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-brand" />
                {{ store.overview.disciplines[disc].active_course?.solved_puzzles }} /
                {{ store.overview.disciplines[disc].active_course?.target_puzzles }} ·
                {{
                  formatRemainingDuration(
                    store.overview.disciplines[disc].active_course?.remaining_seconds ?? 0,
                    t,
                  )
                }}
              </span>
              <span
                v-else-if="store.overview?.disciplines?.[disc]?.active_session"
                class="inline-flex items-center gap-1.5 text-[11px] font-condensed text-warning"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-warning" />
                {{ t('features.trainingCenter.session.unfinishedBadge') }}
              </span>
              <span v-else class="text-[11px] text-text-secondary">
                {{ t('features.trainingCenter.course.noActiveCourseShort') }}
              </span>
            </div>
          </button>
        </div>

        <!-- Unfinished Session Resume Banner -->
        <div
          v-if="activeSession"
          class="p-3.5 @3xl:p-4 rounded-lg bg-surface border border-warning/40 flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-3"
        >
          <div class="flex flex-col gap-0.5">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40">
                {{
                  activeSession.focus_group === 'woodpecker'
                    ? t('features.trainingCenter.woodpecker.batchBadge')
                    : activeSession.mode === 'course'
                      ? t('features.trainingCenter.modes.courseBadge')
                      : t('features.trainingCenter.modes.warmupBadge')
                }}
              </span>
              <span class="font-display font-semibold text-sm text-text-primary">
                {{ t('features.trainingCenter.session.activeTitle') }}
              </span>
            </div>
            <div class="text-xs text-text-secondary font-condensed">
              {{ resolveDifficultyLabel(activeSession.difficulty, t) }} ·
              {{ activeSession.solved_count + activeSession.failed_count }} /
              {{ activeSession.total_count }}
              {{ t('features.trainingCenter.session.completedPuzzles') }}
            </div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <NButton
              size="small"
              quaternary
              type="error"
              @click="handleDismissActiveSession(activeSession.id)"
            >
              <template #icon>
                <NIcon><TrashOutline /></NIcon>
              </template>
              {{ t('features.trainingCenter.actions.dismissSession') }}
            </NButton>
            <NButton
              size="small"
              type="primary"
              :loading="store.isStartingSession"
              @click="handleResumeActiveSession"
            >
              <template #icon>
                <NIcon><PlayOutline /></NIcon>
              </template>
              {{ t('features.trainingCenter.actions.resumeSession') }}
            </NButton>
          </div>
        </div>

        <!-- Main Content Card: Course Mode (/training) OR WarmUp Mode (/warmup) -->
        <div class="rounded-lg bg-surface border border-border overflow-hidden">
          <TrainingSprintCourseSection
            v-if="props.mode === 'course'"
            v-model:selected-tier="selectedCourseTier"
            v-model:selected-duration="selectedCourseDuration"
            v-model:selected-batch-size="selectedBatchSize"
            :active-discipline="store.activeDiscipline"
            :disc-overview="discOverview"
            :is-starting-session="store.isStartingSession"
            @start-course="handleStartCourse"
            @launch-batch="handleLaunchCourseBatch"
            @abort-course="handleAbortCourse"
            @open-lagging-scope="handleOpenLaggingScopeInWarmup"
          />

          <TrainingWarmupConfigurator
            v-else
            v-model:selected-tier="selectedWarmupTier"
            v-model:selected-count="selectedWarmupCount"
            v-model:selected-focus-group="selectedFocusGroup"
            v-model:selected-focus-key="selectedFocusKey"
            v-model:selected-objective="selectedObjective"
            :active-discipline="store.activeDiscipline"
            :disc-overview="discOverview"
            :is-starting-session="store.isStartingSession"
            @start-warmup="handleStartWarmup"
          />
        </div>
      </div>
    </div>
  </AppPageShell>
</template>
