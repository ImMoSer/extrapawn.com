<script setup lang="ts">
import type { PuzzleReportReasonCode } from '@/entities/training'
import {
  CheckmarkCircleOutline,
  FlagOutline,
  HardwareChipOutline,
  OpenOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import { NButton, NCheckbox, NCheckboxGroup, NIcon, NInput, NModal, NProgress } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { usePuzzleReportStore } from '../model/puzzleReport.store'

const { t } = useI18n()
const store = usePuzzleReportStore()

const modalVisible = computed({
  get: () => store.isOpen,
  set: (val: boolean) => {
    if (!val) store.closeModal()
  },
})

const selectedReasonsModel = computed<PuzzleReportReasonCode[]>({
  get: () => store.selectedReasons,
  set: (vals) => {
    store.selectedReasons = vals
  },
})

const progressLabel = computed(() => {
  const p = store.progress
  if (!p) return t('features.puzzleFeedback.report.verifyingInit')
  if (p.mode === 'tablebase') {
    return t('features.puzzleFeedback.report.verifyingTablebase')
  }
  if (p.mode === 'tactics_engine') {
    return t('features.puzzleFeedback.report.verifyingTacticsStep', {
      step: p.stepIndex,
      total: p.totalSteps,
      depth: p.depth,
      target: p.targetDepth,
    })
  }
  return t('features.puzzleFeedback.report.verifyingStockfishDepth', {
    depth: p.depth,
    target: p.targetDepth,
  })
})

const wdlWinPercent = computed(() => {
  const wdl = store.verificationResult?.wdl
  if (!wdl) return null
  const total = wdl.win + wdl.draw + wdl.loss
  if (total <= 0) return null
  return Math.round((wdl.win / total) * 1000) / 10
})
</script>

<template>
  <NModal
    v-model:show="modalVisible"
    :mask-closable="store.phase !== 'verifying'"
    :close-on-esc="store.phase !== 'verifying'"
    transform-origin="center"
  >
    <div
      class="w-[min(92vw,460px)] rounded-lg bg-surface border border-border shadow-xl p-4 sm:p-5 flex flex-col gap-4 text-text-primary select-none"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 pb-2 border-b border-border">
        <NIcon size="18" class="text-warning shrink-0"><FlagOutline /></NIcon>
        <h3 class="font-display font-bold text-sm uppercase tracking-wider truncate">
          {{ t('features.puzzleFeedback.report.modalTitle') }}
        </h3>
      </div>

      <!-- Phase 1: Reason Selection Form -->
      <template v-if="store.phase === 'form'">
        <p class="text-xs text-text-secondary leading-relaxed">
          {{ t('features.puzzleFeedback.report.formHint') }}
        </p>

        <NCheckboxGroup v-model:value="selectedReasonsModel">
          <div class="flex flex-col gap-2">
            <label
              v-for="reason in store.availableReasons"
              :key="reason"
              class="flex items-start gap-2.5 p-2 rounded-md border border-border bg-elevated/40 hover:bg-elevated/80 transition-colors cursor-pointer"
            >
              <NCheckbox :value="reason" class="mt-0.5 shrink-0" />
              <span class="text-xs text-text-primary leading-snug">
                {{ t(`features.puzzleFeedback.report.reasons.${reason}`) }}
              </span>
            </label>
          </div>
        </NCheckboxGroup>

        <div class="flex flex-col gap-1">
          <span class="text-[11px] font-medium text-text-secondary">
            {{ t('features.puzzleFeedback.report.commentLabel') }}
          </span>
          <NInput
            v-model:value="store.comment"
            type="textarea"
            :rows="2"
            :maxlength="500"
            show-count
            :placeholder="t('features.puzzleFeedback.report.commentPlaceholder')"
          />
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1">
          <NButton
            size="small"
            secondary
            class="min-w-0 overflow-hidden"
            @click="store.closeModal()"
          >
            <span class="truncate">{{ t('features.puzzleFeedback.report.cancelBtn') }}</span>
          </NButton>
          <NButton
            size="small"
            type="primary"
            class="min-w-0 overflow-hidden"
            :disabled="!store.canStartVerification"
            @click="store.startVerification()"
          >
            <span class="truncate">{{ t('features.puzzleFeedback.report.verifyBtn') }}</span>
          </NButton>
        </div>
      </template>

      <!-- Phase 2: Automated Verification Progress -->
      <template v-else-if="store.phase === 'verifying'">
        <div class="flex flex-col gap-3 py-2">
          <div class="flex items-center justify-between gap-2 text-xs">
            <span class="flex items-center gap-2 text-text-primary font-medium min-w-0">
              <NIcon size="16" class="text-brand shrink-0"><HardwareChipOutline /></NIcon>
              <span class="truncate">{{ progressLabel }}</span>
            </span>
            <span
              v-if="store.progress?.currentEvalLabel"
              class="font-condensed font-bold text-text-secondary shrink-0"
            >
              {{ store.progress.currentEvalLabel }}
            </span>
          </div>

          <NProgress
            type="line"
            :percentage="store.progress?.percent ?? 5"
            :show-indicator="false"
            processing
          />

          <p class="text-[11px] text-text-secondary leading-snug">
            {{ t('features.puzzleFeedback.report.verifyingSubhint') }}
          </p>
        </div>

        <div class="flex justify-end">
          <NButton size="small" secondary @click="store.closeModal()">
            <span class="truncate">{{ t('features.puzzleFeedback.report.cancelBtn') }}</span>
          </NButton>
        </div>
      </template>

      <!-- Phase 3: Verified Solvable (Anti-Spam Rejection) -->
      <template v-else-if="store.phase === 'valid'">
        <div class="p-3 rounded-md bg-success/10 border border-success/40 flex flex-col gap-2">
          <div class="flex items-center gap-2 text-success font-display font-bold text-xs uppercase">
            <NIcon size="18" class="shrink-0"><CheckmarkCircleOutline /></NIcon>
            <span>{{ t('features.puzzleFeedback.report.validTitle') }}</span>
          </div>

          <p class="text-xs text-text-primary leading-relaxed">
            {{
              store.verificationResult?.source === 'lichess_tablebase'
                ? t('features.puzzleFeedback.report.validTablebaseText', {
                    category: store.verificationResult.tablebaseCategory ?? '',
                  })
                : t('features.puzzleFeedback.report.validStockfishText', {
                    eval: store.verificationResult?.whitePovEvalLabel ?? '—',
                    depth: store.verificationResult?.depth ?? 21,
                  })
            }}
          </p>

          <div
            v-if="wdlWinPercent !== null"
            class="text-[11px] font-condensed text-text-secondary"
          >
            WDL Win: <span class="font-bold text-text-primary">{{ wdlWinPercent }}%</span>
          </div>

          <a
            v-if="store.verificationResult?.syzygyUrl"
            :href="store.verificationResult.syzygyUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
          >
            <span>{{ t('features.puzzleFeedback.report.syzygyProofLink') }}</span>
            <NIcon size="14" class="shrink-0"><OpenOutline /></NIcon>
          </a>
        </div>

        <div class="flex justify-end">
          <NButton size="small" type="primary" @click="store.closeModal()">
            <span class="truncate">{{ t('features.puzzleFeedback.report.closeBtn') }}</span>
          </NButton>
        </div>
      </template>

      <!-- Phase 4: Confirmed Suspicious -> Quarantined & Reported -->
      <template v-else-if="store.phase === 'suspicious_submitted'">
        <div class="p-3 rounded-md bg-warning/10 border border-warning/40 flex flex-col gap-2">
          <div class="flex items-center gap-2 text-warning font-display font-bold text-xs uppercase">
            <NIcon size="18" class="shrink-0"><WarningOutline /></NIcon>
            <span>{{ t('features.puzzleFeedback.report.submittedTitle') }}</span>
          </div>

          <p class="text-xs text-text-primary leading-relaxed">
            {{ t('features.puzzleFeedback.report.submittedText') }}
          </p>

          <div
            v-if="store.verificationResult?.whitePovEvalLabel || store.verificationResult?.tablebaseCategory"
            class="text-[11px] font-condensed text-text-secondary flex flex-wrap gap-x-3 gap-y-1"
          >
            <span v-if="store.verificationResult?.tablebaseCategory">
              Syzygy: <strong class="text-text-primary">{{ store.verificationResult.tablebaseCategory }}</strong>
            </span>
            <span v-if="store.verificationResult?.whitePovEvalLabel">
              Eval (d{{ store.verificationResult.depth ?? 21 }}):
              <strong class="text-text-primary">{{ store.verificationResult.whitePovEvalLabel }}</strong>
            </span>
            <span v-if="wdlWinPercent !== null">
              WDL Win: <strong class="text-text-primary">{{ wdlWinPercent }}%</strong>
            </span>
          </div>
        </div>

        <div class="flex justify-end">
          <NButton size="small" type="primary" @click="store.closeModal()">
            <span class="truncate">{{ t('features.puzzleFeedback.report.closeBtn') }}</span>
          </NButton>
        </div>
      </template>

      <!-- Phase 5: Network / Engine Error -->
      <template v-else>
        <div class="p-3 rounded-md bg-danger/10 border border-danger/40 flex flex-col gap-1.5">
          <div class="text-xs font-display font-bold uppercase text-danger">
            {{ t('features.puzzleFeedback.report.errorTitle') }}
          </div>
          <p class="text-xs text-text-secondary leading-snug">
            {{ store.errorMessage || t('features.puzzleFeedback.report.errorFallback') }}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <NButton
            size="small"
            secondary
            class="min-w-0 overflow-hidden"
            @click="store.closeModal()"
          >
            <span class="truncate">{{ t('features.puzzleFeedback.report.closeBtn') }}</span>
          </NButton>
          <NButton
            size="small"
            type="primary"
            class="min-w-0 overflow-hidden"
            @click="store.startVerification()"
          >
            <span class="truncate">{{ t('features.puzzleFeedback.report.retryBtn') }}</span>
          </NButton>
        </div>
      </template>
    </div>
  </NModal>
</template>
