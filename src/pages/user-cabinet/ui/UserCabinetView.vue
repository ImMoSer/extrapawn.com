<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { NAlert, NButton, NIcon, NResult, NSpin } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { useAuthStore } from '@/entities/user'
import {
  DisciplineStickyBar,
  disciplineToRouteSlug,
  getVisibleTrainingDisciplines,
  isDisciplineVisibleForUser,
  routeSlugToDiscipline,
  trainingApi,
  type CabinetDTO,
  type CourseDTO,
  type DiagnosticStripDTO,
  type EndgameCabinetMapDTO,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import AppPageShell from '@/shared/ui/layout/AppPageShell.vue'
import {
  CabinetDiagnosticStrip,
  CabinetEndgameMap,
  CabinetMacroPulse,
  CabinetTacticsMap,
  CabinetWoodpeckerCard,
} from '@/features/profile'
import { useTrainingSessionStore } from '@/features/training-session'
import CabinetAccountDangerZone from './CabinetAccountDangerZone.vue'
import CabinetRecentCourses from './CabinetRecentCourses.vue'
import CabinetWarmupModal from './CabinetWarmupModal.vue'

type AccountDeleteNotice = {
  type: 'warning' | 'error'
  message: string
}

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const authStore = useAuthStore()
const trainingSessionStore = useTrainingSessionStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)

const isPublicMo3epCabinet = computed<boolean>(() => route.name === 'user-cabinet-public')

const canViewCabinet = computed<boolean>(() => {
  return isPublicMo3epCabinet.value || (isAuthenticated.value && Boolean(userProfile.value))
})

const displayedUsername = computed<string>(() => {
  if (isPublicMo3epCabinet.value) return 'MO3EP'
  return userProfile.value?.username ?? ''
})

const visibleDisciplines = computed(() => getVisibleTrainingDisciplines(authStore.canAccessCourses))

const cabinetData = ref<CabinetDTO | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const accountDeleteNotice = ref<AccountDeleteNotice | null>(null)

const selectedDiscipline = computed<TrainingDiscipline>(() => {
  const rawParam = typeof route.params.discipline === 'string' ? route.params.discipline : undefined
  return routeSlugToDiscipline(rawParam) ?? 'tactics'
})
const isMobileSelectorVisible = ref(true)

const activeDisciplineRating = computed<number | null>(() => {
  const discOverview = cabinetData.value?.overview.disciplines[selectedDiscipline.value]
  return discOverview ? discOverview.global_rating : null
})

const activeWoodpeckerPendingCount = computed<number>(() => {
  const byDisc = cabinetData.value?.overview.woodpecker?.by_discipline?.[selectedDiscipline.value]
  if (!byDisc) return 0
  return byDisc.due_now + byDisc.on_cooldown
})

function consumeAccountDeleteStatusFromQuery(): void {
  const raw = route.query.account_delete_status
  if (typeof raw !== 'string' || !raw) return

  if (raw === 'cancelled') {
    accountDeleteNotice.value = {
      type: 'warning',
      message: t('pages.userCabinet.accountDanger.statusCancelled'),
    }
  } else if (raw === 'expired') {
    accountDeleteNotice.value = {
      type: 'error',
      message: t('pages.userCabinet.accountDanger.statusExpired'),
    }
  } else if (raw === 'mismatch') {
    accountDeleteNotice.value = {
      type: 'error',
      message: t('pages.userCabinet.accountDanger.statusMismatch'),
    }
  } else {
    accountDeleteNotice.value = {
      type: 'error',
      message: t('pages.userCabinet.accountDanger.statusError'),
    }
  }

  const nextQuery = { ...route.query }
  delete nextQuery.account_delete_status
  void router.replace({ query: nextQuery })
}

async function handleStartWoodpeckerBatch(): Promise<void> {
  if (!isAuthenticated.value || activeWoodpeckerPendingCount.value <= 0) return
  errorMessage.value = null
  try {
    const discOverview = cabinetData.value?.overview.disciplines[selectedDiscipline.value]
    trainingSessionStore.selectDiscipline(selectedDiscipline.value)
    await trainingSessionStore.startWarmupSession({
      discipline: selectedDiscipline.value,
      difficulty: discOverview?.unlocked_tier ?? 'Novice',
      count: selectedDiscipline.value === 'tactics' ? 50 : 30,
      focus_group: 'woodpecker',
      focus_key: 'all',
      objective: '',
      force_replace: true,
    })
    await router.push({
      path: '/warmup',
      query: {
        discipline: selectedDiscipline.value,
      },
    })
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  }
}

function handleSelectDiscipline(disc: TrainingDiscipline): void {
  const slug = disciplineToRouteSlug(disc)
  const targetPath = isPublicMo3epCabinet.value
    ? `/user-cabinet/mo3ep/${slug}`
    : `/user-cabinet/${slug}`
  if (route.path !== targetPath) {
    void router.replace(targetPath)
  }
}

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
  consumeAccountDeleteStatusFromQuery()
  if (canViewCabinet.value) {
    void loadCabinet()
  }
})

watch(
  () => route.query.account_delete_status,
  () => {
    consumeAccountDeleteStatusFromQuery()
  },
)

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
    (c) =>
      c.status === 'completed' &&
      isDisciplineVisibleForUser(c.discipline, authStore.canAccessCourses),
  )
})

const showWarmupModal = ref(false)
const warmupModalFocusGroup = ref('all')
const warmupModalFocusKey = ref('all')
const warmupModalObjective = ref<TrainingObjective | ''>('')
const warmupModalTier = ref<TrainingDifficulty>('Novice')
const warmupModalError = ref<string | null>(null)

const warmupModalAllowedSizes = computed<number[]>(() => {
  const discOverview = cabinetData.value?.overview.disciplines[selectedDiscipline.value]
  if (discOverview?.warmup_allowed_sizes?.length) {
    return discOverview.warmup_allowed_sizes
  }
  return selectedDiscipline.value === 'tactics' ? [50, 100, 200] : [10, 25, 50]
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
  warmupModalFocusGroup.value = payload.focusGroup
  warmupModalFocusKey.value = payload.focusKey
  warmupModalObjective.value = payload.objective ?? ''
  warmupModalTier.value = discOverview?.unlocked_tier ?? 'Novice'
  warmupModalError.value = null
  showWarmupModal.value = true
}

async function handleConfirmWarmupLaunch(payload: {
  difficulty: TrainingDifficulty
  count: number
  objective: TrainingObjective | ''
}): Promise<void> {
  warmupModalError.value = null
  try {
    trainingSessionStore.selectDiscipline(selectedDiscipline.value)
    await trainingSessionStore.startWarmupSession({
      discipline: selectedDiscipline.value,
      difficulty: payload.difficulty,
      count: payload.count,
      focus_group: warmupModalFocusGroup.value,
      focus_key: warmupModalFocusGroup.value === 'all' ? 'all' : warmupModalFocusKey.value,
      objective: payload.objective,
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

function handleOpenDiploma(course: CourseDTO): void {
  if (course.status !== 'completed') return
  void router.push(`/kursdiplom/${course.id}`)
}
</script>

<template>
  <AppPageShell>
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
    <div v-else class="relative">
      <DisciplineStickyBar
        v-if="cabinetData"
        :visible="!isMobileSelectorVisible"
        :disciplines="visibleDisciplines"
        :selected-discipline="selectedDiscipline"
        :rating="activeDisciplineRating"
        @select-discipline="handleSelectDiscipline"
      />

      <div class="space-y-3 sm:space-y-6">
        <NAlert
          v-if="accountDeleteNotice"
          :type="accountDeleteNotice.type"
          closable
          @close="accountDeleteNotice = null"
        >
          {{ accountDeleteNotice.message }}
        </NAlert>

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
          <CabinetMacroPulse
            :cabinet="cabinetData"
            :selected-discipline="selectedDiscipline"
            :username="displayedUsername"
            @select-discipline="handleSelectDiscipline"
            @open-training-hub="handleOpenTrainingHub"
            @selector-visibility-change="(v) => (isMobileSelectorVisible = v)"
          />

          <CabinetDiagnosticStrip
            v-if="activeDiagnosticStrip"
            :diagnostics="activeDiagnosticStrip"
            :discipline="selectedDiscipline"
            :gate-threshold="activeGateThreshold"
            @train-scope="handleTrainScope"
          />

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

          <CabinetRecentCourses
            :courses="visibleRecentCourses"
            @open-diploma="handleOpenDiploma"
          />

          <CabinetWoodpeckerCard
            :discipline="selectedDiscipline"
            :pending-count="activeWoodpeckerPendingCount"
            :can-start="isAuthenticated && !isPublicMo3epCabinet"
            :is-starting="trainingSessionStore.isStartingSession"
            @start-batch="handleStartWoodpeckerBatch"
          />

          <CabinetAccountDangerZone
            v-if="isAuthenticated && !isPublicMo3epCabinet"
            :username="displayedUsername"
          />
        </template>
      </div>
    </div>

    <CabinetWarmupModal
      v-model:show="showWarmupModal"
      :discipline="selectedDiscipline"
      :focus-group="warmupModalFocusGroup"
      :focus-key="warmupModalFocusKey"
      :initial-objective="warmupModalObjective"
      :initial-tier="warmupModalTier"
      :allowed-sizes="warmupModalAllowedSizes"
      :is-starting="trainingSessionStore.isStartingSession"
      :error-message="warmupModalError"
      @clear-error="warmupModalError = null"
      @confirm="handleConfirmWarmupLaunch"
    />
  </AppPageShell>
</template>
