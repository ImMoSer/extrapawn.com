import { apiClient } from '@/shared/api/client'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GameResultResponse } from '@/shared/types/api.types'

export function useEndgamesMutations() {
  const queryClient = useQueryClient()

  const finishHimMutation = useMutation({
    mutationFn: (dto: unknown) =>
      apiClient<GameResultResponse>('/finish-him/result', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
    },
  })

  const theoryMutation = useMutation({
    mutationFn: (dto: unknown) =>
      apiClient<GameResultResponse>('/theory-endings/result', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
    },
  })

  const practicalMutation = useMutation({
    mutationFn: (args: { category: string; dto: unknown }) =>
      apiClient<GameResultResponse>(`/practical-chess/${args.category}/process-result`, {
        method: 'POST',
        body: JSON.stringify(args.dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
    },
  })

  return {
    finishHimMutation,
    theoryMutation,
    practicalMutation,
  }
}
