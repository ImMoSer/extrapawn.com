// src/entities/game/model/board.store.ts
import logger from '@/shared/lib/logger'
import { pgnService, NAG_MAPPING } from '@/shared/lib/pgn/PgnService'
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
  const boardSyncCounter = ref(0)
  const chessPosition = shallowRef(Chess.fromSetup(parseFen(fen.value).unwrap()).unwrap())

  const turn = computed(() => chessPosition.value.turn)
  const dests = computed<Dests>(() =>
    chessgroundDests(toRaw(chessPosition.value) as unknown as Position),
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
    try {
      if (newOrientation) {
        orientation.value = newOrientation
      }
      const setup = parseFen(newFen === 'start' ? INITIAL_FEN : newFen).unwrap()
      chessPosition.value = Chess.fromSetup(setup).unwrap()
      fen.value = makeFen(chessPosition.value.toSetup())
      lastMove.value = undefined
      promotionState.value = null
      drawableShapes.value = []
      coachShapes.value = []
      lastNag.value = null
      boardSyncCounter.value++
      soundService.playSound('board_load_position')
    } catch (e) {
      logger.error('[BoardStore] Invalid FEN provided:', newFen, e)
    }
  }

  function syncVisualCues() {
    // Sync visual cues from PgnService
    const lastPgnMove = pgnService.getLastMove()
    if (lastPgnMove && lastPgnMove.uci) {
      lastMove.value = [lastPgnMove.uci.slice(0, 2) as Key, lastPgnMove.uci.slice(2, 4) as Key]
    } else {
      lastMove.value = undefined
    }

    const currentNode = pgnService.getCurrentNode()
    const meta = currentNode.metadata
    if (meta && meta.nag && meta.nag !== 'OK') {
      lastNag.value = {
        square: currentNode.uci ? (currentNode.uci.slice(2, 4) as Key) : ('a1' as Key),
        nag: meta.nag,
        quality: meta.quality || 'good',
      }
    } else if (currentNode.nag) {
      const mapping = NAG_MAPPING[currentNode.nag]
      if (mapping) {
        lastNag.value = {
          square: currentNode.uci ? (currentNode.uci.slice(2, 4) as Key) : ('a1' as Key),
          nag: mapping.symbol,
          quality: mapping.quality,
        }
      } else {
        lastNag.value = null
      }
    } else {
      lastNag.value = null
    }

    drawableShapes.value = (currentNode.shapes as DrawShape[]) || []
    coachShapes.value = []
    boardSyncCounter.value++
  }

  function loadPosition(newFen: string) {
    try {
      const setup = parseFen(newFen).unwrap()
      chessPosition.value = Chess.fromSetup(setup).unwrap()
      fen.value = makeFen(chessPosition.value.toSetup())

      syncVisualCues()
      
      // Play load sound if we just loaded a position (not triggered by a move, though navigating might trigger it).
      // If we want to strictly emulate old behavior, this might play on every undo/redo. 
      // This is generally desired.
      soundService.playSound('board_load_position')
    } catch (e) {
      logger.error('[BoardStore] Error in loadPosition:', newFen, e)
    }
  }

  function applyUciMove(uci: string): boolean {
    logger.info(`[BoardStore] Applying UCI move: ${uci}`)
    const move = parseUciMove(uci)
    if (!move || !chessPosition.value.isLegal(move)) {
      logger.error(`[BoardStore] Illegal move: ${uci}`)
      return false
    }

    chessPosition.value.play(move)
    chessPosition.value = chessPosition.value.clone()
    fen.value = makeFen(chessPosition.value.toSetup())

    if (isNormal(move)) {
      lastMove.value = [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
    }
    lastMoveTimestamp.value = Date.now()
    boardSyncCounter.value++
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
    setupPosition(INITIAL_FEN)
    orientation.value = 'white'
    promotionState.value = null
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
