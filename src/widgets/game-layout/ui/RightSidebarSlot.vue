<script setup lang="ts">
import { useSidebarStore } from '../model/sidebar.store'
import { useGameStore } from '@/entities/game'
import { ExplorerSidebarWidget } from '@/widgets/explorer-sidebar'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'

const sidebarStore = useSidebarStore()
const gameStore = useGameStore()
</script>

<template>
  <div class="right-sidebar-slot-container h-full w-full flex flex-col min-h-0">
    <ExplorerSidebarWidget v-if="sidebarStore.activeMode === 'explorer' && gameStore.gamePhase !== 'FAIRPLAY'" />
    <CoachSidebarWidget v-else-if="sidebarStore.activeMode === 'coach' || gameStore.gamePhase === 'FAIRPLAY'" />
  </div>
</template>
