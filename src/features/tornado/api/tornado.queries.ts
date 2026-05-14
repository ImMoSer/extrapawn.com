import { apiClient } from '@/shared/api/client'
import type {
  TornadoEndResponse,
  TornadoEndSessionDto,
  TornadoMode,
  TornadoStartResponse,
} from '@/shared/types/api.types'
import { useMutation, useQueryClient } from '@tanstack/vue-query'

export function useTornadoQueries() {
  const startSessionMutation = useMutation({
    mutationFn: (args: { mode: TornadoMode; theme?: string }) =>
      apiClient<TornadoStartResponse>(
        `/tornado/start/${args.mode}${args.theme ? `?theme=${args.theme}` : ''}`,
        {
          method: 'GET',
        },
      ),
  })

  const queryClient = useQueryClient()
  const endSessionMutation = useMutation({
    mutationFn: (args: { mode: TornadoMode; dto: TornadoEndSessionDto }) =>
      apiClient<TornadoEndResponse>(`/tornado/end-session/${args.mode}`, {
        method: 'POST',
        body: JSON.stringify(args.dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    },
  })

  return {
    startSessionMutation,
    endSessionMutation,
  }
}
