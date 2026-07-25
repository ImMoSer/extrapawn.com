export type SparringGameStatus = 'setup' | 'playing' | 'analysis'

export interface SparringGameParams {
  gameId: string
  userColor: 'white' | 'black'
  startPosition: string
  userId: string
}

export interface OpeningPreset {
  id: string
  name: string
  fen: string
  eco?: string
  description?: string
}

export interface SparringWebhookPayload {
  mode: 'sparring'
  event: 'user_move'
  game_id: string
  user_id: string
  user_color: 'white' | 'black'
  bot_color: 'white' | 'black'
  is_user_to_move: boolean
  is_bot_to_move: boolean
  language: string
  start_position: string
  color_to_move: 'white' | 'black'
  user_message: null | string
  last_user_move: null | string
  top_moves_in_position: null | string
  candidate_uci_moves: string[] | null
  candidate_uci_moves_json: string | null
  pgn_history: string | null
}

export interface SparringCoachResponse {
  message: string
  mood?: string | null
  bot_move?: string | null
  san?: string | null
}

export interface SparringWebhookResponse {
  status: string
  coach_response?: SparringCoachResponse | null
}
