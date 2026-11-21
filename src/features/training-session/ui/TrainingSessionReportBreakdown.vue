<script setup lang="ts">
import {
  resolveScopeLabel,
  resolveTwinBadgeLabel,
  type HydratedSessionItem,
} from '@/entities/training'
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  EyeOutline,
  LockClosedOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import { NButton, NIcon } from 'naive-ui'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  canAnalyzeSessionItem,
  canPracticeReplayItem,
  getItemAttemptsUsed,
} from '../lib/sessionItemPolicy'

const props = defineProps<{
  items: HydratedSessionItem[]
  formatDurationMs: (ms?: number) => string
}>()

const emit = defineEmits<{
  practiceReplay: [puzzleId: string]
  analyzePuzzle: [puzzleId: string]
}>()

const { t, te } = useI18n()
const reportRenderLimit = ref<number>(100)

const visibleReportItems = computed(() => {
  if (props.items.length <= reportRenderLimit.value) return props.items
  return props.items.slice(0, reportRenderLimit.value)
})

const hasMoreReportItems = computed(() => props.items.length > reportRenderLimit.value)

function formatDelta(val: number): string {
  const rounded = Math.round(val * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

function itemCategory(item: HydratedSessionItem): string {
  if (item.course_puzzle) {
    return resolveScopeLabel('scopes', item.course_puzzle.class || 'mixedExam', t, te)
  }
  if (item.tactical) {
    return resolveScopeLabel('scopes', item.tactical.primary_motif, t, te)
  }
  if (item.endgame) {
    return resolveScopeLabel('scopes', item.endgame.class, t, te)
  }
  return item.puzzle_id || `#${item.index + 1}`
}

function itemMetaLabel(item: HydratedSessionItem): string {
  if (item.course_puzzle) {
    return `Курс ${item.course_puzzle.course_id || 1} · Батч #${item.course_puzzle.batch_id}`
  }
  if (item.tactical) return `R: ${item.tactical.rating}`
  if (item.endgame) return `R: ${item.endgame.effective_rating}`
  return ''
}
</script>

<template>
  <div class="rounded-lg bg-surface border border-border overflow-hidden">
    <div class="px-4 py-3 bg-elevated border-b border-border flex items-center justify-between">
      <h2 class="font-display font-bold text-sm uppercase tracking-wider text-text-primary">
        {{ t('features.trainingCenter.report.puzzleBreakdownTitle') }}
      </h2>
      <span class="text-xs text-text-secondary">
        {{ t('features.trainingCenter.report.clickToAnalyzeHint') }}
      </span>
    </div>

    <div class="divide-y divide-border">
      <div
        v-for="item in visibleReportItems"
        :key="item.index"
        class="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-elevated/60 transition-colors"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="font-condensed text-xs text-text-secondary w-6">
            #{{ item.index + 1 }}
          </span>

          <NIcon
            size="18"
            :class="
              item.status === 'solved'
                ? 'text-success'
                : item.status === 'failed'
                  ? 'text-danger'
                  : 'text-text-disabled'
            "
          >
            <CheckmarkCircleOutline v-if="item.status === 'solved'" />
            <CloseCircleOutline v-else-if="item.status === 'failed'" />
            <LockClosedOutline v-else />
          </NIcon>

          <span class="font-medium text-sm text-text-primary truncate">
            {{ itemCategory(item) }}
          </span>

          <span
            v-if="item.course_puzzle?.twin_role"
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40"
          >
            {{ resolveTwinBadgeLabel(item.course_puzzle.twin_role) }}
          </span>

          <span
            v-if="
              item.course_puzzle?.objective === 'hold_draw' ||
              item.endgame?.objective === 'hold_draw'
            "
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40"
          >
            {{ t('features.trainingCenter.badges.holdDrawFide') }}
          </span>

          <span
            v-if="item.status === 'solved' && getItemAttemptsUsed(item) > 1"
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40"
            :title="
              t('features.trainingCenter.play.solvedWithRetriesNote', {
                attempt: getItemAttemptsUsed(item),
              })
            "
          >
            #{{ getItemAttemptsUsed(item) }}
          </span>

          <span
            v-if="item.is_woodpecker"
            class="px-2 py-0.5 rounded-sm text-[10px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40"
          >
            WP {{ item.woodpecker_streak }}/3
          </span>
        </div>

        <div class="flex items-center gap-3 shrink-0">
          <span class="font-condensed text-xs text-text-secondary">
            {{ itemMetaLabel(item) }}
          </span>

          <span
            v-if="item.rating_delta !== undefined"
            class="font-condensed font-bold text-xs min-w-12 text-right"
            :class="item.rating_delta >= 0 ? 'text-success' : 'text-danger'"
          >
            {{ formatDelta(item.rating_delta) }}
          </span>

          <span class="font-condensed text-xs text-warning min-w-14 text-right">
            {{ formatDurationMs(item.time_ms) }}
          </span>

          <NButton
            v-if="canPracticeReplayItem(item)"
            size="tiny"
            secondary
            @click="emit('practiceReplay', item.puzzle_id!)"
          >
            <template #icon>
              <NIcon><RefreshOutline /></NIcon>
            </template>
            {{ t('features.trainingCenter.actions.practiceReplay') }}
          </NButton>

          <NButton
            v-if="canAnalyzeSessionItem(item)"
            size="tiny"
            secondary
            @click="emit('analyzePuzzle', item.puzzle_id!)"
          >
            <template #icon>
              <NIcon><EyeOutline /></NIcon>
            </template>
            {{ t('features.trainingCenter.actions.analyze') }}
          </NButton>
        </div>
      </div>
    </div>

    <div v-if="hasMoreReportItems" class="p-3 bg-elevated border-t border-border text-center">
      <NButton size="small" secondary @click="reportRenderLimit += 200">
        Показать ещё ({{ visibleReportItems.length }} / {{ items.length }})
      </NButton>
    </div>
  </div>
</template>
