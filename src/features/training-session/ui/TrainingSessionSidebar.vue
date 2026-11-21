<script setup lang="ts">
import {
  isClassicalCourseDiscipline,
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  type PuzzleVoteValue,
} from '@/entities/training'
import { DownloadOutline, PauseOutline, PlayOutline } from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadCrashTestReport, useCrashTestReport } from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import TrainingSessionFeedbackBanners from './TrainingSessionFeedbackBanners.vue'
import TrainingSessionQueueItem from './TrainingSessionQueueItem.vue'

const { t, te } = useI18n()
const store = useTrainingSessionStore()
const { anomaliesCount } = useCrashTestReport()

const scrollViewportRef = ref<HTMLElement | null>(null)
const queueListRef = ref<HTMLElement | null>(null)
const viewportHeightPx = ref(0)

let resizeObserver: ResizeObserver | null = null

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

// Bottom spacer allows the last 2 items (previous + current) to anchor cleanly at Row 1 & Row 2
// even in short 10-puzzle WarmUps or near the end of a 50-puzzle batch.
const bottomSpacerPx = computed(() => {
  if (store.currentItemIndex <= 0 || viewportHeightPx.value <= 104) return 0
  return Math.max(0, viewportHeightPx.value - 104)
})

const isInspectionActive = computed(() => store.isAnalysisMode || store.isPracticeReplay)

function scrollToLastCompletedItem(smooth: boolean): void {
  const viewport = scrollViewportRef.value
  const listEl = queueListRef.value
  if (!viewport || !listEl) return

  const items = store.sessionItems
  if (items.length === 0) return

  // Row 1 = previous (last completed) puzzle; Row 2 = current unsolved puzzle.
  let targetIndex = Math.max(0, store.currentItemIndex - 1)
  if (store.currentItemIndex >= items.length) {
    targetIndex = items.length - 1
  }

  const targetEl = listEl.querySelector<HTMLElement>(`[data-queue-index="${targetIndex}"]`)
  if (!targetEl) return

  const targetTop = targetEl.offsetTop
  if (typeof viewport.scrollTo === 'function') {
    viewport.scrollTo({
      top: targetTop,
      behavior: smooth ? 'smooth' : 'auto',
    })
  } else {
    viewport.scrollTop = targetTop
  }
}

onMounted(() => {
  const el = scrollViewportRef.value
  if (el) {
    viewportHeightPx.value = el.clientHeight
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (entry) {
          viewportHeightPx.value = Math.round(entry.contentRect.height)
        }
      })
      resizeObserver.observe(el)
    }
  }
  void nextTick(() => scrollToLastCompletedItem(false))
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  [() => store.currentItemIndex, () => store.hydratedSession?.session.id],
  async ([, newSessId], [, oldSessId]) => {
    await nextTick()
    scrollToLastCompletedItem(Boolean(oldSessId && newSessId === oldSessId))
  },
)

function formatDelta(delta?: number): string {
  if (delta === undefined) return ''
  const rounded = Math.round(delta * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

function handleItemSelect(puzzleId: string): void {
  store.enterPuzzleAnalysis(puzzleId, true)
}

function handleItemVote(puzzleId: string, nextVote: PuzzleVoteValue): void {
  void store.voteSessionItem(puzzleId, nextVote)
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
          <template v-else-if="summary.focus_group === 'woodpecker'">
            {{ t('features.trainingCenter.woodpecker.batchBadge') }}
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

    <TrainingSessionFeedbackBanners />

    <!-- Puzzle Queue List -->
    <div class="queue-box flex flex-col border border-border rounded-md bg-elevated/30 overflow-hidden">
      <div class="px-3 py-1.5 bg-elevated/80 border-b border-border flex items-center justify-between shrink-0">
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

      <div ref="scrollViewportRef" class="queue-scroll-viewport overflow-y-auto overscroll-contain">
        <div ref="queueListRef" class="relative divide-y divide-border/50">
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
            @vote="handleItemVote"
          />
          <div
            v-if="bottomSpacerPx > 0"
            :style="{ height: `${bottomSpacerPx}px` }"
            class="border-t-0 pointer-events-none"
            aria-hidden="true"
          />
        </div>
      </div>
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

<style scoped>
.queue-box {
  flex: 1 1 0%;
  min-height: 0;
}

.queue-scroll-viewport {
  flex: 1 1 0%;
  min-height: 0;
  scrollbar-width: thin;
}

/* Matches GameLayout.vue portrait / mobile shell where .left-panel has height: auto */
@media (max-width: 899px), (orientation: portrait) {
  .queue-box {
    flex: none;
  }

  .queue-scroll-viewport {
    flex: none;
    height: 212px;
    max-height: 212px;
  }
}
</style>
