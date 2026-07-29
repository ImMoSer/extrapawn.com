<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useGameStore, useBoardStore } from '@/entities/game'
import { useCoachStore, SettingsPanel } from '@/features/coach'
import { NIcon } from 'naive-ui'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  PlaySkipBackOutline,
  PlaySkipForwardOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const route = useRoute()
const gameStore = useGameStore()
const boardStore = useBoardStore()
const coachStore = useCoachStore()

const isSparringRoute = computed(() => route.path.startsWith('/sparring'))
</script>

<template>
  <div class="h-12 w-full px-4 bg-surface/80 backdrop-blur-md border border-border rounded-xl shadow-flat flex items-center justify-between gap-3 select-none">
    <!-- Left: Coach Tab Toggles (MB - WT - SF - CC) -->
    <div class="flex items-center gap-1.5">
      <button
        v-if="isSparringRoute"
        @click="coachStore.toggleTab('book')"
        title="MozerBook Opening Explorer (MB)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          coachStore.activeTab === 'book'
            ? 'bg-success/15 text-success border-success/40 shadow-[0_0_10px_rgba(0,255,85,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        MB
      </button>

      <button
        v-if="isSparringRoute"
        @click="coachStore.toggleTab('wiki')"
        title="WikiBooks Opening Theory (WT)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          coachStore.activeTab === 'wiki'
            ? 'bg-warning/15 text-warning border-warning/40 shadow-[0_0_10px_rgba(255,230,0,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        WT
      </button>

      <button
        @click="coachStore.toggleTab('sf')"
        title="Stockfish Evaluation & Lines (SF)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          coachStore.activeTab === 'sf'
            ? 'bg-cyan-500/15 text-cyan-400 border-cyan-500/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        SF
      </button>

      <button
        @click="coachStore.toggleTab('console')"
        title="Toggle Visualizer Debug Console (CC)"
        class="px-2.5 py-1 rounded-md text-[11px] font-condensed font-bold border transition-all duration-150 cursor-pointer"
        :class="
          coachStore.activeTab === 'console'
            ? 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/40 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
            : 'bg-elevated/60 text-text-secondary border-border hover:border-border-hover hover:text-text-primary hover:bg-elevated'
        "
      >
        CC
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

    <!-- Right: Settings Gear (Zahnrad) -->
    <div class="flex items-center">
      <SettingsPanel @change="coachStore.handleSettingsChange()" />
    </div>
  </div>
</template>
