// src/widgets/game-layout/model/useTopInfo.ts
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useWorkoutStore } from '@/features/workout'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

export function useTopInfo() {
  const route = useRoute()
  const workoutStore = useWorkoutStore()

  const displayInfo = computed<TopInfoDisplay>(() => {
    const routeName = route.name?.toString() || ''

    if (
      routeName.startsWith('finish-him') ||
      routeName.startsWith('theory-endings') ||
      routeName.startsWith('practical-chess') ||
      routeName.startsWith('workout')
    ) {
      return workoutStore.topInfoDisplay
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
