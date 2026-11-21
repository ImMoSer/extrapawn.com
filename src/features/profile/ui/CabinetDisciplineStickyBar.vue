<script setup lang="ts">
import {
  resolveDisciplineLabel,
  stepDiscipline,
  type TrainingDiscipline,
} from '@/entities/training'
import { useHorizontalSwipe } from '@/shared/lib/touch/useHorizontalSwipe'
import { CaretBackSharp, CaretForwardSharp } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  visible: boolean
  disciplines: readonly TrainingDiscipline[]
  selectedDiscipline: TrainingDiscipline
  rating: number | null
}>()

const emit = defineEmits<{
  selectDiscipline: [discipline: TrainingDiscipline]
}>()

const { t } = useI18n()

const activeLabel = computed(() => resolveDisciplineLabel(props.selectedDiscipline, t))

function goPrev(): void {
  emit('selectDiscipline', stepDiscipline(props.disciplines, props.selectedDiscipline, -1))
}

function goNext(): void {
  emit('selectDiscipline', stepDiscipline(props.disciplines, props.selectedDiscipline, 1))
}

const swipe = useHorizontalSwipe({
  onSwipeLeft: goNext,
  onSwipeRight: goPrev,
})
</script>

<template>
  <!-- Zero-height sticky anchor prevents layout shift when toggling visibility -->
  <div class="sticky top-0 z-30 h-0 overflow-visible @5xl:hidden select-none">
    <div
      class="h-10 -mx-1.5 px-1 bg-surface border-b border-border shadow-md flex items-center justify-between transition-all duration-150"
      :class="
        visible
          ? 'opacity-100 translate-y-0 pointer-events-auto'
          : 'opacity-0 -translate-y-2 pointer-events-none'
      "
      @touchstart.passive="swipe.onTouchstart"
      @touchend="swipe.onTouchend"
      @touchcancel="swipe.onTouchcancel"
    >
      <button
        type="button"
        class="h-full w-10 flex items-center justify-center text-text-secondary hover:text-text-primary active:text-brand transition-colors cursor-pointer shrink-0"
        :aria-label="t('pages.userCabinet.macro.prevDiscipline')"
        @click="goPrev"
      >
        <NIcon size="18"><CaretBackSharp /></NIcon>
      </button>

      <div class="flex flex-col items-center justify-center min-w-0">
        <div class="flex items-baseline gap-1.5 min-w-0">
          <span
            class="font-display font-bold text-xs uppercase tracking-wider text-text-primary truncate"
          >
            {{ activeLabel }}
          </span>
          <span v-if="rating !== null" class="text-text-disabled text-xs">·</span>
          <span
            v-if="rating !== null"
            class="font-condensed font-bold text-sm text-brand shrink-0"
          >
            {{ Math.round(rating) }}
          </span>
        </div>

        <div class="flex items-center gap-1 mt-0.5">
          <span
            v-for="disc in disciplines"
            :key="disc"
            class="h-1 rounded-xs transition-all"
            :class="disc === selectedDiscipline ? 'w-3.5 bg-brand' : 'w-1.5 bg-border-hover'"
          />
        </div>
      </div>

      <button
        type="button"
        class="h-full w-10 flex items-center justify-center text-text-secondary hover:text-text-primary active:text-brand transition-colors cursor-pointer shrink-0"
        :aria-label="t('pages.userCabinet.macro.nextDiscipline')"
        @click="goNext"
      >
        <NIcon size="18"><CaretForwardSharp /></NIcon>
      </button>
    </div>
  </div>
</template>
