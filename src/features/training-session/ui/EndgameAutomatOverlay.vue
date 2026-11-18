<script setup lang="ts">
import {
  CloseOutline,
  FlameOutline,
  FlashOutline,
  HandLeftOutline,
  RefreshOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { NCheckbox, NIcon } from 'naive-ui'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useTrainingSessionStore } from '../model/trainingSession.store'

const { t } = useI18n()
const store = useTrainingSessionStore()

const rememberChoice = ref<boolean>(false)

watch(
  () => store.automatPrompt,
  (prompt) => {
    if (prompt) {
      rememberChoice.value = false
    }
  },
)

function handleChoose(choice: 'automat' | 'manual'): void {
  store.resolveAutomatPrompt(choice, rememberChoice.value)
}

function handleHopelessChoice(choice: 'restart' | 'resign' | 'suffer'): void {
  void store.resolveHopelessPrompt(choice)
}
</script>

<template>
  <!-- 1. Interactive Decision Prompt (when endgameAutomat === 'unknown') -->
  <div
    v-if="store.automatPrompt"
    class="w-full max-w-sm mx-3 p-4 rounded-lg bg-overlay border border-border shadow-xl flex flex-col gap-3.5 select-none text-text-primary"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase tracking-wider bg-brand/15 text-brand border border-brand/40"
      >
        <NIcon size="13"><FlashOutline /></NIcon>
        <span>GAVIOTA DTM</span>
      </span>

      <span class="font-condensed font-bold text-xs text-text-secondary">
        #{{ store.automatPrompt.mateInMoves }}
      </span>
    </div>

    <p class="font-display text-sm leading-snug text-text-primary">
      {{
        t('features.trainingCenter.automat.promptMessage', {
          moves: store.automatPrompt.mateInMoves,
        })
      }}
    </p>

    <div class="p-2.5 rounded-md bg-elevated border border-border flex flex-col gap-1">
      <NCheckbox v-model:checked="rememberChoice" size="small">
        <span class="font-display text-xs font-medium text-text-primary">
          {{ t('features.trainingCenter.automat.rememberChoice') }}
        </span>
      </NCheckbox>
      <span class="text-[11px] text-text-secondary pl-6 leading-tight">
        {{ t('features.trainingCenter.automat.settingsHint') }}
      </span>
    </div>

    <div class="grid grid-cols-2 gap-2 pt-0.5">
      <button
        type="button"
        class="min-w-0 overflow-hidden py-2 px-3 rounded-md bg-elevated hover:bg-surface border border-border hover:border-border-hover text-text-primary font-display font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        @click="handleChoose('manual')"
      >
        <NIcon class="shrink-0" size="14"><HandLeftOutline /></NIcon>
        <span class="truncate">{{ t('features.trainingCenter.automat.playManualBtn') }}</span>
      </button>

      <button
        type="button"
        class="min-w-0 overflow-hidden py-2 px-3 rounded-md bg-brand hover:bg-brand-deep text-on-brand font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        @click="handleChoose('automat')"
      >
        <NIcon class="shrink-0" size="14"><FlashOutline /></NIcon>
        <span class="truncate">{{ t('features.trainingCenter.automat.runAutomatBtn') }}</span>
      </button>
    </div>
  </div>

  <!-- 2. Non-blocking Top Countdown Pill during Gaviota Rollout -->
  <div
    v-else-if="store.automatRemainingMoves !== null"
    class="self-center mt-2.5 mb-auto px-3 py-1 rounded-sm bg-overlay border border-brand/50 shadow-md inline-flex items-center gap-1.5 pointer-events-none select-none"
  >
    <NIcon size="13" class="text-brand shrink-0"><FlashOutline /></NIcon>
    <span class="font-condensed font-bold text-xs uppercase tracking-wider text-brand">
      {{
        t('features.trainingCenter.automat.runningBadge', {
          moves: store.automatRemainingMoves,
        })
      }}
    </span>
  </div>

  <!-- 3. Hopeless 5-Piece Tablebase Position Modal (Restart / Resign / Suffer) -->
  <div
    v-else-if="store.hopelessPrompt"
    class="w-full max-w-sm mx-3 p-4 rounded-lg bg-overlay border border-danger/50 shadow-xl flex flex-col gap-3.5 select-none text-text-primary"
    role="dialog"
    aria-modal="true"
  >
    <div class="flex items-center justify-between gap-2">
      <span
        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[11px] font-condensed font-bold uppercase tracking-wider bg-danger/15 text-danger border border-danger/40"
      >
        <NIcon size="13"><WarningOutline /></NIcon>
        <span>{{
          store.hopelessPrompt.source === 'syzygy' ? 'SYZYGY WDL' : 'GAVIOTA WDL'
        }}</span>
      </span>

      <span class="font-condensed font-bold text-xs text-text-secondary">
        {{ store.hopelessPrompt.verdict === 'draw_when_win_required' ? '1/2-1/2' : '0-1' }}
      </span>
    </div>

    <div class="flex flex-col gap-1">
      <p class="font-display font-bold text-sm leading-snug text-text-primary">
        {{ t('features.trainingCenter.hopeless.title') }}
      </p>
      <p class="text-xs leading-snug text-text-secondary">
        {{
          store.hopelessPrompt.verdict === 'draw_when_win_required'
            ? store.hopelessPrompt.source === 'syzygy'
              ? t('features.trainingCenter.hopeless.subtitleDrawSyzygy')
              : t('features.trainingCenter.hopeless.subtitleDraw')
            : store.hopelessPrompt.source === 'syzygy'
              ? t('features.trainingCenter.hopeless.subtitleLostSyzygy')
              : t('features.trainingCenter.hopeless.subtitleLost')
        }}
      </p>
    </div>

    <div class="grid grid-cols-3 gap-1.5 pt-0.5">
      <button
        type="button"
        class="min-w-0 overflow-hidden py-2 px-2 rounded-md bg-warning/15 hover:bg-warning/25 border border-warning/50 text-warning font-display font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
        @click="handleHopelessChoice('restart')"
      >
        <NIcon class="shrink-0" size="13"><RefreshOutline /></NIcon>
        <span class="truncate">{{ t('features.trainingCenter.hopeless.restartBtn') }}</span>
      </button>

      <button
        type="button"
        class="min-w-0 overflow-hidden py-2 px-2 rounded-md bg-danger/15 hover:bg-danger/25 border border-danger/50 text-danger font-display font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
        @click="handleHopelessChoice('resign')"
      >
        <NIcon class="shrink-0" size="13"><CloseOutline /></NIcon>
        <span class="truncate">{{ t('features.trainingCenter.hopeless.resignBtn') }}</span>
      </button>

      <button
        type="button"
        class="min-w-0 overflow-hidden py-2 px-2 rounded-md bg-elevated hover:bg-surface border border-border hover:border-border-hover text-text-secondary hover:text-text-primary font-display font-semibold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
        @click="handleHopelessChoice('suffer')"
      >
        <NIcon class="shrink-0" size="13"><FlameOutline /></NIcon>
        <span class="truncate">{{ t('features.trainingCenter.hopeless.sufferBtn') }}</span>
      </button>
    </div>
  </div>
</template>
