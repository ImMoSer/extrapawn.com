<script setup lang="ts">
import {
  resolveDifficultyLabel,
  resolveScopeLabel,
  TRAINING_DIFFICULTIES,
  type DisciplineOverviewDTO,
  type TrainingDifficulty,
  type TrainingDiscipline,
  type TrainingObjective,
} from '@/entities/training'
import { PlayOutline } from '@vicons/ionicons5'
import { NButton, NIcon, NSwitch } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

interface WarmupQuickTile {
  id: string
  focusGroup: string
  focusKey: string
  labelKey: string
}

const props = defineProps<{
  activeDiscipline: TrainingDiscipline
  discOverview: DisciplineOverviewDTO | null
  isStartingSession: boolean
}>()

const emit = defineEmits<{
  startWarmup: []
}>()

const selectedTier = defineModel<TrainingDifficulty>('selectedTier', { required: true })
const selectedCount = defineModel<number>('selectedCount', { required: true })
const selectedFocusGroup = defineModel<string>('selectedFocusGroup', { required: true })
const selectedFocusKey = defineModel<string>('selectedFocusKey', { required: true })
const selectedObjective = defineModel<TrainingObjective | ''>('selectedObjective', {
  required: true,
})

const { t, te } = useI18n()

const tacticsQuickTiles: readonly WarmupQuickTile[] = [
  { id: 'opening', focusGroup: 'phase', focusKey: 'opening', labelKey: 'features.trainingCenter.warmup.quickGrid.opening' },
  { id: 'middlegame', focusGroup: 'phase', focusKey: 'middlegame', labelKey: 'features.trainingCenter.warmup.quickGrid.middlegame' },
  { id: 'endgame', focusGroup: 'phase', focusKey: 'endgame', labelKey: 'features.trainingCenter.warmup.quickGrid.endgame' },
  { id: 'attack', focusGroup: 'motif', focusKey: 'kingsideAttack', labelKey: 'features.trainingCenter.warmup.quickGrid.attack' },
  { id: 'defense', focusGroup: 'motif', focusKey: 'defensiveMove', labelKey: 'features.trainingCenter.warmup.quickGrid.defense' },
  { id: 'sacrifice', focusGroup: 'motif', focusKey: 'sacrifice', labelKey: 'features.trainingCenter.warmup.quickGrid.sacrifice' },
  { id: 'mate', focusGroup: 'goal', focusKey: 'mate', labelKey: 'features.trainingCenter.warmup.quickGrid.mate' },
  { id: 'crushing', focusGroup: 'goal', focusKey: 'crushing', labelKey: 'features.trainingCenter.warmup.quickGrid.crushing' },
  { id: 'advantage', focusGroup: 'goal', focusKey: 'advantage', labelKey: 'features.trainingCenter.warmup.quickGrid.advantage' },
]

const theoreticalQuickTiles: readonly WarmupQuickTile[] = [
  { id: 'pawn', focusGroup: 'domain', focusKey: 'PAWN', labelKey: 'features.trainingCenter.warmup.quickGrid.pawn' },
  { id: 'rook', focusGroup: 'domain', focusKey: 'ROOK', labelKey: 'features.trainingCenter.warmup.quickGrid.rook' },
  { id: 'bishop', focusGroup: 'domain', focusKey: 'BISHOP', labelKey: 'features.trainingCenter.warmup.quickGrid.bishop' },
  { id: 'knight', focusGroup: 'domain', focusKey: 'KNIGHT', labelKey: 'features.trainingCenter.warmup.quickGrid.knight' },
  { id: 'queen', focusGroup: 'domain', focusKey: 'QUEEN', labelKey: 'features.trainingCenter.warmup.quickGrid.queen' },
  { id: 'complex', focusGroup: 'domain', focusKey: 'COMPLEX', labelKey: 'features.trainingCenter.warmup.quickGrid.complex' },
]

const practicalQuickTiles: readonly WarmupQuickTile[] = [
  { id: 'pawn', focusGroup: 'domain', focusKey: 'PAWN', labelKey: 'features.trainingCenter.warmup.quickGrid.pawn' },
  { id: 'rook', focusGroup: 'domain', focusKey: 'ROOK', labelKey: 'features.trainingCenter.warmup.quickGrid.rook' },
  { id: 'bishop', focusGroup: 'domain', focusKey: 'BISHOP', labelKey: 'features.trainingCenter.warmup.quickGrid.bishop' },
  { id: 'knight', focusGroup: 'domain', focusKey: 'KNIGHT', labelKey: 'features.trainingCenter.warmup.quickGrid.knight' },
  { id: 'queen', focusGroup: 'domain', focusKey: 'QUEEN', labelKey: 'features.trainingCenter.warmup.quickGrid.queen' },
  { id: 'complex', focusGroup: 'domain', focusKey: 'COMPLEX', labelKey: 'features.trainingCenter.warmup.quickGrid.complex' },
]

const warmupAllowedSizes = computed<number[]>(() => {
  if (props.discOverview?.warmup_allowed_sizes?.length) {
    return props.discOverview.warmup_allowed_sizes
  }
  return props.activeDiscipline === 'tactics' ? [50, 100, 200] : [10, 25, 50]
})

// Theoretical endgames objective toggles: at least one of (win, hold_draw) is ALWAYS active.
// Both ON => '' (mixed win + hold_draw inside the chosen category/MIX).
const isWinToggleOn = computed<boolean>(
  () => selectedObjective.value === 'win' || selectedObjective.value === '',
)
const isDrawToggleOn = computed<boolean>(
  () => selectedObjective.value === 'hold_draw' || selectedObjective.value === '',
)

function handleToggleWin(nextVal: boolean): void {
  if (nextVal) {
    selectedObjective.value = isDrawToggleOn.value ? '' : 'win'
  } else {
    // Turning Win OFF always guarantees Draw is ON (auto-flip if Draw was OFF)
    selectedObjective.value = 'hold_draw'
  }
}

function handleToggleDraw(nextVal: boolean): void {
  if (nextVal) {
    selectedObjective.value = isWinToggleOn.value ? '' : 'hold_draw'
  } else {
    // Turning Draw OFF always guarantees Win is ON (auto-flip if Win was OFF)
    selectedObjective.value = 'win'
  }
}

function selectWarmupFocus(group: string, key: string): void {
  selectedFocusGroup.value = group
  selectedFocusKey.value = key
  if (props.activeDiscipline !== 'theoretical_endgames') {
    selectedObjective.value = ''
  }
}

function isWarmupFocusSelected(group: string, key: string): boolean {
  if (props.activeDiscipline === 'theoretical_endgames') {
    return selectedFocusGroup.value === group && selectedFocusKey.value === key
  }
  return (
    selectedFocusGroup.value === group &&
    selectedFocusKey.value === key &&
    selectedObjective.value === ''
  )
}

const isCustomCabinetFocus = computed<boolean>(() => {
  if (selectedFocusGroup.value === 'all') {
    return false
  }
  if (props.activeDiscipline === 'tactics') {
    return !tacticsQuickTiles.some(
      (tile) =>
        tile.focusGroup === selectedFocusGroup.value && tile.focusKey === selectedFocusKey.value,
    )
  }
  if (props.activeDiscipline === 'theoretical_endgames') {
    return !theoreticalQuickTiles.some(
      (tile) =>
        tile.focusGroup === selectedFocusGroup.value && tile.focusKey === selectedFocusKey.value,
    )
  }
  if (selectedFocusGroup.value === 'domain' && selectedFocusKey.value === 'EXTRA') {
    return false
  }
  return !practicalQuickTiles.some(
    (tile) =>
      tile.focusGroup === selectedFocusGroup.value && tile.focusKey === selectedFocusKey.value,
  )
})

const customFocusDisplayLabel = computed<string>(() => {
  const base = resolveScopeLabel(selectedFocusGroup.value, selectedFocusKey.value, t, te)
  if (props.activeDiscipline === 'theoretical_endgames') {
    if (selectedObjective.value === 'win') {
      return `${base} · ${t('features.trainingCenter.warmup.quickGrid.win')}`
    }
    if (selectedObjective.value === 'hold_draw') {
      return `${base} · ${t('features.trainingCenter.warmup.quickGrid.draw')}`
    }
  }
  return base
})
</script>

<template>
  <div class="p-3.5 @3xl:p-6 flex flex-col gap-5 @3xl:gap-6">
    <div class="grid grid-cols-1 @3xl:grid-cols-2 gap-5 @3xl:gap-6">
      <!-- Left: Free Rank Tier, Session Volume & Start CTA -->
      <div class="flex flex-col justify-between gap-4 @3xl:gap-5">
        <div class="flex flex-col gap-4 @3xl:gap-5">
          <div class="flex flex-col gap-2">
            <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
              {{ t('features.trainingCenter.warmup.selectTierLabel') }}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="tier in TRAINING_DIFFICULTIES"
                :key="tier"
                type="button"
                class="p-2.5 @3xl:p-3 rounded-md border flex flex-col items-start gap-1 transition-colors cursor-pointer"
                :class="
                  selectedTier === tier
                    ? 'bg-elevated border-brand/60 text-text-primary'
                    : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                "
                @click="selectedTier = tier"
              >
                <span class="font-display font-semibold text-sm">
                  {{ resolveDifficultyLabel(tier, t) }}
                </span>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
              {{ t('features.trainingCenter.warmup.selectCountLabel') }}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="cnt in warmupAllowedSizes"
                :key="cnt"
                type="button"
                class="py-2.5 px-3 rounded-md border font-condensed font-bold text-sm transition-colors cursor-pointer"
                :class="
                  selectedCount === cnt
                    ? 'bg-elevated border-brand/60 text-text-primary'
                    : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                "
                @click="selectedCount = cnt"
              >
                {{ cnt }} {{ t('features.trainingCenter.warmup.puzzlesUnit') }}
              </button>
            </div>
          </div>
        </div>

        <div class="pt-1">
          <NButton
            type="primary"
            size="large"
            block
            :loading="props.isStartingSession"
            @click="emit('startWarmup')"
          >
            <template #icon>
              <NIcon><PlayOutline /></NIcon>
            </template>
            {{
              t('features.trainingCenter.warmup.startBtn', {
                count: selectedCount,
              })
            }}
          </NButton>
        </div>
      </div>

      <!-- Right: Visual Quick-Select Focus Grid -->
      <div class="flex flex-col gap-2">
        <label class="font-display font-semibold text-xs uppercase tracking-wider text-text-secondary">
          {{ t('features.trainingCenter.warmup.quickGrid.title') }}
        </label>

        <!-- Theoretical Endgames Objective Toggles (Win / Hold Draw — at least one always ON) -->
        <div
          v-if="props.activeDiscipline === 'theoretical_endgames'"
          class="grid grid-cols-2 gap-2"
        >
          <div
            class="px-3 py-2 rounded-md border flex items-center justify-between gap-2 transition-colors cursor-pointer"
            :class="
              isWinToggleOn
                ? 'bg-elevated border-brand/50 text-text-primary'
                : 'bg-surface border-border text-text-secondary'
            "
            @click="handleToggleWin(!isWinToggleOn)"
          >
            <span class="font-display font-semibold text-xs truncate">
              {{ t('features.trainingCenter.warmup.quickGrid.win') }}
            </span>
            <NSwitch
              :value="isWinToggleOn"
              size="small"
              @click.stop
              @update:value="handleToggleWin"
            />
          </div>

          <div
            class="px-3 py-2 rounded-md border flex items-center justify-between gap-2 transition-colors cursor-pointer"
            :class="
              isDrawToggleOn
                ? 'bg-elevated border-warning/50 text-text-primary'
                : 'bg-surface border-border text-text-secondary'
            "
            @click="handleToggleDraw(!isDrawToggleOn)"
          >
            <span class="font-display font-semibold text-xs truncate">
              {{ t('features.trainingCenter.warmup.quickGrid.draw') }}
            </span>
            <NSwitch
              :value="isDrawToggleOn"
              size="small"
              @click.stop
              @update:value="handleToggleDraw"
            />
          </div>
        </div>

        <div
          v-if="isCustomCabinetFocus"
          class="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-brand/10 border border-brand/40 text-xs"
        >
          <span class="font-display font-semibold text-text-primary truncate">
            <span class="text-text-secondary font-normal mr-1">
              {{ t('features.trainingCenter.warmup.quickGrid.customFocusPrefix') }}
            </span>
            <strong class="text-brand">{{ customFocusDisplayLabel }}</strong>
          </span>
          <button
            type="button"
            class="font-condensed font-bold uppercase text-[11px] text-text-secondary hover:text-text-primary cursor-pointer shrink-0"
            @click="selectWarmupFocus('all', 'all')"
          >
            × {{ t('features.trainingCenter.warmup.quickGrid.mix') }}
          </button>
        </div>

        <button
          type="button"
          class="w-full py-2.5 px-3 rounded-md border font-display font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer text-center"
          :class="
            isWarmupFocusSelected('all', 'all')
              ? 'bg-elevated border-brand text-brand shadow-xs'
              : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
          "
          @click="selectWarmupFocus('all', 'all')"
        >
          {{ t('features.trainingCenter.warmup.quickGrid.mix') }}
        </button>

        <div
          v-if="props.activeDiscipline === 'tactics'"
          class="grid grid-cols-3 gap-2"
        >
          <button
            v-for="tile in tacticsQuickTiles"
            :key="tile.id"
            type="button"
            class="py-2.5 px-2 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer text-center truncate"
            :class="
              isWarmupFocusSelected(tile.focusGroup, tile.focusKey)
                ? 'bg-elevated border-brand text-brand shadow-xs'
                : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectWarmupFocus(tile.focusGroup, tile.focusKey)"
          >
            {{ t(tile.labelKey) }}
          </button>
        </div>

        <div
          v-else-if="props.activeDiscipline === 'theoretical_endgames'"
          class="grid grid-cols-2 gap-2"
        >
          <button
            v-for="tile in theoreticalQuickTiles"
            :key="tile.id"
            type="button"
            class="py-2 px-2.5 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer text-center truncate"
            :class="
              isWarmupFocusSelected(tile.focusGroup, tile.focusKey)
                ? 'bg-elevated border-brand text-brand shadow-xs'
                : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectWarmupFocus(tile.focusGroup, tile.focusKey)"
          >
            {{ t(tile.labelKey) }}
          </button>
        </div>

        <div v-else class="flex flex-col gap-2">
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tile in practicalQuickTiles"
              :key="tile.id"
              type="button"
              class="py-2 px-2.5 rounded-md border font-display font-semibold text-xs transition-colors cursor-pointer text-center truncate"
              :class="
                isWarmupFocusSelected(tile.focusGroup, tile.focusKey)
                  ? 'bg-elevated border-brand text-brand shadow-xs'
                  : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
              "
              @click="selectWarmupFocus(tile.focusGroup, tile.focusKey)"
            >
              {{ t(tile.labelKey) }}
            </button>
          </div>

          <button
            type="button"
            class="w-full py-2.5 px-3 rounded-md border font-display font-bold text-xs uppercase tracking-widest transition-colors cursor-pointer text-center"
            :class="
              isWarmupFocusSelected('domain', 'EXTRA')
                ? 'bg-elevated border-brand text-brand shadow-xs'
                : 'bg-surface border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
            "
            @click="selectWarmupFocus('domain', 'EXTRA')"
          >
            {{ t('features.trainingCenter.warmup.quickGrid.extrapawn') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
