<script setup lang="ts">
import { useGameStore, useBoardStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import { useSidebarStore } from '../model/sidebar.store'
import { useI18n } from 'vue-i18n'
import { NIcon } from 'naive-ui'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const { t } = useI18n()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const coachStore = useCoachStore()
const sidebarStore = useSidebarStore()
</script>

<template>
  <div class="h-12 w-full px-3.5 bg-surface border border-border rounded-lg flex items-center justify-between gap-3 select-none">
    <!-- Left: Sidebar Mode Toggles (EXP - COACH) -->
    <div class="flex items-center gap-1.5">
      <button
        v-if="!coachStore.isFairPlayLocked"
        type="button"
        :title="t('shared.board.pgn.modeExplorer')"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-colors cursor-pointer"
        :class="
          sidebarStore.activeMode === 'explorer'
            ? 'bg-elevated text-text-primary border-border-hover'
            : 'bg-transparent text-text-secondary border-transparent hover:border-border hover:text-text-primary hover:bg-elevated/60'
        "
        @click="sidebarStore.setMode('explorer')"
      >
        STOCKFISH
      </button>

      <button
        type="button"
        :title="t('shared.board.pgn.modeCoach')"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-colors cursor-pointer"
        :class="
          sidebarStore.activeMode === 'coach'
            ? 'bg-elevated text-brand border-brand/40'
            : 'bg-transparent text-text-secondary border-transparent hover:border-border hover:text-text-primary hover:bg-elevated/60'
        "
        @click="sidebarStore.setMode('coach')"
      >
        COACH
      </button>
    </div>

    <!-- Center: Controls (PGN Navigation + Board Flip) -->
    <div class="flex items-center gap-1 bg-elevated border border-border p-1 rounded-md">
      <button
        type="button"
        :title="t('shared.board.pgn.startOfGame')"
        :aria-label="t('shared.board.pgn.startOfGame')"
        class="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('start')"
      >
        <n-icon size="16"><PlaySkipBackOutline /></n-icon>
      </button>
      <button
        type="button"
        :title="t('shared.board.pgn.moveBack')"
        :aria-label="t('shared.board.pgn.moveBack')"
        class="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('backward')"
      >
        <n-icon size="16"><ChevronBackOutline /></n-icon>
      </button>
      <button
        type="button"
        :title="t('shared.board.pgn.moveForward')"
        :aria-label="t('shared.board.pgn.moveForward')"
        class="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('forward')"
      >
        <n-icon size="16"><ChevronForwardOutline /></n-icon>
      </button>
      <button
        type="button"
        :title="t('shared.board.pgn.endOfGame')"
        :aria-label="t('shared.board.pgn.endOfGame')"
        class="p-1.5 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('end')"
      >
        <n-icon size="16"><PlaySkipForwardOutline /></n-icon>
      </button>

      <div class="h-4 w-px bg-border mx-0.5" />

      <button
        type="button"
        :title="t('shared.board.pgn.flipBoard')"
        :aria-label="t('shared.board.pgn.flipBoard')"
        class="p-1.5 rounded-sm text-text-secondary hover:text-brand hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="boardStore.flipBoard()"
      >
        <n-icon size="16"><SwapVerticalOutline /></n-icon>
      </button>
    </div>
  </div>
</template>
