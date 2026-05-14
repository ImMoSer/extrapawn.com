// src/widgets/game-layout/model/useTopInfo.ts
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useDiamondHunterStore } from '@/features/diamond-hunter'
import { useFinishHimStore } from '@/features/finish-him'
import { useOpeningSparringStore } from '@/features/opening-sparring'
import { usePracticalChessStore } from '@/features/practical-chess'
import { useTheoryEndingsStore } from '@/features/theory-endings'
import { useTornadoStore } from '@/features/tornado'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useTopInfo() {
  const route = useRoute()

  const displayInfo = computed<TopInfoDisplay>(() => {
    const routeName = route.name?.toString() || ''

    if (routeName === 'tornado') return useTornadoStore().topInfoDisplay
    if (routeName === 'diamond-hunter') return useDiamondHunterStore().topInfoDisplay
    if (routeName.startsWith('finish-him')) return useFinishHimStore().topInfoDisplay
    if (routeName.startsWith('theory-endings')) return useTheoryEndingsStore().topInfoDisplay
    if (routeName.startsWith('practical-chess')) return usePracticalChessStore().topInfoDisplay
    if (routeName === 'opening-sparring') return useOpeningSparringStore().topInfoDisplay

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
