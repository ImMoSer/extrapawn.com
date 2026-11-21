<script setup lang="ts">
import {
  resolveTwinBadgeLabel,
  resolveTwinPedagogicalPrompt,
} from '@/entities/training'
import {
  ArrowForwardOutline,
  EyeOutline,
  PlayOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t } = useI18n()
const store = useTrainingSessionStore()

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
</script>

<template>
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
        v-if="!store.isWoodpeckerBatch"
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
</template>
