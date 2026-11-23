<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import StudyPgnNode from './StudyPgnNode.vue'

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const hasMoves = computed(() => studyStore.rootNode.children.length > 0)
const hasRootShapes = computed(() =>
  Boolean(studyStore.rootNode.shapes && studyStore.rootNode.shapes.length > 0),
)
const isRootActive = computed(() => studyStore.currentNode === studyStore.rootNode)

const evalBadge = computed(() => {
  const meta = studyStore.latestMeta
  if (!meta) return null
  return {
    source: meta.eval_source.toUpperCase(),
    value: meta.eval_white,
  }
})

const objectiveLabel = computed(() => {
  const obj = studyStore.activeChapter?.objective
  if (obj === 'win') return t('pages.study.objectiveWin')
  if (obj === 'hold_draw') return t('pages.study.objectiveDraw')
  return null
})

const handleSelectRoot = () => {
  studyStore.navigateToNode(studyStore.rootNode)
}
</script>

<template>
  <section class="flex h-full min-h-0 flex-col rounded-lg border border-border bg-surface">
    <!-- Top Header: Evaluation & Objective -->
    <div class="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
      <span class="truncate font-display text-xs font-semibold tracking-wide text-text-primary uppercase">
        {{ studyStore.activeChapter?.title || t('pages.study.pgnTitle') }}
      </span>

      <div class="flex shrink-0 items-center gap-1.5">
        <span
          v-if="objectiveLabel"
          class="rounded-sm border border-border bg-elevated px-1.5 py-0.5 font-condensed text-[0.72rem] text-text-primary"
        >
          {{ objectiveLabel }}
        </span>
        <span
          v-if="evalBadge"
          class="rounded-sm border border-brand/40 bg-elevated px-1.5 py-0.5 font-condensed text-[0.72rem] font-semibold text-brand"
        >
          {{ evalBadge.source }} {{ evalBadge.value }}
        </span>
      </div>
    </div>

    <!-- Scrollable PGN & Root Commentary -->
    <div class="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
      <!-- Root position comment card (click to jump to start position & root arrows) -->
      <button
        v-if="studyStore.rootComment || hasRootShapes"
        type="button"
        class="w-full cursor-pointer rounded-md border p-2.5 text-left transition-colors"
        :class="
          isRootActive
            ? 'border-brand/60 bg-elevated text-text-primary'
            : 'border-border bg-elevated/55 text-text-secondary hover:border-border-hover hover:text-text-primary'
        "
        @click="handleSelectRoot"
      >
        <div class="mb-1 flex items-center justify-between gap-2">
          <span class="font-condensed text-[0.72rem] font-semibold tracking-wide text-brand uppercase">
            {{ t('pages.study.startPosition') }}
          </span>
          <span
            v-if="hasRootShapes"
            class="inline-block h-2 w-2 rounded-full bg-success"
            aria-hidden="true"
          />
        </div>
        <p v-if="studyStore.rootComment" class="m-0 font-display text-xs leading-relaxed">
          {{ studyStore.rootComment }}
        </p>
      </button>

      <!-- Branching PGN Tree -->
      <div
        v-if="hasMoves"
        class="text-left font-condensed text-[0.95rem] leading-relaxed text-text-primary"
      >
        <StudyPgnNode :node="studyStore.rootNode" :depth="0" />
      </div>

      <div
        v-else
        class="flex flex-1 items-center justify-center p-6 text-center text-xs text-text-secondary italic"
      >
        {{
          studyStore.activeChapter
            ? t('shared.board.pgn.noMoves')
            : t('pages.study.pgnEmptyHint')
        }}
      </div>
    </div>

    <!-- Compact Owner Telemetry Footer -->
    <div
      v-if="studyStore.latestTelemetry"
      class="flex items-center justify-between gap-2 border-t border-border px-3 py-1.5 font-condensed text-[0.7rem] text-text-secondary"
    >
      <span class="truncate">{{ studyStore.latestTelemetry.model_id }}</span>
      <span class="shrink-0">
        {{ studyStore.latestTelemetry.input_tokens }}/{{ studyStore.latestTelemetry.cached_tokens }}c ·
        {{ studyStore.latestTelemetry.output_tokens }} out ·
        {{ (studyStore.latestTelemetry.latency_ms / 1000).toFixed(1) }}s
      </span>
    </div>
  </section>
</template>
