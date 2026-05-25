// src/widgets/game-layout/model/useTopInfo.ts
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useEndgamesStore } from '@/features/endgames'
import { useTacticsStore } from '@/features/tactics'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useTopInfo() {
  const route = useRoute()
  const endgamesStore = useEndgamesStore()
  const tacticsStore = useTacticsStore()

  const displayInfo = computed<TopInfoDisplay>(() => {
    const routeName = route.name?.toString() || ''

    if (routeName.startsWith('endgames')) {
      return endgamesStore.topInfoDisplay
    }
    
    if (routeName.startsWith('tactics')) {
      return tacticsStore.topInfoDisplay
    }

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
