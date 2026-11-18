<script setup lang="ts">
import { FlashOutline, HandLeftOutline } from '@vicons/ionicons5'
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
</template>
