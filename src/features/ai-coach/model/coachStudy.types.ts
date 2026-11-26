import type { PlayerTablebaseDTO } from '@/entities/game/lib/EnginePlayService'

export type StudySideColor = 'white' | 'black'
export type StudyObjective = 'win' | 'hold_draw'
export type StudyLanguage = 'ru' | 'en' | 'de'
export type StudyChapterKind = 'lesson' | 'drill' | 'live_game' | 'repertoire'
export type StudyPlayMode = 'study' | 'coach_game' | 'sparring' | 'weed_pressure'
export type StudyEngineProfile = 'mozero' | 'maia_1500' | 'maia_1700' | 'maia_1900' | 'maia_2200'
export const STUDY_BOT_PROFILES: readonly StudyEngineProfile[] = ['mozero', 'maia_1700', 'maia_2200']
export type StudyCommentaryLevel = 'off' | 'brief' | 'detailed'
export type StudyAgentRole = 'head_coach' | 'assistant_coach'
export type StudyChapterOpenMode = 'auto' | 'suggest'
export type StudyImportSourceKind =
  | 'lichess_analyzed'
  | 'lichess_scanned'
  | 'pgn_scanned'
  | 'fen_import'

export interface ImportLichessPayload {
  url: string
  user_color?: StudySideColor | null
  language: StudyLanguage
}

export interface ImportPgnPayload {
  pgn: string
  title?: string | null
  user_color?: StudySideColor | null
  language: StudyLanguage
}

export interface ImportFenPayload {
  fen: string
  title?: string | null
  orientation?: StudySideColor | null
  language: StudyLanguage
}

export interface ImportChapterResponse {
  chapter: StudyChapterRecord
  study_title?: string | null
  source_kind: StudyImportSourceKind
  summary_text: string
  session_id: string
}

export type StudyEventKind =
  | 'chat_message'
  | 'student_moved'
  | 'move_played'
  | 'preset_click'
  | 'drill_start'

export type StudyUiActionKind =
  | 'play_move'
  | 'takeback'
  | 'annotate'
  | 'set_play_mode'
  | 'chapter_created'
  | 'chapter_updated'

export interface StudyChapterMetadata {
  first_move?: 'user' | 'bot'
  puzzle_id?: string | null
  engine_profile?: StudyEngineProfile
  commentary?: StudyCommentaryLevel
  assistant_brief?: string | null
  pending_takeback_promote?: boolean
  [key: string]: unknown
}

export interface StudySessionRecord {
  id: string
  user_id: string
  title: string
  active_chapter_id: string | null
  chapter_count: number
  mode: 'lesson' | 'drill'
  active_pack_id: string
  active_concept_id: string | null
  start_fen: string
  current_fen: string
  objective: StudyObjective | null
  user_color: StudySideColor | null
  move_history_uci: string[]
  rolling_summary: string
  turn_count: number
  created_at: string
  updated_at: string
}

export interface StudyChapterRecord {
  id: string
  session_id: string
  user_id: string
  chapter_order: number
  title: string
  concept_id: string | null
  chapter_kind: StudyChapterKind
  play_mode: StudyPlayMode
  pack_id: string
  revision: number
  rolling_summary: string
  episode_synced_at: string | null
  metadata: StudyChapterMetadata
  start_fen: string
  orientation: StudySideColor
  objective: StudyObjective | null
  user_color: StudySideColor | null
  annotated_pgn: string
  current_path: string
  current_fen: string
  created_at: string
  updated_at: string
}

export interface StudyTurnRecord {
  id: number
  session_id: string
  user_id: string
  chapter_id: string | null
  role: 'user' | 'assistant' | 'system'
  content: string
  board_fen: string
  board_actions: Record<string, unknown>[]
  model_id: string | null
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  latency_ms: number
  created_at: string
  // Optional client-enriched telemetry from live v2 SSE `done` event
  agent_role?: StudyAgentRole
  cost_usd?: number
  thoughts_tokens?: number
  requests?: number
}

export interface StudyWithDetailsResponse {
  session: StudySessionRecord
  chapters: StudyChapterRecord[]
  recent_turns: StudyTurnRecord[]
}

export interface SseMetaEvent {
  event: 'meta'
  session_id: string
  chapter_id: string | null
  event_kind: StudyEventKind
  fen: string
  eval_source: string | null
  eval_white: string | null
  concept_id: string | null
  agent_role: StudyAgentRole
}

export interface SseStatusEvent {
  event: 'status'
  stage: string
  label: string
}

export interface SseUiActionEvent {
  event: 'ui_action'
  action: StudyUiActionKind
  chapter: StudyChapterRecord | null
  open_mode?: StudyChapterOpenMode | null
  study_title?: string | null
  move_san?: string | null
  move_uci?: string | null
  play_mode?: StudyPlayMode | null
  user_color?: StudySideColor | null
  engine_profile?: StudyEngineProfile | null
  commentary?: StudyCommentaryLevel | null
  csl?: string[]
  cal?: string[]
  reason?: string | null
  keep_as_blunder_branch?: boolean | null
  promote_next_move?: boolean
}

export interface SseTextDeltaEvent {
  event: 'text_delta'
  delta: string
}

export interface SseDoneEvent {
  event: 'done'
  turn_id: number
  chapter_id: string | null
  chapter_revision: number | null
  agent_role: StudyAgentRole
  model_id: string
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  thoughts_tokens: number
  requests: number
  cost_usd: number
  latency_ms: number
  tool_rounds: number
  tools_called: string[]
}

export interface SseErrorEvent {
  event: 'error'
  code: string
  message: string
}

export interface SuggestedChapterCard {
  chapter: StudyChapterRecord
  fromChapterId: string | null
}

export interface StudyTelemetryTotals {
  assistantTurns: number
  inputTokens: number
  cachedTokens: number
  outputTokens: number
  totalCostUsd: number
}

export interface ChatStreamPayload {
  session_id: string
  event_kind: StudyEventKind
  user_message?: string
  language: StudyLanguage
  current_fen?: string
  fen_before?: string
  last_move_uci?: string
  student_move_uci?: string
  expected_chapter_revision?: number
  player_tablebase?: {
    wdl: number
    dtm: number | null
    fideLost: boolean
    source?: 'gaviota' | 'syzygy'
  }
  arbiter_cp?: number | null
  arbiter_mate?: number | null
  play_mode?: StudyPlayMode
  active_chapter_id?: string | null
  active_uci_path?: string[]
  anchor_enabled?: boolean
  request_new_chapter?: boolean
}

const LEADING_CHAPTER_NUM_RE =
  /^\s*(?:(?:глава|chapter|kapitel)\s*\d+\s*[:.\-—–]\s*|\d{1,2}\s*[.):\-—–]\s+(?!(?:[a-h][1-8x]|[KQRBN][a-h1-8x]|O-O)))+/i

/**
 * Strips redundant leading numbering (`Глава 1:`, `2.`, `Chapter 3 —`) so chapters
 * never render as `1. Глава 1: ...`.
 */
export function formatDisplayChapterTitle(rawTitle: string): string {
  const cleaned = rawTitle.replace(LEADING_CHAPTER_NUM_RE, '').trim()
  return cleaned || rawTitle.trim()
}

export function estimateTurnCostUsd(
  modelId: string | null | undefined,
  inputTokens: number,
  cachedTokens: number,
  outputTokens: number,
): number {
  if (!modelId || (inputTokens <= 0 && outputTokens <= 0)) return 0
  const uncached = Math.max(0, inputTokens - cachedTokens)
  const isLite = modelId.toLowerCase().includes('flash-lite')
  const inRate = isLite ? 0.3 : 1.5
  const cacheRate = isLite ? 0.03 : 0.075
  const outRate = isLite ? 2.5 : 7.5
  return (uncached * inRate + cachedTokens * cacheRate + outputTokens * outRate) / 1_000_000
}

export function mapPlayerTablebaseToSignal(
  tb: PlayerTablebaseDTO | null,
): ChatStreamPayload['player_tablebase'] | undefined {
  if (!tb) return undefined
  return {
    wdl: tb.wdl,
    dtm: tb.dtm,
    fideLost: tb.fideLost,
    source: tb.source,
  }
}
