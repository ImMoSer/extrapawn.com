<script setup lang="ts">
import { useSidebarStore } from '../model/sidebar.store'
import { useCoachStore } from '@/features/coach'
import { ExplorerSidebarWidget } from '@/widgets/explorer-sidebar'
import { CoachSidebarWidget } from '@/widgets/coach-sidebar'

const sidebarStore = useSidebarStore()
const coachStore = useCoachStore()
</script>

<template>
  <div class="right-sidebar-slot-container h-full w-full flex flex-col min-h-0">
    <ExplorerSidebarWidget v-if="sidebarStore.activeMode === 'explorer' && !coachStore.isFairPlayLocked" />
    <CoachSidebarWidget v-else-if="sidebarStore.activeMode === 'coach' || coachStore.isFairPlayLocked" />
  </div>
</template>
