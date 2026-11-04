<script setup lang="ts">
import {
  resolveDisciplineLabel,
  trainingApi,
  type ChallengeRecordEntryDTO,
  type TrainingDiscipline,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  CodeWorkingOutline,
  RefreshOutline,
  TimeOutline,
  TrophyOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NSpin, NTooltip } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

const records = ref<ChallengeRecordEntryDTO[]>([])
const isLoading = ref<boolean>(true)
const errorMessage = ref<string | null>(null)

interface DisciplineSegmentConfig {
  discipline: TrainingDiscipline
  field: keyof Pick<
    ChallengeRecordEntryDTO,
    'tactics_points' | 'finishhim_points' | 'practical_points' | 'theoretical_points'
  >
  barClass: string
  dotClass: string
  textClass: string
  badgeClass: string
}

const DISCIPLINE_SEGMENTS: readonly DisciplineSegmentConfig[] = [
  {
    discipline: 'tactics',
    field: 'tactics_points',
    barClass: 'bg-brand',
    dotClass: 'bg-brand',
    textClass: 'text-brand',
    badgeClass: 'bg-brand/15 text-brand border-brand/40',
  },
  {
    discipline: 'finishhim',
    field: 'finishhim_points',
    barClass: 'bg-accent',
    dotClass: 'bg-accent',
    textClass: 'text-accent',
    badgeClass: 'bg-accent/15 text-accent border-accent/40',
  },
  {
    discipline: 'practical_chess',
    field: 'practical_points',
    barClass: 'bg-info',
    dotClass: 'bg-info',
    textClass: 'text-info',
    badgeClass: 'bg-info/15 text-info border-info/40',
  },
  {
    discipline: 'theoretical_endgames',
    field: 'theoretical_points',
    barClass: 'bg-warning',
    dotClass: 'bg-warning',
    textClass: 'text-warning',
    badgeClass: 'bg-warning/15 text-warning border-warning/40',
  },
]

const maxPoints = computed<number>(() => {
  let max = 0
  for (const row of records.value) {
    if (row.total_points > max) {
      max = row.total_points
    }
  }
  return max > 0 ? max : 1
})

const maxSeconds = computed<number>(() => {
  let max = 0
  for (const row of records.value) {
    if (row.total_seconds > max) {
      max = row.total_seconds
    }
  }
  return max > 0 ? max : 1
})

function segmentWidthPercent(row: ChallengeRecordEntryDTO, field: DisciplineSegmentConfig['field']): string {
  const val = row[field]
  if (val <= 0) return '0%'
  const pct = Math.min(100, (val / maxPoints.value) * 100)
  return `${pct.toFixed(2)}%`
}

function secondsWidthPercent(row: ChallengeRecordEntryDTO): string {
  if (row.total_seconds <= 0) return '0%'
  const pct = Math.min(100, (row.total_seconds / maxSeconds.value) * 100)
  return `${pct.toFixed(2)}%`
}

function formatPoints(val: number): string {
  return Number.isInteger(val) ? val.toFixed(1) : val.toFixed(2)
}

function formatSeconds(val: number): string {
  return `${val.toFixed(1)}s`
}

async function fetchRecords(): Promise<void> {
  isLoading.value = true
  errorMessage.value = null
  try {
    records.value = await trainingApi.getChallengeRecords()
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void fetchRecords()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-3 sm:p-6 pb-20 text-text-primary select-none">
    <!-- Page Header -->
    <div
      class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-border"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-11 h-11 rounded-md bg-warning/15 border border-warning/40 flex items-center justify-center text-warning shrink-0"
        >
          <NIcon size="24"><TrophyOutline /></NIcon>
        </div>
        <div>
          <h1 class="font-display font-bold text-xl sm:text-2xl uppercase tracking-wider text-text-primary">
            {{ t('features.trainingCenter.challenge.recordsTitle') }}
          </h1>
          <p class="text-xs sm:text-sm text-text-secondary">
            {{ t('features.trainingCenter.challenge.recordsSubtitle') }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 self-start sm:self-auto">
        <a
          href="/challenge/records.json"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex no-underline"
        >
          <NButton size="small" secondary>
            <template #icon>
              <NIcon><CodeWorkingOutline /></NIcon>
            </template>
            records.json
          </NButton>
        </a>
        <NButton size="small" secondary :loading="isLoading" @click="fetchRecords()">
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.challenge.refreshBtn') }}
        </NButton>
      </div>
    </div>

    <!-- Main Leaderboard Card -->
    <div class="rounded-lg border border-border bg-surface overflow-hidden shadow-lg">
      <!-- Table Top Header + Discipline Color Legend -->
      <div class="p-4 bg-elevated/80 border-b border-border flex flex-col gap-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <NIcon size="18" class="text-warning"><TrophyOutline /></NIcon>
            <span class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
              {{ t('features.trainingCenter.challenge.recordsTableHeader') }}
            </span>
          </div>
          <span class="font-condensed text-xs text-text-secondary">
            {{
              t('features.trainingCenter.challenge.totalParticipantsCount', {
                count: records.length,
              })
            }}
          </span>
        </div>

        <!-- 4-Color Discipline Legend + Time Bar Legend right below table header -->
        <div
          class="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-border/60 text-xs"
        >
          <span class="font-condensed font-bold uppercase tracking-wider text-text-secondary">
            {{ t('features.trainingCenter.challenge.legendLabel') }}:
          </span>

          <div
            v-for="seg in DISCIPLINE_SEGMENTS"
            :key="seg.discipline"
            class="flex items-center gap-1.5"
          >
            <span class="w-3 h-3 rounded-xs shrink-0" :class="seg.dotClass" />
            <span class="font-medium text-text-primary">
              {{ resolveDisciplineLabel(seg.discipline, t) }}
            </span>
          </div>

          <div class="flex items-center gap-1.5 sm:ml-auto">
            <span class="w-3 h-3 rounded-xs bg-orange shrink-0" />
            <span class="font-medium text-text-secondary">
              {{ t('features.trainingCenter.challenge.secondsBarLegend') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Loading / Error / Empty States -->
      <div v-if="isLoading" class="py-16 flex flex-col items-center justify-center gap-3">
        <NSpin size="large" />
      </div>

      <div
        v-else-if="errorMessage"
        class="p-8 text-center flex flex-col items-center gap-3 text-danger"
      >
        <p class="text-sm">{{ errorMessage }}</p>
        <NButton size="small" type="primary" @click="fetchRecords()">
          {{ t('features.trainingCenter.challenge.tryAgainBtn') }}
        </NButton>
      </div>

      <div
        v-else-if="records.length === 0"
        class="p-12 text-center text-sm text-text-secondary"
      >
        {{ t('features.trainingCenter.challenge.noParticipantsYet') }}
      </div>

      <!-- Records List -->
      <div v-else class="divide-y divide-border/60">
        <div
          v-for="row in records"
          :key="row.user_id"
          class="p-3.5 sm:px-5 sm:py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6 transition-colors"
          :class="
            row.user_id === authStore.userProfile?.id
              ? 'bg-elevated/60 border-l-3 border-l-brand'
              : 'hover:bg-elevated/40'
          "
        >
          <!-- Left: Rank + Username + Solved Summary -->
          <div class="flex items-center gap-3 md:w-64 shrink-0 min-w-0">
            <div
              class="w-8 h-8 rounded-md flex items-center justify-center font-condensed font-bold text-sm shrink-0 border"
              :class="[
                row.rank === 1 && row.total_points > 0
                  ? 'bg-warning/20 text-warning border-warning/50'
                  : row.rank === 2 && row.total_points > 0
                    ? 'bg-info/15 text-info border-info/40'
                    : row.rank === 3 && row.total_points > 0
                      ? 'bg-orange/15 text-orange border-orange/40'
                      : 'bg-elevated text-text-secondary border-border',
              ]"
            >
              #{{ row.rank }}
            </div>

            <div class="flex flex-col min-w-0 flex-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="font-display font-bold text-sm sm:text-base text-text-primary truncate">
                  {{ row.username }}
                </span>
                <span
                  v-if="row.user_id === authStore.userProfile?.id"
                  class="px-1.5 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-brand/15 text-brand border border-brand/40 shrink-0"
                >
                  {{ t('features.leaderboards.sidebar.currentUser') }}
                </span>
              </div>

              <div class="flex items-center gap-2 text-xs text-text-secondary font-condensed">
                <span>
                  {{
                    t('features.trainingCenter.challenge.userSolvedStats', {
                      solved: row.solved_count,
                      puzzles: row.attempted_puzzles,
                      attempts: row.total_attempts,
                    })
                  }}
                </span>
              </div>
            </div>
          </div>

          <!-- Right: Two Bars (1. 4-Colored Points Bar, 2. Total Seconds Bar) -->
          <div class="flex-1 flex flex-col gap-2.5 min-w-0">
            <!-- Bar 1: Total Points (4-color stacked bar) -->
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="font-condensed font-bold uppercase tracking-wider text-text-secondary">
                    {{ t('features.trainingCenter.challenge.pointsBarLabel') }}
                  </span>
                  <!-- Discipline mini badges for non-zero points -->
                  <template v-for="seg in DISCIPLINE_SEGMENTS" :key="seg.discipline">
                    <span
                      v-if="row[seg.field] > 0"
                      class="px-1.5 py-0.2 rounded-xs font-condensed font-bold text-[10px] border"
                      :class="seg.badgeClass"
                    >
                      {{ resolveDisciplineLabel(seg.discipline, t) }}: {{ formatPoints(row[seg.field]) }}
                    </span>
                  </template>
                </div>

                <span class="font-condensed font-bold text-sm text-text-primary shrink-0">
                  {{ formatPoints(row.total_points) }} {{ t('features.trainingCenter.challenge.ptsUnit') }}
                </span>
              </div>

              <!-- 4-colored stacked horizontal bar -->
              <div
                class="h-3.5 w-full rounded-sm bg-background/90 border border-border/80 overflow-hidden flex"
              >
                <template v-for="seg in DISCIPLINE_SEGMENTS" :key="seg.discipline">
                  <NTooltip v-if="row[seg.field] > 0" trigger="hover">
                    <template #trigger>
                      <div
                        class="h-full transition-all duration-300 first:rounded-l-xs last:rounded-r-xs border-r border-background/40 last:border-r-0"
                        :class="seg.barClass"
                        :style="{ width: segmentWidthPercent(row, seg.field) }"
                      />
                    </template>
                    <span>
                      {{ resolveDisciplineLabel(seg.discipline, t) }}: {{ formatPoints(row[seg.field]) }}
                      {{ t('features.trainingCenter.challenge.ptsUnit') }}
                    </span>
                  </NTooltip>
                </template>
              </div>
            </div>

            <!-- Bar 2: Total Seconds -->
            <div class="flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2 text-xs">
                <span class="font-condensed font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1">
                  <NIcon size="12" class="text-orange"><TimeOutline /></NIcon>
                  {{ t('features.trainingCenter.challenge.secondsBarLabel') }}
                </span>
                <span class="font-condensed font-bold text-xs text-orange shrink-0">
                  {{ formatSeconds(row.total_seconds) }}
                </span>
              </div>

              <div
                class="h-2.5 w-full rounded-sm bg-background/90 border border-border/80 overflow-hidden flex"
              >
                <div
                  v-if="row.total_seconds > 0"
                  class="h-full bg-orange transition-all duration-300 rounded-xs"
                  :style="{ width: secondsWidthPercent(row) }"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

