<script setup lang="ts">
import { resolveDisciplineLabel, resolveScopeLabel } from '@/entities/training'
import { ENGINE_NAMES } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
  CloseCircleOutline,
  EyeOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useChallengeStore } from '../model/challenge.store'

const { t, te } = useI18n()
const router = useRouter()
const store = useChallengeStore()
const uiStore = useUiStore()

const activePuzzle = computed(() => store.currentPuzzle)
const state = computed(() => store.challengeState)
const myEntry = computed(() => store.myEntry)

const formattedTimer = computed(() => store.formatDurationMs(store.currentTimeMs))

const disciplineTitle = computed(() => {
  if (!state.value) return ''
  return resolveDisciplineLabel(state.value.discipline, t)
})

const categoryTitle = computed(() => {
  const p = activePuzzle.value
  if (!p) return ''
  return resolveScopeLabel('scopes', p.category, t, te)
})

const isHoldDraw = computed(() => activePuzzle.value?.objective === 'hold_draw')

const showBotBadge = computed(() => {
  const disc = state.value?.discipline
  return disc && disc !== 'tactics'
})

const botLabel = computed(() => ENGINE_NAMES[store.activeBotEngine] ?? store.activeBotEngine)

async function handleGiveUpAndAnalyze(): Promise<void> {
  const confirmed = await uiStore.showConfirmation(
    t('features.trainingCenter.challenge.confirmSurrenderTitle'),
    t('features.trainingCenter.challenge.confirmSurrenderMessage'),
    {
      confirmText: t('features.trainingCenter.challenge.confirmSurrenderBtn'),
      cancelText: t('shared.buttons.cancel'),
      showCancel: true,
    },
  )

  if (confirmed === 'confirm') {
    await store.surrenderAndAnalyze()
  }
}

function handleBackAction(): void {
  store.stopChallenge()
  void router.push('/training')
}
</script>

<template>
  <div
    v-if="activePuzzle"
    class="w-full h-11 px-3 rounded-lg bg-surface/90 backdrop-blur-md border border-border flex items-center justify-between gap-2 select-none"
  >
    <!-- Left: Exit to Training Center + Discipline/Category -->
    <div class="flex items-center gap-2 shrink-0">
      <NButton
        circle
        quaternary
        size="small"
        type="error"
        :title="t('features.trainingCenter.actions.backToHub')"
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

    <!-- Center: Objective Badge + Bot + Timer -->
    <div class="flex items-center gap-2 min-w-0">
      <span
        v-if="store.isAnalysisMode"
        class="px-2.5 py-0.5 rounded-sm text-[11px] font-display font-bold uppercase tracking-wider bg-neon-purple/15 text-neon-purple border border-neon-purple/40"
      >
        {{ t('features.trainingCenter.badges.analysis') }}
      </span>
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

      <span
        v-if="showBotBadge"
        class="hidden lg:inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-condensed bg-elevated text-text-secondary border border-border"
      >
        {{ botLabel }}
      </span>

      <span
        v-if="store.isPlaying"
        class="font-condensed font-bold text-base text-warning min-w-16 text-right"
      >
        {{ formattedTimer }}
      </span>
      <span
        v-else-if="store.isSolved && myEntry?.solved_time_ms !== undefined"
        class="font-condensed font-bold text-base text-success min-w-16 text-right"
      >
        {{ store.formatDurationMs(myEntry.solved_time_ms) }}
      </span>
    </div>

    <!-- Right: Post-Attempt / Analysis Actions -->
    <div class="flex items-center gap-1.5 shrink-0">
      <template v-if="store.isAttemptFailed">
        <span
          v-if="myEntry"
          class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-sm font-condensed font-bold text-xs bg-danger/15 text-danger border border-danger/40"
        >
          {{ myEntry.score_text }}
        </span>

        <NButton
          size="tiny"
          type="primary"
          :disabled="store.isSubmitting"
          @click="store.retryChallenge()"
        >
          <template #icon>
            <NIcon><RefreshOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.challenge.tryAgainBtn') }}
        </NButton>

        <NButton
          size="tiny"
          secondary
          :disabled="store.isSubmitting"
          @click="handleGiveUpAndAnalyze()"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
      </template>

      <template v-else-if="store.isSolved || store.isSurrendered || store.isAnalysisMode">
        <span
          v-if="myEntry"
          class="hidden sm:inline-flex items-center px-2 py-0.5 rounded-sm font-condensed font-bold text-xs border"
          :class="
            myEntry.solved
              ? 'bg-success/15 text-success border-success/40'
              : 'bg-warning/15 text-warning border border-warning/40'
          "
        >
          {{ myEntry.score_text }}
        </span>

        <NButton
          v-if="!store.isAnalysisMode"
          size="tiny"
          type="primary"
          @click="store.enterAnalysis(false)"
        >
          <template #icon>
            <NIcon><EyeOutline /></NIcon>
          </template>
          {{ t('features.trainingCenter.actions.analyze') }}
        </NButton>
      </template>

      <span
        v-else
        class="font-condensed text-xs text-text-secondary px-1.5 py-0.5 rounded-sm bg-elevated border border-border"
      >
        #{{ state?.puzzle_id }}
      </span>
    </div>
  </div>
</template>

