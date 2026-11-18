import type {
  EndgameAutomatPromptRequest,
  EndgameHopelessPromptRequest,
  PuzzleAttemptTelemetry,
  PuzzlePuzzle,
} from '@/entities/game'
import type {
  AttemptResultDTO,
  BotLadderEngineId,
  CourseDTO,
  HubOverviewDTO,
  HydratedSessionDTO,
  HydratedSessionItem,
  TacticsCourseCurriculumDTO,
  TacticsCourseSlug,
  TrainingDifficulty,
  TrainingDiscipline,
  TrainingSessionMode,
} from '@/entities/training'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import type { ComputedRef, Ref } from 'vue'

export type TrainingViewState =
  | 'hub'
  | 'playing'
  | 'awaiting_retry'
  | 'awaiting_next'
  | 'practice_replay'
  | 'analyzing'
  | 'report'

export type PracticeFeedbackState = 'idle' | 'solved' | 'failed'

export type InspectionReturnState = 'playing' | 'awaiting_retry' | 'awaiting_next' | 'report'

export interface RetryBoardSnapshot {
  puzzleId: string
  fen: string
  orientation: ChessgroundColor
}

export interface SessionReportSummary {
  sessionId: string
  discipline: TrainingDiscipline
  mode: TrainingSessionMode
  difficulty: TrainingDifficulty
  botEngine: BotLadderEngineId
  focusGroup: string
  focusKey: string
  totalCount: number
  solvedCount: number
  failedCount: number
  pendingCount: number
  accuracyPercent: number
  totalTimeMs: number
  avgTimeMs: number
  netGlobalRatingDelta: number
  woodpeckerCount: number
  woodpeckerSolvedCount: number
  woodpeckerGraduatedCount: number
  woodpeckerQueuedCount: number
  items: HydratedSessionItem[]
}

export interface PlayRuntimeTracker {
  nextPlayToken: () => number
  getPlayToken: () => number
  getSavedRetrySnapshot: () => RetryBoardSnapshot | null
  setSavedRetrySnapshot: (snapshot: RetryBoardSnapshot | null) => void
}

export interface TrainingSessionSharedState {
  overview: Ref<HubOverviewDTO | null>
  courseHistory: Ref<CourseDTO[]>
  tacticsCourseCurriculum: Ref<TacticsCourseCurriculumDTO | null>
  activeCourseSlug: Ref<TacticsCourseSlug>
  activeDiscipline: Ref<TrainingDiscipline>
  viewState: Ref<TrainingViewState>
  hydratedSession: Ref<HydratedSessionDTO | null>
  currentItemIndex: Ref<number>
  isLoadingOverview: Ref<boolean>
  isLoadingCurriculum: Ref<boolean>
  isStartingSession: Ref<boolean>
  isSubmittingAttempt: Ref<boolean>
  isPersistingRetry: Ref<boolean>
  isFlaggingPuzzle: Ref<boolean>
  error: Ref<string | null>
  feedbackMessage: Ref<string | null>
  lastAttemptResult: Ref<AttemptResultDTO | null>
  lastAttemptTelemetry: Ref<PuzzleAttemptTelemetry | null>
  sessionAttemptResults: Ref<Record<string, AttemptResultDTO>>
  promotionBannerTier: Ref<TrainingDifficulty | null>
  runningSessionTimeMs: Ref<number>
  analysisPuzzle: Ref<PuzzlePuzzle | null>
  practicePuzzle: Ref<PuzzlePuzzle | null>
  practiceFeedbackState: Ref<PracticeFeedbackState>
  currentPuzzleUserMoves: Ref<number>
  analysisReturnState: Ref<InspectionReturnState>
  automatPrompt: Ref<EndgameAutomatPromptRequest | null>
  automatRemainingMoves: Ref<number | null>
  hopelessPrompt: Ref<EndgameHopelessPromptRequest | null>
  currentItem: ComputedRef<HydratedSessionItem | null>
  itemByPuzzleId: Map<string, HydratedSessionItem>
  runtime: PlayRuntimeTracker
}

export function extractErrorText(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message.trim().length > 0) {
    return err.message
  }
  return fallback
}

export function formatDurationMs(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return '--:--.-'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const tenths = Math.floor((ms % 1000) / 100)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
}
