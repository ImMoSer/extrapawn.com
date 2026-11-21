<script setup lang="ts">
import { useBoardStore, useGameStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import {
  CheckmarkOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  HardwareChipOutline,
  MenuOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
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
    class="h-11 w-full px-2 bg-surface border border-border rounded-lg flex items-center justify-center select-none"
  >
    <!-- Centered PGN Navigation + Upward Board Menu: ⏮ ◀ ☰ ▶ ⏭ -->
    <div class="flex items-center gap-1 bg-elevated border border-border p-1 rounded-md">
      <button
        type="button"
        :title="t('shared.board.pgn.startOfGame')"
        :aria-label="t('shared.board.pgn.startOfGame')"
        class="h-7 w-9 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('start')"
      >
        <n-icon size="16"><PlaySkipBackOutline /></n-icon>
      </button>

      <button
        type="button"
        :title="t('shared.board.pgn.moveBack')"
        :aria-label="t('shared.board.pgn.moveBack')"
        class="h-7 w-9 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('backward')"
      >
        <n-icon size="16"><ChevronBackOutline /></n-icon>
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
            class="h-7 w-10 rounded-sm transition-colors cursor-pointer flex items-center justify-center border"
            :class="
              isMenuOpen
                ? 'bg-surface text-brand border-border-hover'
                : 'bg-surface/60 text-text-primary border-border hover:bg-surface hover:border-border-hover'
            "
          >
            <n-icon size="17"><MenuOutline /></n-icon>
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
        class="h-7 w-9 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('forward')"
      >
        <n-icon size="16"><ChevronForwardOutline /></n-icon>
      </button>

      <button
        type="button"
        :title="t('shared.board.pgn.endOfGame')"
        :aria-label="t('shared.board.pgn.endOfGame')"
        class="h-7 w-9 rounded-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer flex items-center justify-center"
        @click="gameStore.navigatePgn('end')"
      >
        <n-icon size="16"><PlaySkipForwardOutline /></n-icon>
      </button>
    </div>
  </div>
</template>
