// src/entities/game/model/board.store.ts
import logger from '@/shared/lib/logger'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Color as ChessgroundColor, Dests, Key } from '@lichess-org/chessground/types'
import { Chess } from 'chessops/chess'
import { chessgroundDests } from 'chessops/compat'
import { makeFen, parseFen } from 'chessops/fen'
import type {
  Color as ChessopsColor,
  Position,
  Role as ChessopsRole,
} from 'chessops'
import { isNormal } from 'chessops'
import { makeUci, parseSquare, parseUci as parseUciMove } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'
import { boardSoundService } from '@/shared/lib/sound'
import { soundService } from '@/shared/lib/sound.service'

export interface GameEndOutcome {
  winner: ChessopsColor | undefined
  reason?: string
}

export interface NagMarker {
  square: Key
  nag?: string
  quality: string
}

export interface PromotionState {
  orig: Key
  dest: Key
  color: ChessgroundColor
  onComplete: (role: ChessopsRole | null) => void
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const useBoardStore = defineStore('board', () => {
  const fen = ref<string>(INITIAL_FEN)
  /** @deprecated Board state is reactively tracked natively via Vue 3. Deprecated legacy property. */
  const boardSyncCounter = ref(0)
  const chessPosition = shallowRef(Chess.fromSetup(parseFen(fen.value).unwrap()).unwrap())

  const turn = computed(() => chessPosition.value.turn)
  const dests = computed<Dests>(() =>
    chessgroundDests(toRaw(chessPosition.value) as Position),
  )
  const lastMove = ref<[Key, Key] | undefined>(undefined)
  const isCheck = computed(() => chessPosition.value.isCheck())
  const orientation = ref<ChessgroundColor>('white')
  const promotionState = ref<PromotionState | null>(null)
  const drawableShapes = ref<DrawShape[]>([])
  const coachShapes = ref<DrawShape[]>([])
  const autoShapes = computed(() => coachShapes.value)
  const lastNag = ref<NagMarker | null>(null)
  const lastMoveTimestamp = ref<number>(0)
  const animationDurationMs = ref<number>(200)

  const isGameOver = computed(() => {
    return !!chessPosition.value.outcome()
  })

  function setupPosition(newFen: string, newOrientation?: ChessgroundColor) {
    const targetFen = newFen === 'start' ? INITIAL_FEN : newFen
    const parsedSetup = parseFen(targetFen)
    if (parsedSetup.isErr) {
      throw new Error(`[BoardStore] Invalid FEN provided to setupPosition: "${newFen}". Fail-Fast!`)
    }
    const setup = parsedSetup.unwrap()
    const parsedChess = Chess.fromSetup(setup)
    if (parsedChess.isErr) {
      throw new Error(`[BoardStore] Failed to construct Chess position from FEN: "${newFen}". Fail-Fast!`)
    }

    if (newOrientation) {
      orientation.value = newOrientation
    }
    chessPosition.value = parsedChess.unwrap()
    fen.value = makeFen(chessPosition.value.toSetup())
    lastMove.value = undefined
    promotionState.value = null
    drawableShapes.value = []
    coachShapes.value = []
    lastNag.value = null
    soundService.playSound('board_load_position')
  }

  function syncVisualCues(cues?: {
    lastMove?: [Key, Key]
    lastNag?: NagMarker | null
    shapes?: DrawShape[]
  }) {
    if (cues) {
      if (cues.lastMove !== undefined) lastMove.value = cues.lastMove
      if (cues.lastNag !== undefined) lastNag.value = cues.lastNag
      if (cues.shapes !== undefined) drawableShapes.value = cues.shapes
    }
    coachShapes.value = []
  }

  function loadPosition(newFen: string) {
    const parsedSetup = parseFen(newFen)
    if (parsedSetup.isErr) {
      throw new Error(`[BoardStore] Invalid FEN provided to loadPosition: "${newFen}". Fail-Fast!`)
    }
    const setup = parsedSetup.unwrap()
    const parsedChess = Chess.fromSetup(setup)
    if (parsedChess.isErr) {
      throw new Error(`[BoardStore] Failed to construct Chess position from FEN: "${newFen}". Fail-Fast!`)
    }

    chessPosition.value = parsedChess.unwrap()
    fen.value = makeFen(chessPosition.value.toSetup())

    syncVisualCues()
    soundService.playSound('board_load_position')
  }

  function applyUciMove(uci: string, options?: { skipSound?: boolean }): boolean {
    logger.info(`[BoardStore] Applying UCI move: ${uci}`)
    const move = parseUciMove(uci)
    if (!move || !chessPosition.value.isLegal(move)) {
      logger.error(`[BoardStore] Illegal move: ${uci}`)
      return false
    }

    const fromPiece = isNormal(move) ? chessPosition.value.board.get(move.from) : undefined
    const isCapture = isNormal(move) && (chessPosition.value.board.has(move.to) || (fromPiece?.role === 'pawn' && (move.from % 8 !== move.to % 8)))
    const isCastle = isNormal(move) && fromPiece?.role === 'king' && Math.abs((move.from % 8) - (move.to % 8)) > 1
    const isPromotion = isNormal(move) && !!move.promotion

    chessPosition.value.play(move)
    chessPosition.value = chessPosition.value.clone()
    fen.value = makeFen(chessPosition.value.toSetup())
    coachShapes.value = []

    if (isNormal(move)) {
      lastMove.value = [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
    }
    lastMoveTimestamp.value = Date.now()

    if (!options?.skipSound) {
      if (isCastle) {
        boardSoundService.play('castle', 'boardStore.applyUciMove')
      } else if (isCapture) {
        boardSoundService.play('capture', 'boardStore.applyUciMove')
      } else if (isPromotion) {
        boardSoundService.play('promote', 'boardStore.applyUciMove')
      } else {
        boardSoundService.play('move', 'boardStore.applyUciMove')
      }

      if (chessPosition.value.isCheck()) {
        boardSoundService.play('check', 'boardStore.applyUciMove')
      }
    }

    return true
  }

  async function prepareUserUciMove({ orig, dest }: { orig: Key; dest: Key }): Promise<string | null> {
    const fromSq = parseSquare(orig)
    const toSq = parseSquare(dest)
    if (fromSq === undefined || toSq === undefined) return null

    const piece = chessPosition.value.board.get(fromSq)
    const isPromotion =
      piece?.role === 'pawn' &&
      ((piece.color === 'white' && dest.charAt(1) === '8') ||
        (piece.color === 'black' && dest.charAt(1) === '1'))

    if (isPromotion && piece) {
      return new Promise<string | null>((resolve) => {
        promotionState.value = {
          orig,
          dest,
          color: piece.color,
          onComplete: (role: ChessopsRole | null) => {
            promotionState.value = null
            if (role) {
              const uci = makeUci({ from: fromSq, to: toSq, promotion: role })
              resolve(uci)
            } else {
              resolve(null)
            }
          },
        }
      })
    }

    return makeUci({ from: fromSq, to: toSq })
  }

  async function handleUserMove({ orig, dest }: { orig: Key; dest: Key }): Promise<string | null> {
    const uci = await prepareUserUciMove({ orig, dest })
    if (!uci) return null

    const success = applyUciMove(uci)
    return success ? uci : null
  }

  function completePromotion(role: ChessopsRole) {
    if (promotionState.value) {
      promotionState.value.onComplete(role)
    }
  }

  function cancelPromotion() {
    if (promotionState.value) {
      promotionState.value.onComplete(null)
    }
  }

  function flipBoard() {
    orientation.value = orientation.value === 'white' ? 'black' : 'white'
  }

  function setDrawableShapes(shapes: DrawShape[]) {
    drawableShapes.value = shapes
  }

  function setCoachShapes(shapes: DrawShape[]) {
    coachShapes.value = shapes
  }

  function clearAutoShapes() {
    coachShapes.value = []
  }

  function resetBoardState() {
    cancelPromotion()
    setupPosition(INITIAL_FEN)
    orientation.value = 'white'
    drawableShapes.value = []
    coachShapes.value = []
    lastNag.value = null
    boardSyncCounter.value++
    logger.info('[BoardStore] Board state has been reset to initial.')
  }

  return {
    fen,
    turn,
    dests,
    lastMove,
    isCheck,
    isGameOver,
    orientation,
    promotionState,
    drawableShapes,
    autoShapes,
    boardSyncCounter,
    setupPosition,
    loadPosition,
    applyUciMove,
    prepareUserUciMove,
    handleUserMove,
    completePromotion,
    cancelPromotion,
    flipBoard,
    setDrawableShapes,
    setCoachShapes,
    clearAutoShapes,
    resetBoardState,
    lastNag,
    chessPosition,
    lastMoveTimestamp,
    animationDurationMs,
    syncVisualCues,
  }
})

