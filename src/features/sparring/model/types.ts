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

export interface SparringNewGamePayload {
  mode: 'sparring'
  event: 'new_game'
  game_id: string
  user_id: string
  user_color: 'white' | 'black'
  language: string
  start_position: string
  color_to_move: 'white' | 'black'
  is_user_to_move: boolean
  user_message: null | string
  positional_info: null | Record<string, unknown>
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
