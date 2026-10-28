// src/types/api.types.ts

// --- Engine and Gameplay Types ---
export type EngineId =
  | 'maia-1500'
  | 'maia-1700'
  | 'maia-1900'
  | 'maia-2200'
  | 'badgyal'
  | 't1000'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'maia-1500': 'Maia 1500',
  'maia-1700': 'Maia 1700',
  'maia-1900': 'Maia 1900',
  'maia-2200': 'Maia 2200',
  badgyal: 'Bad Gyal',
  t1000: 'T1000',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1500',
  'maia-1700',
  'maia-1900',
  'maia-2200',
  'badgyal',
  't1000',
]

export type Color = 'white' | 'black'

// --- FINISH HIM MODE ---

export const FINISH_HIM_CATEGORIES = [
  'bishopVsKnight',
  'bishopVsPawns',
  'doubleRookEnding',
  'extraPawn',
  'knightEnding',
  'knightVsPawns',
  'pawnEnding',
  'queenEnding',
  'queenMinorVsQueenMinor',
  'queenVsMinors',
  'queenVsRook',
  'queenVsRookMinor',
  'rookEnding',
  'rookMinorVsRook',
  'rookMinorVsRookMinor',
  'rookVsMinor',
  'rookVsPawns',
  'rookVsTwoMinors',
  'sameColorBishops',
] as const;
export type FinishHimCategory = (typeof FINISH_HIM_CATEGORIES)[number];
export type FinishHimDifficulty = 'Novice' | 'Pro' | 'Master';

export interface FinishHimResultDto {
  puzzleId: string
  wasCorrect: boolean
  pgn_moves?: string
  initial_fen?: string
  user_color?: string
}

// --- END FINISH HIM MODE ---
// --- THEORY ENDINGS MODE ---
export const THEORY_ENDING_CATEGORIES = [
  'pawnEnding',
  'rookEnding',
  'rookVsMinor',
  'bishopVsKnight',
  'rookVsPawns',
  'sameColorBishops',
  'queenEnding',
  'knightVsPawns',
  'queenVsRookMinor',
  'knightEnding',
  'rookMinorVsRook',
  'queenVsMinors',
  'queenVsRook',
  'oppositeColorBishops',
  'rookVsTwoMinors',
  'bishopVsPawns',
  'doubleRookEnding',
] as const;
export type TheoryEndingCategory = (typeof THEORY_ENDING_CATEGORIES)[number];
export type TheoryEndingDifficulty = 'Novice' | 'Pro' | 'Master';

export interface TheoryEndingResultDto {
  puzzleId: string
  wasCorrect: boolean
}

// --- END THEORY ENDINGS ---

// --- PRACTICAL CHESS MODE ---
export const PRACTICAL_CHESS_CATEGORIES = [
  'bishopVsKnight',
  'bishopVsPawns',
  'doubleRookEnding',
  'extraPawn',
  'knightEnding',
  'knightVsPawns',
  'oppositeColorBishops',
  'pawnEnding',
  'queenEnding',
  'queenMinorVsQueenMinor',
  'queenVsMinors',
  'queenVsRook',
  'queenVsRookMinor',
  'rookEnding',
  'rookMinorVsRook',
  'rookMinorVsRookMinor',
  'rookVsMinor',
  'rookVsPawns',
  'rookVsTwoMinors',
  'sameColorBishops',
] as const;
export type PracticalChessCategory =
  (typeof PRACTICAL_CHESS_CATEGORIES)[number];
export type PracticalChessDifficulty = 'Novice' | 'Pro' | 'Master';
export interface PracticalChessResultDto {
  puzzleId: string
  wasCorrect: boolean
  pgn_moves?: string
  initial_fen?: string
  user_color?: string
}

// --- END PRACTICAL CHESS ---

// --- TACTICS MODE ---
export const TACTICS_CATEGORIES = [
  'advancedPawn',
  'attraction',
  'backRankMate',
  'capturingDefender',
  'clearance',
  'defensiveMove',
  'deflection',
  'discoveredAttack',
  'fork',
  'hangingPiece',
  'interference',
  'intermezzo',
  'kingAttack',
  'pin',
  'quietMove',
  'sacrifice',
  'skewer',
  'trappedPiece',
  'xRayAttack',
  'zugzwang',
] as const;
export type TacticsCategory = (typeof TACTICS_CATEGORIES)[number];
export type TacticsDifficulty = 'Novice' | 'Pro' | 'Master';
// --- END TACTICS MODE ---

// --- UNIFIED PLAY PUZZLE API ---
export type PlayPuzzleType = 'tactics' | 'finish_him' | 'practical_chess' | 'theory_endings';
export type PlayPuzzleDifficulty = 'Novice' | 'Pro' | 'Master';
// --- END UNIFIED PLAY PUZZLE API ---

export interface UserMeta {
  id: string
  username: string
}

interface LichessUserProfile {
  id: string
  username: string
  email?: string
  perfs?: Record<string, { rating: number; prog: number; games: number }>
  createdAt?: number
  profile?: {
    firstName?: string
    lastName?: string
    bio?: string
    country?: string
    location?: string
  }
}

interface PuzzlesSolvedToday {
  finish_him: number
  theory: number
  'practical-chess': number
  tacticalTrainer?: number
  total: number
}

export interface TodayActivity {
  puzzles_solved_today: PuzzlesSolvedToday
}

export interface UserStatsUpdate {
  id?: string
  username?: string
  today_activity?: TodayActivity
  finish_him?: GameModeProfileDto
  theory?: GameModeProfileDto
  practical?: GameModeProfileDto
}

export interface GameResultResponse {
  success: boolean
  status?: string
  message?: string
  ratingDelta?: number
  newRating?: number
  attempts?: number
  info?: string
  userStatsUpdate?: UserStatsUpdate
}

export interface UserSessionProfile extends LichessUserProfile {
  base_puzzle_rating: number
  telegram?: boolean
  telegramId?: number | null
  language?: string | null
  validatedAt?: number
  endgame_skill: number
  today_activity?: TodayActivity
  finishHimRating?: { rating: number }
  training_status?: 'N' | 'P' | 'M'
  current_streak?: number
  total_plans_mastered?: number
}

export interface AuthState {
  isAuthenticated: boolean
  userProfile: UserSessionProfile | null
  isProcessing: boolean
  error: string | null
}

// --- Типы для детальной статистики в кабинете пользователя ---

export interface ThemeStatDto {
  category: string
  success: number
  requested: number
  rating: number
}

export interface GameModeProfileDto {
  modes: Record<string, Record<string, ThemeStatDto[]>>
  highScores?: Record<string, number>
}

export interface UserProfileStatEntry {
  game_mode: string
  sub_mode: string
  category: string
  difficulty?: string
  puzzles_solved: number
  puzzles_failed: number
  rating: number
}

export interface UserProfileStatsDto {
  user: UserMeta
  stats: UserProfileStatEntry[]
}

export interface FrontendProfileStats {
  finish_him: GameModeProfileDto
  theory_endings: GameModeProfileDto
  practical_chess: GameModeProfileDto
  tactics: GameModeProfileDto
}

export interface GameLaunchOptions {
  mode: PlayPuzzleType
  theme: string
  difficulty: string
  subMode: string
}

// --- TRAINING PLAN ---
export interface TrainingPlanThemeGoal {
  name: string
  count: number
  current_solved?: number
  is_done?: boolean
}

export interface TrainingPlanTask {
  mode: string
  sub_mode: string
  themes: TrainingPlanThemeGoal[]
}

export interface TrainingPlanData {
  level: string
  total_puzzles: number
  tasks: TrainingPlanTask[]
}

export interface DailyTrainingPlanPuzzle {
  puzzle_id: string
  sub_mode: string
  category: string
  attempts?: number
  solved?: boolean
  time?: number
  rating?: number
}

export interface TrainingPlanPuzzlesJson {
  strategy: string
  difficulty: string
  plan_type?: string
  date: string
  puzzles: DailyTrainingPlanPuzzle[]
}

export interface CategoryReportBreakdown {
  category: string
  solved: number
  failed: number
  avgTimeMs: number
  avgRating: number
}

export interface SubModeReportBreakdown {
  subMode: string
  count: number
  failedCount: number
  timeMs: number
  attempts: number
  avgRating: number
  categories: CategoryReportBreakdown[]
}

export interface CompletedPlanReport {
  strategyTitle: string
  totalPuzzles: number
  totalFailed: number
  totalTimeMs: number
  totalAttempts: number
  accuracy: number
  avgTimeMs: number
  avgRating: number
  breakdown: SubModeReportBreakdown[]
}

export interface DailyTrainingPlanEntity {
  id?: string
  user_id: string
  date: string
  difficulty: string
  strategy: string
  plan_type?: string
  is_completed: boolean
  tasks_json: TrainingPlanPuzzlesJson
  report_json?: CompletedPlanReport
}

export interface TrainingPlanNextResponse {
  message?: string
  plan?: TrainingPlanData
  isNew?: boolean
  type?: string
  newStatus?: string
}

export interface RecommendationEntry {
  sub_mode: string
  category: string
  total_attempts: number
  success: number
}

export interface TrainingPlanRecommendations {
  discovery: RecommendationEntry[]
  hardcore: RecommendationEntry[]
  warmup: RecommendationEntry[]
}

export interface TrainingPlanCurrentResponse {
  active: boolean
  message?: string
  training_status?: string
  current_streak?: number
  is_completed?: boolean
  date?: string
  plan?: TrainingPlanPuzzlesJson
  overall_progress_percent?: number
  difficulty?: string
  strategy?: string
  plan_type?: string
  recommendations?: TrainingPlanRecommendations
  completed_difficulties?: string[]
  report_json?: CompletedPlanReport
}

export interface TrainingPlanCompleteResponse {
  success?: boolean
  message?: string
  streak?: number
}
