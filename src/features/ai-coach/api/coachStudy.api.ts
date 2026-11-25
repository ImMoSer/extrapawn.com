import { BestMoveResponseSchema, type BestMoveResult } from '@/entities/game/lib/EnginePlayService'
import { apiClient, BACKEND_API_URL } from '@/shared/api/client'
import type {
  ChatStreamPayload,
  ImportChapterResponse,
  ImportFenPayload,
  ImportLichessPayload,
  ImportPgnPayload,
  SseDoneEvent,
  SseErrorEvent,
  SseMetaEvent,
  SseStatusEvent,
  SseTextDeltaEvent,
  SseUiActionEvent,
  StudyChapterRecord,
  StudyEngineProfile,
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

export async function requestStudyEngineMove(
  startFen: string,
  uciMoves: string[],
  profile: StudyEngineProfile = 'mozero',
  includeArbiterEval = true,
): Promise<BestMoveResult | null> {
  const data = await apiClient(
    '/bestmove',
    {
      method: 'POST',
      body: JSON.stringify({
        engine: profile,
        start_fen: startFen,
        moves: uciMoves,
        includeArbiterEval,
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
    arbiterCp: data.arbiterCp ?? null,
    arbiterMate: data.arbiterMate ?? null,
  }
}

export interface CoachStreamHandlers {
  onMeta?: (ev: SseMetaEvent) => void
  onStatus?: (ev: SseStatusEvent) => void
  onUiAction?: (ev: SseUiActionEvent) => void
  onTextDelta?: (ev: SseTextDeltaEvent) => void
  onDone?: (ev: SseDoneEvent) => void
  onError?: (ev: SseErrorEvent) => void
}

export interface ImportStreamHandlers {
  onStatus?: (ev: SseStatusEvent) => void
  onDone?: (ev: ImportChapterResponse) => void
  onError?: (ev: SseErrorEvent) => void
}

function parseSseFrame(frame: string): { eventName: string; parsed: unknown } | null {
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
  if (!eventName || dataLines.length === 0) return null
  return { eventName, parsed: JSON.parse(dataLines.join('\n')) }
}

function dispatchSseFrame(frame: string, handlers: CoachStreamHandlers): void {
  const res = parseSseFrame(frame)
  if (!res) return
  const { eventName, parsed } = res

  if (eventName === 'meta') {
    handlers.onMeta?.(parsed as SseMetaEvent)
  } else if (eventName === 'status') {
    handlers.onStatus?.(parsed as SseStatusEvent)
  } else if (eventName === 'ui_action') {
    handlers.onUiAction?.(parsed as SseUiActionEvent)
  } else if (eventName === 'text_delta') {
    handlers.onTextDelta?.(parsed as SseTextDeltaEvent)
  } else if (eventName === 'done') {
    handlers.onDone?.(parsed as SseDoneEvent)
  } else if (eventName === 'error') {
    handlers.onError?.(parsed as SseErrorEvent)
  }
}

function extractHttpErrorDetail(rawText: string, status: number): string {
  if (!rawText) return `HTTP ${status}`
  try {
    const parsed: unknown = JSON.parse(rawText)
    if (
      parsed &&
      typeof parsed === 'object' &&
      'detail' in parsed &&
      typeof (parsed as { detail?: unknown }).detail === 'string'
    ) {
      return (parsed as { detail: string }).detail
    }
  } catch {
    // plain text fallback
  }
  return rawText
}

async function consumeFetchSse(
  url: string,
  payload: unknown,
  onFrame: (frame: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(url, {
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
    throw new Error(extractHttpErrorDetail(errText, response.status))
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
          onFrame(frame)
        }
        sepIdx = buffer.search(/\r?\n\r?\n/)
      }
    }
    const tail = buffer + decoder.decode()
    if (tail.trim()) {
      onFrame(tail)
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Streams a single AI Coach 2.0 turn via Fetch SSE with mandatory AbortSignal cancellation.
 */
export async function streamCoachTurn(
  payload: ChatStreamPayload,
  handlers: CoachStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  await consumeFetchSse(
    `${BACKEND_API_URL}${BASE}/chat/stream`,
    payload,
    (frame) => dispatchSseFrame(frame, handlers),
    signal,
  )
}

function dispatchImportFrame(frame: string, handlers: ImportStreamHandlers): void {
  const res = parseSseFrame(frame)
  if (!res) return
  if (res.eventName === 'status') {
    handlers.onStatus?.(res.parsed as SseStatusEvent)
  } else if (res.eventName === 'done') {
    handlers.onDone?.(res.parsed as ImportChapterResponse)
  } else if (res.eventName === 'error') {
    handlers.onError?.(res.parsed as SseErrorEvent)
  }
}

export async function importLichessGameStream(
  sessionId: string,
  payload: ImportLichessPayload,
  handlers: ImportStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  await consumeFetchSse(
    `${BACKEND_API_URL}${BASE}/sessions/${encodeURIComponent(sessionId)}/import/lichess`,
    payload,
    (frame) => dispatchImportFrame(frame, handlers),
    signal,
  )
}

export async function importPgnGameStream(
  sessionId: string,
  payload: ImportPgnPayload,
  handlers: ImportStreamHandlers,
  signal: AbortSignal,
): Promise<void> {
  await consumeFetchSse(
    `${BACKEND_API_URL}${BASE}/sessions/${encodeURIComponent(sessionId)}/import/pgn`,
    payload,
    (frame) => dispatchImportFrame(frame, handlers),
    signal,
  )
}

export async function importFenPosition(
  sessionId: string,
  payload: ImportFenPayload,
): Promise<ImportChapterResponse> {
  return apiClient<ImportChapterResponse>(
    `${BASE}/sessions/${encodeURIComponent(sessionId)}/import/fen`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}
