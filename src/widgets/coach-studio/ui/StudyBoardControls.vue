<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  CloseCircleOutline,
  PauseOutline,
  PlayBackOutline,
  PlayForwardOutline,
  PlayOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const hasMoves = computed(() => studyStore.rootNode.children.length > 0)
const canGoBack = computed(() => Boolean(studyStore.currentNode.parent))
const canGoForward = computed(() => studyStore.currentNode.children.length > 0)
</script>

<template>
  <div class="flex h-full w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface px-2">
    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-primary transition-colors hover:border-border hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35"
      :disabled="!canGoBack"
      :title="t('shared.board.pgn.startOfGame')"
      @click="studyStore.navigateStep('start')"
    >
      <NIcon :size="17"><PlayBackOutline /></NIcon>
    </button>

    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-primary transition-colors hover:border-border hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35"
      :disabled="!canGoBack"
      :title="t('shared.board.pgn.moveBack')"
      @click="studyStore.navigateStep('backward')"
    >
      <NIcon :size="18"><ChevronBackOutline /></NIcon>
    </button>

    <button
      type="button"
      class="flex h-8 min-w-[42px] cursor-pointer items-center justify-center rounded-md border px-2 transition-colors disabled:cursor-not-allowed disabled:opacity-35"
      :class="
        studyStore.isAutoPlaying
          ? 'border-brand/60 bg-brand text-on-brand'
          : 'border-border bg-elevated text-text-primary hover:border-border-hover hover:bg-overlay'
      "
      :disabled="!hasMoves"
      :title="t('pages.study.autoPlay')"
      @click="studyStore.toggleAutoPlay()"
    >
      <NIcon :size="17">
        <PauseOutline v-if="studyStore.isAutoPlaying" />
        <PlayOutline v-else />
      </NIcon>
    </button>

    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-primary transition-colors hover:border-border hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35"
      :disabled="!canGoForward"
      :title="t('shared.board.pgn.moveForward')"
      @click="studyStore.navigateStep('forward')"
    >
      <NIcon :size="18"><ChevronForwardOutline /></NIcon>
    </button>

    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-primary transition-colors hover:border-border hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-35"
      :disabled="!canGoForward"
      :title="t('shared.board.pgn.endOfGame')"
      @click="studyStore.navigateStep('end')"
    >
      <NIcon :size="17"><PlayForwardOutline /></NIcon>
    </button>

    <div class="mx-1 h-5 w-px bg-border" />

    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary"
      :title="t('shared.board.pgn.flipBoard')"
      @click="studyStore.flipOrientation()"
    >
      <NIcon :size="17"><SwapVerticalOutline /></NIcon>
    </button>

    <button
      type="button"
      class="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-text-secondary transition-colors hover:border-border hover:bg-elevated hover:text-text-primary"
      :title="t('pages.study.clearArrows')"
      @click="studyStore.clearTransientShapes()"
    >
      <NIcon :size="17"><CloseCircleOutline /></NIcon>
    </button>
  </div>
</template>
