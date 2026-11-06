import type { EngineId } from '@/shared/types/api.types'

// ============================================================================
// Core Taxonomy & Bot Ladder ([D4, D7..D12])
// ============================================================================

export const TRAINING_DISCIPLINES = [
  'tactics',
  'tactics_course',
  'theoretical_endgames',
  'practical_chess',
  'finishhim',
] as const

export type TrainingDiscipline = (typeof TRAINING_DISCIPLINES)[number]

export function isValidTrainingDiscipline(value: string): value is TrainingDiscipline {
  return (TRAINING_DISCIPLINES as readonly string[]).includes(value)
}

/**
 * Disciplines/courses currently in developer preview (visible and accessible ONLY to `mo3ep`).
 * Add any new in-development discipline here to hide it from regular users in production,
 * and remove it from this array when ready for public release.
 */
export const CORE_TRAINING_DISCIPLINES = [
  'tactics',
  'theoretical_endgames',
  'practical_chess',
  'finishhim',
] as const

export type CoreTrainingDiscipline = (typeof CORE_TRAINING_DISCIPLINES)[number]

export const DEV_ONLY_TRAINING_DISCIPLINES: readonly TrainingDiscipline[] = ['tactics_course']

export function isDisciplineVisibleForUser(
  discipline: TrainingDiscipline,
  isDeveloper?: boolean,
): boolean {
  if (!isDeveloper && DEV_ONLY_TRAINING_DISCIPLINES.includes(discipline)) {
    return false
  }
  return (CORE_TRAINING_DISCIPLINES as readonly string[]).includes(discipline)
}

export function getVisibleTrainingDisciplines(
  isDeveloper?: boolean,
): readonly TrainingDiscipline[] {
  return CORE_TRAINING_DISCIPLINES.filter((d) => isDisciplineVisibleForUser(d, isDeveloper))
}

export const TRAINING_DIFFICULTIES = ['Novice', 'Pro', 'Master'] as const

export type TrainingDifficulty = (typeof TRAINING_DIFFICULTIES)[number]

export function isValidTrainingDifficulty(value: string): value is TrainingDifficulty {
  return (TRAINING_DIFFICULTIES as readonly string[]).includes(value)
}

export type BotLadderEngineId = Extract<EngineId, 'maia-1500' | 'maia-2200' | 'mozero'>

export const BOT_ENGINE_BY_DIFFICULTY: Readonly<Record<TrainingDifficulty, BotLadderEngineId>> = {
  Novice: 'maia-1500',
  Pro: 'maia-2200',
  Master: 'mozero',
}

export function resolveBotEngineForDifficulty(
  difficulty: TrainingDifficulty,
  discipline?: TrainingDiscipline,
): BotLadderEngineId {
  const engine = BOT_ENGINE_BY_DIFFICULTY[difficulty]
  if (!engine) {
    throw new Error(
      `[TrainingTaxonomy] Unknown difficulty "${String(difficulty)}" for Bot Ladder resolution. Fail-Fast!`,
    )
  }
  if (discipline === 'theoretical_endgames') {
    return 'mozero'
  }
  return engine
}

export function validateBotLadderEngine(engineId: string): BotLadderEngineId {
  if (engineId === 'maia-1500' || engineId === 'maia-2200' || engineId === 'mozero') {
    return engineId
  }
  throw new Error(
    `[TrainingTaxonomy] Unexpected bot_engine "${engineId}" outside v2 Bot Ladder (maia-1500 | maia-2200 | mozero). Fail-Fast!`,
  )
}

export const TRAINING_OBJECTIVES = ['win', 'hold_draw'] as const
export type TrainingObjective = (typeof TRAINING_OBJECTIVES)[number]

export type TrainingSessionMode = 'course' | 'warmup' | 'crashtest'
export type CourseDurationDays = 7 | 30 | 42
export type CourseStatus = 'active' | 'completed' | 'incomplete' | 'expired' | 'aborted'
export type SessionItemStatus = 'pending' | 'solved' | 'failed'
export type AttemptFailStage = '' | 'none' | 'scenario' | 'playout'
export type WoodpeckerAction = 'none' | 'queued' | 'progressed' | 'reset' | 'graduated'
export type DiagnosticFocusKind = 'strength' | 'weakness' | 'blind_spot'

// ============================================================================
// Endgame Domains & Classes ([D9]: EXTRA excluded from theoretical_endgames)
// ============================================================================

export const THEORETICAL_DOMAINS = [
  'PAWN',
  'KNIGHT',
  'BISHOP',
  'ROOK',
  'QUEEN',
  'COMPLEX',
] as const

export const PRACTICAL_AND_FINISHHIM_DOMAINS = [
  'PAWN',
  'KNIGHT',
  'BISHOP',
  'ROOK',
  'QUEEN',
  'COMPLEX',
  'EXTRA',
] as const

export type TheoreticalDomain = (typeof THEORETICAL_DOMAINS)[number]
export type EndgameDomain = (typeof PRACTICAL_AND_FINISHHIM_DOMAINS)[number]

export const THEORETICAL_DOMAIN_CLASSES: Readonly<Record<TheoreticalDomain, readonly string[]>> = {
  PAWN: ['pawnEnding'],
  KNIGHT: ['knightEnding', 'knightVsPawns', 'twoKnightsVsPawn'],
  BISHOP: ['bishopVsPawns', 'oppositeColorBishops', 'sameColorBishops', 'twoBishopsEnding'],
  ROOK: ['doubleRookEnding', 'rookEnding', 'rookVsPawns'],
  QUEEN: ['queenEnding', 'queenVsPawns'],
  COMPLEX: [
    'bishopKnightEnding',
    'bishopVsKnight',
    'mixEnding',
    'queenBishopVsQueen',
    'queenKnightVsQueen',
    'queenMinorVsQueenMinor',
    'queenRookEnding',
    'queenVsMinors',
    'queenVsRook',
    'queenVsRookMinor',
    'queenVsTwoRooks',
    'rookMinorVsRook',
    'rookMinorVsRookMinor',
    'rookVsMinor',
    'rookVsTwoMinors',
  ],
}

export const PRACTICAL_DOMAIN_CLASSES: Readonly<Record<EndgameDomain, readonly string[]>> = {
  PAWN: ['pawnEnding'],
  KNIGHT: ['knightEnding', 'knightVsPawns'],
  BISHOP: ['bishopVsPawns', 'oppositeColorBishops', 'sameColorBishops'],
  ROOK: ['doubleRookEnding', 'rookEnding', 'rookVsPawns'],
  QUEEN: ['queenEnding'],
  COMPLEX: [
    'bishopVsKnight',
    'queenMinorVsQueenMinor',
    'queenVsMinors',
    'queenVsRook',
    'queenVsRookMinor',
    'rookMinorVsRook',
    'rookMinorVsRookMinor',
    'rookVsMinor',
    'rookVsTwoMinors',
  ],
  EXTRA: ['extraPawn'],
}

// ============================================================================
// Tactics Structural Contours & 25 Combat Motifs ([D9, D11])
// ============================================================================

export const TACTICS_PHASES = ['opening', 'middlegame', 'endgame'] as const
export type TacticsPhase = (typeof TACTICS_PHASES)[number]

export const TACTICS_LENGTHS = ['short', 'long', 'veryLong'] as const
export type TacticsLength = (typeof TACTICS_LENGTHS)[number]

export const TACTICS_GOALS = ['mate', 'crushing', 'advantage'] as const
export type TacticsGoal = (typeof TACTICS_GOALS)[number]

export const TACTICS_COGNITIVE_PROFILES = [
  'pure_calc',
  'geometry_only',
  'operator_geometry',
  'other_motif',
] as const
export type TacticsCognitiveProfile = (typeof TACTICS_COGNITIVE_PROFILES)[number]

export const TACTICS_MOTIF_GROUPS = ['geometry', 'operator', 'concept', 'trigger'] as const
export type TacticsMotifGroup = (typeof TACTICS_MOTIF_GROUPS)[number]

export const TACTICS_GEOMETRY_MOTIFS = [
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'discoveredCheck',
  'doubleCheck',
  'xRayAttack',
  'hangingPiece',
  'trappedPiece',
] as const

export const TACTICS_OPERATOR_MOTIFS = [
  'sacrifice',
  'attraction',
  'deflection',
  'capturingDefender',
  'interference',
  'clearance',
  'intermezzo',
] as const

export const TACTICS_CONCEPT_MOTIFS = ['defensiveMove', 'quietMove', 'zugzwang'] as const

export const TACTICS_TRIGGER_MOTIFS = [
  'kingsideAttack',
  'queensideAttack',
  'exposedKing',
  'attackingF2F7',
  'advancedPawn',
  'promotion',
] as const

export const TACTICS_MOTIFS_BY_GROUP: Readonly<Record<TacticsMotifGroup, readonly string[]>> = {
  geometry: TACTICS_GEOMETRY_MOTIFS,
  operator: TACTICS_OPERATOR_MOTIFS,
  concept: TACTICS_CONCEPT_MOTIFS,
  trigger: TACTICS_TRIGGER_MOTIFS,
}

// ============================================================================
// Catalog v2 Puzzle Payloads
// ============================================================================

export interface CatalogManifestDTO {
  schema_version: number
  built_at: string
  files_signature: string
  tactics_count: number
  tactics_course_count?: number
  practical_count: number
  finishhim_count: number
  theoretical_count: number
  theoretical_skipped_extra: number
  total_count: number
}

export const TACTICS_COURSE_SLUGS = [
  'tactics_classical_1',
  'tactics_classical_2',
  'tactics_classical_3',
] as const

export type TacticsCourseSlug = (typeof TACTICS_COURSE_SLUGS)[number]

export interface CoursePuzzleV2 {
  puzzle_id: string
  base_id: string
  discipline: 'tactics_course'
  course_slug?: TacticsCourseSlug | string
  course_id?: number
  batch_id: number
  global_batch_id?: number
  batch_slug?: string
  batch_title: string
  week_number: number
  schedule_day?: string
  order_in_batch?: number
  domain: string
  class: string
  sub_class?: string
  objective: TrainingObjective
  strategy: 'scenarioOnly' | 'scenarioPlus' | 'blunderSpy'
  first_move: 'bot' | 'user'
  user_color: 'white' | 'black'
  pieces_count: number
  plies_count: number
  phase?: string
  length?: string
  geometry_motifs?: string[]
  operator_motifs?: string[]
  concept_motifs?: string[]
  trigger_motifs?: string[]
  meta_themes?: string[]
  tactical_fen: string
  tactical_solution: string
}

export interface TacticalPuzzleV2 {
  puzzle_id: string
  discipline: 'tactics'
  strategy: 'scenarioOnly'
  first_move: 'bot' | 'user'
  user_color: 'white' | 'black'
  difficulty: TrainingDifficulty
  phase: TacticsPhase
  length: TacticsLength
  goal: TacticsGoal
  master_game: boolean
  course_eligible: boolean
  cognitive_profile: TacticsCognitiveProfile
  geometry_motifs: string[]
  operator_motifs: string[]
  concept_motifs: string[]
  trigger_motifs: string[]
  meta_themes: string[]
  tactical_fen: string
  tactical_solution: string
  rating: number
  popularity: number
  nb_plays: number
}

export interface EndgamePuzzleV2 {
  puzzle_id: string
  discipline: Exclude<TrainingDiscipline, 'tactics'>
  ending_fen: string
  difficulty: TrainingDifficulty
  ending_rating: number
  effective_rating: number
  pieces_count: number
  domain: EndgameDomain
  class: string
  strategy: 'playOutOnly' | 'scenarioPlus'
  first_move: 'bot' | 'user'
  user_color: 'white' | 'black'
  objective: TrainingObjective

  // FinishHim extensions (present when discipline === 'finishhim')
  tactical_fen?: string
  tactical_solution?: string
  tactical_rating?: number
  popularity?: number
  nb_plays?: number
  meta_themes?: string[]

  // Theoretical extensions (present when discipline === 'theoretical_endgames')
  base_id?: string
  result?: string
  winner?: string
  weak_side?: string
  turn_sensitive?: boolean
  dtm?: number
  dtz?: number
  sf_eval?: number
  wdl_white?: number
  wdl_draw?: number
  wdl_black?: number
  source?: string
}

// ============================================================================
// Tracking, Courses, Sessions & Hub Overview DTOs
// ============================================================================

export interface TrainingUserMetaDTO {
  user_id: string
  last_solved_at: string
  tactics_tier: TrainingDifficulty
  theoretical_tier: TrainingDifficulty
  practical_tier: TrainingDifficulty
  finishhim_tier: TrainingDifficulty
  woodpecker_mastered_total: number
}

export interface ScopeStatDTO {
  group: string
  key: string
  domain?: string
  rating: number
  rd: number
  vol: number
  ema_accuracy: number
  solved_count: number
  failed_count: number
  first_move_fail_count?: number
  scenario_fail_count?: number
  playout_fail_count?: number
  total_time_ms: number
  last_played_at?: string
}

export interface CourseScopeSummaryDTO {
  group: string
  key: string
  solved_count: number
  failed_count: number
  total_time_ms: number
}

export interface CourseSummaryDTO {
  has_detailed_telemetry: boolean
  rating_start?: number
  rating_end?: number
  rating_delta?: number
  total_time_ms?: number
  first_move_fails?: number
  scenario_fails?: number
  playout_fails?: number
  woodpecker_queued?: number
  woodpecker_graduated?: number
  scopes?: CourseScopeSummaryDTO[]
}

export interface CourseDTO {
  id: string
  discipline: TrainingDiscipline
  difficulty: TrainingDifficulty
  bot_engine: BotLadderEngineId
  duration_days: CourseDurationDays
  target_puzzles: number
  solved_puzzles: number
  failed_puzzles: number
  status: CourseStatus
  started_at: string
  expires_at: string
  completed_at?: string
  remaining_seconds: number
  summary?: CourseSummaryDTO
}

export interface CourseDiplomaDTO {
  course: CourseDTO
  user_id: string
  username: string
  accuracy_percent: number
  total_attempts: number
  elapsed_duration_sec: number
  current_global_rating: number
  summary: CourseSummaryDTO
}

export interface StartCourseRequest {
  discipline: TrainingDiscipline
  difficulty: TrainingDifficulty
  duration_days: CourseDurationDays
}

export interface CourseHistoryResponseDTO {
  courses: CourseDTO[]
}

export interface CourseSessionRequest {
  discipline: TrainingDiscipline
  course_slug?: TacticsCourseSlug | string
  batch_size?: number
  force_new?: boolean
}

export interface WarmUpSessionRequest {
  discipline: TrainingDiscipline
  difficulty: TrainingDifficulty
  count: number
  focus_group?: string
  focus_key?: string
  objective?: TrainingObjective | ''
  force_replace?: boolean
}

export interface SessionSummaryDTO {
  id: string
  discipline: TrainingDiscipline
  mode: TrainingSessionMode
  course_id?: string
  difficulty: TrainingDifficulty
  bot_engine: BotLadderEngineId
  focus_group: string
  focus_key: string
  total_count: number
  current_index: number
  solved_count: number
  failed_count: number
  is_completed: boolean
  started_at: string
  updated_at: string
}

export interface HydratedSessionItem {
  index: number
  puzzle_id: string
  is_woodpecker: boolean
  woodpecker_streak: number
  status: SessionItemStatus
  time_ms?: number
  rating_delta?: number
  tactical?: TacticalPuzzleV2
  endgame?: EndgamePuzzleV2
  course_puzzle?: CoursePuzzleV2
}

export interface HydratedSessionDTO {
  session: SessionSummaryDTO
  items: HydratedSessionItem[]
}

export interface ActiveSessionResponseDTO {
  active_session: HydratedSessionDTO | null
}

export interface TierGateProgressDTO {
  target_tier: TrainingDifficulty
  course_completed: boolean
  rating_threshold: number
  current_rating: number
  rating_qualified: boolean
  qualified_scopes: number
  total_scopes: number
  lagging_scopes: ScopeStatDTO[]
}

export interface WoodpeckerDisciplineStatDTO {
  due_now: number
  on_cooldown: number
}

export interface WoodpeckerVaultDTO {
  due_now: number
  on_cooldown: number
  mastered_total: number
  by_discipline: Record<TrainingDiscipline, WoodpeckerDisciplineStatDTO>
}

export interface DisciplineOverviewDTO {
  discipline: TrainingDiscipline
  unlocked_tier: TrainingDifficulty
  global_rating: number
  global_rd: number
  ema_accuracy: number
  solved_total: number
  failed_total: number
  warmup_allowed_sizes: number[]
  course_batch_sizes: number[]
  default_course_batch: number
  active_course?: CourseDTO
  active_session?: SessionSummaryDTO
  next_tier_gate?: TierGateProgressDTO
}

export interface HubOverviewDTO {
  user: TrainingUserMetaDTO
  bot_engines: Record<TrainingDifficulty, BotLadderEngineId>
  disciplines: Record<TrainingDiscipline, DisciplineOverviewDTO>
  woodpecker: WoodpeckerVaultDTO
}

// ============================================================================
// Attempt Submission & Real-Time Feedback DTOs
// ============================================================================

export interface AttemptRequest {
  puzzle_id: string
  solved: boolean
  time_ms: number
  first_move_failed: boolean
  fail_stage: AttemptFailStage
}

export interface ScopeDeltaDTO {
  group: string
  key: string
  rating_before: number
  rating_after: number
  delta: number
}

export interface WoodpeckerOutcomeDTO {
  action: WoodpeckerAction
  streak: number
  next_due_at?: string
}

export interface AttemptResultDTO {
  puzzle_id: string
  solved: boolean
  global_rating_before: number
  global_rating_after: number
  global_rating_delta: number
  scope_deltas: ScopeDeltaDTO[]
  woodpecker: WoodpeckerOutcomeDTO
  session: SessionSummaryDTO
  course?: CourseDTO
  promoted_to_tier?: TrainingDifficulty
}

// ============================================================================
// User Cabinet 2.0 Analytics DTOs
// ============================================================================

export interface DiagnosticFocusCardDTO {
  kind: DiagnosticFocusKind
  focus_group: string
  focus_key: string
  rating: number
  rd: number
  ema_accuracy: number
  attempts: number
}

export interface DiagnosticStripDTO {
  top_strength?: DiagnosticFocusCardDTO
  primary_weakness?: DiagnosticFocusCardDTO
  blind_spot?: DiagnosticFocusCardDTO
}

export interface EndgameClassAnalyticsDTO {
  stat: ScopeStatDTO
  win?: ScopeStatDTO
  hold_draw?: ScopeStatDTO
}

export interface EndgameDomainAnalyticsDTO {
  domain: ScopeStatDTO
  classes: EndgameClassAnalyticsDTO[]
}

export interface EndgameCabinetMapDTO {
  diagnostics: DiagnosticStripDTO
  objectives?: ScopeStatDTO[]
  domains: EndgameDomainAnalyticsDTO[]
}

export interface TacticalMotifAnalyticsDTO {
  motif: ScopeStatDTO
  short_horizon?: ScopeStatDTO
  deep_horizon?: ScopeStatDTO
}

export interface TacticsCabinetMapDTO {
  diagnostics: DiagnosticStripDTO
  phases: ScopeStatDTO[]
  lengths: ScopeStatDTO[]
  goals: ScopeStatDTO[]
  colors: ScopeStatDTO[]
  master_game: ScopeStatDTO[]
  cognitive: ScopeStatDTO[]
  motif_contours: Record<string, TacticalMotifAnalyticsDTO[]>
}

export interface WeeklyPointDTO {
  week_start: string
  discipline: TrainingDiscipline
  scope_key: string
  rating_end: number
  ema_accuracy: number
  solved: number
  failed: number
}

export interface DailyActivityPointDTO {
  date: string
  solved: number
  failed: number
  time_ms: number
  woodpecker_graduated: number
}

export interface CabinetDTO {
  overview: HubOverviewDTO
  tactics: TacticsCabinetMapDTO
  theoretical: EndgameCabinetMapDTO
  practical: EndgameCabinetMapDTO
  finishhim: EndgameCabinetMapDTO
  tactics_course?: EndgameCabinetMapDTO
  weekly_timeline: WeeklyPointDTO[]
  daily_activity: DailyActivityPointDTO[]
  recent_courses: CourseDTO[]
}

// ============================================================================
// Challenge Mode & Leaderboard DTOs
// ============================================================================

export type ChallengeStatus = 'in_progress' | 'solved' | 'surrendered'

export interface ChallengeParticipantDTO {
  rank: number
  user_id: string
  username: string
  status: ChallengeStatus
  solved: boolean
  attempts: number
  score_text: string
  solved_time_ms?: number
  uci_moves?: string
  pgn_moves?: string
  updated_at: string
  completed_at?: string
}

export interface ChallengeStateDTO {
  discipline: TrainingDiscipline
  puzzle_id: string
  edition?: string
  difficulty: TrainingDifficulty
  bot_engine: BotLadderEngineId
  tactical?: TacticalPuzzleV2
  endgame?: EndgamePuzzleV2
  my_entry?: ChallengeParticipantDTO
  leaderboard: ChallengeParticipantDTO[]
}

export interface ChallengeAttemptRequest {
  solved: boolean
  time_ms: number
  uci_moves?: string
  pgn_moves?: string
}

export interface ChallengeRecordEntryDTO {
  rank: number
  user_id: string
  username: string
  total_points: number
  tactics_points: number
  finishhim_points: number
  practical_points: number
  theoretical_points: number
  total_time_ms: number
  total_seconds: number
  solved_count: number
  attempted_puzzles: number
  total_attempts: number
}

// ============================================================================
// Classical Tactics Course (3 Courses × 20 Batches, 10 Woodpecker Days & Crash-Test)
// ============================================================================

export type ClassicalCourseStepType = 'batch' | 'woodpecker' | 'completed'

export interface CourseBatchStatusDTO {
  course_slug?: string
  course_id?: number
  batch_id: number
  global_batch_id?: number
  batch_slug?: string
  batch_title: string
  week: number
  schedule_day?: string
  domain: string
  class?: string
  is_exam: boolean
  total_puzzles: number
  solved_count: number
  failed_count: number
  is_completed: boolean
  is_unlocked: boolean
  is_current: boolean
}

export interface WoodpeckerCheckpointDTO {
  checkpoint_id: number
  after_batch_id: number
  week: number
  schedule_day?: string
  title?: string
  batch_ids?: number[]
  due_count: number
  is_completed: boolean
  is_unlocked?: boolean
  is_active: boolean
}

export interface CourseFlagDTO {
  puzzle_id: string
  batch_id: number
  order_in_batch?: number
  comment: string
  tactical_fen?: string
  tactical_solution?: string
  created_at: string
}

export interface TacticsCourseCurriculumDTO {
  course_slug?: string
  course_id?: number
  active_course?: CourseDTO
  total_puzzles: number
  solved_total: number
  failed_total: number
  current_step_type: ClassicalCourseStepType
  current_batch_id: number
  current_woodpecker_id: number
  batches: CourseBatchStatusDTO[]
  woodpecker_days: WoodpeckerCheckpointDTO[]
  crash_test_total?: number
  crash_test_active: boolean
  crash_test_index: number
  crash_test_solved: number
  crash_test_failed: number
  crashtest_session?: SessionSummaryDTO
  flagged_puzzles: CourseFlagDTO[]
}

export interface CrashTestSessionRequest {
  force_restart?: boolean
  jump_to_index?: number
}

export interface FlagCoursePuzzleRequest {
  puzzle_id: string
  comment: string
  session_id?: string
}

export interface BlunderSpyStepRequest {
  puzzle_id?: string
  fen: string
  move_uci: string
  objective: TrainingObjective
  user_move_number?: number
}

export interface BlunderSpyStepResponse {
  status: 'solved' | 'continue' | 'blunder'
  quality: 'Best' | 'Good' | 'Inaccuracy' | 'Blunder' | string
  node_state: '100' | '110' | '111' | 'terminal' | string
  is_user_last_move: boolean
  bot_reply: string | null
  next_fen4: string | null
  next_state: string | null
  best_move_uci: string | null
  cache_source: 'ram_hit' | 'self_healed_111' | 'self_healed_node' | 'terminal' | string
}




