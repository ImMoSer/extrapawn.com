import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

export type SidebarMode = 'explorer' | 'wiki' | 'coach'

export const useSidebarStore = defineStore('sidebar', () => {
  const activeMode = ref<SidebarMode>('coach')
  const route = useRoute()

  const isWikiAllowed = computed(() => {
    return route?.path?.startsWith('/repertoire-training') ?? false
  })

  function setMode(mode: SidebarMode) {
    if (mode === 'wiki' && !isWikiAllowed.value) {
      activeMode.value = 'coach'
      return
    }
    activeMode.value = mode
  }

  function toggleMode(mode: SidebarMode) {
    const targetMode = activeMode.value === mode ? 'coach' : mode
    setMode(targetMode)
  }

  watch(
    () => route?.path,
    () => {
      if (activeMode.value === 'wiki' && !isWikiAllowed.value) {
        activeMode.value = 'coach'
      }
    },
  )

  return {
    activeMode,
    isWikiAllowed,
    setMode,
    toggleMode,
  }
})
