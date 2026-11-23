import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { STANDARD_START_FEN } from '@/shared/lib/pgn/pgnTypes'
import {
  createStudy,
  deleteStudy,
  deleteStudyChapter,
  getStudy,
  listStudies,
  renameStudy,
  setActiveStudyChapter,
  streamCoachTurn,
  updateStudyChapterCursor,
} from '../api/coachStudy.api'
import type {
  ChatStreamPayload,
  SseDoneEvent,
  SseMetaEvent,
  StudyBoardActionEvent,
  StudyChapterRecord,
  StudyLanguage,
  StudySessionRecord,
  StudyTurnRecord,
} from './coachStudy.types'
import { useStudyBoardEngine } from './useStudyBoardEngine'

export const useCoachStudyStore = defineStore('coachStudy', () => {
  // Studies list (Manager page)
  const studies = ref<StudySessionRecord[]>([])
  const isLoadingStudies = ref(false)

  // Active Study Workspace
  const activeStudy = ref<StudySessionRecord | null>(null)
  const chapters = ref<StudyChapterRecord[]>([])
  const activeChapterId = ref<string | null>(null)
  const turns = ref<StudyTurnRecord[]>([])
  const isLoadingWorkspace = ref(false)

  // Streaming & Coach state
  const isStreaming = ref(false)
  const streamingText = ref('')
  const streamError = ref<string | null>(null)
  const latestMeta = ref<SseMetaEvent | null>(null)
  const latestTelemetry = ref<SseDoneEvent | null>(null)
  const pendingNewChapter = ref(false)
  const abortCtrl = shallowRef<AbortController | null>(null)

  const activeChapter = computed<StudyChapterRecord | null>(() => {
    if (!activeChapterId.value) return null
    return chapters.value.find((c) => c.id === activeChapterId.value) ?? null
  })

  async function persistActiveChapterCursor(includePgn: boolean): Promise<void> {
    if (!activeStudy.value || !activeChapter.value) return
    const payload: { current_path: string; current_fen: string; annotated_pgn?: string } = {
      current_path: board.getCurrentPath(),
      current_fen: board.currentFen.value,
    }
    if (includePgn) {
      payload.annotated_pgn = board.serializeCurrentChapterPgn()
    }
    try {
      const updated = await updateStudyChapterCursor(
        activeStudy.value.id,
        activeChapter.value.id,
        payload,
      )
      chapters.value = chapters.value.map((c) => (c.id === updated.id ? updated : c))
    } catch {
      // Non-fatal cursor persistence failure; local tree remains responsive
    }
  }

  const board = useStudyBoardEngine({
    activeChapter,
    isStreaming,
    onPersistCursor: persistActiveChapterCursor,
    onObjectiveLost: async (language, tb) => {
      await sendCoachMessage({
        text: '',
        language,
        eventKind: 'move_played',
        extraPayload: { player_tablebase: tb },
      })
    },
  })

  function abortStream(): void {
    if (abortCtrl.value) {
      abortCtrl.value.abort()
      abortCtrl.value = null
    }
    isStreaming.value = false
  }

  async function fetchStudies(): Promise<void> {
    isLoadingStudies.value = true
    try {
      studies.value = await listStudies(40)
    } finally {
      isLoadingStudies.value = false
    }
  }

  async function createNewStudy(title?: string): Promise<StudySessionRecord> {
    const created = await createStudy(title)
    studies.value = [created, ...studies.value.filter((s) => s.id !== created.id)]
    return created
  }

  async function renameExistingStudy(sessionId: string, title: string): Promise<void> {
    const updated = await renameStudy(sessionId, title)
    studies.value = studies.value.map((s) => (s.id === sessionId ? updated : s))
    if (activeStudy.value?.id === sessionId) {
      activeStudy.value = updated
    }
  }

  async function removeStudy(sessionId: string): Promise<void> {
    await deleteStudy(sessionId)
    studies.value = studies.value.filter((s) => s.id !== sessionId)
    if (activeStudy.value?.id === sessionId) {
      resetWorkspace()
    }
  }

  async function openStudy(sessionId: string): Promise<void> {
    resetWorkspace()
    isLoadingWorkspace.value = true
    try {
      const data = await getStudy(sessionId)
      activeStudy.value = data.session
      chapters.value = data.chapters
      turns.value = data.recent_turns

      const targetId =
        data.session.active_chapter_id &&
        data.chapters.some((c) => c.id === data.session.active_chapter_id)
          ? data.session.active_chapter_id
          : (data.chapters[0]?.id ?? null)

      activeChapterId.value = targetId
      const targetChapter = data.chapters.find((c) => c.id === targetId) ?? null
      if (targetChapter) {
        board.loadChapterIntoTree(targetChapter)
      } else {
        board.resetBoard(data.session.current_fen || STANDARD_START_FEN)
      }
    } finally {
      isLoadingWorkspace.value = false
    }
  }

  async function selectChapter(chapterId: string): Promise<void> {
    const target = chapters.value.find((c) => c.id === chapterId)
    if (!target || !activeStudy.value) return

    board.isSparringActive.value = false
    pendingNewChapter.value = false
    activeChapterId.value = chapterId
    board.loadChapterIntoTree(target)
    await setActiveStudyChapter(activeStudy.value.id, chapterId)
  }

  async function removeChapter(chapterId: string): Promise<void> {
    if (!activeStudy.value) return
    await deleteStudyChapter(activeStudy.value.id, chapterId)
    chapters.value = chapters.value.filter((c) => c.id !== chapterId)
    if (activeChapterId.value === chapterId) {
      const next = chapters.value[0] ?? null
      activeChapterId.value = next?.id ?? null
      if (next) {
        board.loadChapterIntoTree(next)
        await setActiveStudyChapter(activeStudy.value.id, next.id)
      } else {
        board.resetBoard(STANDARD_START_FEN)
      }
    }
  }

  function triggerNewChapterPrompt(): void {
    pendingNewChapter.value = true
  }

  function cancelNewChapterPrompt(): void {
    pendingNewChapter.value = false
  }

  async function sendCoachMessage(opts: {
    text: string
    language: StudyLanguage
    eventKind?: ChatStreamPayload['event_kind']
    extraPayload?: Partial<ChatStreamPayload>
  }): Promise<void> {
    if (!activeStudy.value) return
    const trimmed = opts.text.trim()
    const eventKind = opts.eventKind ?? 'chat_message'
    if (eventKind === 'chat_message' && !trimmed) return

    abortStream()
    board.stopAutoPlay()
    streamError.value = null
    streamingText.value = ''
    isStreaming.value = true

    const wantNewChapter = pendingNewChapter.value || chapters.value.length === 0
    pendingNewChapter.value = false

    const optimisticUserTurn: StudyTurnRecord = {
      id: -Date.now(),
      session_id: activeStudy.value.id,
      user_id: activeStudy.value.user_id,
      chapter_id: activeChapterId.value,
      role: 'user',
      content: trimmed || `[${eventKind}]`,
      board_fen: board.currentFen.value,
      board_actions: [],
      model_id: null,
      input_tokens: 0,
      cached_tokens: 0,
      output_tokens: 0,
      latency_ms: 0,
      created_at: new Date().toISOString(),
    }
    turns.value = [...turns.value, optimisticUserTurn]

    const ctrl = new AbortController()
    abortCtrl.value = ctrl
    const collectedActions: StudyBoardActionEvent[] = []
    let turnChapterId = activeChapterId.value

    const payload: ChatStreamPayload = {
      session_id: activeStudy.value.id,
      event_kind: eventKind,
      user_message: trimmed || undefined,
      language: opts.language,
      current_fen: board.currentFen.value,
      active_chapter_id: activeChapterId.value,
      active_uci_path: board.activeUciPath.value,
      request_new_chapter: wantNewChapter,
      ...opts.extraPayload,
    }

    try {
      await streamCoachTurn(
        payload,
        {
          onMeta: (ev) => {
            latestMeta.value = ev
          },
          onChapter: (ev) => {
            const ch = ev.chapter
            turnChapterId = ch.id
            const exists = chapters.value.some((item) => item.id === ch.id)
            if (exists) {
              chapters.value = chapters.value.map((item) => (item.id === ch.id ? ch : item))
            } else {
              chapters.value = [...chapters.value, ch]
            }
            activeChapterId.value = ch.id
            board.loadChapterIntoTree(ch, ev.event === 'chapter_updated')
            if (ev.study_title && activeStudy.value) {
              activeStudy.value = { ...activeStudy.value, title: ev.study_title }
            }
          },
          onBoardAction: (ev) => {
            collectedActions.push(ev)
            board.applyTransientBoardAction(ev)
          },
          onTextDelta: (ev) => {
            streamingText.value += ev.delta
          },
          onDone: (ev) => {
            latestTelemetry.value = ev
            if (activeStudy.value) {
              turns.value = [
                ...turns.value,
                {
                  id: ev.turn_id,
                  session_id: activeStudy.value.id,
                  user_id: activeStudy.value.user_id,
                  chapter_id: turnChapterId,
                  role: 'assistant',
                  content: streamingText.value.trim() || '(Chapter updated)',
                  board_fen: board.currentFen.value,
                  board_actions: collectedActions,
                  model_id: ev.model_id,
                  input_tokens: ev.input_tokens,
                  cached_tokens: ev.cached_tokens,
                  output_tokens: ev.output_tokens,
                  latency_ms: ev.latency_ms,
                  created_at: new Date().toISOString(),
                },
              ]
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
    }
  }

  function resetWorkspace(): void {
    abortStream()
    board.resetBoard(STANDARD_START_FEN)
    activeStudy.value = null
    chapters.value = []
    activeChapterId.value = null
    turns.value = []
    latestMeta.value = null
    latestTelemetry.value = null
    streamError.value = null
    streamingText.value = ''
    pendingNewChapter.value = false
  }

  return {
    studies,
    isLoadingStudies,
    activeStudy,
    chapters,
    activeChapterId,
    activeChapter,
    turns,
    isLoadingWorkspace,
    orientation: board.orientation,
    rootNode: board.rootNode,
    currentNode: board.currentNode,
    currentFen: board.currentFen,
    boardState: board.boardState,
    lastMove: board.lastMove,
    drawableShapes: board.drawableShapes,
    rootComment: board.rootComment,
    activeUciPath: board.activeUciPath,
    promotionState: board.promotionState,
    isStreaming,
    streamingText,
    streamError,
    latestMeta,
    latestTelemetry,
    pendingNewChapter,
    isAutoPlaying: board.isAutoPlaying,
    isSparringActive: board.isSparringActive,
    isBotThinking: board.isBotThinking,
    fetchStudies,
    createNewStudy,
    renameExistingStudy,
    removeStudy,
    openStudy,
    selectChapter,
    removeChapter,
    navigateToNode: board.navigateToNode,
    navigateStep: board.navigateStep,
    toggleAutoPlay: board.toggleAutoPlay,
    stopAutoPlay: board.stopAutoPlay,
    flipOrientation: board.flipOrientation,
    clearTransientShapes: board.clearTransientShapes,
    setUserShapes: board.setUserShapes,
    triggerNewChapterPrompt,
    cancelNewChapterPrompt,
    toggleSparring: board.toggleSparring,
    handleBoardUserMove: board.handleBoardUserMove,
    completePromotion: board.completePromotion,
    sendCoachMessage,
    abortStream,
    resetWorkspace,
  }
})
