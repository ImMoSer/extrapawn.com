<script setup lang="ts">
import {
  resolveScopeLabel,
  resolveTwinShortTag,
  type HydratedSessionItem,
} from '@/entities/training'
import { CheckmarkOutline, CloseOutline, LockClosedOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { canAnalyzeSessionItem, isSessionItemHydrated } from '../lib/sessionItemPolicy'

const props = defineProps<{
  item: HydratedSessionItem
  isCurrent: boolean
  isInspectionActive: boolean
  isInspectingThis: boolean
  canSwitchSidebarItem: boolean
  formatDurationMs: (ms: number | undefined) => string
}>()

const emit = defineEmits<{
  select: [puzzleId: string]
}>()

const { t, te } = useI18n()

const hydrated = computed(() => isSessionItemHydrated(props.item))
const clickable = computed(
  () => props.canSwitchSidebarItem && canAnalyzeSessionItem(props.item) && Boolean(props.item.puzzle_id),
)
const showLockedVisual = computed(
  () => !canAnalyzeSessionItem(props.item) && props.isInspectionActive,
)

const BLUR_TITLE_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32', 'w-40'] as const
const BLUR_SUB_WIDTHS = ['w-16', 'w-20', 'w-14', 'w-24'] as const

const blurTitleWidthClass = computed(
  () => BLUR_TITLE_WIDTHS[props.item.index % BLUR_TITLE_WIDTHS.length],
)
const blurSubWidthClass = computed(
  () => BLUR_SUB_WIDTHS[props.item.index % BLUR_SUB_WIDTHS.length],
)

const categoryLabel = computed(() => {
  const it = props.item
  if (it.course_puzzle) {
    if (it.course_puzzle.domain === 'EXAMS' && (it.status === 'pending' || !it.course_puzzle.class)) {
      return `Экзамен · Батч #${it.course_puzzle.batch_id}`
    }
    return resolveScopeLabel('scopes', it.course_puzzle.class || 'mixedExam', t, te)
  }
  if (it.tactical) {
    return resolveScopeLabel('scopes', it.tactical.primary_motif, t, te)
  }
  if (it.endgame) {
    return resolveScopeLabel('scopes', it.endgame.class, t, te)
  }
  return `#${it.index + 1}`
})

const metaSubtitle = computed(() => {
  const it = props.item
  if (it.course_puzzle) {
    return `Курс ${it.course_puzzle.course_id || 1} · Батч #${it.course_puzzle.batch_id}`
  }
  if (it.tactical) return `R: ${it.tactical.rating}`
  if (it.endgame) return `R: ${it.endgame.effective_rating}`
  return ''
})

const objective = computed<'win' | 'hold_draw'>(() => {
  const it = props.item
  if (it.course_puzzle) {
    if (it.course_puzzle.domain === 'EXAMS' && it.status === 'pending') {
      return 'win'
    }
    return it.course_puzzle.objective
  }
  return it.endgame?.objective ?? 'win'
})

const twinShortTag = computed(() => {
  const it = props.item
  if (!it.course_puzzle?.twin_role) return ''
  if (it.course_puzzle.domain === 'EXAMS' && it.status === 'pending') return ''
  return resolveTwinShortTag(it.course_puzzle.twin_role)
})

const formattedDelta = computed(() => {
  const delta = props.item.rating_delta
  if (delta === undefined) return ''
  const rounded = Math.round(delta * 10) / 10
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
})

function handleClick(): void {
  if (!clickable.value || !props.item.puzzle_id) return
  emit('select', props.item.puzzle_id)
}
</script>

<template>
  <div
    class="flex items-center justify-between px-2.5 py-2 text-xs transition-colors"
    :title="showLockedVisual ? t('features.trainingCenter.sidebar.pendingLockedHint') : undefined"
    :class="[
      isCurrent && !isInspectionActive ? 'bg-elevated border-l-2 border-l-brand' : '',
      isInspectingThis ? 'bg-accent/15 border-l-2 border-l-accent' : '',
      item.status === 'solved' ? 'bg-success/5 border-l-2 border-l-success' : '',
      item.status === 'failed' ? 'bg-danger/5 border-l-2 border-l-danger' : '',
      clickable ? 'cursor-pointer hover:bg-elevated/70' : '',
      showLockedVisual ? 'opacity-50 cursor-not-allowed' : '',
    ]"
    @click="handleClick"
  >
    <!-- Left: Status Icon + Category (or Frosted Blurred Placeholder for Unloaded Slots) -->
    <div class="flex items-center gap-2 min-w-0 flex-1">
      <span
        class="w-5 h-5 rounded-sm flex items-center justify-center font-condensed font-bold text-[11px] shrink-0 border"
        :class="[
          item.status === 'solved'
            ? 'bg-success/15 text-success border-success/40'
            : item.status === 'failed'
              ? 'bg-danger/15 text-danger border-danger/40'
              : isCurrent
                ? 'bg-brand text-on-brand border-brand'
                : 'bg-elevated text-text-secondary border-border',
        ]"
      >
        <NIcon v-if="item.status === 'solved'" size="12"><CheckmarkOutline /></NIcon>
        <NIcon v-else-if="item.status === 'failed'" size="12"><CloseOutline /></NIcon>
        <template v-else>{{ item.index + 1 }}</template>
      </span>

      <div v-if="hydrated" class="flex flex-col min-w-0 flex-1 transition-all duration-300">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="truncate text-text-primary font-medium">
            {{ categoryLabel }}
          </span>
          <span
            v-if="twinShortTag"
            class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40 shrink-0"
            title="Золотой перевёртыш"
          >
            TWIN {{ twinShortTag }}
          </span>
          <span
            v-if="objective === 'hold_draw'"
            class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-warning/15 text-warning border border-warning/40 shrink-0"
          >
            DRAW
          </span>
          <span
            v-if="item.is_woodpecker"
            class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40 shrink-0"
          >
            WP {{ item.woodpecker_streak }}/3
          </span>
        </div>
        <span class="font-condensed text-[11px] text-text-secondary">
          {{ metaSubtitle }}
        </span>
      </div>

      <!-- Blurred Skeleton Placeholder (Future Unloaded Slot — Zero DOM/JSON Spoilers) -->
      <div
        v-else
        class="flex flex-col gap-1 min-w-0 flex-1 py-0.5 select-none"
        aria-hidden="true"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <span
            class="h-3 rounded-xs bg-text-secondary/25 blur-[2.5px] opacity-65 pointer-events-none"
            :class="blurTitleWidthClass"
          />
          <span
            v-if="item.is_woodpecker"
            class="px-1 py-0.2 rounded-sm text-[9px] font-condensed font-bold uppercase bg-accent/15 text-accent border border-accent/40 shrink-0"
          >
            WP {{ item.woodpecker_streak }}/3
          </span>
        </div>
        <span
          class="h-2.5 rounded-xs bg-text-secondary/20 blur-[2px] opacity-55 pointer-events-none"
          :class="blurSubWidthClass"
        />
      </div>
    </div>

    <!-- Right: Lock Icon (Pending in Analysis) / Rating Delta + Time -->
    <div class="flex items-center gap-2 shrink-0 ml-2">
      <NIcon
        v-if="showLockedVisual"
        size="13"
        class="text-text-disabled"
      >
        <LockClosedOutline />
      </NIcon>
      <span
        v-if="item.rating_delta !== undefined"
        class="font-condensed font-bold text-[11px]"
        :class="item.rating_delta >= 0 ? 'text-success' : 'text-danger'"
      >
        {{ formattedDelta }}
      </span>
      <span class="font-condensed text-[11px] text-text-secondary min-w-12 text-right">
        {{ item.time_ms ? formatDurationMs(item.time_ms) : '--:--.-' }}
      </span>
    </div>
  </div>
</template>
