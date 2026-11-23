import { BestMoveResponseSchema, type BestMoveResult } from '@/entities/game/lib/EnginePlayService'
import { apiClient, BACKEND_API_URL } from '@/shared/api/client'
import type {
  ChatStreamPayload,
  SseChapterEvent,
  SseDoneEvent,
  SseErrorEvent,
  SseMetaEvent,
  SseTextDeltaEvent,
  StudyBoardActionEvent,
  StudyChapterRecord,
  StudySessionRecord,
  StudyWithDetailsResponse,
} from '../model/coachStudy.types'

const BASE = '/ai-coach'

export async function listStudies(limit = 30): Promise<StudySessionRecord[]> {
  return apiClient<StudySessionRecord[]>(`${BASE}/sessions?limit=${limit}`, { method: 'GET' })
}

export async function createStudy(title?: string): Promise<StudySessionRecord> {
  const payload = title ? { title } : {}
  return apiClient<StudySessionRecord>(`${BASE}/sessions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getStudy(sessionId: string): Promise<StudyWithDetailsResponse> {
  return apiClient<StudyWithDetailsResponse>(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  })
}

export async function renameStudy(sessionId: string, title: string): Promise<StudySessionRecord> {
  return apiClient<StudySessionRecord>(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  })
}

export async function deleteStudy(sessionId: string): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(`${BASE}/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  })
}

export async function setActiveStudyChapter(
  sessionId: string,
  chapterId: string | null,
): Promise<StudySessionRecord> {
  return apiClient<StudySessionRecord>(
    `${BASE}/sessions/${encodeURIComponent(sessionId)}/active-chapter`,
    {
      method: 'PATCH',
      body: JSON.stringify({ chapter_id: chapterId }),
    },
  )
}

export async function updateStudyChapterCursor(
  sessionId: string,
  chapterId: string,
  payload: { current_path: string; current_fen: string; annotated_pgn?: string },
): Promise<StudyChapterRecord> {
  return apiClient<StudyChapterRecord>(
    `${BASE}/sessions/${encodeURIComponent(sessionId)}/chapters/${encodeURIComponent(chapterId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  )
}

export async function deleteStudyChapter(
  sessionId: string,
  chapterId: string,
): Promise<{ deleted: boolean }> {
  return apiClient<{ deleted: boolean }>(
    `${BASE}/sessions/${encodeURIComponent(sessionId)}/chapters/${encodeURIComponent(chapterId)}`,
    { method: 'DELETE' },
  )
}

export async function requestStudyMozeroMove(
  startFen: string,
  uciMoves: string[],
): Promise<BestMoveResult | null> {
  const data = await apiClient(
    '/bestmove',
    {
      method: 'POST',
      body: JSON.stringify({
        engine: 'mozero',
        start_fen: startFen,
        moves: uciMoves,
      }),
    },
    BestMoveResponseSchema,
  )
  if (!data || !data.bestMove) return null
  return {
    bestMove: data.bestMove,
    mode: data.mode,
    source: data.source,
    playerTablebase: data.playerTablebase ?? null,
  }
}

export interface CoachStreamHandlers {
  onMeta?: (ev: SseMetaEvent) => void
  onChapter?: (ev: SseChapterEvent) => void
  onBoardAction?: (ev: StudyBoardActionEvent) => void
  onTextDelta?: (ev: SseTextDeltaEvent) => void
  onDone?: (ev: SseDoneEvent) => void
  onError?: (ev: SseErrorEvent) => void
}

function dispatchSseFrame(frame: string, handlers: CoachStreamHandlers): void {
  const lines = frame.split(/\r?\n/)
  let eventName = ''
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }
  if (!eventName || dataLines.length === 0) return

  const rawJson = dataLines.join('\n')
  const parsed: unknown = JSON.parse(rawJson)

  if (eventName === 'meta') {
    handlers.onMeta?.(parsed as SseMetaEvent)
  } else if (eventName === 'chapter_created' || eventName === 'chapter_updated') {
    handlers.onChapter?.(parsed as SseChapterEvent)
  } else if (eventName === 'board_action') {
    handlers.onBoardAction?.(parsed as StudyBoardActionEvent)
  } else if (eventName === 'text_delta') {
    handlers.onTextDelta?.(parsed as SseTextDeltaEvent)
  } else if (eventName === 'done') {
    handlers.onDone?.(parsed as SseDoneEvent)
  } else if (eventName === 'error') {
    handlers.onError?.(parsed as SseErrorEvent)
  }
}

/**
 * Streams a single AI Coach turn via Fetch SSE with mandatory AbortSignal cancellation.
 */
export async function streamCoachTurn(
  payload: ChatStreamPayload,
  handlers: CoachStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${BACKEND_API_URL}${BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    credentials: 'include',
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(errText || `HTTP ${response.status}`)
  }
  if (!response.body) {
    throw new Error('SSE response stream body is missing')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let sepIdx = buffer.search(/\r?\n\r?\n/)
      while (sepIdx !== -1) {
        const frame = buffer.slice(0, sepIdx)
        const match = buffer.slice(sepIdx).match(/^\r?\n\r?\n/)
        const skipLen = match ? match[0].length : 2
        buffer = buffer.slice(sepIdx + skipLen)
        if (frame.trim()) {
          dispatchSseFrame(frame, handlers)
        }
        sepIdx = buffer.search(/\r?\n\r?\n/)
      }
    }
    const tail = buffer + decoder.decode()
    if (tail.trim()) {
      dispatchSseFrame(tail, handlers)
    }
  } finally {
    reader.releaseLock()
  }
}
