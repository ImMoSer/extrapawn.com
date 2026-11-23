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
import { parseVisualCommands } from '@/shared/lib/engine/coach/visualizer'
import {
  parseLichessChapterPgn,
  serializeStudyChapterPgn,
} from '@/shared/lib/pgn/lichessPgnParser'
import { PgnTreeController, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { STANDARD_START_FEN } from '@/shared/lib/pgn/pgnTypes'
import { requestStudyMozeroMove } from '../api/coachStudy.api'
import {
  mapPlayerTablebaseToSnake,
  type ChatStreamPayload,
  type StudyBoardActionEvent,
  type StudyChapterRecord,
  type StudyLanguage,
  type StudySideColor,
} from './coachStudy.types'

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
  onObjectiveLost: (
    language: StudyLanguage,
    tb: NonNullable<ChatStreamPayload['player_tablebase']>,
  ) => Promise<void>
}

/**
 * Isolated PGN tree, board navigation, autoplay, Lichess shapes, and mozero sparring engine
 * for AI Study (completely decoupled from TrainingCenter `gameStore`).
 */
export function useStudyBoardEngine(callbacks: StudyBoardEngineCallbacks) {
  const pgnTree = new PgnTreeController(STANDARD_START_FEN)
  const chapterHeaders = ref<Record<string, string>>({})
  const chapterResult = ref<string>('*')

  const orientation = ref<StudySideColor>('white')
  const transientShapes = ref<DrawShape[]>([])
  const promotionState = ref<PromotionState | null>(null)

  const isAutoPlaying = ref(false)
  let autoPlayTimer: ReturnType<typeof setTimeout> | null = null

  const isSparringActive = ref(false)
  const sparringUserColor = ref<StudySideColor>('white')
  const isBotThinking = ref(false)

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
  const boardState = computed(() => computePositionState(currentFen.value))

  const lastMove = computed<Key[] | undefined>(() => {
    const uci = currentNode.value.uci
    if (!uci || uci.length < 4) return undefined
    return [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
  })

  const drawableShapes = computed<DrawShape[]>(() => {
    if (transientShapes.value.length > 0) return transientShapes.value
    return currentNode.value.shapes ?? []
  })

  const rootComment = computed<string>(() => rootNode.value.comment || '')

  const activeUciPath = computed<string[]>(() => {
    void treeVersion.value
    return pgnTree.getCurrentUciPath()
  })

  function stopAutoPlay(): void {
    isAutoPlaying.value = false
    if (autoPlayTimer !== null) {
      clearTimeout(autoPlayTimer)
      autoPlayTimer = null
    }
  }

  function loadChapterIntoTree(chapter: StudyChapterRecord, preservePath = false): void {
    stopAutoPlay()
    transientShapes.value = []
    promotionState.value = null

    const parsed = parseLichessChapterPgn(
      chapter.annotated_pgn,
      chapter.start_fen,
      chapter.orientation,
    )
    chapterHeaders.value = parsed.headers
    chapterResult.value = parsed.result
    orientation.value = parsed.orientation
    const targetPath = preservePath ? pgnTree.getCurrentPath() : chapter.current_path
    pgnTree.setRoot(parsed.rootNode, targetPath)
  }

  function resetBoard(fen: string = STANDARD_START_FEN): void {
    stopAutoPlay()
    transientShapes.value = []
    promotionState.value = null
    isSparringActive.value = false
    isBotThinking.value = false
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
    pgnTree.navigateToNode(node)
    void callbacks.onPersistCursor(false)
  }

  function navigateStep(direction: 'start' | 'backward' | 'forward' | 'end'): void {
    stopAutoPlay()
    transientShapes.value = []
    if (direction === 'start') {
      pgnTree.navigateToNode(pgnTree.getRootNode())
    } else if (direction === 'backward') {
      pgnTree.navigateBackward()
    } else if (direction === 'forward') {
      pgnTree.navigateForward()
    } else {
      let cursor = pgnTree.getCurrentNode()
      while (cursor.children[0]) {
        cursor = cursor.children[0]
      }
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

  function clearTransientShapes(): void {
    transientShapes.value = []
  }

  function setUserShapes(shapes: DrawShape[]): void {
    transientShapes.value = shapes
  }

  function applyTransientBoardAction(ev: StudyBoardActionEvent): void {
    if (ev.action === 'draw_visuals' && ev.visual_commands) {
      transientShapes.value = parseVisualCommands(ev.visual_commands)
    } else if (ev.action === 'set_fen' && ev.fen && !callbacks.activeChapter.value) {
      pgnTree.reset(ev.fen)
      transientShapes.value = []
    }
  }

  function applyUciMoveToTree(uci: string): boolean {
    const fenBefore = currentFen.value
    const setupRes = parseFen(fenBefore)
    if (setupRes.isErr) return false
    const posRes = Chess.fromSetup(setupRes.unwrap())
    if (posRes.isErr) return false
    const pos = posRes.unwrap()
    const move = parseUci(uci)
    if (!move || !pos.isLegal(move)) return false

    const san = makeSan(pos, move)
    pos.play(move)
    const fenAfter = makeFen(pos.toSetup())
    pgnTree.addNode({ san, uci: makeUci(move), fenBefore, fenAfter })
    transientShapes.value = []
    return true
  }

  async function playMozeroReply(language: StudyLanguage = 'ru'): Promise<void> {
    if (!isSparringActive.value || isBotThinking.value) return
    isBotThinking.value = true
    try {
      const res = await requestStudyMozeroMove(
        pgnTree.getRootNode().fenAfter,
        pgnTree.getCurrentUciPath(),
      )
      if (!res || !isSparringActive.value) return

      if (applyUciMoveToTree(res.bestMove)) {
        await callbacks.onPersistCursor(true)
      }

      const obj = callbacks.activeChapter.value?.objective
      const tb = res.playerTablebase
      const objectiveLost =
        tb !== null &&
        ((obj === 'win' && tb.wdl <= 0) || (obj === 'hold_draw' && tb.wdl < 0 && tb.fideLost))

      if (objectiveLost) {
        const mapped = mapPlayerTablebaseToSnake(tb)
        if (mapped) {
          await callbacks.onObjectiveLost(language, mapped)
        }
      }
    } finally {
      isBotThinking.value = false
    }
  }

  function toggleSparring(): void {
    stopAutoPlay()
    if (isSparringActive.value) {
      isSparringActive.value = false
      return
    }
    const ch = callbacks.activeChapter.value
    sparringUserColor.value = ch?.user_color ?? ch?.orientation ?? orientation.value
    orientation.value = sparringUserColor.value
    isSparringActive.value = true
    if (boardState.value.turn !== sparringUserColor.value) {
      void playMozeroReply()
    }
  }

  async function commitMove(uci: string, language: StudyLanguage): Promise<void> {
    if (!applyUciMoveToTree(uci)) return
    await callbacks.onPersistCursor(true)
    if (isSparringActive.value && boardState.value.turn !== sparringUserColor.value) {
      await playMozeroReply(language)
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
    if (isBotThinking.value || callbacks.isStreaming.value) return

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
          if (role) {
            void completePromotion(role, language)
          } else {
            promotionState.value = null
          }
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
    rootComment,
    activeUciPath,
    promotionState,
    isAutoPlaying,
    isSparringActive,
    isBotThinking,
    loadChapterIntoTree,
    resetBoard,
    getCurrentPath,
    serializeCurrentChapterPgn,
    navigateToNode,
    navigateStep,
    toggleAutoPlay,
    stopAutoPlay,
    flipOrientation,
    clearTransientShapes,
    setUserShapes,
    applyTransientBoardAction,
    toggleSparring,
    handleBoardUserMove,
    completePromotion,
  }
}
