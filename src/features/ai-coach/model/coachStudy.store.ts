import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import logger from '@/shared/lib/logger'
import { buildChapterSanPathIndex } from '@/shared/lib/markdown/renderCoachMarkdown'
import { STANDARD_START_FEN, type PgnNode } from '@/shared/lib/pgn/pgnTypes'
import {
  createStudy,
  deleteStudy,
  deleteStudyChapter,
  getStudy,
  listStudies,
  renameStudy,
  setActiveStudyChapter,
  updateStudyChapterCursor,
} from '../api/coachStudy.api'
import {
  estimateTurnCostUsd,
  type StudyChapterRecord,
  type StudySessionRecord,
  type StudyTelemetryTotals,
  type StudyTurnRecord,
  type SuggestedChapterCard,
} from './coachStudy.types'
import {
  buildChapterFen4PathIndex,
  buildDiscussedPathsMap,
  buildMainlinePathPlyMap,
  formatStudyAnchorMoveLabel,
} from './coachStudyCanvas'
import { useStudyBoardEngine } from './useStudyBoardEngine'
import { useStudyImport } from './useStudyImport'
import { useStudyStreamHandler } from './useStudyStreamHandler'

const CURSOR_PERSIST_DEBOUNCE_MS = 800

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
  const pendingNewChapter = ref(false)
  const suggestedChapter = ref<SuggestedChapterCard | null>(null)

  // Unified Canvas: Live Board Context Anchor & Bidirectional Chat <-> PGN Signals
  const anchorEnabled = ref(true)
  const scrollToTurnRequest = ref<{ turnId: number; pgnPath?: string; nonce: number } | null>(null)
  const focusChatInputRequest = ref(0)

  const activeChapter = computed<StudyChapterRecord | null>(() => {
    if (!activeChapterId.value) return null
    return chapters.value.find((c) => c.id === activeChapterId.value) ?? null
  })

  /**
   * 1:1 Chapter <-> Chat Isolation: displays ONLY turns belonging to the active chapter
   * (or study-lobby turns when the study has no chapters yet).
   */
  const visibleTurns = computed<StudyTurnRecord[]>(() => {
    if (activeChapterId.value) {
      return turns.value.filter((t) => t.chapter_id === activeChapterId.value)
    }
    return turns.value.filter((t) => t.chapter_id === null)
  })

  const studyTelemetryTotals = computed<StudyTelemetryTotals>(() => {
    let assistantTurns = 0
    let inputTokens = 0
    let cachedTokens = 0
    let outputTokens = 0
    let totalCostUsd = 0
    for (const t of turns.value) {
      if (t.role !== 'assistant') continue
      assistantTurns += 1
      inputTokens += t.input_tokens
      cachedTokens += t.cached_tokens
      outputTokens += t.output_tokens
      totalCostUsd +=
        t.cost_usd !== undefined
          ? t.cost_usd
          : estimateTurnCostUsd(t.model_id, t.input_tokens, t.cached_tokens, t.output_tokens)
    }
    return { assistantTurns, inputTokens, cachedTokens, outputTokens, totalCostUsd }
  })

  function upsertChapter(ch: StudyChapterRecord): void {
    const exists = chapters.value.some((item) => item.id === ch.id)
    if (exists) {
      chapters.value = chapters.value.map((item) => (item.id === ch.id ? ch : item))
    } else {
      chapters.value = [...chapters.value, ch].sort((a, b) => a.chapter_order - b.chapter_order)
    }
  }

  let boardRef: ReturnType<typeof useStudyBoardEngine> | null = null

  const stream = useStudyStreamHandler({
    activeStudy,
    chapters,
    activeChapterId,
    turns,
    pendingNewChapter,
    suggestedChapter,
    upsertChapter,
    getCurrentFen: () => boardRef?.currentFen.value ?? STANDARD_START_FEN,
    getActiveUciPath: () => boardRef?.activeUciPath.value ?? [],
    getPlayMode: () => boardRef?.playMode.value ?? 'study',
    getAnchorEnabled: () => anchorEnabled.value,
    stopAutoPlay: () => boardRef?.stopAutoPlay(),
    loadChapterIntoTree: (ch, preserve, autoBot) =>
      boardRef?.loadChapterIntoTree(ch, preserve, autoBot),
    applyCoachInlineShapes: (shapes) => boardRef?.applyCoachInlineShapes(shapes),
    setPendingTakebackPromote: (val) => boardRef?.setPendingTakebackPromote(val),
    applyPlayModeSettings: (opts) => boardRef?.applyPlayModeSettings(opts),
  })

  let cursorPersistTimer: ReturnType<typeof setTimeout> | null = null

  function cancelCursorDebounce(): void {
    if (cursorPersistTimer !== null) {
      clearTimeout(cursorPersistTimer)
      cursorPersistTimer = null
    }
  }

  async function executePersistChapterCursor(
    studyId: string,
    chapterId: string,
    includePgn: boolean,
  ): Promise<void> {
    if (!boardRef || activeStudy.value?.id !== studyId || activeChapterId.value !== chapterId) {
      return
    }
    const payload: { current_path: string; current_fen: string; annotated_pgn?: string } = {
      current_path: boardRef.getCurrentPath(),
      current_fen: boardRef.currentFen.value,
    }
    if (includePgn) {
      payload.annotated_pgn = boardRef.serializeCurrentChapterPgn()
    }
    try {
      const updated = await updateStudyChapterCursor(studyId, chapterId, payload)
      upsertChapter(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to persist chapter state'
      logger.error('[CoachStudyStore] Failed to persist chapter cursor/PGN:', err)
      stream.streamError.value = msg
    }
  }

  async function persistActiveChapterCursor(includePgn: boolean): Promise<void> {
    if (!activeStudy.value || !activeChapter.value || !boardRef) return
    const studyId = activeStudy.value.id
    const chapterId = activeChapter.value.id

    cancelCursorDebounce()
    if (!includePgn) {
      cursorPersistTimer = setTimeout(() => {
        cursorPersistTimer = null
        void executePersistChapterCursor(studyId, chapterId, false)
      }, CURSOR_PERSIST_DEBOUNCE_MS)
      return
    }
    await executePersistChapterCursor(studyId, chapterId, true)
  }

  const board = useStudyBoardEngine({
    activeChapter,
    isStreaming: stream.isStreaming,
    onPersistCursor: persistActiveChapterCursor,
    onBoardInteracted: () => {
      anchorEnabled.value = true
    },
  })
  boardRef = board

  const sanPathIndex = computed(() => buildChapterSanPathIndex(board.rootNode.value))
  const fen4PathIndex = computed(() => buildChapterFen4PathIndex(board.rootNode.value))
  const mainlinePathPlies = computed(() => buildMainlinePathPlyMap(board.rootNode.value))
  const discussedPathsMap = computed(() =>
    buildDiscussedPathsMap(
      visibleTurns.value,
      sanPathIndex.value,
      fen4PathIndex.value,
      board.rootNode.value.fenAfter,
      mainlinePathPlies.value,
    ),
  )
  const anchorInfo = computed(() =>
    formatStudyAnchorMoveLabel(board.currentNode.value, board.rootNode.value),
  )

  const importer = useStudyImport({
    activeStudy,
    activeChapterId,
    suggestedChapter,
    upsertChapter,
    loadChapterIntoTree: (ch, preserve, autoBot) =>
      board.loadChapterIntoTree(ch, preserve, autoBot),
    cancelCursorDebounce,
    sendCoachMessage: stream.sendCoachMessage,
  })

  function setAnchorEnabled(value: boolean): void {
    anchorEnabled.value = value
  }

  function requestScrollToTurn(turnId: number, pgnPath?: string): void {
    scrollToTurnRequest.value = { turnId, pgnPath, nonce: Date.now() + Math.random() }
  }

  function requestFocusChatForNode(node: PgnNode): void {
    board.navigateToNode(node)
    anchorEnabled.value = true
    focusChatInputRequest.value += 1
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
      anchorEnabled.value = true

      const targetId =
        data.session.active_chapter_id &&
        data.chapters.some((c) => c.id === data.session.active_chapter_id)
          ? data.session.active_chapter_id
          : (data.chapters[0]?.id ?? null)

      activeChapterId.value = targetId
      const targetChapter = data.chapters.find((c) => c.id === targetId) ?? null
      if (targetChapter) {
        board.loadChapterIntoTree(targetChapter, false, true)
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

    cancelCursorDebounce()
    pendingNewChapter.value = false
    suggestedChapter.value = null
    anchorEnabled.value = true
    stream.latestMeta.value = null
    stream.streamError.value = null
    activeChapterId.value = chapterId
    board.loadChapterIntoTree(target, false, true)
    await setActiveStudyChapter(activeStudy.value.id, chapterId)
  }

  function dismissSuggestedChapter(): void {
    suggestedChapter.value = null
  }

  async function removeChapter(chapterId: string): Promise<void> {
    if (!activeStudy.value) return
    cancelCursorDebounce()
    await deleteStudyChapter(activeStudy.value.id, chapterId)
    chapters.value = chapters.value.filter((c) => c.id !== chapterId)
    turns.value = turns.value.filter((t) => t.chapter_id !== chapterId)
    if (suggestedChapter.value?.chapter.id === chapterId) {
      suggestedChapter.value = null
    }
    if (activeChapterId.value === chapterId) {
      stream.latestMeta.value = null
      anchorEnabled.value = true
      const next = chapters.value[0] ?? null
      activeChapterId.value = next?.id ?? null
      if (next) {
        board.loadChapterIntoTree(next, false, true)
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

  function resetWorkspace(): void {
    cancelCursorDebounce()
    importer.abortImport()
    stream.resetStreamState()
    board.resetBoard(STANDARD_START_FEN)
    activeStudy.value = null
    chapters.value = []
    activeChapterId.value = null
    turns.value = []
    pendingNewChapter.value = false
    suggestedChapter.value = null
    anchorEnabled.value = true
    scrollToTurnRequest.value = null
  }

  return {
    studies,
    isLoadingStudies,
    activeStudy,
    chapters,
    activeChapterId,
    activeChapter,
    turns,
    visibleTurns,
    studyTelemetryTotals,
    isLoadingWorkspace,
    orientation: board.orientation,
    rootNode: board.rootNode,
    currentNode: board.currentNode,
    currentFen: board.currentFen,
    boardState: board.boardState,
    lastMove: board.lastMove,
    drawableShapes: board.drawableShapes,
    hideNodeShapes: board.hideNodeShapes,
    rootComment: board.rootComment,
    activeUciPath: board.activeUciPath,
    promotionState: board.promotionState,
    sanPathIndex,
    discussedPathsMap,
    anchorEnabled,
    anchorInfo,
    scrollToTurnRequest,
    focusChatInputRequest,
    isStreaming: stream.isStreaming,
    streamingText: stream.streamingText,
    coachStatusLabel: stream.coachStatusLabel,
    streamError: stream.streamError,
    latestMeta: stream.latestMeta,
    latestTelemetry: stream.latestTelemetry,
    pendingNewChapter,
    suggestedChapter,
    isAutoPlaying: board.isAutoPlaying,
    playMode: board.playMode,
    engineProfile: board.engineProfile,
    isBotAutoReplyActive: board.isBotAutoReplyActive,
    isBotThinking: board.isBotThinking,
    isImporting: importer.isImporting,
    importStatusLabel: importer.importStatusLabel,
    importError: importer.importError,
    fetchStudies,
    createNewStudy,
    renameExistingStudy,
    removeStudy,
    openStudy,
    selectChapter,
    dismissSuggestedChapter,
    removeChapter,
    setAnchorEnabled,
    requestScrollToTurn,
    requestFocusChatForNode,
    navigateToNode: board.navigateToNode,
    navigateToPath: board.navigateToPath,
    applyCoachInlineShapes: board.applyCoachInlineShapes,
    navigateStep: board.navigateStep,
    toggleAutoPlay: board.toggleAutoPlay,
    stopAutoPlay: board.stopAutoPlay,
    flipOrientation: board.flipOrientation,
    clearBoardShapes: board.clearBoardShapes,
    setUserShapes: board.setUserShapes,
    triggerNewChapterPrompt,
    cancelNewChapterPrompt,
    setEngineProfile: board.setEngineProfile,
    toggleBotAutoReply: board.toggleBotAutoReply,
    handleBoardUserMove: board.handleBoardUserMove,
    completePromotion: board.completePromotion,
    sendCoachMessage: stream.sendCoachMessage,
    abortStream: stream.abortStream,
    importFromLichess: importer.importFromLichess,
    importFromPgn: importer.importFromPgn,
    importFromFen: importer.importFromFen,
    abortImport: importer.abortImport,
    clearImportError: importer.clearImportError,
    resetWorkspace,
  }
})
