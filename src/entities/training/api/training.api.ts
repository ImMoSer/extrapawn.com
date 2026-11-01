import { apiClient } from '@/shared/api/client'
import type {
  ActiveSessionResponseDTO,
  AttemptRequest,
  AttemptResultDTO,
  CabinetDTO,
  CatalogManifestDTO,
  ChallengeAttemptRequest,
  ChallengeRecordEntryDTO,
  ChallengeStateDTO,
  CourseDTO,
  CourseHistoryResponseDTO,
  CourseSessionRequest,
  EndgamePuzzleV2,
  HubOverviewDTO,
  HydratedSessionDTO,
  StartCourseRequest,
  TacticalPuzzleV2,
  TrainingDiscipline,
  WarmUpSessionRequest,
} from '../model/training.types'

function assertNonEmptyId(label: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`[trainingApi] Missing required ${label}. Fail-Fast!`)
  }
  return trimmed
}

function assertHubOverviewDTO(raw: unknown): HubOverviewDTO {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[trainingApi] Invalid HubOverviewDTO: expected non-null object. Fail-Fast!')
  }
  const obj = raw as Record<string, unknown>
  if (
    !obj.disciplines ||
    typeof obj.disciplines !== 'object' ||
    !obj.woodpecker ||
    typeof obj.woodpecker !== 'object' ||
    !obj.user ||
    typeof obj.user !== 'object'
  ) {
    throw new Error(
      '[trainingApi] Invalid HubOverviewDTO payload from server (missing disciplines/woodpecker/user). Ensure Go training-engine v2.0 is running on port 5001. Fail-Fast!',
    )
  }
  return raw as HubOverviewDTO
}

function assertCabinetDTO(raw: unknown): CabinetDTO {
  if (!raw || typeof raw !== 'object') {
    throw new Error('[trainingApi] Invalid CabinetDTO: expected non-null object. Fail-Fast!')
  }
  const obj = raw as Record<string, unknown>
  assertHubOverviewDTO(obj.overview)
  if (
    !obj.tactics ||
    typeof obj.tactics !== 'object' ||
    !obj.theoretical ||
    typeof obj.theoretical !== 'object' ||
    !obj.practical ||
    typeof obj.practical !== 'object' ||
    !obj.finishhim ||
    typeof obj.finishhim !== 'object'
  ) {
    throw new Error(
      '[trainingApi] Invalid CabinetDTO payload from server (missing discipline analytics maps). Ensure Go training-engine v2.0 is running on port 5001. Fail-Fast!',
    )
  }
  return raw as CabinetDTO
}

export const trainingApi = {
  getCatalogInfo(): Promise<CatalogManifestDTO> {
    return apiClient<CatalogManifestDTO>('/training/catalog-info')
  },

  async getOverview(): Promise<HubOverviewDTO> {
    const raw = await apiClient<unknown>('/training/overview')
    return assertHubOverviewDTO(raw)
  },

  async getCabinet(): Promise<CabinetDTO> {
    const raw = await apiClient<unknown>('/training/cabinet')
    return assertCabinetDTO(raw)
  },

  startCourse(payload: StartCourseRequest): Promise<CourseDTO> {
    return apiClient<CourseDTO>('/training/courses', {
      method: 'POST',
      body: JSON.stringify({
        discipline: payload.discipline,
        difficulty: payload.difficulty,
        duration_days: payload.duration_days,
      }),
    })
  },

  abortCourse(courseId: string): Promise<CourseDTO> {
    const id = assertNonEmptyId('courseId', courseId)
    return apiClient<CourseDTO>(`/training/courses/${encodeURIComponent(id)}/abort`, {
      method: 'POST',
    })
  },

  async getCourseHistory(limit: number = 25): Promise<CourseDTO[]> {
    const res = await apiClient<CourseHistoryResponseDTO>(
      `/training/courses/history?limit=${encodeURIComponent(String(limit))}`,
    )
    return res.courses
  },

  composeCourseSession(payload: CourseSessionRequest): Promise<HydratedSessionDTO> {
    return apiClient<HydratedSessionDTO>('/training/sessions/course', {
      method: 'POST',
      body: JSON.stringify({
        discipline: payload.discipline,
        batch_size: payload.batch_size ?? 0,
        force_new: payload.force_new ?? false,
      }),
    })
  },

  composeWarmupSession(payload: WarmUpSessionRequest): Promise<HydratedSessionDTO> {
    return apiClient<HydratedSessionDTO>('/training/sessions/warmup', {
      method: 'POST',
      body: JSON.stringify({
        discipline: payload.discipline,
        difficulty: payload.difficulty,
        count: payload.count,
        focus_group: payload.focus_group ?? 'all',
        focus_key: payload.focus_key ?? 'all',
        objective: payload.objective ?? '',
        force_replace: payload.force_replace ?? false,
      }),
    })
  },

  async getActiveSession(discipline: TrainingDiscipline): Promise<HydratedSessionDTO | null> {
    const res = await apiClient<ActiveSessionResponseDTO>(
      `/training/sessions/active?discipline=${encodeURIComponent(discipline)}`,
    )
    return res.active_session
  },

  dismissSession(sessionId: string): Promise<void> {
    const id = assertNonEmptyId('sessionId', sessionId)
    return apiClient<void>(`/training/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },

  submitAttempt(sessionId: string, payload: AttemptRequest): Promise<AttemptResultDTO> {
    const id = assertNonEmptyId('sessionId', sessionId)
    const puzzleId = assertNonEmptyId('puzzle_id', payload.puzzle_id)
    if (payload.time_ms < 0 || !Number.isFinite(payload.time_ms)) {
      throw new Error(
        `[trainingApi] Invalid attempt time_ms (${String(payload.time_ms)}) for puzzle ${puzzleId}. Fail-Fast!`,
      )
    }

    return apiClient<AttemptResultDTO>(`/training/sessions/${encodeURIComponent(id)}/attempt`, {
      method: 'POST',
      body: JSON.stringify({
        puzzle_id: puzzleId,
        solved: payload.solved,
        time_ms: Math.round(payload.time_ms),
        first_move_failed: payload.first_move_failed,
        fail_stage: payload.fail_stage,
      }),
    })
  },

  getTacticalPuzzleById(puzzleId: string): Promise<TacticalPuzzleV2> {
    const id = assertNonEmptyId('puzzleId', puzzleId)
    return apiClient<TacticalPuzzleV2>(`/training/puzzle/tactics/${encodeURIComponent(id)}`)
  },

  getEndgamePuzzleById(
    discipline: Exclude<TrainingDiscipline, 'tactics'>,
    puzzleId: string,
  ): Promise<EndgamePuzzleV2> {
    const id = assertNonEmptyId('puzzleId', puzzleId)
    return apiClient<EndgamePuzzleV2>(
      `/training/puzzle/${encodeURIComponent(discipline)}/${encodeURIComponent(id)}`,
    )
  },

  getChallengeState(
    discipline: TrainingDiscipline,
    puzzleId: string,
  ): Promise<ChallengeStateDTO> {
    const id = assertNonEmptyId('puzzleId', puzzleId)
    return apiClient<ChallengeStateDTO>(
      `/training/challenges/${encodeURIComponent(discipline)}/${encodeURIComponent(id)}`,
    )
  },

  submitChallengeAttempt(
    discipline: TrainingDiscipline,
    puzzleId: string,
    payload: ChallengeAttemptRequest,
  ): Promise<ChallengeStateDTO> {
    const id = assertNonEmptyId('puzzleId', puzzleId)
    if (payload.time_ms < 0 || !Number.isFinite(payload.time_ms)) {
      throw new Error(
        `[trainingApi] Invalid challenge attempt time_ms (${String(payload.time_ms)}) for puzzle ${id}. Fail-Fast!`,
      )
    }
    return apiClient<ChallengeStateDTO>(
      `/training/challenges/${encodeURIComponent(discipline)}/${encodeURIComponent(id)}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({
          solved: payload.solved,
          time_ms: Math.round(payload.time_ms),
        }),
      },
    )
  },

  surrenderChallenge(
    discipline: TrainingDiscipline,
    puzzleId: string,
  ): Promise<ChallengeStateDTO> {
    const id = assertNonEmptyId('puzzleId', puzzleId)
    return apiClient<ChallengeStateDTO>(
      `/training/challenges/${encodeURIComponent(discipline)}/${encodeURIComponent(id)}/surrender`,
      {
        method: 'POST',
      },
    )
  },

  async getChallengeRecords(): Promise<ChallengeRecordEntryDTO[]> {
    const raw = await apiClient<unknown>('/training/challenges/records')
    if (!Array.isArray(raw)) {
      throw new Error(
        '[trainingApi] Invalid ChallengeRecordEntryDTO[] payload: expected array. Fail-Fast!',
      )
    }
    return raw as ChallengeRecordEntryDTO[]
  },
}
