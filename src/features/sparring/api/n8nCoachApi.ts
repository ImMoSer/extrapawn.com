import logger from '@/shared/lib/logger'
import i18n from '@/shared/config/i18n'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { SparringWebhookPayload, SparringCoachResponse } from '../model/types'

const N8N_COACH_URL = import.meta.env.VITE_N8N_COACH as string

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

export async function sendSparringWebhook(
  payload: SparringWebhookPayload
): Promise<SparringCoachResponse | null> {
  if (!N8N_COACH_URL) {
    logger.warn('[n8nCoachApi] VITE_N8N_COACH is not configured in .env file.')
    return null
  }

  try {
    logger.info(`[n8nCoachApi] Sending ${payload.event} webhook payload to n8n:`, payload)
    const response = await fetch(N8N_COACH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      logger.error(`[n8nCoachApi] Webhook returned HTTP error status ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    logger.info(`[n8nCoachApi] ${payload.event} webhook response received:`, data)

    if (data) {
      const target = (data.output || data.coach_response || data) as Record<string, unknown>
      if (target && typeof target.message === 'string') {
        return {
          message: target.message,
          mood: typeof target.mood === 'string' ? target.mood : null,
          bot_move: typeof target.bot_move === 'string' ? target.bot_move : null,
          san: typeof target.san === 'string' ? target.san : null,
        }
      }
    }

    return null
  } catch (err) {
    logger.error(`[n8nCoachApi] Error sending ${payload.event} webhook to n8n:`, err)
    return null
  }
}
