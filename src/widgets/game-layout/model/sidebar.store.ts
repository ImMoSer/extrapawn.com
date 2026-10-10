import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useGameStore } from '@/entities/game'

export type SidebarMode = 'explorer' | 'coach'

export const useSidebarStore = defineStore('sidebar', () => {
  const gameStore = useGameStore()
  const activeMode = ref<SidebarMode>('coach')

  function setMode(mode: SidebarMode) {
    if (mode === 'explorer' && gameStore.gamePhase === 'FAIRPLAY') {
      return
    }
    activeMode.value = mode
  }

  function toggleMode(mode: SidebarMode) {
    const targetMode = activeMode.value === mode ? 'coach' : mode
    setMode(targetMode)
  }

  watch(
    () => gameStore.gamePhase,
    (phase) => {
      if (phase === 'FAIRPLAY' && activeMode.value === 'explorer') {
        activeMode.value = 'coach'
      }
    },
  )

  return {
    activeMode,
    setMode,
    toggleMode,
  }
})
