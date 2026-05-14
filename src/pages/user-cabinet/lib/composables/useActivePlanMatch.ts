import { useCurrentTrainingPlanQuery } from '@/shared/api/queries/userCabinet.queries'
import { computed } from 'vue'

interface ActivePlanMatchOptions {
  mode: string
  subMode?: string
  theme: string
}

export function useActivePlanMatch(options: () => ActivePlanMatchOptions) {
  // We do not pass `enabled: false` because we want it to fetch or use cached plan data
  const { data: planData } = useCurrentTrainingPlanQuery()

  const activeTaskKey = computed(() => {
    const activePlan = planData.value
    if (!activePlan?.active || !activePlan?.plan?.tasks) {
      return null
    }

    const { mode, subMode, theme } = options()

    for (const task of activePlan.plan.tasks) {
      if (task.mode !== mode) continue
      if (subMode && task.sub_mode !== subMode) continue

      for (const t of task.themes) {
        const taskThemeName = t.name === 'rook' ? 'rookPawn' : t.name
        const currentThemeName = theme === 'rook' ? 'rookPawn' : theme

        if (taskThemeName === currentThemeName) {
          return `${task.mode}-${task.sub_mode}-${t.name}`
        }
      }
    }
    return null
  })

  const isTaskInActivePlan = computed(() => activeTaskKey.value !== null)

  return {
    isTaskInActivePlan,
    activeTaskKey,
  }
}
