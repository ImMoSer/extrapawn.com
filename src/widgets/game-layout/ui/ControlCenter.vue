<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import {
  CaretBackSharp,
  CaretForwardSharp,
  CheckmarkOutline,
  GridSharp,
  HardwareChipOutline,
  PlaySkipBackSharp,
  PlaySkipForwardSharp,
  SchoolOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'
import { NIcon, NPopover } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSidebarStore, type SidebarMode } from '../model/sidebar.store'

const { t } = useI18n()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const coachStore = useCoachStore()
const sidebarStore = useSidebarStore()

const isMenuOpen = ref(false)

function selectAnalysisMode(mode: SidebarMode): void {
  sidebarStore.setMode(mode)
  isMenuOpen.value = false
}

function handleFlipBoard(): void {
  boardStore.flipBoard()
  isMenuOpen.value = false
}
</script>

<template>
  <div
    class="h-11 w-full bg-surface border border-border rounded-lg flex items-center justify-center select-none"
  >
    <!-- Centered Sharp Segmented Navigation & Board Menu Bar -->
    <div
      class="inline-flex h-8 items-stretch overflow-hidden rounded-md border border-border bg-elevated/40 divide-x divide-border"
    >
      <button
        type="button"
        :title="t('shared.board.pgn.startOfGame')"
        :aria-label="t('shared.board.pgn.startOfGame')"
        class="w-11 sm:w-12 flex items-center justify-center text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-surface transition-colors cursor-pointer"
        @click="gameStore.navigatePgn('start')"
      >
        <n-icon size="16"><PlaySkipBackSharp /></n-icon>
      </button>

      <button
        type="button"
        :title="t('shared.board.pgn.moveBack')"
        :aria-label="t('shared.board.pgn.moveBack')"
        class="w-11 sm:w-12 flex items-center justify-center text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-surface transition-colors cursor-pointer"
        @click="gameStore.navigatePgn('backward')"
      >
        <n-icon size="18"><CaretBackSharp /></n-icon>
      </button>

      <n-popover
        v-model:show="isMenuOpen"
        trigger="click"
        placement="top"
        :show-arrow="false"
        :raw="true"
        :overlap="false"
      >
        <template #trigger>
          <button
            type="button"
            :title="t('shared.board.pgn.boardMenu')"
            :aria-label="t('shared.board.pgn.boardMenu')"
            :aria-expanded="isMenuOpen"
            class="w-11 sm:w-12 flex items-center justify-center transition-colors cursor-pointer"
            :class="
              isMenuOpen
                ? 'bg-elevated text-brand'
                : 'text-text-primary hover:bg-elevated hover:text-brand'
            "
          >
            <n-icon size="15"><GridSharp /></n-icon>
          </button>
        </template>

        <!-- Upward Board Menu Overlay (rendered above the board via Naive UI teleport) -->
        <div
          class="min-w-52 bg-overlay border border-border rounded-md p-1.5 shadow-lg flex flex-col gap-0.5 select-none"
        >
          <template v-if="!coachStore.isFairPlayLocked">
            <div
              class="px-2 py-1 text-[10px] font-condensed font-bold uppercase tracking-wider text-text-secondary"
            >
              {{ t('shared.board.pgn.analysisMode') }}
            </div>

            <button
              type="button"
              class="w-full px-2.5 py-2 rounded-sm text-xs font-display font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer"
              :class="
                sidebarStore.activeMode === 'explorer'
                  ? 'bg-elevated text-text-primary'
                  : 'text-text-secondary hover:bg-elevated/70 hover:text-text-primary'
              "
              @click="selectAnalysisMode('explorer')"
            >
              <span class="flex items-center gap-2 min-w-0">
                <n-icon size="15" class="shrink-0"><HardwareChipOutline /></n-icon>
                <span class="truncate">{{ t('shared.board.pgn.localStockfish') }}</span>
              </span>
              <n-icon
                v-if="sidebarStore.activeMode === 'explorer'"
                size="14"
                class="text-brand shrink-0"
              >
                <CheckmarkOutline />
              </n-icon>
            </button>

            <button
              type="button"
              class="w-full px-2.5 py-2 rounded-sm text-xs font-display font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer"
              :class="
                sidebarStore.activeMode === 'coach'
                  ? 'bg-elevated text-text-primary'
                  : 'text-text-secondary hover:bg-elevated/70 hover:text-text-primary'
              "
              @click="selectAnalysisMode('coach')"
            >
              <span class="flex items-center gap-2 min-w-0">
                <n-icon size="15" class="shrink-0"><SchoolOutline /></n-icon>
                <span class="truncate">{{ t('shared.board.pgn.serverCoach') }}</span>
              </span>
              <n-icon
                v-if="sidebarStore.activeMode === 'coach'"
                size="14"
                class="text-brand shrink-0"
              >
                <CheckmarkOutline />
              </n-icon>
            </button>

            <div class="h-px bg-border my-1" />
          </template>

          <button
            type="button"
            class="w-full px-2.5 py-2 rounded-sm text-xs font-display font-medium text-text-primary hover:bg-elevated flex items-center gap-2 transition-colors cursor-pointer"
            @click="handleFlipBoard"
          >
            <n-icon size="15" class="text-text-secondary shrink-0"><SwapVerticalOutline /></n-icon>
            <span class="truncate">{{ t('shared.board.pgn.flipBoard') }}</span>
          </button>
        </div>
      </n-popover>

      <button
        type="button"
        :title="t('shared.board.pgn.moveForward')"
        :aria-label="t('shared.board.pgn.moveForward')"
        class="w-11 sm:w-12 flex items-center justify-center text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-surface transition-colors cursor-pointer"
        @click="gameStore.navigatePgn('forward')"
      >
        <n-icon size="18"><CaretForwardSharp /></n-icon>
      </button>

      <button
        type="button"
        :title="t('shared.board.pgn.endOfGame')"
        :aria-label="t('shared.board.pgn.endOfGame')"
        class="w-11 sm:w-12 flex items-center justify-center text-text-secondary hover:bg-elevated hover:text-text-primary active:bg-surface transition-colors cursor-pointer"
        @click="gameStore.navigatePgn('end')"
      >
        <n-icon size="16"><PlaySkipForwardSharp /></n-icon>
      </button>
    </div>
  </div>
</template>
