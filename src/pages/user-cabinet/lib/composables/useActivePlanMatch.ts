import { useTaskTodayStore } from '@/features/task-today'
import { computed } from 'vue'

interface ActivePlanMatchOptions {
  mode: string
  subMode?: string
  theme: string
}

export function useActivePlanMatch(options: () => ActivePlanMatchOptions) {
  const taskTodayStore = useTaskTodayStore()

  const activeTaskKey = computed(() => {
    const activePlan = taskTodayStore.trainingPlan
    if (!taskTodayStore.isPlaying || !activePlan || !activePlan.tasks) {
      return null
    }

    const { mode, subMode, theme } = options()

    for (const task of activePlan.tasks) {
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
