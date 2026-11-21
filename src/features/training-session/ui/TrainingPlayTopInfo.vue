<script setup lang="ts">
import {
  isClassicalCourseDiscipline,
  resolveDisciplineLabel,
  resolveScopeLabel,
  resolveTwinBadgeLabel,
  resolveTwinPedagogicalPrompt,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import {
  ArrowForwardOutline,
  CloseCircleOutline,
  CloseOutline,
  DownloadOutline,
  EyeOutline,
  PlayOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadCrashTestReport, useCrashTestReport } from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'
import TrainingPuzzleFlagPopover from './TrainingPuzzleFlagPopover.vue'

const { t, te } = useI18n()
const authStore = useAuthStore()
const store = useTrainingSessionStore()
const { anomaliesCount } = useCrashTestReport()

const activePuzzle = computed(
  () => store.analysisPuzzle ?? store.practicePuzzle ?? store.currentPuzzle,
)

const formattedTimer = computed(() => store.formatDurationMs(store.currentTimeMs))

const isTacticsCourse = computed(() => {
  const disc = store.activeSessionSummary?.discipline ?? store.activeDiscipline
  const pt = activePuzzle.value?.puzzle_type
  return (
    isClassicalCourseDiscipline(disc) ||
    pt === 'tactics_course' ||
    pt === 'endgame_course'
  )
})

const isExamPuzzle = computed(() => {
  const p = activePuzzle.value
  return Boolean(p?.is_exam || p?.domain === 'EXAMS')
})

const disciplineTitle = computed(() => {
  const p = activePuzzle.value
  if (isTacticsCourse.value && p?.batch_id) {
    return `Батч #${p.batch_id}`
  }
  const disc = store.activeSessionSummary?.discipline ?? store.activeDiscipline
  return resolveDisciplineLabel(disc, t)
})

const categoryTitle = computed(() => {
  const p = activePuzzle.value
  if (!p) return ''
  if (isExamPuzzle.value && !store.isAnalysisMode) {
    return 'Как бы вы сыграли?'
  }
  if (isTacticsCourse.value && p.batch_title) {
    return p.batch_title
  }
  return resolveScopeLabel('scopes', p.category, t, te)
})

const isHoldDraw = computed(() => activePuzzle.value?.objective === 'hold_draw')

const twinBadgeLabel = computed(() => {
  if (isExamPuzzle.value && !store.isAnalysisMode) return ''
  return resolveTwinBadgeLabel(activePuzzle.value?.twin_role)
})

const twinPrompt = computed(() => {
  if (isExamPuzzle.value && !store.isAnalysisMode) return ''
  return resolveTwinPedagogicalPrompt(activePuzzle.value?.twin_role)
})

async function handleFlagSubmit(reason: string): Promise<void> {
  if (!authStore.isDeveloper) return
  await store.flagCurrentCoursePuzzle(reason)
}

const deltaText = computed(() => {
  const res = store.lastAttemptResult
  if (!res) return ''
  const val = Math.round(res.global_rating_delta * 10) / 10
  return val >= 0 ? `+${val}` : `${val}`
})

const isCrashtestSession = computed(() => store.activeSessionSummary?.mode === 'crashtest')

const isPostAttemptDecision = computed(
  () => Boolean(store.isAwaitingNext && store.lastAttemptResult && !store.lastAttemptResult.solved),
)

const showLivePlayMeta = computed(
  () => !store.isAnalysisMode && !store.isPracticeReplay && !isPostAttemptDecision.value,
)

const showAttemptBadge = computed(
  () =>
    !isCrashtestSession.value &&
    (store.isPlaying || store.isAwaitingRetry) &&
    store.currentItem?.status === 'pending',
)

function handleBackAction(): void {
  if (store.isAnalysisMode) {
    store.exitPuzzleAnalysis()
    return
  }
  if (store.isPracticeReplay) {
    store.exitPracticeReplay()
    return
  }
  store.pauseToHub()
}
</script>

<template>
  <div
    v-if="activePuzzle"
    class="w-full h-11 px-2.5 sm:px-3 rounded-lg bg-surface border border-border flex items-center justify-between gap-1.5 sm:gap-2 select-none overflow-hidden"
  >
    <!-- Left: Pause / Return to Hub or Exit Analysis -->
    <div class="flex items-center gap-2 shrink-0">
      <NButton
        circle
        quaternary
        size="small"
        type="error"
        :title="
          store.isAnalysisMode || store.isPracticeReplay
            ? t('features.trainingCenter.actions.continueSession')
            : t('features.trainingCenter.actions.pauseToHub')
        "
        :aria-label="
          store.isAnalysisMode || store.isPracticeReplay
            ? t('features.trainingCenter.actions.continueSession')
            : t('features.trainingCenter.actions.pauseToHub')
        "
        @click="handleBackAction"
      >
        <template #icon>
          <NIcon><CloseCircleOutline /></NIcon>
        </template>
      </NButton>

      <div class="hidden sm:flex items-center gap-1.5 text-xs">
        <span class="font-display font-bold uppercase tracking-wider text-text-primary">
          {{ disciplineTitle }}
        </span>
        <span v-if="categoryTitle" class="text-text-secondary">·</span>
        <span v-if="categoryTitle" class="text-text-secondary truncate max-w-36">
          {{ categoryTitle }}
        </span>
      </div>
    </div>

    <!-- Center: Objective Badge + Woodpecker + Bot + Timer -->
    <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
      <!-- Analysis Badge -->
      <span
        v-if="store.isAnalysisMode"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40 whitespace-nowrap shrink-0"
      >
        {{ t('features.trainingCenter.badges.analysis') }}
      </span>

      <!-- Practice Replay Badge -->
      <span
        v-else-if="store.isPracticeReplay"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-success/15 text-success border border-success/40 whitespace-nowrap shrink-0"
      >
        {{ t('features.trainingCenter.badges.practiceBadge') }}
      </span>

      <!-- Live Play Objective Badges (hidden after resign/fail to prevent mobile bar overflow) -->
      <template v-else-if="showLivePlayMeta">
        <!-- Exam Mode Badge (No Theme or Objective Spoilers) -->
        <span
          v-if="isExamPuzzle"
          class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40 truncate max-w-44 sm:max-w-none"
          :class="{ 'hidden sm:inline-flex': store.isAwaitingRetry }"
        >
          ЭКЗАМЕН · НАЙДИТЕ СИЛЬНЕЙШЕЕ ПРОДОЛЖЕНИЕ
        </span>

        <!-- Objective Badge: Hold Draw (FIDE) vs Win -->
        <span
          v-else-if="isHoldDraw"
          class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-warning/15 text-warning border border-warning/50 whitespace-nowrap shrink-0"
          :class="{ 'hidden sm:inline-flex': store.isAwaitingRetry }"
        >
          {{ t('features.trainingCenter.badges.holdDrawFide') }}
        </span>
        <span
          v-else
          class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/40 whitespace-nowrap shrink-0"
          :class="{ 'hidden sm:inline-flex': store.isAwaitingRetry }"
        >
          {{ t('features.trainingCenter.badges.winTarget') }}
        </span>
      </template>

      <!-- Attempt Counter Badge (#1, #2, ...) -->
      <span
        v-if="showAttemptBadge"
        class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold border whitespace-nowrap shrink-0"
        :class="
          store.isAwaitingRetry
            ? 'bg-danger/15 text-danger border-danger/40'
            : store.displayAttemptNumber > 1
              ? 'bg-warning/15 text-warning border-warning/40'
              : 'bg-elevated text-text-secondary border-border'
        "
      >
        {{
          t('features.trainingCenter.badges.attemptCounter', {
            current: store.displayAttemptNumber,
          })
        }}
      </span>

      <!-- Golden Twin Badge -->
      <span
        v-if="twinBadgeLabel && showLivePlayMeta"
        :title="twinPrompt"
        class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40 cursor-help whitespace-nowrap shrink-0"
      >
        {{ twinBadgeLabel }}
      </span>

      <!-- Woodpecker Badge -->
      <span
        v-if="activePuzzle.is_woodpecker && showLivePlayMeta"
        class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold bg-accent/15 text-accent border border-accent/40 whitespace-nowrap shrink-0"
      >
        {{
          t('features.trainingCenter.badges.woodpeckerStreak', {
            streak: activePuzzle.woodpecker_streak ?? 0,
          })
        }}
      </span>

      <!-- Timer (hidden during analysis, practice replay, post-attempt decision, and mobile retry prompt) -->
      <span
        v-if="showLivePlayMeta"
        class="font-condensed font-bold text-base text-warning min-w-14 sm:min-w-16 text-right whitespace-nowrap shrink-0"
        :class="{ 'hidden sm:inline': store.isAwaitingRetry }"
      >
        {{ formattedTimer }}
      </span>
    </div>

    <!-- Right: Post-Attempt Actions / Analysis Controls / Flag Button -->
    <div class="flex items-center gap-1.5 shrink-0">
      <NButton
        v-if="authStore.isDeveloper && store.activeSessionSummary?.mode === 'crashtest'"
        size="tiny"
        secondary
        type="info"
        title="Скачать отчёт крэш-теста craschTestReport.json"
        @click="downloadCrashTestReport()"
      >
        <template #icon>
          <NIcon><DownloadOutline /></NIcon>
        </template>
        Отчёт ({{ anomaliesCount }})
      </NButton>

      <TrainingPuzzleFlagPopover
        v-if="authStore.isDeveloper && isTacticsCourse && !store.isAnalysisMode && !store.isPracticeReplay"
        :puzzle-id="activePuzzle.puzzle_id"
        :loading="store.isFlaggingPuzzle"
        @submit="handleFlagSubmit"
      />

      <!-- Retry Prompt Controls (Attempt 1/3 or 2/3 failed, engine locked) -->
      <template v-if="store.isAwaitingRetry">
        <NButton
          size="tiny"
          type="warning"
          :disabled="!store.canRestartCurrentPuzzle"
          :loading="store.isPersistingRetry"
          @click="store.restartCurrentPuzzle()"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{
            t('features.trainingCenter.actions.restartAttempt', {
              current: store.currentAttemptNumber,
            })
          }}
        </NButton>

        <NButton
          size="tiny"
          secondary
          type="error"
          :disabled="!store.canResignCurrentPuzzle"
          :loading="store.isSubmittingAttempt"
          @click="store.resignCurrentPuzzle()"
        >
          <template #icon>
            <NIcon><CloseOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.resignToAnalyze') }}
        </NButton>
      </template>

      <!-- Finalized Failed / Resigned Controls -->
      <template v-else-if="store.isAwaitingNext && store.lastAttemptResult && !store.lastAttemptResult.solved">
        <span
          class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-sm font-condensed font-bold text-xs border"
          :class="
            store.lastAttemptResult.solved
              ? 'bg-success/15 text-success border-success/40'
              : 'bg-danger/15 text-danger border-danger/40'
          "
        >
          {{
            store.lastAttemptResult.solved
              ? t('features.trainingCenter.play.solvedShort')
              : t('features.trainingCenter.play.failedShort')
          }}
          {{ deltaText }}
        </span>

        <NButton size="tiny" secondary @click="store.enterPuzzleAnalysis()">
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>

        <NButton size="tiny" secondary @click="store.startPracticeReplay()">
          <template #icon>
            <NIcon><PlayOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.practiceReplay') }}
        </NButton>

        <NButton size="tiny" type="primary" @click="store.advanceAfterAttempt()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.nextPuzzle') }}
        </NButton>
      </template>

      <!-- Analysis Controls -->
      <template v-else-if="store.isAnalysisMode">
        <NButton
          size="tiny"
          secondary
          @click="store.startPracticeReplay(store.analysisPuzzle?.puzzle_id)"
        >
          <template #icon>
            <NIcon><PlayOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.practiceReplayFull') }}
        </NButton>

        <NButton size="tiny" type="primary" @click="store.exitPuzzleAnalysis()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.continueSession') }}
        </NButton>
      </template>

      <!-- Practice Replay Controls (Sandbox without rating impact) -->
      <template v-else-if="store.isPracticeReplay">
        <NButton
          size="tiny"
          secondary
          :title="t('features.trainingCenter.actions.restartPuzzle')"
          @click="store.restartCurrentPuzzle()"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          <span class="hidden sm:inline">{{ t('features.trainingCenter.actions.restartPuzzle') }}</span>
        </NButton>

        <NButton
          size="tiny"
          secondary
          :title="t('features.trainingCenter.actions.analyze')"
          @click="store.enterPuzzleAnalysis(store.practicePuzzle?.puzzle_id, true)"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          <span class="hidden sm:inline">{{ t('features.trainingCenter.actions.analyze') }}</span>
        </NButton>

        <NButton size="tiny" type="primary" @click="store.exitPracticeReplay()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.continueSession') }}
        </NButton>
      </template>

      <!-- Active Play Controls (Restart & Resign + Queue Counter) -->
      <template v-else>
        <template v-if="!isCrashtestSession && store.currentItem?.status === 'pending'">
          <NButton
            size="tiny"
            secondary
            :disabled="!store.canRestartCurrentPuzzle"
            :loading="store.isPersistingRetry"
            :title="t('features.trainingCenter.actions.restartPuzzle')"
            @click="store.restartCurrentPuzzle()"
          >
            <template #icon>
              <NIcon><RefreshOutline /></NIcon>
            </template>
            <span class="hidden md:inline">{{ t('features.trainingCenter.actions.restartPuzzle') }}</span>
          </NButton>

          <NButton
            size="tiny"
            quaternary
            type="error"
            :disabled="!store.canResignCurrentPuzzle"
            :loading="store.isSubmittingAttempt"
            :title="t('features.trainingCenter.actions.resignPuzzle')"
            @click="store.resignCurrentPuzzle()"
          >
            <template #icon>
              <NIcon><CloseOutline /></NIcon>
            </template>
            <span class="hidden md:inline">{{ t('features.trainingCenter.actions.resignPuzzle') }}</span>
          </NButton>
        </template>

        <span
          class="font-condensed text-xs text-text-secondary px-1.5 py-0.5 rounded-sm bg-elevated border border-border"
        >
          #{{ store.currentItemIndex + 1 }}/{{ store.sessionItems.length }}
        </span>
      </template>
    </div>
  </div>
</template>

