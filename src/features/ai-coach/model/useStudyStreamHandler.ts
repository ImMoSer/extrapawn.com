import type { DrawShape } from '@lichess-org/chessground/draw'
import { ref, shallowRef, type Ref } from 'vue'
import logger from '@/shared/lib/logger'
import { extractLatestStandaloneDrawShapes } from '@/shared/lib/markdown/coachDrawShapes'
import { getStudy, streamCoachTurn } from '../api/coachStudy.api'
import type {
  ChatStreamPayload,
  SseDoneEvent,
  SseMetaEvent,
  SseUiActionEvent,
  StudyChapterRecord,
  StudyEngineProfile,
  StudyLanguage,
  StudyPlayMode,
  StudySessionRecord,
  StudySideColor,
  StudyTurnRecord,
  SuggestedChapterCard,
} from './coachStudy.types'

export interface SendCoachMessageOptions {
  text: string
  displayUserText?: string
  hideOptimisticUserBubble?: boolean
  language: StudyLanguage
  eventKind?: ChatStreamPayload['event_kind']
  extraPayload?: Partial<ChatStreamPayload>
}

export interface StudyStreamHost {
  activeStudy: Ref<StudySessionRecord | null>
  chapters: Ref<StudyChapterRecord[]>
  activeChapterId: Ref<string | null>
  turns: Ref<StudyTurnRecord[]>
  pendingNewChapter: Ref<boolean>
  suggestedChapter: Ref<SuggestedChapterCard | null>
  upsertChapter: (ch: StudyChapterRecord) => void
  getCurrentFen: () => string
  getActiveUciPath: () => string[]
  getPlayMode: () => StudyPlayMode
  getAnchorEnabled: () => boolean
  stopAutoPlay: () => void
  loadChapterIntoTree: (
    chapter: StudyChapterRecord,
    preservePath: boolean,
    autoStartBotOpening: boolean,
  ) => void
  applyCoachInlineShapes: (shapes: DrawShape[]) => void
  setPendingTakebackPromote: (value: boolean) => void
  applyPlayModeSettings: (opts: {
    mode: StudyPlayMode
    userColor?: StudySideColor | null
    profile?: StudyEngineProfile | null
  }) => void
}

/**
 * Manages AI Coach 3.0 Fetch SSE streaming, live status pills, inline `[draw: ...]`
 * board arrow overlays, `ui_action` dispatching, and server re-sync upon user abort.
 */
export function useStudyStreamHandler(host: StudyStreamHost) {
  const isStreaming = ref(false)
  const streamingText = ref('')
  const coachStatusLabel = ref<string | null>(null)
  const streamError = ref<string | null>(null)
  const latestMeta = ref<SseMetaEvent | null>(null)
  const latestTelemetry = ref<SseDoneEvent | null>(null)
  const abortCtrl = shallowRef<AbortController | null>(null)

  async function resyncActiveStudyFromServer(): Promise<void> {
    if (!host.activeStudy.value) return
    try {
      const data = await getStudy(host.activeStudy.value.id)
      host.activeStudy.value = data.session
      host.chapters.value = data.chapters
      host.turns.value = data.recent_turns
      const cur = host.chapters.value.find((c) => c.id === host.activeChapterId.value) ?? null
      if (cur) {
        host.loadChapterIntoTree(cur, false, false)
      }
    } catch (err: unknown) {
      logger.error('[CoachStudyStore] Failed to re-sync study after abort:', err)
    }
  }

  function abortStream(resync = false): void {
    const wasStreaming = isStreaming.value
    if (abortCtrl.value) {
      abortCtrl.value.abort()
      abortCtrl.value = null
    }
    isStreaming.value = false
    coachStatusLabel.value = null
    if (resync && wasStreaming) {
      void resyncActiveStudyFromServer()
    }
  }

  function handleUiActionEvent(
    ev: SseUiActionEvent,
    stateRef: { turnChapterId: string | null },
  ): void {
    if (ev.study_title && host.activeStudy.value) {
      host.activeStudy.value = { ...host.activeStudy.value, title: ev.study_title }
    }
    const ch = ev.chapter
    if (ch) {
      host.upsertChapter(ch)
    }

    if (ev.action === 'chapter_created' && ch) {
      const openMode = ev.open_mode ?? (host.chapters.value.length <= 1 ? 'auto' : 'suggest')
      if (openMode === 'auto') {
        const previousId = host.activeChapterId.value
        host.activeChapterId.value = ch.id
        stateRef.turnChapterId = ch.id
        host.suggestedChapter.value = null
        if (previousId === null) {
          host.turns.value = host.turns.value.map((t) =>
            t.id < 0 && t.chapter_id === null ? { ...t, chapter_id: ch.id } : t,
          )
        }
        host.loadChapterIntoTree(ch, false, true)
      } else {
        host.suggestedChapter.value = { chapter: ch, fromChapterId: host.activeChapterId.value }
      }
      return
    }

    if ((ev.action === 'chapter_updated' || ev.action === 'annotate') && ch) {
      if (host.activeChapterId.value === ch.id) {
        host.loadChapterIntoTree(ch, true, false)
      }
      return
    }

    if (ev.action === 'play_move' && ch) {
      if (host.activeChapterId.value === ch.id) {
        host.loadChapterIntoTree(ch, false, false)
      }
      return
    }

    if (ev.action === 'takeback' && ch) {
      if (host.activeChapterId.value === ch.id) {
        host.loadChapterIntoTree(ch, false, false)
        host.setPendingTakebackPromote(Boolean(ev.promote_next_move ?? true))
      }
      return
    }

    if (ev.action === 'set_play_mode') {
      if (ch && host.activeChapterId.value === ch.id) {
        host.loadChapterIntoTree(ch, true, false)
      } else if (ev.play_mode) {
        host.applyPlayModeSettings({
          mode: ev.play_mode,
          userColor: ev.user_color,
          profile: ev.engine_profile,
        })
      }
    }
  }

  async function sendCoachMessage(opts: SendCoachMessageOptions): Promise<void> {
    if (!host.activeStudy.value) return
    const trimmed = opts.text.trim()
    const eventKind = opts.eventKind ?? 'chat_message'
    if (eventKind === 'chat_message' && !trimmed) return

    abortStream(false)
    host.stopAutoPlay()
    streamError.value = null
    streamingText.value = ''
    coachStatusLabel.value = null
    isStreaming.value = true

    const wantNewChapter = host.pendingNewChapter.value
    host.pendingNewChapter.value = false
    const anchorEnabled = host.getAnchorEnabled()

    const optimisticLabel = opts.displayUserText ?? trimmed
    if (!opts.hideOptimisticUserBubble && optimisticLabel) {
      host.turns.value = [
        ...host.turns.value,
        {
          id: -Date.now(),
          session_id: host.activeStudy.value.id,
          user_id: host.activeStudy.value.user_id,
          chapter_id: host.activeChapterId.value,
          role: 'user',
          content: optimisticLabel,
          board_fen: anchorEnabled ? host.getCurrentFen() : '',
          board_actions: [],
          model_id: null,
          input_tokens: 0,
          cached_tokens: 0,
          output_tokens: 0,
          latency_ms: 0,
          created_at: new Date().toISOString(),
        },
      ]
    }

    const ctrl = new AbortController()
    abortCtrl.value = ctrl
    const stateRef = { turnChapterId: host.activeChapterId.value }

    const payload: ChatStreamPayload = {
      session_id: host.activeStudy.value.id,
      event_kind: eventKind,
      user_message: trimmed || undefined,
      language: opts.language,
      current_fen: host.getCurrentFen(),
      active_chapter_id: host.activeChapterId.value,
      active_uci_path: host.getActiveUciPath(),
      anchor_enabled: anchorEnabled,
      request_new_chapter: wantNewChapter,
      play_mode: host.getPlayMode(),
      ...opts.extraPayload,
    }

    try {
      await streamCoachTurn(
        payload,
        {
          onMeta: (ev) => {
            latestMeta.value = ev
          },
          onStatus: (ev) => {
            coachStatusLabel.value = ev.label
          },
          onUiAction: (ev) => {
            handleUiActionEvent(ev, stateRef)
          },
          onTextDelta: (ev) => {
            coachStatusLabel.value = null
            streamingText.value += ev.delta
          },
          onDone: (ev) => {
            latestTelemetry.value = ev
            coachStatusLabel.value = null
            const finalText = streamingText.value.trim()
            const targetChap = ev.chapter_id ?? stateRef.turnChapterId
            if (host.activeStudy.value) {
              host.turns.value = [
                ...host.turns.value,
                {
                  id: ev.turn_id,
                  session_id: host.activeStudy.value.id,
                  user_id: host.activeStudy.value.user_id,
                  chapter_id: targetChap,
                  role: 'assistant',
                  content: finalText,
                  board_fen: host.getCurrentFen(),
                  board_actions: [],
                  model_id: ev.model_id,
                  input_tokens: ev.input_tokens,
                  cached_tokens: ev.cached_tokens,
                  output_tokens: ev.output_tokens,
                  latency_ms: ev.latency_ms,
                  created_at: new Date().toISOString(),
                  agent_role: ev.agent_role,
                  cost_usd: ev.cost_usd,
                  thoughts_tokens: ev.thoughts_tokens,
                  requests: ev.requests,
                },
              ]
            }
            const standaloneShapes = extractLatestStandaloneDrawShapes(finalText)
            if (standaloneShapes.length > 0) {
              host.applyCoachInlineShapes(standaloneShapes)
            }
            streamingText.value = ''
          },
          onError: (ev) => {
            streamError.value = ev.message
          },
        },
        ctrl.signal,
      )
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        streamError.value = err instanceof Error ? err.message : 'Stream failed'
      }
    } finally {
      if (abortCtrl.value === ctrl) {
        abortCtrl.value = null
      }
      isStreaming.value = false
      coachStatusLabel.value = null
    }
  }

  function resetStreamState(): void {
    abortStream(false)
    latestMeta.value = null
    latestTelemetry.value = null
    streamError.value = null
    streamingText.value = ''
    coachStatusLabel.value = null
  }

  return {
    isStreaming,
    streamingText,
    coachStatusLabel,
    streamError,
    latestMeta,
    latestTelemetry,
    sendCoachMessage,
    abortStream,
    resetStreamState,
  }
}
