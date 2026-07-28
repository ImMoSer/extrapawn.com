import i18n from '@/shared/config/i18n'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { SparringWebhookPayload, SparringCoachResponse } from '../model/types'

export function createSparringWebhookPayload(params: {
  event?: 'user_move'
  gameId: string
  userId: string
  userColor: 'white' | 'black'
  startPosition: string
  lastUserMove?: string | null
  topMovesInPosition?: string | null
  candidateUciMoves?: string[] | null
}): SparringWebhookPayload {
  const fenParts = params.startPosition.trim().split(/\s+/)
  const activeColorChar = fenParts[1] || 'w'
  const colorToMove: 'white' | 'black' = activeColorChar === 'b' ? 'black' : 'white'
  const isUserToMove = colorToMove === params.userColor
  const botColor: 'white' | 'black' = params.userColor === 'white' ? 'black' : 'white'
  const isBotToMove = colorToMove === botColor

  let pgnHistory: string | null = null
  try {
    const currentPgn = pgnService.getCurrentPgnString()
    pgnHistory = currentPgn && currentPgn.length > 0 ? currentPgn : null
  } catch {
    pgnHistory = null
  }

  return {
    mode: 'sparring',
    event: 'user_move',
    game_id: params.gameId,
    user_id: params.userId,
    user_color: params.userColor,
    bot_color: botColor,
    is_user_to_move: isUserToMove,
    is_bot_to_move: isBotToMove,
    language: String(i18n.global.locale.value || 'de'),
    start_position: params.startPosition,
    color_to_move: colorToMove,
    user_message: null,
    last_user_move: params.lastUserMove ?? null,
    top_moves_in_position: params.topMovesInPosition ?? null,
    candidate_uci_moves: params.candidateUciMoves ?? null,
    candidate_uci_moves_json: params.candidateUciMoves ? JSON.stringify(params.candidateUciMoves) : null,
    pgn_history: pgnHistory,
  }
}

import { sendCoachWebhook } from '@/shared/api/n8nCoachApi'

export { sendCoachWebhook }

export async function sendSparringWebhook(
  payload: SparringWebhookPayload
): Promise<SparringCoachResponse | null> {
  return sendCoachWebhook(payload as unknown as Record<string, unknown>)
}
