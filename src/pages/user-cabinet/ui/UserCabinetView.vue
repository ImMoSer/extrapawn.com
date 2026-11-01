<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { NAlert, NButton, NIcon, NResult, NSpin } from 'naive-ui'
import { CalendarOutline, CheckmarkCircleOutline, RefreshOutline, TimeOutline } from '@vicons/ionicons5'
import { useAuthStore } from '@/entities/user'
import {
  trainingApi,
  resolveDisciplineLabel,
  resolveDifficultyLabel,
  type CabinetDTO,
  type DiagnosticStripDTO,
  type EndgameCabinetMapDTO,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import {
  CabinetDiagnosticStrip,
  CabinetEndgameMap,
  CabinetMacroPulse,
  CabinetTacticsMap,
} from '@/features/profile'

const { t } = useI18n()
const router = useRouter()

const authStore = useAuthStore()
const { userProfile, isAuthenticated } = storeToRefs(authStore)

const cabinetData = ref<CabinetDTO | null>(null)
const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const selectedDiscipline = ref<TrainingDiscipline>('tactics')

async function loadCabinet(): Promise<void> {
  if (!isAuthenticated.value) return
  isLoading.value = true
  errorMessage.value = null
  try {
    cabinetData.value = await trainingApi.getCabinet()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (isAuthenticated.value) {
    void loadCabinet()
  }
})

watch(isAuthenticated, (authed) => {
  if (authed) {
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
  return discOverview.next_tier_gate?.rating_threshold ?? 2000
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
}
</script>

<template>
  <div class="mx-auto my-6 max-w-6xl px-4 max-md:my-3 max-md:px-2">
    <!-- Unauthenticated State -->
    <div
      v-if="!isAuthenticated || !userProfile"
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

    <!-- Authenticated State -->
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
          :username="userProfile.username"
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
          v-if="cabinetData.recent_courses.length > 0"
          class="rounded-xl border border-border bg-surface p-5 shadow-md"
        >
          <div class="flex items-center gap-2 border-b border-border pb-3">
            <NIcon :component="CalendarOutline" class="text-lg text-neon-purple" />
            <h2 class="font-display text-base font-bold tracking-wider text-text-primary uppercase">
              {{ t('pages.userCabinet.macro.recentCoursesTitle') }}
            </h2>
          </div>

          <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="course in cabinetData.recent_courses"
              :key="course.id"
              class="flex flex-col justify-between rounded-lg border border-border bg-void/60 p-3.5"
            >
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-xs font-bold tracking-wider text-neon-cyan uppercase">
                    {{ resolveDisciplineLabel(course.discipline, t) }}
                  </div>
                  <div class="mt-0.5 text-sm font-bold text-text-primary">
                    {{ resolveDifficultyLabel(course.difficulty, t) }} · {{ course.duration_days }}d
                  </div>
                </div>

                <span
                  class="inline-flex items-center gap-1 rounded border px-2 py-0.5 font-condensed text-[11px] font-bold uppercase"
                  :class="
                    course.status === 'completed'
                      ? 'border-success/40 bg-success/10 text-success'
                      : course.status === 'active'
                        ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan'
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

              <div class="mt-3 flex items-center justify-between font-condensed text-xs text-text-secondary">
                <span>
                  {{ course.solved_puzzles }} / {{ course.target_puzzles }}
                  {{ t('features.trainingCenter.course.puzzlesSolved') }}
                </span>
                <span class="font-bold text-text-primary">
                  {{
                    Math.min(
                      100,
                      Math.round((course.solved_puzzles / Math.max(1, course.target_puzzles)) * 100),
                    )
                  }}%
                </span>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>
