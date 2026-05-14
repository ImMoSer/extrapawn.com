import type {
  PersonalActivityStatsResponse,
  UserProfileStatsDto,
  TrainingPlanCurrentResponse,
  TrainingPlanNextResponse,
} from '@/shared/types/api.types'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiClient } from '../client'

const USER_CABINET_KEYS = {
  all: ['user-cabinet'] as const,
  personalActivity: () => [...USER_CABINET_KEYS.all, 'personal-activity'] as const,
  detailedStats: () => [...USER_CABINET_KEYS.all, 'detailed-stats'] as const,
  trainingPlan: () => [...USER_CABINET_KEYS.all, 'training-plan'] as const,
}

export const usePersonalActivityStatsQuery = (enabled: boolean = true) => {
  return useQuery<PersonalActivityStatsResponse, Error>({
    queryKey: USER_CABINET_KEYS.personalActivity(),
    queryFn: () => apiClient<PersonalActivityStatsResponse>('/activity/personal'),
    enabled,
    staleTime: 5 * 60 * 1000,
  })
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
