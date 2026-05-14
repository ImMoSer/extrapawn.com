import { apiClient } from '@/shared/api/client'
import type {
  GameResultResponse,
  TheoryEndingCategory,
  TheoryEndingDifficulty,
  TheoryEndingResultDto,
  TheoryEndingType,
  TheoryPuzzle,
} from '@/shared/types/api.types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type Ref } from 'vue'

const THEORY_ENDINGS_KEYS = {
  all: ['theory-endings'] as const,
  puzzles: () => [...THEORY_ENDINGS_KEYS.all, 'puzzles'] as const,
  puzzle: (type: TheoryEndingType, id: string) =>
    [...THEORY_ENDINGS_KEYS.puzzles(), type, id] as const,
  params: (
    type: TheoryEndingType,
    difficulty: TheoryEndingDifficulty,
    category: TheoryEndingCategory,
  ) => [...THEORY_ENDINGS_KEYS.puzzles(), type, difficulty, category] as const,
}

export function useTheoryEndingsQueries(params?: {
  type: Ref<TheoryEndingType | null>
  difficulty: Ref<TheoryEndingDifficulty | null>
  category: Ref<TheoryEndingCategory | null>
  puzzleId?: Ref<string | undefined>
}) {
  const puzzleQuery = useQuery({
    queryKey: computed(() => {
      const type = params?.type.value
      const id = params?.puzzleId?.value
      const diff = params?.difficulty.value
      const cat = params?.category.value

      if (id && type) return THEORY_ENDINGS_KEYS.puzzle(type, id)
      if (type && diff && cat) return THEORY_ENDINGS_KEYS.params(type, diff, cat)
      return [...THEORY_ENDINGS_KEYS.puzzles(), 'unknown']
    }),
    queryFn: async () => {
      const type = params?.type.value
      const id = params?.puzzleId?.value
      const diff = params?.difficulty.value
      const cat = params?.category.value

      if (id && type) {
        return await apiClient<TheoryPuzzle>(`/theory-endings/puzzle/${type}/${id}`)
      }

      if (type && diff && cat) {
        return await apiClient<TheoryPuzzle>(
          `/theory-endings/puzzle?mode=${type}&difficulty=${diff}&category=${cat}`,
        )
      }

      throw new Error('Missing parameters for Theory Ending puzzle fetch')
    },
    enabled: false,
    staleTime: 0,
  })

  const queryClient = useQueryClient()
  const resultMutation = useMutation({
    mutationFn: (dto: TheoryEndingResultDto) =>
      apiClient<GameResultResponse>('/theory-endings/result', {
        method: 'POST',
        body: JSON.stringify(dto),
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
