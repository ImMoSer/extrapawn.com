<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { NAlert, NButton, NIcon, NModal, NResult, NSpin } from 'naive-ui'
import {
  CalendarOutline,
  CheckmarkCircleOutline,
  CloseOutline,
  FlashOutline,
  PlayOutline,
  RibbonOutline,
  RefreshOutline,
  ShareSocialOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/entities/user'
import {
  formatElapsedDuration,
  isDisciplineVisibleForUser,
  resolveBotEngineForDifficulty,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  TRAINING_DIFFICULTIES,
  trainingApi,
  type CabinetDTO,
  type CourseDTO,
  type DiagnosticStripDTO,
  type EndgameCabinetMapDTO,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import {
  CabinetDiagnosticStrip,
  CabinetEndgameMap,
  CabinetMacroPulse,
  CabinetTacticsMap,
} from '@/features/profile'
import { useTrainingSessionStore } from '@/features/training-session'

const { t, te, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const trainingSessionStore = useTrainingSessionStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)

const isPublicMo3epCabinet = computed<boolean>(() => {
  const rawId = typeof route.params.id === 'string' ? route.params.id.trim().toLowerCase() : ''
  return rawId === 'mo3ep'
})

const canViewCabinet = computed<boolean>(() => {
  return isPublicMo3epCabinet.value || (isAuthenticated.value && Boolean(userProfile.value))
})

const displayedUsername = computed<string>(() => {
  if (isPublicMo3epCabinet.value) return 'MO3EP'
  return userProfile.value?.username ?? ''
})

const cabinetData = ref<CabinetDTO | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const selectedDiscipline = ref<TrainingDiscipline>('tactics')
const copiedCourseId = ref<string | null>(null)

async function loadCabinet(): Promise<void> {
  if (!canViewCabinet.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    cabinetData.value = isPublicMo3epCabinet.value
      ? await trainingApi.getPublicCabinet('mo3ep')
      : await trainingApi.getCabinet()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (canViewCabinet.value) {
    void loadCabinet()
  }
})

watch([canViewCabinet, isPublicMo3epCabinet], ([allowed]) => {
  if (allowed) {
    void loadCabinet()
  } else {
    cabinetData.value = null
  }
})

const activeDiagnosticStrip = computed<DiagnosticStripDTO | null>(() => {
  const data = cabinetData.value
  if (!data) return null
  if (selectedDiscipline.value === 'tactics') return data.tactics.diagnostics
  if (selectedDiscipline.value === 'theoretical_endgames') return data.theoretical.diagnostics
  if (selectedDiscipline.value === 'practical_chess') return data.practical.diagnostics
  return data.finishhim.diagnostics
})

const activeEndgameMap = computed<EndgameCabinetMapDTO | null>(() => {
  const data = cabinetData.value
  if (!data || selectedDiscipline.value === 'tactics') return null
  if (selectedDiscipline.value === 'theoretical_endgames') return data.theoretical
  if (selectedDiscipline.value === 'practical_chess') return data.practical
  return data.finishhim
})

const activeGateThreshold = computed<number>(() => {
  const data = cabinetData.value
  if (!data) return 1500
  const discOverview = data.overview.disciplines[selectedDiscipline.value]
  return discOverview?.next_tier_gate?.rating_threshold ?? 2000
})

const visibleRecentCourses = computed<CourseDTO[]>(() => {
  const courses = cabinetData.value?.recent_courses ?? []
  return courses.filter(
    (c) => c.status === 'completed' && isDisciplineVisibleForUser(c.discipline, authStore.isMo3ep),
  )
})

// Quick WarmUp Launch Modal State
const showWarmupModal = ref(false)
const warmupModalFocusGroup = ref('all')
const warmupModalFocusKey = ref('all')
const warmupModalObjective = ref<TrainingObjective | ''>('')
const warmupModalTier = ref<TrainingDifficulty>('Novice')
const warmupModalCount = ref<number>(50)
const warmupModalError = ref<string | null>(null)

const warmupModalAllowedSizes = computed<number[]>(() => {
  const discOverview = cabinetData.value?.overview.disciplines[selectedDiscipline.value]
  if (discOverview?.warmup_allowed_sizes?.length) {
    return discOverview.warmup_allowed_sizes
  }
  return selectedDiscipline.value === 'tactics' ? [50, 100, 200] : [10, 25, 50]
})

const warmupModalTopicTitle = computed<string>(() => {
  return resolveScopeLabel(warmupModalFocusGroup.value, warmupModalFocusKey.value, t, te)
})

function handleOpenTrainingHub(discipline: TrainingDiscipline): void {
  void router.push({
    path: '/training',
    query: { discipline },
  })
}

function handleTrainScope(payload: {
  focusGroup: string
  focusKey: string
  objective?: TrainingObjective
}): void {
  if (!isAuthenticated.value) {
    const query: Record<string, string> = {
      discipline: selectedDiscipline.value,
      focusGroup: payload.focusGroup,
      focusKey: payload.focusKey,
    }
    if (payload.objective) {
      query.objective = payload.objective
    }
    void router.push({
      path: '/warmup',
      query,
    })
    return
  }

  const discOverview = cabinetData.value?.overview.disciplines[selectedDiscipline.value]
  const sizes = warmupModalAllowedSizes.value

  warmupModalFocusGroup.value = payload.focusGroup
  warmupModalFocusKey.value = payload.focusKey
  warmupModalObjective.value = payload.objective ?? ''
  warmupModalTier.value = discOverview?.unlocked_tier ?? 'Novice'
  warmupModalCount.value = sizes[0] ?? (selectedDiscipline.value === 'tactics' ? 50 : 10)
  warmupModalError.value = null
  showWarmupModal.value = true
}

async function handleConfirmWarmupLaunch(): Promise<void> {
  warmupModalError.value = null
  try {
    trainingSessionStore.selectDiscipline(selectedDiscipline.value)
    await trainingSessionStore.startWarmupSession({
      discipline: selectedDiscipline.value,
      difficulty: warmupModalTier.value,
      count: warmupModalCount.value,
      focus_group: warmupModalFocusGroup.value,
      focus_key: warmupModalFocusGroup.value === 'all' ? 'all' : warmupModalFocusKey.value,
      objective:
        selectedDiscipline.value === 'theoretical_endgames' &&
        warmupModalFocusGroup.value !== 'objective'
          ? warmupModalObjective.value
          : '',
      force_replace: true,
    })
    showWarmupModal.value = false
    await router.push({
      path: '/warmup',
      query: {
        discipline: selectedDiscipline.value,
      },
    })
  } catch (err: unknown) {
    warmupModalError.value = err instanceof Error ? err.message : String(err)
  }
}

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

function handleOpenDiploma(course: CourseDTO): void {
  if (course.status !== 'completed') return
  void router.push(`/kursdiplom/${course.id}`)
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
  <div class="mx-auto my-6 max-w-6xl px-4 max-md:my-3 max-md:px-2">
    <!-- Unauthenticated State -->
    <div
      v-if="!canViewCabinet"
      class="rounded-xl border border-border bg-surface py-16 shadow-md"
    >
      <NResult
        status="403"
        :title="t('pages.userCabinet.title')"
        :description="t('pages.userCabinet.loginPrompt')"
      >
        <template #footer>
          <NButton type="primary" size="large" @click="authStore.login()">
            {{ t('shared.nav.loginWithLichess') }}
          </NButton>
        </template>
      </NResult>
    </div>

    <!-- Authenticated / Public Showcase State -->
    <div v-else class="space-y-6">
      <NAlert v-if="errorMessage" type="error" closable @close="errorMessage = null">
        <div class="flex items-center justify-between gap-4">
          <span>{{ errorMessage }}</span>
          <NButton size="small" secondary type="error" @click="loadCabinet">
            <template #icon>
              <NIcon :component="RefreshOutline" />
            </template>
            {{ t('shared.actions.retry') }}
          </NButton>
        </div>
      </NAlert>

      <div
        v-if="isLoading && !cabinetData"
        class="flex min-h-[380px] items-center justify-center rounded-xl border border-border bg-surface"
      >
        <NSpin size="large" />
      </div>

      <template v-else-if="cabinetData">
        <!-- LAYER 1: Macro-Pulse & 12-Month Dual-Axis Timeline -->
        <CabinetMacroPulse
          :cabinet="cabinetData"
          :selected-discipline="selectedDiscipline"
          :username="displayedUsername"
          @select-discipline="(disc) => (selectedDiscipline = disc)"
          @open-training-hub="handleOpenTrainingHub"
        />

        <!-- LAYER 2: Coach's Diagnostic Strip (Top Strength / Primary Weakness / Blind Spot) -->
        <CabinetDiagnosticStrip
          v-if="activeDiagnosticStrip"
          :diagnostics="activeDiagnosticStrip"
          :discipline="selectedDiscipline"
          :gate-threshold="activeGateThreshold"
          @train-scope="handleTrainScope"
        />

        <!-- LAYER 3: Deep Analytical Map (Tactics vs Endgames) -->
        <CabinetTacticsMap
          v-if="selectedDiscipline === 'tactics'"
          :map-data="cabinetData.tactics"
          :gate-threshold="activeGateThreshold"
          @train-scope="handleTrainScope"
        />

        <CabinetEndgameMap
          v-else-if="activeEndgameMap"
          :map-data="activeEndgameMap"
          :discipline="selectedDiscipline"
          :gate-threshold="activeGateThreshold"
          @train-scope="handleTrainScope"
        />

        <!-- Recent Courses History Strip -->
        <section
          v-if="visibleRecentCourses.length > 0"
          class="rounded-xl border border-border bg-surface p-5 shadow-md"
        >
          <div class="flex items-center gap-2 border-b border-border pb-3">
            <NIcon :component="CalendarOutline" class="text-lg text-accent" />
            <h2 class="font-display text-base font-bold tracking-wider text-text-primary uppercase">
              {{ t('pages.userCabinet.macro.recentCoursesTitle') }}
            </h2>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="course in visibleRecentCourses"
              :key="course.id"
              class="flex flex-col justify-between rounded-lg border bg-canvas p-4 transition-all"
              :class="
                course.status === 'completed'
                  ? 'border-border hover:border-border-hover cursor-pointer'
                  : 'border-border'
              "
              @click="handleOpenDiploma(course)"
            >
              <div>
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <div class="text-xs font-bold tracking-wider text-text-secondary uppercase">
                      {{ resolveDisciplineLabel(course.discipline, t) }}
                    </div>
                    <div class="mt-0.5 text-sm font-bold text-text-primary">
                      {{ resolveDifficultyLabel(course.difficulty, t) }} · {{ course.duration_days }}d
                      <span class="font-condensed text-xs font-normal text-text-secondary">
                        · {{ ENGINE_NAMES[course.bot_engine] }}
                      </span>
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
                      :component="
                        course.status === 'completed' ? CheckmarkCircleOutline : TimeOutline
                      "
                    />
                    {{ t(`features.trainingCenter.course.status.${course.status}`) }}
                  </span>
                </div>

                <!-- Quota Progress Row + Bar -->
                <div class="mt-3 flex items-center justify-between font-condensed text-xs text-text-secondary">
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

                <!-- Course Metrics Strip (Accuracy, Mistakes, Optional Rating Delta) -->
                <div class="mt-3 flex flex-wrap items-center justify-between gap-2 font-condensed text-xs">
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

                <!-- Dates & Sprint Duration -->
                <div class="mt-2 flex items-center justify-between font-condensed text-[11px] text-text-secondary">
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

              <!-- Diploma Action Footer (Only for Completed Courses) -->
              <div
                v-if="course.status === 'completed'"
                class="mt-3.5 flex items-center justify-between gap-2 border-t border-border pt-2.5"
              >
                <span class="inline-flex items-center gap-1.5 font-condensed text-xs font-bold text-brand uppercase">
                  <NIcon :component="RibbonOutline" />
                  {{ t('features.trainingCenter.diploma.openDiplomaBtn') }} ↗
                </span>

                <NButton
                  size="tiny"
                  secondary
                  @click.stop="handleCopyDiplomaLink(course.id)"
                >
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
    </div>

    <!-- Quick WarmUp Launch Modal (Direct Start from Cabinet) -->
    <NModal v-model:show="showWarmupModal" :mask-closable="!trainingSessionStore.isStartingSession">
      <div class="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl text-text-primary select-none flex flex-col gap-4">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <NIcon :component="FlashOutline" class="text-lg text-brand" />
            <h3 class="font-display text-base font-bold uppercase tracking-wider text-text-primary">
              {{ t('pages.userCabinet.warmupModal.title') }}
            </h3>
          </div>
          <button
            type="button"
            class="cursor-pointer rounded p-1 text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
            :disabled="trainingSessionStore.isStartingSession"
            @click="showWarmupModal = false"
          >
            <NIcon :component="CloseOutline" class="text-lg" />
          </button>
        </div>

        <!-- Selected Discipline & Topic Summary -->
        <div class="rounded-lg border border-brand/30 bg-brand/5 p-3 flex flex-col gap-1">
          <span class="font-condensed text-[11px] font-bold uppercase tracking-wider text-text-secondary">
            {{ resolveDisciplineLabel(selectedDiscipline, t) }} · {{ t('pages.userCabinet.warmupModal.topicLabel') }}
          </span>
          <span class="font-display text-sm font-bold text-brand">
            {{ warmupModalTopicTitle }}
          </span>
        </div>

        <NAlert v-if="warmupModalError" type="error" closable @close="warmupModalError = null">
          {{ warmupModalError }}
        </NAlert>

        <!-- 1. Difficulty Tier Selector -->
        <div class="flex flex-col gap-2">
          <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
            {{ t('pages.userCabinet.warmupModal.tierLabel') }}
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="tier in TRAINING_DIFFICULTIES"
              :key="tier"
              type="button"
              class="p-2.5 rounded-md border flex flex-col items-start gap-0.5 transition-colors cursor-pointer"
              :class="
                warmupModalTier === tier
                  ? 'bg-elevated border-border-hover text-text-primary'
                  : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="warmupModalTier = tier"
            >
              <span class="font-display font-semibold text-xs">
                {{ resolveDifficultyLabel(tier, t) }}
              </span>
              <span class="font-condensed text-[10px] text-text-secondary">
                {{ ENGINE_NAMES[resolveBotEngineForDifficulty(tier, selectedDiscipline)] }}
              </span>
            </button>
          </div>
        </div>

        <!-- 2. Session Batch Size Selector -->
        <div class="flex flex-col gap-2">
          <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
            {{ t('pages.userCabinet.warmupModal.batchLabel') }}
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="cnt in warmupModalAllowedSizes"
              :key="cnt"
              type="button"
              class="py-2 px-2.5 rounded-md border font-condensed font-bold text-sm transition-colors cursor-pointer"
              :class="
                warmupModalCount === cnt
                  ? 'bg-elevated border-border-hover text-text-primary'
                  : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="warmupModalCount = cnt"
            >
              {{ cnt }} {{ t('features.trainingCenter.warmup.puzzlesUnit') }}
            </button>
          </div>
        </div>

        <!-- 3. Optional Objective Selector (Theoretical Endgames Only) -->
        <div
          v-if="
            selectedDiscipline === 'theoretical_endgames' &&
            warmupModalFocusGroup !== 'objective'
          "
          class="flex flex-col gap-2"
        >
          <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
            {{ t('pages.userCabinet.warmupModal.objectiveLabel') }}
          </label>
          <div class="grid grid-cols-3 gap-2">
            <button
              type="button"
              class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer"
              :class="
                warmupModalObjective === ''
                  ? 'bg-elevated border-border-hover text-text-primary'
                  : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="warmupModalObjective = ''"
            >
              {{ t('features.trainingCenter.warmup.quickGrid.mix') }}
            </button>
            <button
              type="button"
              class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer"
              :class="
                warmupModalObjective === 'win'
                  ? 'bg-elevated border-border-hover text-text-primary'
                  : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="warmupModalObjective = 'win'"
            >
              {{ t('features.trainingCenter.warmup.quickGrid.win') }}
            </button>
            <button
              type="button"
              class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer"
              :class="
                warmupModalObjective === 'hold_draw'
                  ? 'bg-elevated border-border-hover text-text-primary'
                  : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="warmupModalObjective = 'hold_draw'"
            >
              {{ t('features.trainingCenter.warmup.quickGrid.draw') }}
            </button>
          </div>
        </div>

        <div class="pt-1">
          <NButton
            type="primary"
            size="large"
            block
            :loading="trainingSessionStore.isStartingSession"
            @click="handleConfirmWarmupLaunch"
          >
            <template #icon>
              <NIcon :component="PlayOutline" />
            </template>
            {{ t('pages.userCabinet.warmupModal.startBtn', { count: warmupModalCount }) }}
          </NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>
