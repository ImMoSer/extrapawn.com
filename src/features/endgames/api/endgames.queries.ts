import { apiClient } from '@/shared/api/client'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { GameResultResponse, PlayPuzzleResultDto } from '@/shared/types/api.types'

export function useEndgamesMutations() {
  const queryClient = useQueryClient()

  const playPuzzleResultMutation = useMutation({
    mutationFn: (dto: PlayPuzzleResultDto) =>
      apiClient<GameResultResponse>('/play-puzzle/result', {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
    },
  })

  return {
    playPuzzleResultMutation,
  }
}
