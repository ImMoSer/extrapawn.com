import type {
  UserProfileStatsDto,
  TrainingPlanCurrentResponse,
  TrainingPlanNextResponse,
  DailyTrainingPlanEntity,
} from '@/shared/types/api.types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiClient } from '../client'

const USER_CABINET_KEYS = {
  all: ['user-cabinet'] as const,
  detailedStats: () => [...USER_CABINET_KEYS.all, 'detailed-stats'] as const,
  trainingPlan: () => [...USER_CABINET_KEYS.all, 'training-plan'] as const,
}

export const useDetailedStatsQuery = (enabled: boolean = true) => {
  return useQuery<UserProfileStatsDto, Error>({
    queryKey: USER_CABINET_KEYS.detailedStats(),
    queryFn: () => apiClient<UserProfileStatsDto>('/users/me/profile-stats'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export const useCurrentTrainingPlanQuery = (enabled: boolean = true) => {
  return useQuery<TrainingPlanCurrentResponse, Error>({
    queryKey: USER_CABINET_KEYS.trainingPlan(),
    queryFn: () => apiClient<TrainingPlanCurrentResponse>('/training-plan/current'),
    enabled,
    staleTime: 60 * 1000,
  })
}

export const useTrainingPlanHistoryQuery = (enabled: boolean = true) => {
  return useQuery<DailyTrainingPlanEntity[], Error>({
    queryKey: [...USER_CABINET_KEYS.trainingPlan(), 'history'],
    queryFn: () => apiClient<DailyTrainingPlanEntity[]>('/training-plan/history'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

export const useNextTrainingPlanMutation = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (level: string) =>
      apiClient<TrainingPlanNextResponse>(`/training-plan/next?level=${level}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_CABINET_KEYS.trainingPlan() })
    },
  })
}
