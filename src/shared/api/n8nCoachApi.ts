import logger from '@/shared/lib/logger'
import i18n from '@/shared/config/i18n'

export interface CoachWebhookResponse {
  message: string
  mood: string | null
  bot_move: string | null
  san: string | null
}

const N8N_COACH_URL = import.meta.env.VITE_N8N_COACH as string

export async function sendCoachWebhook(
  payload: Record<string, unknown>
): Promise<CoachWebhookResponse | null> {
  if (!N8N_COACH_URL) {
    logger.warn('[n8nCoachApi] VITE_N8N_COACH is not configured in .env file.')
    return null
  }

  const enrichedPayload = {
    language: String(i18n.global.locale.value || 'de'),
    ...payload,
  }

  try {
    const eventName = payload.event || 'coach_event'
    logger.info(`[n8nCoachApi] Sending ${eventName} webhook payload to n8n:`, enrichedPayload)
    
    const response = await fetch(N8N_COACH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(enrichedPayload),
    })

    if (!response.ok) {
      logger.error(`[n8nCoachApi] Webhook returned HTTP error status ${response.status}`)
      return null
    }

    const data = (await response.json()) as Record<string, unknown>
    logger.info(`[n8nCoachApi] ${eventName} webhook response received:`, data)

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
    logger.error(`[n8nCoachApi] Error sending webhook to n8n:`, err)
    return null
  }
}
