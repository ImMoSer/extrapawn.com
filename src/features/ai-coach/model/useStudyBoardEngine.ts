import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Color as ChessgroundColor, Dests, Key } from '@lichess-org/chessground/types'
import { Chess } from 'chessops/chess'
import { chessgroundDests } from 'chessops/compat'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan } from 'chessops/san'
import type { Role as ChessopsRole } from 'chessops/types'
import { makeUci, parseSquare, parseUci } from 'chessops/util'
import { computed, ref, type Ref } from 'vue'
import type { PromotionState } from '@/entities/game/model/board.store'
import {
  parseLichessChapterPgn,
  serializeStudyChapterPgn,
} from '@/shared/lib/pgn/lichessPgnParser'
import { PgnTreeController, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { STANDARD_START_FEN } from '@/shared/lib/pgn/pgnTypes'
import type { StudyChapterRecord, StudyLanguage, StudySideColor } from './coachStudy.types'
import {
  useStudyPlayModes,
  type CoachGameMoveEvent,
  type SparringWakeEvent,
} from './useStudyPlayModes'

function computePositionState(fen: string): {
  turn: ChessgroundColor
  dests: Dests
  isCheck: boolean
} {
  const setupRes = parseFen(fen)
  if (setupRes.isErr) {
    return { turn: 'white', dests: new Map(), isCheck: false }
  }
  const posRes = Chess.fromSetup(setupRes.unwrap())
  if (posRes.isErr) {
    return { turn: 'white', dests: new Map(), isCheck: false }
  }
  const pos = posRes.unwrap()
  return {
    turn: pos.turn,
    dests: chessgroundDests(pos),
    isCheck: pos.isCheck(),
  }
}

export interface StudyBoardEngineCallbacks {
  activeChapter: Ref<StudyChapterRecord | null>
  isStreaming: Ref<boolean>
  onPersistCursor: (includePgn: boolean) => Promise<void>
  onCoachGameMove: (ev: CoachGameMoveEvent) => Promise<void>
  onSparringWakeCoach: (ev: SparringWakeEvent) => Promise<void>
  onSparringBriefCommentary: (ev: CoachGameMoveEvent) => Promise<void>
}

/**
 * Isolated AI Study 2.0 PGN tree, Turn-Lock, Takeback-Promote, Clear-Shapes toggle,
 * navigation, autoplay, and move commitment (decoupled from TrainingCenter `gameStore`).
 */
export function useStudyBoardEngine(callbacks: StudyBoardEngineCallbacks) {
  const pgnTree = new PgnTreeController(STANDARD_START_FEN)
  const chapterHeaders = ref<Record<string, string>>({})
  const chapterResult = ref<string>('*')

  const orientation = ref<StudySideColor>('white')
  const transientShapes = ref<DrawShape[]>([])
  const hideNodeShapes = ref(false)
  const promotionState = ref<PromotionState | null>(null)
  const pendingTakebackPromote = ref(false)

  const isAutoPlaying = ref(false)
  let autoPlayTimer: ReturnType<typeof setTimeout> | null = null

  const treeVersion = computed(() => pgnTree.version.value)
  const rootNode = computed<PgnNode>(() => {
    void treeVersion.value
    return pgnTree.getRootNode()
  })
  const currentNode = computed<PgnNode>(() => {
    void treeVersion.value
    return pgnTree.getCurrentNode()
  })
  const currentFen = computed<string>(() => currentNode.value.fenAfter || STANDARD_START_FEN)
  const rawBoardState = computed(() => computePositionState(currentFen.value))

  function stopAutoPlay(): void {
    isAutoPlaying.value = false
    if (autoPlayTimer !== null) {
      clearTimeout(autoPlayTimer)
      autoPlayTimer = null
    }
  }

  function applyUciMoveToTree(uci: string, promoteMainline = false): string | null {
    const fenBefore = currentFen.value
    const setupRes = parseFen(fenBefore)
    if (setupRes.isErr) return null
    const posRes = Chess.fromSetup(setupRes.unwrap())
    if (posRes.isErr) return null
    const pos = posRes.unwrap()
    const move = parseUci(uci)
    if (!move || !pos.isLegal(move)) return null

    const san = makeSan(pos, move)
    pos.play(move)
    const fenAfter = makeFen(pos.toSetup())
    const added = pgnTree.addNode({ san, uci: makeUci(move), fenBefore, fenAfter })
    if (!added) return null
    if (promoteMainline) {
      pgnTree.promoteToVariantMainline(added)
    }
    transientShapes.value = []
    hideNodeShapes.value = false
    return san
  }

  const modes = useStudyPlayModes({
    activeChapter: callbacks.activeChapter,
    orientation,
    getRawTurn: () => rawBoardState.value.turn,
    getRootFen: () => pgnTree.getRootNode().fenAfter,
    getCurrentUciPath: () => pgnTree.getCurrentUciPath(),
    stopAutoPlay,
    applyEngineMoveToTree: (uci) => Boolean(applyUciMoveToTree(uci, false)),
    onPersistCursor: callbacks.onPersistCursor,
    onSparringWakeCoach: callbacks.onSparringWakeCoach,
    onSparringBriefCommentary: callbacks.onSparringBriefCommentary,
  })

  const boardState = computed(() => {
    const raw = rawBoardState.value
    if (callbacks.isStreaming.value || modes.isBotThinking.value) {
      return { turn: raw.turn, dests: new Map<Key, Key[]>() as Dests, isCheck: raw.isCheck }
    }
    if (
      (modes.playMode.value === 'coach_game' || modes.playMode.value === 'sparring') &&
      raw.turn !== modes.playerColor.value
    ) {
      return { turn: raw.turn, dests: new Map<Key, Key[]>() as Dests, isCheck: raw.isCheck }
    }
    return raw
  })

  const lastMove = computed<Key[] | undefined>(() => {
    const uci = currentNode.value.uci
    if (!uci || uci.length < 4) return undefined
    return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
  })

  const drawableShapes = computed<DrawShape[]>(() => {
    if (transientShapes.value.length > 0) return transientShapes.value
    if (hideNodeShapes.value) return []
    return currentNode.value.shapes ?? []
  })

  const rootComment = computed<string>(() => rootNode.value.comment || '')

  const activeUciPath = computed<string[]>(() => {
    void treeVersion.value
    return pgnTree.getCurrentUciPath()
  })

  function loadChapterIntoTree(
    chapter: StudyChapterRecord,
    preservePath = false,
    autoStartBotOpening = false,
  ): void {
    stopAutoPlay()
    transientShapes.value = []
    hideNodeShapes.value = false
    promotionState.value = null

    const parsed = parseLichessChapterPgn(
      chapter.annotated_pgn,
      chapter.start_fen,
      chapter.orientation,
    )
    chapterHeaders.value = parsed.headers
    chapterResult.value = parsed.result
    orientation.value = chapter.user_color ?? parsed.orientation
    const targetPath = preservePath ? pgnTree.getCurrentPath() : chapter.current_path
    pgnTree.setRoot(parsed.rootNode, targetPath)
    modes.syncModeFromChapter(chapter)
    pendingTakebackPromote.value = Boolean(chapter.metadata?.pending_takeback_promote)

    if (autoStartBotOpening) {
      modes.maybeAutoStartBotOpening(chapter, parsed.rootNode.children.length > 0)
    }
  }

  function resetBoard(fen: string = STANDARD_START_FEN): void {
    stopAutoPlay()
    transientShapes.value = []
    hideNodeShapes.value = false
    promotionState.value = null
    pendingTakebackPromote.value = false
    modes.resetPlayMode()
    orientation.value = 'white'
    chapterHeaders.value = {}
    chapterResult.value = '*'
    pgnTree.reset(fen)
  }

  function getCurrentPath(): string {
    return pgnTree.getCurrentPath()
  }

  function serializeCurrentChapterPgn(): string {
    return serializeStudyChapterPgn(
      chapterHeaders.value,
      pgnTree.getRootNode(),
      chapterResult.value,
    )
  }

  function navigateToNode(node: PgnNode): void {
    stopAutoPlay()
    transientShapes.value = []
    hideNodeShapes.value = false
    pgnTree.navigateToNode(node)
    void callbacks.onPersistCursor(false)
  }

  function navigateToPath(path: string): boolean {
    stopAutoPlay()
    transientShapes.value = []
    hideNodeShapes.value = false
    const ok = pgnTree.navigateToPath(path)
    if (ok) void callbacks.onPersistCursor(false)
    return ok
  }

  function navigateStep(direction: 'start' | 'backward' | 'forward' | 'end'): void {
    stopAutoPlay()
    transientShapes.value = []
    hideNodeShapes.value = false
    if (direction === 'start') {
      pgnTree.navigateToNode(pgnTree.getRootNode())
    } else if (direction === 'backward') {
      pgnTree.navigateBackward()
    } else if (direction === 'forward') {
      pgnTree.navigateForward()
    } else {
      let cursor = pgnTree.getCurrentNode()
      while (cursor.children[0]) cursor = cursor.children[0]
      pgnTree.navigateToNode(cursor)
    }
    void callbacks.onPersistCursor(false)
  }

  function toggleAutoPlay(): void {
    if (isAutoPlaying.value) {
      stopAutoPlay()
      return
    }
    if (pgnTree.getRootNode().children.length === 0) return
    if (pgnTree.getCurrentNode().children.length === 0) {
      pgnTree.navigateToNode(pgnTree.getRootNode())
    }
    transientShapes.value = []
    hideNodeShapes.value = false
    isAutoPlaying.value = true

    const stepNext = () => {
      if (!isAutoPlaying.value) return
      const nextChild = pgnTree.getCurrentNode().children[0]
      if (!nextChild) {
        stopAutoPlay()
        return
      }
      pgnTree.navigateToNode(nextChild)
      const hasAnnotation = Boolean(
        nextChild.comment || (nextChild.shapes && nextChild.shapes.length > 0),
      )
      autoPlayTimer = setTimeout(stepNext, hasAnnotation ? 1700 : 1050)
    }
    autoPlayTimer = setTimeout(stepNext, 900)
  }

  function flipOrientation(): void {
    orientation.value = orientation.value === 'white' ? 'black' : 'white'
  }

  function clearBoardShapes(): void {
    if (transientShapes.value.length > 0) {
      transientShapes.value = []
      hideNodeShapes.value = true
      return
    }
    if (currentNode.value.shapes && currentNode.value.shapes.length > 0) {
      hideNodeShapes.value = !hideNodeShapes.value
    }
  }

  function setUserShapes(shapes: DrawShape[]): void {
    hideNodeShapes.value = false
    transientShapes.value = shapes
  }

  function setPendingTakebackPromote(value: boolean): void {
    pendingTakebackPromote.value = value
  }

  async function commitMove(uci: string, language: StudyLanguage): Promise<void> {
    const fenBefore = currentFen.value
    const uciPathBefore = pgnTree.getCurrentUciPath()
    const moveSan = applyUciMoveToTree(uci, pendingTakebackPromote.value)
    if (!moveSan) return
    pendingTakebackPromote.value = false

    if (modes.playMode.value === 'coach_game') {
      await callbacks.onCoachGameMove({
        moveUci: uci,
        moveSan,
        fenBefore,
        uciPathBefore,
        language,
      })
      return
    }

    await callbacks.onPersistCursor(true)
    if (modes.playMode.value === 'sparring' && rawBoardState.value.turn !== modes.playerColor.value) {
      await modes.playEngineReply(language, fenBefore, uci, moveSan, uciPathBefore)
    }
  }

  async function completePromotion(
    role: ChessopsRole,
    language: StudyLanguage = 'ru',
  ): Promise<void> {
    const st = promotionState.value
    promotionState.value = null
    if (!st) return
    const promoChar = role === 'knight' ? 'n' : role[0]
    await commitMove(`${st.orig}${st.dest}${promoChar}`, language)
  }

  async function handleBoardUserMove(
    orig: Key,
    dest: Key,
    language: StudyLanguage = 'ru',
  ): Promise<void> {
    stopAutoPlay()
    if (modes.isBotThinking.value || callbacks.isStreaming.value) return

    const setupRes = parseFen(currentFen.value)
    if (setupRes.isErr) return
    const posRes = Chess.fromSetup(setupRes.unwrap())
    if (posRes.isErr) return
    const pos = posRes.unwrap()

    const fromSq = parseSquare(orig)
    const toSq = parseSquare(dest)
    if (fromSq === undefined || toSq === undefined) return
    const piece = pos.board.get(fromSq)
    const isPromotion =
      piece?.role === 'pawn' &&
      ((piece.color === 'white' && dest[1] === '8') ||
        (piece.color === 'black' && dest[1] === '1'))

    if (isPromotion) {
      promotionState.value = {
        orig,
        dest,
        color: piece.color,
        onComplete: (role) => {
          if (role) void completePromotion(role, language)
          else promotionState.value = null
        },
      }
      return
    }

    await commitMove(`${orig}${dest}`, language)
  }

  return {
    orientation,
    rootNode,
    currentNode,
    currentFen,
    boardState,
    lastMove,
    drawableShapes,
    hideNodeShapes,
    rootComment,
    activeUciPath,
    promotionState,
    isAutoPlaying,
    playMode: modes.playMode,
    engineProfile: modes.engineProfile,
    commentaryLevel: modes.commentaryLevel,
    isSparringActive: modes.isSparringActive,
    isCoachGameActive: modes.isCoachGameActive,
    isBotThinking: modes.isBotThinking,
    loadChapterIntoTree,
    applyPlayModeSettings: modes.applyPlayModeSettings,
    resetBoard,
    getCurrentPath,
    serializeCurrentChapterPgn,
    navigateToNode,
    navigateToPath,
    navigateStep,
    toggleAutoPlay,
    stopAutoPlay,
    flipOrientation,
    clearBoardShapes,
    setUserShapes,
    setPendingTakebackPromote,
    toggleSparring: modes.toggleSparring,
    toggleCoachGame: modes.toggleCoachGame,
    handleBoardUserMove,
    completePromotion,
  }
}
