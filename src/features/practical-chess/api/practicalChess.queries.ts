import { apiClient } from '@/shared/api/client'
import type {
  GameResultResponse,
  PracticalChessCategory,
  PracticalChessDifficulty,
  PracticalChessResultDto,
  PracticalPuzzle,
} from '@/shared/types/api.types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'

const PRACTICAL_CHESS_KEYS = {
  all: ['practical-chess'] as const,
  puzzles: () => [...PRACTICAL_CHESS_KEYS.all, 'puzzles'] as const,
  puzzle: (id: string) => [...PRACTICAL_CHESS_KEYS.puzzles(), id] as const,
  params: (category: PracticalChessCategory, difficulty: PracticalChessDifficulty) =>
    [...PRACTICAL_CHESS_KEYS.puzzles(), category, difficulty] as const,
}

export function usePracticalChessQueries(params?: {
  category: Ref<PracticalChessCategory>
  difficulty: Ref<PracticalChessDifficulty>
  puzzleId?: Ref<string | undefined>
}) {
  const puzzleQuery = useQuery({
    queryKey: computed(() => {
      if (params?.puzzleId?.value) return PRACTICAL_CHESS_KEYS.puzzle(params.puzzleId.value)
      return PRACTICAL_CHESS_KEYS.params(
        params?.category.value ?? 'extraPawn',
        params?.difficulty.value ?? 'Novice',
      )
    }),
    queryFn: async () => {
      if (params?.puzzleId?.value) {
        return await apiClient<PracticalPuzzle>(`/practical-chess/puzzle/${params.puzzleId.value}`)
      }
      const category = params?.category.value ?? 'extraPawn'
      return await apiClient<PracticalPuzzle>(
        `/practical-chess/${category}/puzzle?difficulty=${params?.difficulty.value ?? 'Novice'}`,
      )
    },
    enabled: false,
    staleTime: 0,
  })

  const queryClient = useQueryClient()
  const resultMutation = useMutation({
    mutationFn: (args: { category: string; dto: PracticalChessResultDto }) =>
      apiClient<GameResultResponse>(`/practical-chess/${args.category}/process-result`, {
        method: 'POST',
        body: JSON.stringify(args.dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'training-plan'] })
    },
  })

  return {
    puzzleQuery,
    resultMutation,
  }
}
