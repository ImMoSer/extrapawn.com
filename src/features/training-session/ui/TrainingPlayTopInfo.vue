<script setup lang="ts">
import {
  isClassicalCourseDiscipline,
  resolveDisciplineLabel,
  resolveScopeLabel,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import {
  ArrowForwardOutline,
  CloseCircleOutline,
  DownloadOutline,
  EyeOutline,
  FlagOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon, NInput, NPopover } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { downloadCrashTestReport, useCrashTestReport } from '../lib/crashTestReportLogger'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t, te } = useI18n()
const authStore = useAuthStore()
const store = useTrainingSessionStore()
const { anomaliesCount } = useCrashTestReport()

const showFlagPopover = ref<boolean>(false)
const flagComment = ref<string>('')

const activePuzzle = computed(() => store.analysisPuzzle ?? store.currentPuzzle)

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

async function handleFlagSubmit(preset?: string): Promise<void> {
  if (!authStore.isMo3ep) return
  const reason = preset ?? flagComment.value.trim()
  showFlagPopover.value = false
  flagComment.value = ''
  await store.flagCurrentCoursePuzzle(reason || 'Помечено при проверке курса')
}

const showBotBadge = computed(() => {
  const disc = store.activeSessionSummary?.discipline
  return disc && disc !== 'tactics' && disc !== 'tactics_course'
})

const botLabel = computed(() => ENGINE_NAMES[store.activeBotEngine] ?? store.activeBotEngine)

const deltaText = computed(() => {
  const res = store.lastAttemptResult
  if (!res) return ''
  const val = Math.round(res.global_rating_delta * 10) / 10
  return val >= 0 ? `+${val}` : `${val}`
})

function handleBackAction(): void {
  if (store.isAnalysisMode) {
    store.exitPuzzleAnalysis()
    return
  }
  store.pauseToHub()
}
</script>

<template>
  <div
    v-if="activePuzzle"
    class="w-full h-11 px-3 rounded-lg bg-surface border border-border flex items-center justify-between gap-2 select-none"
  >
    <!-- Left: Pause / Return to Hub or Exit Analysis -->
    <div class="flex items-center gap-2 shrink-0">
      <NButton
        circle
        quaternary
        size="small"
        type="error"
        :title="
          store.isAnalysisMode
            ? t('features.trainingCenter.actions.exitAnalysis')
            : t('features.trainingCenter.actions.pauseToHub')
        "
        :aria-label="
          store.isAnalysisMode
            ? t('features.trainingCenter.actions.exitAnalysis')
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
    <div class="flex items-center gap-2 min-w-0">
      <!-- Analysis Badge -->
      <span
        v-if="store.isAnalysisMode"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40"
      >
        {{ t('features.trainingCenter.badges.analysis') }}
      </span>

      <!-- Exam Mode Badge (No Theme or Objective Spoilers) -->
      <span
        v-else-if="isExamPuzzle"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-accent/15 text-accent border border-accent/40"
      >
        ЭКЗАМЕН · НАЙДИТЕ СИЛЬНЕЙШЕЕ ПРОДОЛЖЕНИЕ
      </span>

      <!-- Objective Badge: Hold Draw (FIDE) vs Win -->
      <span
        v-else-if="isHoldDraw"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-warning/15 text-warning border border-warning/50"
      >
        {{ t('features.trainingCenter.badges.holdDrawFide') }}
      </span>
      <span
        v-else
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/40"
      >
        {{ t('features.trainingCenter.badges.winTarget') }}
      </span>

      <!-- Woodpecker Badge -->
      <span
        v-if="activePuzzle.is_woodpecker"
        class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold bg-accent/15 text-accent border border-accent/40"
      >
        {{
          t('features.trainingCenter.badges.woodpeckerStreak', {
            streak: activePuzzle.woodpecker_streak ?? 0,
          })
        }}
      </span>

      <!-- Sparring Bot Badge -->
      <span
        v-if="showBotBadge"
        class="hidden lg:inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-condensed bg-elevated text-text-secondary border border-border"
      >
        {{ botLabel }}
      </span>

      <!-- Timer -->
      <span
        v-if="!store.isAnalysisMode"
        class="font-condensed font-bold text-base text-warning min-w-16 text-right"
      >
        {{ formattedTimer }}
      </span>
    </div>

    <!-- Right: Post-Attempt Actions / Analysis Controls / Flag Button -->
    <div class="flex items-center gap-1.5 shrink-0">
      <NButton
        v-if="authStore.isMo3ep && store.activeSessionSummary?.mode === 'crashtest'"
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

      <NPopover
        v-if="authStore.isMo3ep && isTacticsCourse && !store.isAnalysisMode"
        v-model:show="showFlagPopover"
        trigger="click"
        placement="bottom-end"
      >
        <template #trigger>
          <NButton
            size="tiny"
            quaternary
            type="warning"
            :loading="store.isFlaggingPuzzle"
            title="Пожаловаться на задачу и перейти к следующей"
          >
            <template #icon>
              <NIcon><FlagOutline /></NIcon>
            </template>
            Флаг
          </NButton>
        </template>
        <div class="w-64 p-1 flex flex-col gap-2 text-xs">
          <div class="font-display font-bold text-text-primary">
            Отправить задачу #{{ activePuzzle.puzzle_id }} в доработку
          </div>
          <div class="flex flex-wrap gap-1">
            <NButton
              size="tiny"
              secondary
              @click="handleFlagSubmit('Неоднозначное решение / дуаль')"
            >
              Дуаль
            </NButton>
            <NButton
              size="tiny"
              secondary
              @click="handleFlagSubmit('Слишком короткое / странное решение')"
            >
              Странная линия
            </NButton>
            <NButton
              size="tiny"
              secondary
              @click="handleFlagSubmit('Неверная тема / классификация')"
            >
              Не та тема
            </NButton>
          </div>
          <NInput
            v-model:value="flagComment"
            size="small"
            placeholder="Комментарий (опционально)..."
            @keyup.enter="handleFlagSubmit()"
          />
          <NButton
            size="small"
            type="warning"
            block
            :loading="store.isFlaggingPuzzle"
            @click="handleFlagSubmit()"
          >
            В блокнот и далее →
          </NButton>
        </div>
      </NPopover>

      <template v-if="store.isAwaitingNext && store.lastAttemptResult && !store.lastAttemptResult.solved">
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

        <NButton size="tiny" type="primary" @click="store.advanceAfterAttempt()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.nextPuzzle') }}
        </NButton>
      </template>

      <template v-else-if="store.isAnalysisMode">
        <NButton size="tiny" type="primary" @click="store.exitPuzzleAnalysis()">
          <template #icon>
            <NIcon><ArrowForwardOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.continueSession') }}
        </NButton>
      </template>

      <span
        v-else
        class="font-condensed text-xs text-text-secondary px-1.5 py-0.5 rounded-sm bg-elevated border border-border"
      >
        #{{ store.currentItemIndex + 1 }}/{{ store.sessionItems.length }}
      </span>
    </div>
  </div>
</template>

