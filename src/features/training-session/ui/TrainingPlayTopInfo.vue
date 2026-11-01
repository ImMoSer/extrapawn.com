<script setup lang="ts">
import { resolveDisciplineLabel, resolveScopeLabel } from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import {
  ArrowForwardOutline,
  CloseCircleOutline,
  EyeOutline,
  SparklesOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t, te } = useI18n()
const store = useTrainingSessionStore()

const activePuzzle = computed(() => store.analysisPuzzle ?? store.currentPuzzle)

const formattedTimer = computed(() => store.formatDurationMs(store.currentTimeMs))

const disciplineTitle = computed(() => {
  const disc = store.activeSessionSummary?.discipline ?? store.activeDiscipline
  return resolveDisciplineLabel(disc, t)
})

const categoryTitle = computed(() => {
  const p = activePuzzle.value
  if (!p) return ''
  return resolveScopeLabel('scopes', p.category, t, te)
})

const isHoldDraw = computed(() => activePuzzle.value?.objective === 'hold_draw')

const showBotBadge = computed(() => {
  const disc = store.activeSessionSummary?.discipline
  return disc && disc !== 'tactics'
})

const botLabel = computed(() => ENGINE_NAMES[store.activeBotEngine] ?? store.activeBotEngine)

const hasCanonicalSolution = computed(() => Boolean(activePuzzle.value?.tactical_solution))

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
    class="w-full h-11 px-3 rounded-lg bg-surface/90 backdrop-blur-md border border-border flex items-center justify-between gap-2 select-none"
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
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-neon-purple/15 text-neon-purple border border-neon-purple/40"
      >
        {{ t('features.trainingCenter.badges.analysis') }}
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
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-neon-cyan/15 text-neon-cyan border border-neon-cyan/40"
      >
        {{ t('features.trainingCenter.badges.winTarget') }}
      </span>

      <!-- Woodpecker Badge -->
      <span
        v-if="activePuzzle.is_woodpecker"
        class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold bg-neon-purple/15 text-neon-purple border border-neon-purple/40"
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

    <!-- Right: Post-Attempt Actions / Analysis Controls -->
    <div class="flex items-center gap-1.5 shrink-0">
      <template v-if="store.isAwaitingNext && store.lastAttemptResult">
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
        <NButton
          v-if="hasCanonicalSolution"
          size="tiny"
          secondary
          @click="store.loadCanonicalSolutionIntoAnalysis()"
        >
          <template #icon>
            <NIcon><SparklesOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.showSolution') }}
        </NButton>

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

