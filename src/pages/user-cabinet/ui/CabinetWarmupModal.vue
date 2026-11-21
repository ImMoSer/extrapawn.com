<script setup lang="ts">
import {
  resolveDifficultyLabel,
  resolveDisciplineLabel,
  resolveScopeLabel,
  TRAINING_DIFFICULTIES,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { CloseOutline, FlashOutline, PlayOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NIcon, NModal } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
  discipline: TrainingDiscipline
  focusGroup: string
  focusKey: string
  initialObjective: TrainingObjective | ''
  initialTier: TrainingDifficulty
  allowedSizes: number[]
  isStarting: boolean
  errorMessage: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  clearError: []
  confirm: [
    payload: {
      difficulty: TrainingDifficulty
      count: number
      objective: TrainingObjective | ''
    },
  ]
}>()

const { t, te } = useI18n()

const selectedTier = ref<TrainingDifficulty>(props.initialTier)
const selectedCount = ref<number>(props.allowedSizes[0] ?? 50)
const selectedObjective = ref<TrainingObjective | ''>(props.initialObjective)

watch(
  () => props.show,
  (open) => {
    if (open) {
      selectedTier.value = props.initialTier
      selectedCount.value =
        props.allowedSizes[0] ?? (props.discipline === 'tactics' ? 50 : 10)
      selectedObjective.value = props.initialObjective
    }
  },
)

const topicTitle = computed<string>(() => {
  return resolveScopeLabel(props.focusGroup, props.focusKey, t, te)
})

function handleClose(): void {
  if (props.isStarting) return
  emit('update:show', false)
}

function handleConfirm(): void {
  emit('confirm', {
    difficulty: selectedTier.value,
    count: selectedCount.value,
    objective:
      props.discipline === 'theoretical_endgames' && props.focusGroup !== 'objective'
        ? selectedObjective.value
        : '',
  })
}
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="!isStarting"
    @update:show="(v) => emit('update:show', v)"
  >
    <div
      class="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-xl text-text-primary select-none flex flex-col gap-4"
    >
      <div class="flex items-center justify-between border-b border-border pb-3">
        <div class="flex items-center gap-2">
          <NIcon :component="FlashOutline" class="text-lg text-brand" />
          <h3 class="font-display text-base font-bold uppercase tracking-wider text-text-primary">
            {{ t('pages.userCabinet.warmupModal.title') }}
          </h3>
        </div>
        <button
          type="button"
          class="cursor-pointer rounded p-1 text-text-secondary hover:bg-elevated hover:text-text-primary transition-colors"
          :disabled="isStarting"
          @click="handleClose"
        >
          <NIcon :component="CloseOutline" class="text-lg" />
        </button>
      </div>

      <div class="rounded-lg border border-brand/30 bg-brand/5 p-3 flex flex-col gap-1">
        <span
          class="font-condensed text-[11px] font-bold uppercase tracking-wider text-text-secondary"
        >
          {{ resolveDisciplineLabel(discipline, t) }} ·
          {{ t('pages.userCabinet.warmupModal.topicLabel') }}
        </span>
        <span class="font-display text-sm font-bold text-brand">
          {{ topicTitle }}
        </span>
      </div>

      <NAlert v-if="errorMessage" type="error" closable @close="emit('clearError')">
        {{ errorMessage }}
      </NAlert>

      <div class="flex flex-col gap-2">
        <label
          class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary"
        >
          {{ t('pages.userCabinet.warmupModal.tierLabel') }}
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="tier in TRAINING_DIFFICULTIES"
            :key="tier"
            type="button"
            class="p-2.5 rounded-md border flex flex-col items-start gap-0.5 transition-colors cursor-pointer min-w-0"
            :class="
              selectedTier === tier
                ? 'bg-elevated border-border-hover text-text-primary'
                : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectedTier = tier"
          >
            <span class="font-display font-semibold text-xs truncate">
              {{ resolveDifficultyLabel(tier, t) }}
            </span>
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <label
          class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary"
        >
          {{ t('pages.userCabinet.warmupModal.batchLabel') }}
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="cnt in allowedSizes"
            :key="cnt"
            type="button"
            class="py-2 px-2.5 rounded-md border font-condensed font-bold text-sm transition-colors cursor-pointer min-w-0 truncate"
            :class="
              selectedCount === cnt
                ? 'bg-elevated border-border-hover text-text-primary'
                : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectedCount = cnt"
          >
            {{ cnt }} {{ t('features.trainingCenter.warmup.puzzlesUnit') }}
          </button>
        </div>
      </div>

      <div
        v-if="discipline === 'theoretical_endgames' && focusGroup !== 'objective'"
        class="flex flex-col gap-2"
      >
        <label
          class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary"
        >
          {{ t('pages.userCabinet.warmupModal.objectiveLabel') }}
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer min-w-0 truncate"
            :class="
              selectedObjective === ''
                ? 'bg-elevated border-border-hover text-text-primary'
                : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectedObjective = ''"
          >
            {{ t('features.trainingCenter.warmup.quickGrid.mix') }}
          </button>
          <button
            type="button"
            class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer min-w-0 truncate"
            :class="
              selectedObjective === 'win'
                ? 'bg-elevated border-border-hover text-text-primary'
                : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectedObjective = 'win'"
          >
            {{ t('features.trainingCenter.warmup.quickGrid.win') }}
          </button>
          <button
            type="button"
            class="py-2 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer min-w-0 truncate"
            :class="
              selectedObjective === 'hold_draw'
                ? 'bg-elevated border-border-hover text-text-primary'
                : 'bg-canvas border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectedObjective = 'hold_draw'"
          >
            {{ t('features.trainingCenter.warmup.quickGrid.draw') }}
          </button>
        </div>
      </div>

      <div class="pt-1">
        <NButton
          type="primary"
          size="large"
          block
          :loading="isStarting"
          @click="handleConfirm"
        >
          <template #icon>
            <NIcon :component="PlayOutline" />
          </template>
          {{ t('pages.userCabinet.warmupModal.startBtn', { count: selectedCount }) }}
        </NButton>
      </div>
    </div>
  </NModal>
</template>
