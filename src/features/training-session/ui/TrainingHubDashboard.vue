<script setup lang="ts">
import {
  BOT_ENGINE_BY_DIFFICULTY,
  formatRemainingDuration,
  getVisibleTrainingDisciplines,
  isDisciplineVisibleForUser,
  isValidTrainingDifficulty,
  isValidTrainingDiscipline,
  PRACTICAL_AND_FINISHHIM_DOMAINS,
  PRACTICAL_DOMAIN_CLASSES,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  TACTICS_COGNITIVE_PROFILES,
  TACTICS_CONCEPT_MOTIFS,
  TACTICS_GEOMETRY_MOTIFS,
  TACTICS_GOALS,
  TACTICS_LENGTHS,
  TACTICS_MOTIF_GROUPS,
  TACTICS_OPERATOR_MOTIFS,
  TACTICS_PHASES,
  TACTICS_TRIGGER_MOTIFS,
  THEORETICAL_DOMAIN_CLASSES,
  THEORETICAL_DOMAINS,
  TRAINING_DIFFICULTIES,
  type CourseDurationDays,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  AnalyticsOutline,
  CheckmarkCircleOutline,
  FlameOutline,
  FlashOutline,
  LockClosedOutline,
  PlayOutline,
  TimeOutline,
  TrashOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NAlert, NButton, NIcon, NSelect, type SelectOption } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const props = withDefaults(
  defineProps<{
    mode?: 'course' | 'warmup'
  }>(),
  {
    mode: 'course',
  },
)

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const store = useTrainingSessionStore()

// Course Builder Controls
const selectedCourseTier = ref<TrainingDifficulty>('Novice')
const selectedCourseDuration = ref<CourseDurationDays>(30)
const selectedBatchSize = ref<number>(50)

// WarmUp Builder Controls
const selectedWarmupTier = ref<TrainingDifficulty>('Novice')
const selectedWarmupCount = ref<number>(50)
const selectedFocusGroup = ref<string>('all')
const selectedFocusKey = ref<string>('all')
const selectedObjective = ref<TrainingObjective | ''>('')

const TIER_RANK_ORDER: Readonly<Record<TrainingDifficulty, number>> = {
  Novice: 0,
  Pro: 1,
  Master: 2,
}

const ALL_TACTICS_MOTIFS = [
  ...TACTICS_GEOMETRY_MOTIFS,
  ...TACTICS_OPERATOR_MOTIFS,
  ...TACTICS_CONCEPT_MOTIFS,
  ...TACTICS_TRIGGER_MOTIFS,
]

const visibleDisciplines = computed(() => getVisibleTrainingDisciplines(authStore.isMo3ep))

const discOverview = computed(() => store.activeDisciplineOverview)

const unlockedTierOrder = computed(() => {
  const tier = discOverview.value?.unlocked_tier ?? 'Novice'
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
  if (discOverview.value?.course_batch_sizes?.length) {
    return discOverview.value.course_batch_sizes
  }
  return store.activeDiscipline === 'tactics' ? [25, 50, 100] : [10, 20, 30]
})

const warmupAllowedSizes = computed<number[]>(() => {
  if (discOverview.value?.warmup_allowed_sizes?.length) {
    return discOverview.value.warmup_allowed_sizes
  }
  return store.activeDiscipline === 'tactics' ? [50, 100, 200] : [10, 25, 50]
})

const activeCourse = computed(() => discOverview.value?.active_course ?? null)
const activeSession = computed(() => {
  const s = discOverview.value?.active_session ?? null
  if (s?.mode === 'crashtest' && !authStore.isMo3ep) return null
  return s
})
const nextTierGate = computed(() => discOverview.value?.next_tier_gate ?? null)

const activeCoursePercent = computed(() => {
  if (!activeCourse.value || activeCourse.value.target_puzzles <= 0) return 0
  return Math.min(
    100,
    Math.round((activeCourse.value.solved_puzzles / activeCourse.value.target_puzzles) * 100),
  )
})

const gateCurrentRating = computed(() => {
  if (!nextTierGate.value) return 1000
  return nextTierGate.value.current_rating ?? discOverview.value?.global_rating ?? 1000
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
  return Math.min(100, Math.max(0, Math.round(((gateCurrentRating.value - baseRating) / span) * 100)))
})

// WarmUp Focus Group & Key Options
const focusGroupOptions = computed<SelectOption[]>(() => {
  if (store.activeDiscipline === 'tactics') {
    return [
      { label: t('features.trainingCenter.warmup.focusGroups.all'), value: 'all' },
      { label: t('features.trainingCenter.warmup.focusGroups.motif_group'), value: 'motif_group' },
      { label: t('features.trainingCenter.warmup.focusGroups.motif'), value: 'motif' },
      { label: t('features.trainingCenter.warmup.focusGroups.phase'), value: 'phase' },
      { label: t('features.trainingCenter.warmup.focusGroups.length'), value: 'length' },
      { label: t('features.trainingCenter.warmup.focusGroups.goal'), value: 'goal' },
      { label: t('features.trainingCenter.warmup.focusGroups.cognitive'), value: 'cognitive' },
      { label: t('features.trainingCenter.warmup.focusGroups.master_game'), value: 'master_game' },
    ]
  }
  const base: SelectOption[] = [
    { label: t('features.trainingCenter.warmup.focusGroups.all'), value: 'all' },
    { label: t('features.trainingCenter.warmup.focusGroups.domain'), value: 'domain' },
    { label: t('features.trainingCenter.warmup.focusGroups.class'), value: 'class' },
  ]
  if (store.activeDiscipline === 'theoretical_endgames') {
    base.push({
      label: t('features.trainingCenter.warmup.focusGroups.objective'),
      value: 'objective',
    })
  }
  return base
})

const focusKeyOptions = computed<SelectOption[]>(() => {
  const grp = selectedFocusGroup.value
  const disc = store.activeDiscipline
  if (grp === 'all') return []

  if (disc === 'tactics') {
    if (grp === 'phase') {
      return TACTICS_PHASES.map((k) => ({
        label: resolveScopeLabel('phase', k, t, te),
        value: k,
      }))
    }
    if (grp === 'length') {
      return TACTICS_LENGTHS.map((k) => ({
        label: resolveScopeLabel('length', k, t, te),
        value: k,
      }))
    }
    if (grp === 'goal') {
      return TACTICS_GOALS.map((k) => ({
        label: resolveScopeLabel('goal', k, t, te),
        value: k,
      }))
    }
    if (grp === 'master_game') {
      return [
        { label: t('features.trainingCenter.taxonomy.master_game.true'), value: 'true' },
        { label: t('features.trainingCenter.taxonomy.master_game.false'), value: 'false' },
      ]
    }
    if (grp === 'cognitive') {
      return TACTICS_COGNITIVE_PROFILES.filter((k) => k !== 'other_motif').map((k) => ({
        label: resolveScopeLabel('cognitive', k, t, te),
        value: k,
      }))
    }
    if (grp === 'motif_group') {
      return TACTICS_MOTIF_GROUPS.map((k) => ({
        label: t(`features.trainingCenter.warmup.motifGroups.${k}`),
        value: k,
      }))
    }
    if (grp === 'motif') {
      return ALL_TACTICS_MOTIFS.map((k) => ({
        label: resolveScopeLabel('scopes', k, t, te),
        value: k,
      }))
    }
    return []
  }

  // Endgame disciplines
  if (grp === 'domain') {
    const domains =
      disc === 'theoretical_endgames' ? THEORETICAL_DOMAINS : PRACTICAL_AND_FINISHHIM_DOMAINS
    return domains.map((d) => ({
      label: resolveScopeLabel('domain', d, t, te),
      value: d,
    }))
  }
  if (grp === 'objective') {
    return [
      { label: t('features.trainingCenter.badges.winTarget'), value: 'win' },
      { label: t('features.trainingCenter.badges.holdDrawFide'), value: 'hold_draw' },
    ]
  }
  if (grp === 'class') {
    const classMap =
      disc === 'theoretical_endgames' ? THEORETICAL_DOMAIN_CLASSES : PRACTICAL_DOMAIN_CLASSES
    const allClasses = Object.values(classMap).flat()
    return allClasses.map((cls) => ({
      label: resolveScopeLabel('scopes', cls, t, te),
      value: cls,
    }))
  }
  return []
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
    isDisciplineVisibleForUser(qDisc, authStore.isMo3ep)
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
      selectedFocusGroup.value = 'motif'
      selectedFocusKey.value = qFocusKey
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
  () => store.activeDiscipline,
  (disc) => {
    syncDefaultsForDiscipline(disc)
  },
)

watch(
  () => selectedFocusGroup.value,
  (newGrp) => {
    if (newGrp === 'all') {
      selectedFocusKey.value = 'all'
      return
    }
    const firstOpt = focusKeyOptions.value[0]
    if (firstOpt && typeof firstOpt.value === 'string') {
      const exists = focusKeyOptions.value.some((o) => o.value === selectedFocusKey.value)
      if (!exists) {
        selectedFocusKey.value = firstOpt.value
      }
    }
  },
)

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
  <div class="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6 text-text-primary select-none">
    <!-- Top Header & Woodpecker Vault Summary -->
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 rounded-lg bg-surface border border-border">
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
        <!-- Woodpecker Vault Pill -->
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

    <!-- Discipline Tabs ([D7]) — Monochrome Studio Tabs -->
    <div
      class="grid grid-cols-2 gap-3"
      :class="visibleDisciplines.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'"
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

        <!-- Active Course or Session Status Indicator -->
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
      class="p-4 rounded-lg bg-surface border border-warning/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
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
          {{ ENGINE_NAMES[activeSession.bot_engine] }} ·
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
      <!-- COURSE MODE (/training) ([D7, D8, D9, D10, D12]) -->
      <div v-if="props.mode === 'course'" class="p-6 flex flex-col gap-6">
        <!-- Active Course HUD -->
        <template v-if="activeCourse">
          <div class="p-5 rounded-lg bg-elevated/50 border border-border flex flex-col gap-4">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed font-bold uppercase bg-surface text-text-primary border border-border">
                  {{ resolveDifficultyLabel(activeCourse.difficulty, t) }}
                </span>
                <span class="px-2.5 py-0.5 rounded-sm text-xs font-condensed bg-surface border border-border text-text-secondary">
                  {{ t('features.trainingCenter.sidebar.sparringBot') }}:
                  {{ ENGINE_NAMES[activeCourse.bot_engine] }}
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
                @click="handleAbortCourse(activeCourse.id)"
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
            <div class="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                :loading="store.isStartingSession"
                @click="handleLaunchCourseBatch"
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
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Left: Rank Tier & Duration Selection -->
            <div class="flex flex-col gap-5">
              <!-- Step 1: Rank Tier -->
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
                        : selectedCourseTier === tier
                          ? 'bg-elevated border-border-hover text-text-primary cursor-pointer'
                          : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary cursor-pointer',
                    ]"
                    @click="isCourseTierUnlocked(tier) && (selectedCourseTier = tier)"
                  >
                    <div class="w-full flex items-center justify-between">
                      <span class="font-display font-semibold text-sm">
                        {{ resolveDifficultyLabel(tier, t) }}
                      </span>
                      <NIcon v-if="!isCourseTierUnlocked(tier)" size="14">
                        <LockClosedOutline />
                      </NIcon>
                    </div>
                    <span class="font-condensed text-[11px] text-text-secondary">
                      {{ ENGINE_NAMES[BOT_ENGINE_BY_DIFFICULTY[tier]] }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Step 2: Course Duration (7d vs 30d) -->
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
                      selectedCourseDuration === days
                        ? 'bg-elevated border-border-hover text-text-primary'
                        : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                    "
                    @click="selectedCourseDuration = days"
                  >
                    <span class="font-display font-semibold text-sm">
                      {{ t('features.trainingCenter.course.durationDays', { days }) }}
                    </span>
                    <span class="font-condensed text-xs text-text-secondary">
                      {{
                        t('features.trainingCenter.course.quotaTarget', {
                          count: getCourseTargetQuota(store.activeDiscipline, days),
                        })
                      }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Step 3: Batch Size & Start CTA -->
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
                  :loading="store.isStartingSession"
                  @click="handleStartCourse"
                >
                  <template #icon>
                    <NIcon><PlayOutline /></NIcon>
                  </template>
                  {{
                    t('features.trainingCenter.course.startCourseBtn', {
                      days: selectedCourseDuration,
                      quota: getCourseTargetQuota(store.activeDiscipline, selectedCourseDuration),
                    })
                  }}
                </NButton>
              </div>
            </div>

            <!-- Right: Next Tier Unlock Gate Checklist ([D10]) -->
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
                  <!-- Condition 1: Course Quota Completed -->
                  <div class="flex items-center justify-between p-2 rounded-sm bg-surface border border-border">
                    <span class="text-text-secondary">
                      {{
                        t('features.trainingCenter.gate.conditionQuota', {
                          days: selectedCourseDuration,
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

                  <!-- Condition 2: Overall Discipline Rating >= Threshold -->
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

                <!-- Lagging Scopes Preview (Clickable to open in WarmUp!) -->
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
                      @click="handleOpenLaggingScopeInWarmup(lag.group, lag.key)"
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

      <!-- WARMUP MODE (/warmup) ([D11, D12]) -->
      <div v-else class="p-6 flex flex-col gap-6">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Left: Free Rank Tier & Session Volume -->
          <div class="flex flex-col gap-5">
            <!-- Free Rank Selector -->
            <div class="flex flex-col gap-2">
              <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
                {{ t('features.trainingCenter.warmup.selectTierLabel') }}
              </label>
              <div class="grid grid-cols-3 gap-2.5">
                <button
                  v-for="tier in TRAINING_DIFFICULTIES"
                  :key="tier"
                  type="button"
                  class="p-3 rounded-md border flex flex-col items-start gap-1 transition-colors cursor-pointer"
                  :class="
                    selectedWarmupTier === tier
                      ? 'bg-elevated border-border-hover text-text-primary'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                  "
                  @click="selectedWarmupTier = tier"
                >
                  <span class="font-display font-semibold text-sm">
                    {{ resolveDifficultyLabel(tier, t) }}
                  </span>
                  <span class="font-condensed text-[11px] text-text-secondary">
                    {{ ENGINE_NAMES[BOT_ENGINE_BY_DIFFICULTY[tier]] }}
                  </span>
                </button>
              </div>
            </div>

            <!-- WarmUp Count Selector -->
            <div class="flex flex-col gap-2">
              <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
                {{ t('features.trainingCenter.warmup.selectCountLabel') }}
              </label>
              <div class="grid grid-cols-3 gap-2.5">
                <button
                  v-for="cnt in warmupAllowedSizes"
                  :key="cnt"
                  type="button"
                  class="py-2.5 px-3 rounded-md border font-condensed font-bold text-sm transition-colors cursor-pointer"
                  :class="
                    selectedWarmupCount === cnt
                      ? 'bg-elevated border-border-hover text-text-primary'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                  "
                  @click="selectedWarmupCount = cnt"
                >
                  {{ cnt }} {{ t('features.trainingCenter.warmup.puzzlesUnit') }}
                </button>
              </div>
            </div>
          </div>

          <!-- Right: Focus Group, Focus Key & Objective -->
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1.5">
              <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
                {{ t('features.trainingCenter.warmup.focusGroupLabel') }}
              </label>
              <NSelect v-model:value="selectedFocusGroup" :options="focusGroupOptions" />
            </div>

            <div v-if="selectedFocusGroup !== 'all'" class="flex flex-col gap-1.5">
              <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
                {{ t('features.trainingCenter.warmup.focusKeyLabel') }}
              </label>
              <NSelect
                v-model:value="selectedFocusKey"
                filterable
                :options="focusKeyOptions"
              />
            </div>

            <!-- Theoretical Objective Filter (Win vs Hold Draw) -->
            <div
              v-if="
                store.activeDiscipline === 'theoretical_endgames' &&
                selectedFocusGroup !== 'objective'
              "
              class="flex flex-col gap-1.5"
            >
              <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
                {{ t('features.trainingCenter.warmup.objectiveFilterLabel') }}
              </label>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  class="py-2 px-2.5 rounded-sm text-xs font-condensed font-bold uppercase border cursor-pointer transition-colors"
                  :class="
                    selectedObjective === ''
                      ? 'bg-elevated border-border-hover text-text-primary'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover'
                  "
                  @click="selectedObjective = ''"
                >
                  {{ t('features.trainingCenter.warmup.objectiveAll') }}
                </button>
                <button
                  type="button"
                  class="py-2 px-2.5 rounded-sm text-xs font-condensed font-bold uppercase border cursor-pointer transition-colors"
                  :class="
                    selectedObjective === 'win'
                      ? 'bg-elevated border-border-hover text-text-primary'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover'
                  "
                  @click="selectedObjective = 'win'"
                >
                  {{ t('features.trainingCenter.badges.winTarget') }}
                </button>
                <button
                  type="button"
                  class="py-2 px-2.5 rounded-sm text-xs font-condensed font-bold uppercase border cursor-pointer transition-colors"
                  :class="
                    selectedObjective === 'hold_draw'
                      ? 'bg-elevated border-warning/50 text-warning'
                      : 'bg-surface border-border text-text-secondary hover:border-border-hover'
                  "
                  @click="selectedObjective = 'hold_draw'"
                >
                  {{ t('features.trainingCenter.badges.holdDrawFide') }}
                </button>
              </div>
            </div>

            <div class="mt-auto pt-2 flex justify-end">
              <NButton
                type="primary"
                size="large"
                :loading="store.isStartingSession"
                @click="handleStartWarmup"
              >
                <template #icon>
                  <NIcon><PlayOutline /></NIcon>
                </template>
                {{
                  t('features.trainingCenter.warmup.startBtn', {
                    count: selectedWarmupCount,
                  })
                }}
              </NButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
