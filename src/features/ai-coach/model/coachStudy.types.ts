import type { PlayerTablebaseDTO } from '@/entities/game/lib/EnginePlayService'

export type StudySideColor = 'white' | 'black'
export type StudyObjective = 'win' | 'hold_draw'
export type StudyEventKind = 'move_played' | 'preset_click' | 'chat_message' | 'drill_start'
export type StudyLanguage = 'ru' | 'en' | 'de'

export interface StudyBoardActionEvent {
  action: 'set_fen' | 'play_line' | 'draw_visuals'
  fen?: string | null
  moves_san?: string[]
  moves_uci?: string[]
  visual_commands?: string | null
  clear_previous_shapes?: boolean
  ends_in_terminal?: boolean
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
  board_actions: StudyBoardActionEvent[]
  model_id: string | null
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  latency_ms: number
  created_at: string
}

export interface StudyWithDetailsResponse {
  session: StudySessionRecord
  chapters: StudyChapterRecord[]
  recent_turns: StudyTurnRecord[]
}

export interface SseMetaEvent {
  event: 'meta'
  session_id: string
  event_kind: StudyEventKind
  fen: string
  eval_source: string
  eval_white: string
  concept_id: string | null
  thinking_level: string
}

export interface SseChapterEvent {
  event: 'chapter_created' | 'chapter_updated'
  chapter: StudyChapterRecord
  study_title: string | null
}

export interface SseTextDeltaEvent {
  event: 'text_delta'
  delta: string
}

export interface SseDoneEvent {
  event: 'done'
  turn_id: number
  model_id: string
  input_tokens: number
  cached_tokens: number
  output_tokens: number
  latency_ms: number
  tool_rounds: number
  tools_called: string[]
}

export interface SseErrorEvent {
  event: 'error'
  code: string
  message: string
}

export interface ChatStreamPayload {
  session_id: string
  event_kind: StudyEventKind
  user_message?: string
  language: StudyLanguage
  current_fen?: string
  fen_before?: string
  last_move_uci?: string
  player_tablebase?: {
    wdl: number
    dtm: number | null
    fide_lost: boolean
    source?: 'gaviota' | 'syzygy'
  }
  active_chapter_id?: string | null
  active_uci_path?: string[]
  request_new_chapter?: boolean
}

export function mapPlayerTablebaseToSnake(
  tb: PlayerTablebaseDTO | null,
): ChatStreamPayload['player_tablebase'] | undefined {
  if (!tb) return undefined
  return {
    wdl: tb.wdl,
    dtm: tb.dtm,
    fide_lost: tb.fideLost,
    source: tb.source,
  }
}
