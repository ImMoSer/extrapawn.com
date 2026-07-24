import logger from '@/shared/lib/logger'
import i18n from '@/shared/config/i18n'
import type { SparringNewGamePayload, SparringCoachResponse } from '../model/types'

const N8N_COACH_URL = import.meta.env.VITE_N8N_COACH as string

export async function sendNewGameWebhook(params: {
  gameId: string
  userId: string
  userColor: 'white' | 'black'
  startPosition: string
}): Promise<SparringCoachResponse | null> {
  if (!N8N_COACH_URL) {
    logger.warn('[n8nCoachApi] VITE_N8N_COACH is not configured in .env file.')
    return null
  }

  const fenParts = params.startPosition.trim().split(/\s+/)
  const activeColorChar = fenParts[1] || 'w'
  const colorToMove: 'white' | 'black' = activeColorChar === 'b' ? 'black' : 'white'
  const isUserToMove = colorToMove === params.userColor

  const payload: SparringNewGamePayload = {
    mode: 'sparring',
    event: 'new_game',
    game_id: params.gameId,
    user_id: params.userId,
    user_color: params.userColor,
    language: String(i18n.global.locale.value || 'de'),
    start_position: params.startPosition,
    color_to_move: colorToMove,
    is_user_to_move: isUserToMove,
    user_message: null,
    positional_info: null,
  }

  try {
    logger.info('[n8nCoachApi] Sending new_game webhook payload to n8n:', payload)
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
    logger.info('[n8nCoachApi] new_game webhook response received:', data)

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
    logger.error('[n8nCoachApi] Error sending new_game webhook to n8n:', err)
    return null
  }
}
