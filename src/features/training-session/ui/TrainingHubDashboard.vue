<script setup lang="ts">
import {
  formatRemainingDuration,
  getVisibleTrainingDisciplines,
  isDisciplineVisibleForUser,
  isValidTrainingDifficulty,
  isValidTrainingDiscipline,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  type CourseDurationDays,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  AnalyticsOutline,
  FlameOutline,
  FlashOutline,
  PlayOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { NAlert, NButton, NIcon } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
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
  selectedObjective.value = ''
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

onMounted(async () => {
  try {
    await store.fetchOverview()
  } catch {
    // Error is already captured in store.error and displayed via NAlert
  }
  syncDefaultsForDiscipline(store.activeDiscipline)
  applyRouteQueryOverrides()
})

function handleDisciplineSelect(disc: TrainingDiscipline): void {
  store.selectDiscipline(disc)
  syncDefaultsForDiscipline(disc)
  if (Object.keys(route.query).length > 0) {
    void router.replace({ path: route.path, query: { discipline: disc } })
  }
}

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
      store.activeDiscipline === 'theoretical_endgames' && selectedFocusGroup.value !== 'objective'
        ? selectedObjective.value
        : '',
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
    <div class="flex w-full flex-col gap-3 sm:gap-5 text-text-primary select-none">
      <!-- Top Header & Woodpecker Vault Summary -->
      <div class="flex flex-col @5xl:flex-row @5xl:items-center @5xl:justify-between gap-4 p-4 @3xl:p-5 rounded-lg bg-surface border border-border">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <NIcon
            size="22"
            :class="props.mode === 'warmup' ? 'text-accent' : 'text-brand'"
          >
            <FlameOutline v-if="props.mode === 'warmup'" />
            <FlashOutline v-else />
          </NIcon>
          <h1 class="font-display font-semibold text-2xl text-text-primary tracking-tight">
            {{
              props.mode === 'warmup'
                ? t('features.trainingCenter.warmupPage.title')
                : t('features.trainingCenter.title')
            }}
          </h1>
        </div>
        <p class="text-sm text-text-secondary">
          {{
            props.mode === 'warmup'
              ? t('features.trainingCenter.warmupPage.subtitle')
              : t('features.trainingCenter.subtitle')
          }}
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div
          v-if="store.overview?.woodpecker"
          class="flex items-center gap-3 px-3.5 py-2 rounded-md bg-elevated/60 border border-border text-xs"
        >
          <span class="font-display font-semibold uppercase tracking-wider text-text-secondary">
            {{ t('features.trainingCenter.woodpecker.vaultTitle') }}
          </span>
          <div class="flex items-center gap-2 font-condensed text-sm">
            <span class="text-warning" :title="t('features.trainingCenter.woodpecker.dueNow')">
              {{ t('features.trainingCenter.woodpecker.dueShort') }}:
              <strong>{{ store.overview.woodpecker.due_now }}</strong>
            </span>
            <span class="text-text-disabled">|</span>
            <span class="text-text-secondary" :title="t('features.trainingCenter.woodpecker.cooldown24h')">
              24h: <strong>{{ store.overview.woodpecker.on_cooldown }}</strong>
            </span>
            <span class="text-text-disabled">|</span>
            <span class="text-success" :title="t('features.trainingCenter.woodpecker.mastered')">
              3/3: <strong>{{ store.overview.woodpecker.mastered_total }}</strong>
            </span>
          </div>
        </div>

        <NButton
          v-if="props.mode === 'course'"
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

        <NButton secondary @click="router.push('/user-cabinet')">
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

    <!-- Discipline Tabs — Monochrome Studio Tabs -->
    <div
      class="grid grid-cols-1 @md:grid-cols-2 gap-3"
      :class="visibleDisciplines.length >= 5 ? '@5xl:grid-cols-5' : '@5xl:grid-cols-4'"
    >
      <button
        v-for="disc in visibleDisciplines"
        :key="disc"
        type="button"
        class="p-4 rounded-lg border text-left transition-colors cursor-pointer flex flex-col gap-2"
        :class="
          store.activeDiscipline === disc
            ? 'bg-elevated border-border-hover shadow-xs'
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
      class="p-4 rounded-lg bg-surface border border-warning/40 flex flex-col @2xl:flex-row @2xl:items-center @2xl:justify-between gap-3"
    >
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40">
            {{
              activeSession.mode === 'course'
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
  </AppPageShell>
</template>
