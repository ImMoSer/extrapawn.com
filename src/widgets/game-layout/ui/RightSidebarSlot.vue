<script setup lang="ts">
import { useSidebarStore } from '../model/sidebar.store'
import { ExplorerSidebarWidget } from '@/widgets/explorer-sidebar'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'
import { WikiBooksPanel } from '@/features/mozer-book'

const sidebarStore = useSidebarStore()
</script>

<template>
  <div class="right-sidebar-slot-container h-full w-full flex flex-col min-h-0">
    <ExplorerSidebarWidget v-if="sidebarStore.activeMode === 'explorer'" />
    <div v-else-if="sidebarStore.activeMode === 'wiki' && sidebarStore.isWikiAllowed" class="h-full w-full flex flex-col p-2 bg-surface rounded-md border border-border overflow-hidden">
      <WikiBooksPanel />
    </div>
    <CoachSidebarWidget v-else-if="sidebarStore.activeMode === 'coach'" />
  </div>
</template>
