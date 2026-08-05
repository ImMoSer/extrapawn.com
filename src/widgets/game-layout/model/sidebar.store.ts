import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SidebarMode = 'explorer' | 'wiki' | 'coach'

export const useSidebarStore = defineStore('sidebar', () => {
  const activeMode = ref<SidebarMode>('explorer')

  function setMode(mode: SidebarMode) {
    activeMode.value = mode
  }

  function toggleMode(mode: SidebarMode) {
    activeMode.value = activeMode.value === mode ? 'explorer' : mode
  }

  return {
    activeMode,
    setMode,
    toggleMode,
  }
})
