import { apiClient } from '@/shared/api/client'
import type {
  TacticsDifficulty,
  TacticsPuzzle,
  TacticsTheme,
} from '@/shared/types/api.types'
import { useMutation } from '@tanstack/vue-query'

export function useTacticsQueries() {
  const getTacticMutation = useMutation({
    mutationFn: (args: { theme: TacticsTheme; difficulty: TacticsDifficulty }) =>
      apiClient<TacticsPuzzle>(
        `/tactics/start?theme=${args.theme}&difficulty=${args.difficulty}`,
        {
          method: 'GET',
        },
      ),
  })

  return {
    getTacticMutation,
  }
}
