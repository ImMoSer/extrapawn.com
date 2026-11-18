import { useGameStore } from '@/entities/game'
import {
  isClassicalCourseDiscipline,
  isDisciplineVisibleForUser,
  resolveDisciplineForCourseSlug,
  trainingApi,
  type CourseDTO,
  type HubOverviewDTO,
  type HydratedSessionDTO,
  type StartCourseRequest,
  type TacticsCourseCurriculumDTO,
  type TacticsCourseSlug,
  type TrainingDiscipline,
  type WarmUpSessionRequest,
} from '@/entities/training'
import { useAuthStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import { extractErrorText, type TrainingSessionSharedState } from './trainingSession.types'
import type { PuzzleClockController } from './usePuzzleClock'

interface HubAndCurriculumDependencies {
  state: TrainingSessionSharedState
  clock: PuzzleClockController
  applyHydratedSessionAndLaunch: (dto: HydratedSessionDTO) => void
}

export function useHubAndCurriculumActions(deps: HubAndCurriculumDependencies) {
  const { state, clock } = deps
  const authStore = useAuthStore()
  const gameStore = useGameStore()

  async function fetchTacticsCourseCurriculum(
    courseSlug?: TacticsCourseSlug,
  ): Promise<TacticsCourseCurriculumDTO> {
    const slug = courseSlug ?? state.activeCourseSlug.value
    state.activeCourseSlug.value = slug
    state.isLoadingCurriculum.value = true
    try {
      const data = await trainingApi.getTacticsCourseCurriculum(slug)
      state.tacticsCourseCurriculum.value = data
      return data
    } catch (err) {
      logger.error('[TrainingSessionStore] fetchTacticsCourseCurriculum failed:', err)
      throw err
    } finally {
      state.isLoadingCurriculum.value = false
    }
  }

  async function fetchOverview(): Promise<HubOverviewDTO> {
    state.isLoadingOverview.value = true
    state.error.value = null
    try {
      const data = await trainingApi.getOverview()
      state.overview.value = data
      if (!isDisciplineVisibleForUser(state.activeDiscipline.value, authStore.canAccessCourses)) {
        state.activeDiscipline.value = 'tactics'
      }
      if (isClassicalCourseDiscipline(state.activeDiscipline.value)) {
        void fetchTacticsCourseCurriculum()
      }
      return data
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load Training Center overview')
      state.error.value = msg
      logger.error('[TrainingSessionStore] fetchOverview failed:', err)
      throw err
    } finally {
      state.isLoadingOverview.value = false
    }
  }

  function selectTacticsCourse(courseSlug: TacticsCourseSlug): void {
    state.activeCourseSlug.value = courseSlug
    void fetchTacticsCourseCurriculum(courseSlug)
  }

  async function resetTacticsCourse(
    courseSlug?: TacticsCourseSlug,
  ): Promise<TacticsCourseCurriculumDTO> {
    const slug = courseSlug ?? state.activeCourseSlug.value
    state.activeCourseSlug.value = slug
    state.isLoadingCurriculum.value = true
    state.error.value = null
    try {
      const data = await trainingApi.resetTacticsCourse(slug)
      state.tacticsCourseCurriculum.value = data
      if (
        isClassicalCourseDiscipline(state.hydratedSession.value?.session.discipline) &&
        state.hydratedSession.value?.session.mode === 'course'
      ) {
        clock.clearAutoNextTimeout()
        clock.stopTimer()
        state.hydratedSession.value = null
        gameStore.stop()
        state.viewState.value = 'hub'
      }
      return data
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to reset Classical Course')
      state.error.value = msg
      logger.error('[TrainingSessionStore] resetTacticsCourse failed:', err)
      throw err
    } finally {
      state.isLoadingCurriculum.value = false
    }
  }

  async function fetchCourseHistory(limit: number = 25): Promise<CourseDTO[]> {
    state.error.value = null
    try {
      const list = await trainingApi.getCourseHistory(limit)
      state.courseHistory.value = list
      return list
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load course history')
      state.error.value = msg
      logger.error('[TrainingSessionStore] fetchCourseHistory failed:', err)
      throw err
    }
  }

  function selectDiscipline(discipline: TrainingDiscipline): void {
    const safeDiscipline = isDisciplineVisibleForUser(discipline, authStore.canAccessCourses)
      ? discipline
      : 'tactics'
    state.activeDiscipline.value = safeDiscipline
    if (isClassicalCourseDiscipline(safeDiscipline)) {
      void fetchTacticsCourseCurriculum()
    }
  }

  function dismissPromotionBanner(): void {
    state.promotionBannerTier.value = null
  }

  async function startCourse(payload: StartCourseRequest): Promise<CourseDTO> {
    state.error.value = null
    try {
      const course = await trainingApi.startCourse(payload)
      state.activeDiscipline.value = payload.discipline
      await fetchOverview()
      return course
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start course')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startCourse failed:', err)
      throw err
    }
  }

  async function abortCourse(courseId: string): Promise<CourseDTO> {
    state.error.value = null
    try {
      const aborted = await trainingApi.abortCourse(courseId)
      if (state.hydratedSession.value?.session.course_id === courseId) {
        clock.clearAutoNextTimeout()
        clock.stopTimer()
        state.hydratedSession.value = null
        gameStore.stop()
        state.viewState.value = 'hub'
      }
      await fetchOverview()
      return aborted
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to abort course')
      state.error.value = msg
      logger.error('[TrainingSessionStore] abortCourse failed:', err)
      throw err
    }
  }

  async function startOrResumeCourseBatch(
    discipline: TrainingDiscipline,
    batchSize?: number,
    forceNew: boolean = false,
  ): Promise<HydratedSessionDTO> {
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        batch_size: batchSize,
        force_new: forceNew,
      })
      deps.applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to compose course batch session')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startOrResumeCourseBatch failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function startClassicalCourseNextStep(
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    const slug = courseSlug ?? state.activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    state.activeCourseSlug.value = slug
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'next',
        force_new: false,
      })
      deps.applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course step')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseNextStep failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function startClassicalCourseBatch(
    batchId: number,
    forceNew: boolean = true,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (!Number.isInteger(batchId) || batchId <= 0) {
      throw new Error(
        `[TrainingSessionStore] Invalid Classical Course batchId (${String(batchId)}). Fail-Fast!`,
      )
    }
    const slug = courseSlug ?? state.activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    state.activeCourseSlug.value = slug
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'batch',
        batch_id: batchId,
        force_new: forceNew,
      })
      deps.applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course batch')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseBatch failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function startClassicalCourseWoodpecker(
    checkpointId: number,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (!Number.isInteger(checkpointId) || checkpointId <= 0) {
      throw new Error(
        `[TrainingSessionStore] Invalid Classical Course Woodpecker checkpointId (${String(checkpointId)}). Fail-Fast!`,
      )
    }
    const slug = courseSlug ?? state.activeCourseSlug.value
    const discipline = resolveDisciplineForCourseSlug(slug)
    state.activeCourseSlug.value = slug
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.composeCourseSession({
        discipline,
        course_slug: slug,
        step_type: 'woodpecker',
        checkpoint_id: checkpointId,
        force_new: true,
      })
      deps.applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      void fetchTacticsCourseCurriculum(slug)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to start Classical Course Woodpecker checkpoint')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startClassicalCourseWoodpecker failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function startTacticsCourseBatch(
    batchId: number = 0,
    forceNew: boolean = false,
    courseSlug?: TacticsCourseSlug,
  ): Promise<HydratedSessionDTO> {
    if (batchId > 0) {
      return startClassicalCourseBatch(batchId, forceNew, courseSlug)
    }
    return startClassicalCourseNextStep(courseSlug)
  }

  async function startWarmupSession(payload: WarmUpSessionRequest): Promise<HydratedSessionDTO> {
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.composeWarmupSession(payload)
      deps.applyHydratedSessionAndLaunch(dto)
      void fetchOverview()
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to compose WarmUp session')
      state.error.value = msg
      logger.error('[TrainingSessionStore] startWarmupSession failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  async function resumeDisciplineSession(
    discipline: TrainingDiscipline,
  ): Promise<HydratedSessionDTO | null> {
    state.isStartingSession.value = true
    state.error.value = null
    try {
      const dto = await trainingApi.getActiveSession(discipline)
      if (!dto) {
        return null
      }
      deps.applyHydratedSessionAndLaunch(dto)
      return dto
    } catch (err) {
      const msg = extractErrorText(err, 'Failed to load active session')
      state.error.value = msg
      logger.error('[TrainingSessionStore] resumeDisciplineSession failed:', err)
      throw err
    } finally {
      state.isStartingSession.value = false
    }
  }

  return {
    fetchOverview,
    fetchTacticsCourseCurriculum,
    selectTacticsCourse,
    resetTacticsCourse,
    fetchCourseHistory,
    selectDiscipline,
    dismissPromotionBanner,
    startCourse,
    abortCourse,
    startOrResumeCourseBatch,
    startClassicalCourseNextStep,
    startClassicalCourseBatch,
    startClassicalCourseWoodpecker,
    startTacticsCourseBatch,
    startWarmupSession,
    resumeDisciplineSession,
  }
}
