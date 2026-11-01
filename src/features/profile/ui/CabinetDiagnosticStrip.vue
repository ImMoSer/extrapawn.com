<script setup lang="ts">
import {
  resolveScopeLabel,
  type DiagnosticFocusCardDTO,
  type DiagnosticStripDTO,
  type TrainingDiscipline,
} from '@/entities/training'
import { AlertCircleOutline, EyeOffOutline, FlashOutline, ShieldCheckmarkOutline } from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { useI18n } from 'vue-i18n'

defineProps<{
  diagnostics: DiagnosticStripDTO
  discipline: TrainingDiscipline
  gateThreshold: number
}>()

const emit = defineEmits<{
  trainScope: [payload: { focusGroup: string; focusKey: string }]
}>()

const { t, te } = useI18n()

function cardScopeName(card: DiagnosticFocusCardDTO): string {
  return resolveScopeLabel(card.focus_group, card.focus_key, t, te)
}

function handleTrainCard(card: DiagnosticFocusCardDTO): void {
  emit('trainScope', {
    focusGroup: card.focus_group,
    focusKey: card.focus_key,
  })
}
</script>

<template>
  <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <!-- Card 1: Top Strength -->
    <div class="p-4 rounded-lg bg-surface border border-success/40 flex flex-col justify-between gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-success">
          <NIcon size="18"><ShieldCheckmarkOutline /></NIcon>
          <span class="font-display font-bold text-xs uppercase tracking-wider">
            {{ t('pages.userCabinet.diagnostics.topStrengthTitle') }}
          </span>
        </div>
        <span
          v-if="diagnostics.top_strength"
          class="font-condensed text-xs text-text-secondary"
        >
          {{ diagnostics.top_strength.attempts }} {{ t('pages.userCabinet.diagnostics.attemptsShort') }}
        </span>
      </div>

      <template v-if="diagnostics.top_strength">
        <div class="flex items-baseline justify-between">
          <span class="font-display font-bold text-base text-text-primary truncate">
            {{ cardScopeName(diagnostics.top_strength) }}
          </span>
          <span class="font-condensed font-bold text-xl text-success">
            {{ Math.round(diagnostics.top_strength.rating) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-text-secondary">
          <span class="font-condensed">
            EMA {{ Math.round(diagnostics.top_strength.ema_accuracy * 100) }}% · ±{{
              Math.round(diagnostics.top_strength.rd)
            }}
          </span>
          <NButton size="tiny" secondary @click="handleTrainCard(diagnostics.top_strength)">
            {{ t('pages.userCabinet.diagnostics.warmupAction') }}
          </NButton>
        </div>
      </template>

      <div v-else class="text-xs text-text-secondary py-3">
        {{ t('pages.userCabinet.diagnostics.notEnoughData') }}
      </div>
    </div>

    <!-- Card 2: Primary Weakness / Gate Blocker -->
    <div class="p-4 rounded-lg bg-surface border border-danger/40 flex flex-col justify-between gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-danger">
          <NIcon size="18"><AlertCircleOutline /></NIcon>
          <span class="font-display font-bold text-xs uppercase tracking-wider">
            {{ t('pages.userCabinet.diagnostics.primaryWeaknessTitle') }}
          </span>
        </div>
        <span class="font-condensed text-xs text-text-secondary">
          {{ t('pages.userCabinet.diagnostics.gateTarget', { rating: Math.round(gateThreshold) }) }}
        </span>
      </div>

      <template v-if="diagnostics.primary_weakness">
        <div class="flex items-baseline justify-between">
          <span class="font-display font-bold text-base text-text-primary truncate">
            {{ cardScopeName(diagnostics.primary_weakness) }}
          </span>
          <span class="font-condensed font-bold text-xl text-danger">
            {{ Math.round(diagnostics.primary_weakness.rating) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-text-secondary">
          <span class="font-condensed">
            EMA {{ Math.round(diagnostics.primary_weakness.ema_accuracy * 100) }}% ·
            {{ diagnostics.primary_weakness.attempts }} {{ t('pages.userCabinet.diagnostics.attemptsShort') }}
          </span>
          <NButton
            size="tiny"
            type="primary"
            @click="handleTrainCard(diagnostics.primary_weakness)"
          >
            <template #icon>
              <NIcon><FlashOutline /></NIcon>
            </template>
            {{ t('pages.userCabinet.diagnostics.fixInWarmup') }}
          </NButton>
        </div>
      </template>

      <div v-else class="text-xs text-text-secondary py-3">
        {{ t('pages.userCabinet.diagnostics.notEnoughData') }}
      </div>
    </div>

    <!-- Card 3: Blind Spot (High RD / Unexplored) -->
    <div class="p-4 rounded-lg bg-surface border border-dashed border-warning/50 flex flex-col justify-between gap-3">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5 text-warning">
          <NIcon size="18"><EyeOffOutline /></NIcon>
          <span class="font-display font-bold text-xs uppercase tracking-wider">
            {{ t('pages.userCabinet.diagnostics.blindSpotTitle') }}
          </span>
        </div>
        <span
          v-if="diagnostics.blind_spot"
          class="font-condensed text-xs text-warning"
        >
          RD ±{{ Math.round(diagnostics.blind_spot.rd) }}
        </span>
      </div>

      <template v-if="diagnostics.blind_spot">
        <div class="flex items-baseline justify-between">
          <span class="font-display font-bold text-base text-text-primary truncate">
            {{ cardScopeName(diagnostics.blind_spot) }}
          </span>
          <span class="font-condensed font-bold text-xl text-warning">
            {{ Math.round(diagnostics.blind_spot.rating) }}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs text-text-secondary">
          <span class="font-condensed">
            {{ diagnostics.blind_spot.attempts }} {{ t('pages.userCabinet.diagnostics.attemptsShort') }}
          </span>
          <NButton size="tiny" secondary @click="handleTrainCard(diagnostics.blind_spot)">
            <template #icon>
              <NIcon><FlashOutline /></NIcon>
            </template>
            {{ t('pages.userCabinet.diagnostics.calibrateInWarmup') }}
          </NButton>
        </div>
      </template>

      <div v-else class="text-xs text-text-secondary py-3">
        {{ t('pages.userCabinet.diagnostics.allCalibrated') }}
      </div>
    </div>
  </section>
</template>

