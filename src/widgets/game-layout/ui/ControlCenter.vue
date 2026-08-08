<script setup lang="ts">
import { useGameStore, useBoardStore } from '@/entities/game'
import { useSidebarStore } from '../model/sidebar.store'
import { NIcon } from 'naive-ui'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const gameStore = useGameStore()
const boardStore = useBoardStore()
const sidebarStore = useSidebarStore()
</script>

<template>
  <div class="h-12 w-full px-4 bg-surface/80 backdrop-blur-md border border-border rounded-xl shadow-flat flex items-center justify-between gap-3 select-none">
    <!-- Left: Sidebar Mode Toggles (EXP - WIKI - COACH) -->
    <div class="flex items-center gap-1.5">
      <button
        @click="sidebarStore.setMode('explorer')"
        title="Opening Explorer & Engine Lines (EXP)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          sidebarStore.activeMode === 'explorer'
            ? 'bg-success/15 text-success border-success/40 shadow-[0_0_10px_rgba(0,255,85,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        EXP
      </button>

      <button
        v-if="sidebarStore.isWikiAllowed"
        @click="sidebarStore.setMode('wiki')"
        title="WikiBooks Opening Theory (WIKI)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          sidebarStore.activeMode === 'wiki'
            ? 'bg-warning/15 text-warning border-warning/40 shadow-[0_0_10px_rgba(255,230,0,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        WIKI
      </button>

      <button
        @click="sidebarStore.setMode('coach')"
        title="Coach Analysis & Explanations (COACH)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          sidebarStore.activeMode === 'coach'
            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        COACH
      </button>
    </div>

    <!-- Center: Controls (PGN Navigation + Board Flip) -->
    <div class="flex items-center gap-1 bg-elevated/80 border border-border p-1 rounded-lg shadow-inner">
      <button
        @click="gameStore.navigatePgn('start')"
        title="Start der Partie"
        class="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-center"
      >
        <n-icon size="16"><PlaySkipBackOutline /></n-icon>
      </button>
      <button
        @click="gameStore.navigatePgn('backward')"
        title="Zug zurück"
        class="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-center"
      >
        <n-icon size="16"><ChevronBackOutline /></n-icon>
      </button>
      <button
        @click="gameStore.navigatePgn('forward')"
        title="Zug vorwärts"
        class="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-center"
      >
        <n-icon size="16"><ChevronForwardOutline /></n-icon>
      </button>
      <button
        @click="gameStore.navigatePgn('end')"
        title="Ende der Partie"
        class="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-center"
      >
        <n-icon size="16"><PlaySkipForwardOutline /></n-icon>
      </button>

      <div class="h-4 w-[1px] bg-border mx-0.5" />

      <button
        @click="boardStore.flipBoard()"
        title="Brett drehen"
        class="p-1.5 rounded-md text-text-secondary hover:text-neon-cyan hover:bg-surface/80 transition-colors cursor-pointer flex items-center justify-center"
      >
        <n-icon size="16"><SwapVerticalOutline /></n-icon>
      </button>
    </div>
  </div>
</template>
