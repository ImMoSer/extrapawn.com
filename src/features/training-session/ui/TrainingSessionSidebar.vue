<script setup lang="ts">
import {
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  type HydratedSessionItem,
} from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import {
  ArrowForwardOutline,
  CheckmarkOutline,
  CloseOutline,
  DownloadOutline,
  EyeOutline,
  PauseOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NScrollbar } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadCrashTestReport, useCrashTestReport } from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t, te } = useI18n()
const store = useTrainingSessionStore()
const { anomaliesCount } = useCrashTestReport()

const summary = computed(() => store.activeSessionSummary)

const disciplineLabel = computed(() =>
  summary.value ? resolveDisciplineLabel(summary.value.discipline, t) : '',
)

const difficultyLabel = computed(() =>
  summary.value ? resolveDifficultyLabel(summary.value.difficulty, t) : '',
)

const botName = computed(() => ENGINE_NAMES[store.activeBotEngine] ?? store.activeBotEngine)

const completedCount = computed(() => {
  if (summary.value) {
    return summary.value.solved_count + summary.value.failed_count
  }
  return store.sessionItems.filter((it) => it.status === 'solved' || it.status === 'failed').length
})

const progressPercent = computed(() => {
  const total = summary.value?.total_count ?? store.sessionItems.length
  if (total === 0) return 0
  return Math.round((completedCount.value / total) * 100)
})

const WINDOW_THRESHOLD = 100
const WINDOW_BEFORE = 15
const WINDOW_SIZE = 60

const isWindowedQueue = computed(() => store.sessionItems.length > WINDOW_THRESHOLD)

const visibleWindowRange = computed(() => {
  const total = store.sessionItems.length
  if (total <= WINDOW_THRESHOLD) {
    return { start: 0, end: total }
  }
  const start = Math.max(
    0,
    Math.min(store.currentItemIndex - WINDOW_BEFORE, total - WINDOW_SIZE),
  )
  const end = Math.min(total, start + WINDOW_SIZE)
  return { start, end }
})

const visibleSessionItems = computed(() => {
  const items = store.sessionItems
  if (items.length <= WINDOW_THRESHOLD) return items
  const { start, end } = visibleWindowRange.value
  return items.slice(start, end)
})

const scopeLabelCache = new Map<string, string>()
function cachedScopeLabel(key: string): string {
  const hit = scopeLabelCache.get(key)
  if (hit !== undefined) return hit
  const resolved = resolveScopeLabel('scopes', key, t, te)
  scopeLabelCache.set(key, resolved)
  return resolved
}

function itemMetaSubtitle(item: HydratedSessionItem): string {
  if (item.course_puzzle) {
    return `Курс ${item.course_puzzle.course_id || 1} · Батч #${item.course_puzzle.batch_id}`
  }
  if (item.tactical) return `R: ${item.tactical.rating}`
  if (item.endgame) return `R: ${item.endgame.effective_rating}`
  return 'R: 1500'
}

function itemCategoryLabel(item: HydratedSessionItem): string {
  if (item.course_puzzle) {
    if (item.course_puzzle.domain === 'EXAMS' && item.status === 'pending') {
      return `Экзамен · Батч #${item.course_puzzle.batch_id}`
    }
    return cachedScopeLabel(item.course_puzzle.class)
  }
  if (item.tactical) {
    const firstMotif =
      item.tactical.geometry_motifs[0] ??
      item.tactical.operator_motifs[0] ??
      item.tactical.concept_motifs[0] ??
      item.tactical.trigger_motifs[0] ??
      item.tactical.cognitive_profile
    return cachedScopeLabel(firstMotif)
  }
  if (item.endgame) {
    return cachedScopeLabel(item.endgame.class)
  }
  return item.puzzle_id
}

function itemObjective(item: HydratedSessionItem): 'win' | 'hold_draw' {
  if (item.course_puzzle) {
    if (item.course_puzzle.domain === 'EXAMS' && item.status === 'pending') {
      return 'win'
    }
    return item.course_puzzle.objective
  }
  return item.endgame?.objective ?? 'win'
}

function formatDelta(delta?: number): string {
  if (delta === undefined) return ''
  const rounded = Math.round(delta * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

function handleItemClick(item: HydratedSessionItem): void {
  if (store.isAnalysisMode || item.status !== 'pending') {
    store.enterPuzzleAnalysis(item.puzzle_id, true)
  }
}
</script>

<template>
  <div
    class="h-full flex flex-col gap-3 p-3 bg-surface border-r border-border text-text-primary select-none overflow-hidden"
  >
    <!-- Session Header -->
    <div v-if="summary" class="flex flex-col gap-2 pb-2 border-b border-border shrink-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-display font-bold text-sm uppercase tracking-wider text-text-primary truncate">
          {{ disciplineLabel }}
        </span>
        <span
          class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-elevated border border-border text-text-primary"
        >
          <template v-if="summary.discipline === 'tactics_course'">
            {{
              summary.mode === 'crashtest'
                ? 'КРЭШ-ТЕСТ'
                : t('features.trainingCenter.modes.courseBadge')
            }}
          </template>
          <template v-else>
            {{
              summary.mode === 'course'
                ? t('features.trainingCenter.modes.courseBadge')
                : t('features.trainingCenter.modes.warmupBadge')
            }}
            · {{ difficultyLabel }}
          </template>
        </span>
      </div>

      <div class="flex items-center justify-between text-xs text-text-secondary">
        <span v-if="summary.discipline === 'tactics_course'">Режим: BlunderSpy</span>
        <span v-else>{{ t('features.trainingCenter.sidebar.sparringBot') }}: {{ botName }}</span>
        <span class="font-condensed font-bold text-text-primary">
          {{ completedCount }} / {{ store.sessionItems.length }} ({{ progressPercent }}%)
        </span>
      </div>

      <div class="w-full h-1.5 rounded-sm bg-elevated overflow-hidden border border-border/60">
        <div
          class="h-full bg-brand transition-all duration-300"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>

    <!-- Post-Attempt Feedback Banner (Error / Inspection State Only) -->
    <div
      v-if="store.isAwaitingNext && store.lastAttemptResult && !store.lastAttemptResult.solved"
      class="p-3 rounded-md border flex flex-col gap-2 shrink-0"
      :class="
        store.lastAttemptResult.solved
          ? 'bg-success/10 border-success/40'
          : 'bg-danger/10 border-danger/40'
      "
    >
      <div class="flex items-center justify-between">
        <span
          class="font-display font-bold text-xs uppercase tracking-wider"
          :class="store.lastAttemptResult.solved ? 'text-success' : 'text-danger'"
        >
          {{
            store.lastAttemptResult.solved
              ? t('features.trainingCenter.play.attemptSolved')
              : t('features.trainingCenter.play.attemptFailed')
          }}
        </span>
        <span
          class="font-condensed font-bold text-sm"
          :class="store.lastAttemptResult.solved ? 'text-success' : 'text-danger'"
        >
          {{ Math.round(store.lastAttemptResult.global_rating_after) }}
          ({{ formatDelta(store.lastAttemptResult.global_rating_delta) }})
        </span>
      </div>

      <!-- Woodpecker Feedback -->
      <div
        v-if="store.lastAttemptResult.woodpecker.action !== 'none'"
        class="text-[11px] text-text-secondary flex items-center justify-between bg-surface/70 px-2 py-1 rounded-sm border border-border"
      >
        <span>{{ t('features.trainingCenter.woodpecker.title') }}</span>
        <span class="font-condensed font-bold text-accent">
          {{
            t(
              `features.trainingCenter.woodpecker.actions.${store.lastAttemptResult.woodpecker.action}`,
              { streak: store.lastAttemptResult.woodpecker.streak },
            )
          }}
        </span>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1">
        <NButton size="small" secondary @click="store.enterPuzzleAnalysis()">
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
        <NButton size="small" type="primary" @click="store.advanceAfterAttempt()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.nextPuzzle') }}
        </NButton>
      </div>
    </div>

    <!-- Puzzle Queue List -->
    <div class="flex-1 flex flex-col min-h-0 border border-border rounded-md bg-elevated/30 overflow-hidden">
      <div class="px-3 py-1.5 bg-elevated/80 border-b border-border flex items-center justify-between">
        <span class="font-display font-bold text-[11px] uppercase tracking-wider text-text-secondary">
          {{ t('features.trainingCenter.sidebar.queueTitle') }}
          <template v-if="isWindowedQueue">
            (#{{ visibleWindowRange.start + 1 }}–{{ visibleWindowRange.end }})
          </template>
        </span>
        <span class="font-condensed text-xs text-text-secondary">
          {{
            t('features.trainingCenter.sidebar.solvedRatio', {
              solved: summary?.solved_count ?? store.sessionReportSummary?.solvedCount ?? 0,
              total: summary?.total_count ?? store.sessionItems.length,
            })
          }}
        </span>
      </div>

      <NScrollbar class="flex-1">
        <div class="divide-y divide-border/50">
          <div
            v-for="item in visibleSessionItems"
            :key="item.puzzle_id"
            class="flex items-center justify-between px-2.5 py-2 text-xs transition-colors"
            :class="[
              item.index === store.currentItemIndex && !store.isAnalysisMode
                ? 'bg-elevated border-l-2 border-l-brand'
                : '',
              store.isAnalysisMode && store.analysisPuzzle?.puzzle_id === item.puzzle_id
                ? 'bg-accent/15 border-l-2 border-l-accent'
                : '',
              item.status === 'solved' ? 'bg-success/5 border-l-2 border-l-success' : '',
              item.status === 'failed' ? 'bg-danger/5 border-l-2 border-l-danger' : '',
              item.status !== 'pending' || store.isAnalysisMode
                ? 'cursor-pointer hover:bg-elevated/70'
                : '',
            ]"
            @click="handleItemClick(item)"
          >
            <!-- Left: Status Icon + Category + Badges -->
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span
                class="w-5 h-5 rounded-sm flex items-center justify-center font-condensed font-bold text-[11px] shrink-0 border"
                :class="[
                  item.status === 'solved'
                    ? 'bg-success/15 text-success border-success/40'
                    : item.status === 'failed'
                      ? 'bg-danger/15 text-danger border-danger/40'
                      : item.index === store.currentItemIndex
                        ? 'bg-brand text-on-brand border-brand'
                        : 'bg-elevated text-text-secondary border-border',
                ]"
              >
                <NIcon v-if="item.status === 'solved'" size="12"><CheckmarkOutline /></NIcon>
                <NIcon v-else-if="item.status === 'failed'" size="12"><CloseOutline /></NIcon>
                <template v-else>{{ item.index + 1 }}</template>
              </span>

              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="truncate text-text-primary font-medium">
                    {{ itemCategoryLabel(item) }}
                  </span>
                  <span
                    v-if="itemObjective(item) === 'hold_draw'"
                    class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40 shrink-0"
                  >
                    DRAW
                  </span>
                  <span
                    v-if="item.is_woodpecker"
                    class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40 shrink-0"
                  >
                    WP {{ item.woodpecker_streak }}/3
                  </span>
                </div>
                <span class="font-condensed text-[11px] text-text-secondary">
                  {{ itemMetaSubtitle(item) }}
                </span>
              </div>
            </div>

            <!-- Right: Rating Delta + Time -->
            <div class="flex items-center gap-2 shrink-0 ml-2">
              <span
                v-if="item.rating_delta !== undefined"
                class="font-condensed font-bold text-[11px]"
                :class="item.rating_delta >= 0 ? 'text-success' : 'text-danger'"
              >
                {{ formatDelta(item.rating_delta) }}
              </span>
              <span class="font-condensed text-[11px] text-text-secondary min-w-12 text-right">
                {{ item.time_ms ? store.formatDurationMs(item.time_ms) : '--:--.-' }}
              </span>
            </div>
          </div>
        </div>
      </NScrollbar>
    </div>

    <!-- Footer Controls -->
    <div class="mt-auto pt-2 border-t border-border flex flex-col gap-2 shrink-0">
      <div
        v-if="store.sessionReportSummary"
        class="grid grid-cols-3 gap-1.5 p-2 rounded-md bg-elevated/70 border border-border text-center"
      >
        <div>
          <div class="text-[10px] text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.accuracy') }}
          </div>
          <div class="font-condensed font-bold text-sm text-text-primary">
            {{ store.sessionReportSummary.accuracyPercent }}%
          </div>
        </div>
        <div>
          <div class="text-[10px] text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.netDelta') }}
          </div>
          <div
            class="font-condensed font-bold text-sm"
            :class="
              store.sessionReportSummary.netGlobalRatingDelta >= 0 ? 'text-success' : 'text-danger'
            "
          >
            {{ formatDelta(store.sessionReportSummary.netGlobalRatingDelta) }}
          </div>
        </div>
        <div>
          <div class="text-[10px] text-text-secondary uppercase">
            {{ t('features.trainingCenter.report.totalTime') }}
          </div>
          <div class="font-condensed font-bold text-sm text-warning">
            {{ store.formatDurationMs(store.sessionReportSummary.totalTimeMs) }}
          </div>
        </div>
      </div>

      <NButton
        v-if="summary?.mode === 'crashtest'"
        block
        size="small"
        secondary
        type="info"
        @click="downloadCrashTestReport()"
      >
        <template #icon>
          <NIcon><DownloadOutline /></NIcon>
        </template>
        Скачать craschTestReport.json ({{ anomaliesCount }})
      </NButton>

      <NButton
        v-if="store.isAnalysisMode"
        block
        size="small"
        type="primary"
        @click="store.exitPuzzleAnalysis()"
      >
        {{ t('features.trainingCenter.actions.continueSession') }}
      </NButton>
      <NButton v-else block size="small" secondary @click="store.pauseToHub()">
        <template #icon>
          <NIcon><PauseOutline /></NIcon>
        </template>
        {{ t('features.trainingCenter.actions.pauseToHub') }}
      </NButton>
    </div>
  </div>
</template>

