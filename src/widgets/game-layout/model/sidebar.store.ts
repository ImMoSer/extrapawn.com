import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useCoachStore } from '@/features/coach'

export type SidebarMode = 'explorer' | 'coach'

export const useSidebarStore = defineStore('sidebar', () => {
  const coachStore = useCoachStore()
  const activeMode = ref<SidebarMode>('coach')

  function setMode(mode: SidebarMode) {
    if (mode === 'explorer' && coachStore.isFairPlayLocked) {
      return
    }
    activeMode.value = mode
  }

  function toggleMode(mode: SidebarMode) {
    const targetMode = activeMode.value === mode ? 'coach' : mode
    setMode(targetMode)
  }

  watch(
    () => coachStore.isFairPlayLocked,
    (locked) => {
      activeMode.value = locked ? 'coach' : 'explorer'
    },
    { immediate: true },
  )

  return {
    activeMode,
    setMode,
    toggleMode,
  }
})
