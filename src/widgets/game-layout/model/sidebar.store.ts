import { defineStore } from 'pinia'
import { ref } from 'vue'

export type SidebarMode = 'explorer' | 'coach'

export const useSidebarStore = defineStore('sidebar', () => {
  const activeMode = ref<SidebarMode>('coach')

  function setMode(mode: SidebarMode) {
    activeMode.value = mode
  }

  function toggleMode(mode: SidebarMode) {
    const targetMode = activeMode.value === mode ? 'coach' : mode
    setMode(targetMode)
  }

  return {
    activeMode,
    setMode,
    toggleMode,
  }
})
