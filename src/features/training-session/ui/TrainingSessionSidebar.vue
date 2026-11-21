<script setup lang="ts">
import {
  isClassicalCourseDiscipline,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  resolveTwinBadgeLabel,
  resolveTwinPedagogicalPrompt,
} from '@/entities/training'
import {
  ArrowForwardOutline,
  DownloadOutline,
  EyeOutline,
  PauseOutline,
  PlayOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NScrollbar } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadCrashTestReport, useCrashTestReport } from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import TrainingSessionQueueItem from './TrainingSessionQueueItem.vue'

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

const activeHeaderItem = computed(() => {
  const inspectedId = store.isAnalysisMode
    ? store.analysisPuzzle?.puzzle_id
    : store.isPracticeReplay
      ? store.practicePuzzle?.puzzle_id
      : undefined
  if (inspectedId) {
    const matched = store.sessionItems.find((it) => it.puzzle_id === inspectedId)
    if (matched) return matched
  }
  return store.currentItem
})

const activePuzzleHeader = computed<{ title: string; meta: string } | null>(() => {
  const it = activeHeaderItem.value
  if (!it) return null
  if (it.course_puzzle) {
    const hideExamSpoiler =
      it.course_puzzle.domain === 'EXAMS' && it.status === 'pending' && !store.isAnalysisMode
    return {
      title: hideExamSpoiler
        ? `Экзамен · Батч #${it.course_puzzle.batch_id}`
        : resolveScopeLabel('scopes', it.course_puzzle.class || 'mixedExam', t, te),
      meta: `Курс ${it.course_puzzle.course_id || 1} · Батч #${it.course_puzzle.batch_id}`,
    }
  }
  if (it.tactical) {
    return {
      title: resolveScopeLabel('scopes', it.tactical.primary_motif, t, te),
      meta: `R: ${it.tactical.rating}`,
    }
  }
  if (it.endgame) {
    return {
      title: resolveScopeLabel('scopes', it.endgame.class, t, te),
      meta: `R: ${it.endgame.effective_rating}`,
    }
  }
  return null
})

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

const isInspectionActive = computed(() => store.isAnalysisMode || store.isPracticeReplay)

const activeTwinBanner = computed(() => {
  const p = store.analysisPuzzle ?? store.practicePuzzle ?? store.currentPuzzle
  if (!p?.twin_role) return null
  if (p.is_exam && !store.isAnalysisMode) return null
  const badge = resolveTwinBadgeLabel(p.twin_role)
  const prompt = resolveTwinPedagogicalPrompt(p.twin_role)
  if (!badge || !prompt) return null
  const isPart2 = p.twin_role.startsWith('part_2_')
  return {
    badge,
    prompt,
    isPart2,
  }
})

function formatDelta(delta?: number): string {
  if (delta === undefined) return ''
  const rounded = Math.round(delta * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

function handleItemSelect(puzzleId: string): void {
  store.enterPuzzleAnalysis(puzzleId, true)
}
</script>

<template>
  <div
    class="h-full flex flex-col gap-2 sm:gap-3 p-2 sm:p-3 bg-surface text-text-primary select-none overflow-hidden"
  >
    <!-- Session Header -->
    <div v-if="summary" class="flex flex-col gap-2 pb-2 border-b border-border shrink-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-display font-bold text-sm uppercase tracking-wider text-text-primary truncate">
          {{ disciplineLabel }}
        </span>
        <span
          class="px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase bg-elevated border border-border text-text-primary shrink-0"
        >
          <template v-if="isClassicalCourseDiscipline(summary.discipline)">
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

      <div class="flex items-baseline justify-between gap-2 text-xs min-w-0">
        <div v-if="activePuzzleHeader" class="flex items-baseline gap-1.5 min-w-0">
          <span class="font-medium text-text-primary truncate">
            {{ activePuzzleHeader.title }}
          </span>
          <span
            v-if="activePuzzleHeader.meta"
            class="font-condensed text-[11px] text-text-secondary shrink-0"
          >
            {{ activePuzzleHeader.meta }}
          </span>
        </div>
        <span v-else class="text-text-secondary truncate">
          #{{ store.currentItemIndex + 1 }}
        </span>
        <span class="font-condensed font-bold text-text-primary shrink-0">
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

    <!-- Golden Twin Pedagogical Banner -->
    <div
      v-if="activeTwinBanner"
      class="p-2.5 rounded-md border flex flex-col gap-1 shrink-0"
      :class="
        activeTwinBanner.isPart2
          ? 'bg-warning/10 border-warning/40'
          : 'bg-accent/10 border-accent/40'
      "
    >
      <div class="flex items-center justify-between gap-2">
        <span
          class="px-1.5 py-0.2 rounded-sm text-[10px] font-condensed font-bold uppercase tracking-wider border"
          :class="
            activeTwinBanner.isPart2
              ? 'bg-warning/20 text-warning border-warning/50'
              : 'bg-accent/20 text-accent border-accent/50'
          "
        >
          {{ activeTwinBanner.badge }}
        </span>
        <span class="text-[10px] font-condensed text-text-secondary">
          Смена очереди хода
        </span>
      </div>
      <p class="text-xs text-text-primary leading-snug">
        {{ activeTwinBanner.prompt }}
      </p>
    </div>

    <!-- Practice Replay Banner (Sandbox Mode without rating impact) -->
    <div
      v-if="store.isPracticeReplay"
      class="p-3 rounded-md border flex flex-col gap-2 shrink-0"
      :class="
        store.practiceFeedbackState === 'solved'
          ? 'bg-success/10 border-success/40'
          : store.practiceFeedbackState === 'failed'
            ? 'bg-danger/10 border-danger/40'
            : 'bg-accent/10 border-accent/40'
      "
    >
      <div class="flex items-center justify-between gap-2">
        <span
          class="font-display font-bold text-xs uppercase tracking-wider"
          :class="
            store.practiceFeedbackState === 'solved'
              ? 'text-success'
              : store.practiceFeedbackState === 'failed'
                ? 'text-danger'
                : 'text-accent'
          "
        >
          {{ t('features.trainingCenter.badges.practiceBadge') }}
        </span>
      </div>
      <p class="text-[11px] text-text-secondary leading-snug">
        {{
          store.practiceFeedbackState === 'solved'
            ? t('features.trainingCenter.play.practiceSolved')
            : store.practiceFeedbackState === 'failed'
              ? t('features.trainingCenter.play.practiceFailed')
              : t('features.trainingCenter.play.practiceModeHint')
        }}
      </p>
      <div class="grid grid-cols-2 gap-2 pt-0.5">
        <NButton
          size="small"
          secondary
          class="min-w-0 overflow-hidden"
          @click="store.restartCurrentPuzzle()"
        >
          <template #icon>
            <NIcon class="shrink-0"><RefreshOutline /></NIcon>
          </template>
          <span class="truncate">{{ t('features.trainingCenter.actions.restartPuzzle') }}</span>
        </NButton>
        <NButton
          size="small"
          secondary
          class="min-w-0 overflow-hidden"
          @click="store.enterPuzzleAnalysis(store.practicePuzzle?.puzzle_id, true)"
        >
          <template #icon>
            <NIcon class="shrink-0"><EyeOutline /></NIcon>
          </template>
          <span class="truncate">{{ t('features.trainingCenter.actions.analyze') }}</span>
        </NButton>
      </div>
    </div>

    <!-- Post-Attempt Feedback Banner (Error / Inspection State Only) -->
    <div
      v-else-if="store.isAwaitingNext && store.lastAttemptResult && !store.lastAttemptResult.solved"
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
        <NButton
          size="small"
          secondary
          class="min-w-0 overflow-hidden"
          @click="store.enterPuzzleAnalysis()"
        >
          <template #icon>
            <NIcon class="shrink-0"><EyeOutline /></NIcon>
          </template>
          <span class="truncate">{{ t('features.trainingCenter.actions.analyze') }}</span>
        </NButton>
        <NButton
          size="small"
          type="primary"
          class="min-w-0 overflow-hidden"
          @click="store.advanceAfterAttempt()"
        >
          <template #icon>
            <NIcon class="shrink-0"><ArrowForwardOutline /></NIcon>
          </template>
          <span class="truncate">{{ t('features.trainingCenter.actions.nextPuzzle') }}</span>
        </NButton>
      </div>
      <NButton block size="tiny" secondary @click="store.startPracticeReplay()">
        <template #icon>
          <NIcon><PlayOutline /></NIcon>
        </template>
        {{ t('features.trainingCenter.actions.practiceReplayFull') }}
      </NButton>
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
          <TrainingSessionQueueItem
            v-for="item in visibleSessionItems"
            :key="item.index"
            :item="item"
            :is-current="item.index === store.currentItemIndex"
            :is-inspection-active="isInspectionActive"
            :is-inspecting-this="
              Boolean(
                item.puzzle_id &&
                  ((store.isAnalysisMode && store.analysisPuzzle?.puzzle_id === item.puzzle_id) ||
                    (store.isPracticeReplay && store.practicePuzzle?.puzzle_id === item.puzzle_id)),
              )
            "
            :can-switch-sidebar-item="store.canSwitchSidebarItem"
            :format-duration-ms="store.formatDurationMs"
            @select="handleItemSelect"
          />
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

      <template v-if="store.isAnalysisMode">
        <NButton
          block
          size="small"
          secondary
          @click="store.startPracticeReplay(store.analysisPuzzle?.puzzle_id)"
        >
          <template #icon>
            <NIcon><PlayOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.practiceReplayFull') }}
        </NButton>
        <NButton
          block
          size="small"
          type="primary"
          @click="store.exitPuzzleAnalysis()"
        >
          {{ t('features.trainingCenter.actions.continueSession') }}
        </NButton>
      </template>
      <NButton
        v-else-if="store.isPracticeReplay"
        block
        size="small"
        type="primary"
        @click="store.exitPracticeReplay()"
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

