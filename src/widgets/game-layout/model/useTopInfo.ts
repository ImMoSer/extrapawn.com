// src/widgets/game-layout/model/useTopInfo.ts
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useEndgameStore } from '@/features/endgames'
import { useTornadoStore } from '@/features/tornado'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useTopInfo() {
  const route = useRoute()

  const displayInfo = computed<TopInfoDisplay>(() => {
    const routeName = route.name?.toString() || ''

    if (routeName === 'tornado') return useTornadoStore().topInfoDisplay
    if (routeName.startsWith('finish-him')) return useEndgameStore().topInfoDisplay
    if (routeName.startsWith('theory-endings')) return useEndgameStore().topInfoDisplay
    if (routeName.startsWith('practical-chess')) return useEndgameStore().topInfoDisplay

    // Default fallback
    return {
      title: '',
      badges: [],
      stats: [],
    }
  })

  return {
    displayInfo,
  }
}
