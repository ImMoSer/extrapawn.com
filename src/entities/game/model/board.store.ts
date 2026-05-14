// src/stores/board.store.ts
import logger from '@/shared/lib/logger'
import { pgnService, pgnTreeVersion, type PgnNode, NAG_MAPPING } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Color as ChessgroundColor, Dests, Key } from '@lichess-org/chessground/types'
import { Chess } from 'chessops/chess'
import { chessgroundDests } from 'chessops/compat'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan } from 'chessops/san'
import type {
  Color as ChessopsColor,
  Move as ChessopsMove,
  Outcome as ChessopsOutcome,
  Position,
  Role as ChessopsRole,
} from 'chessops'
import { isNormal } from 'chessops'
import { makeUci, parseSquare, parseUci as parseUciMove } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch, toRaw } from 'vue'

export interface GameEndOutcome {
  winner: ChessopsColor | undefined
  reason?: string
}

export interface NagMarker {
  square: Key
  nag: string
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
  const autoShapes = ref<DrawShape[]>([])
  const isAnalysisModeActive = ref(false)
  const queuedPremove = ref<{ orig: Key; dest: Key } | null>(null)
  const lastNag = ref<NagMarker | null>(null)

  const isGameOver = computed(() => {
    return !!chessPosition.value.outcome()
  })

  // Configuration for sounds (decoupled from GameStore)
  const playGameStatusSounds = ref(true)

  function _updateBoardStateFromPgn() {
    const prevFen = fen.value
    const pgnFen = pgnService.getCurrentNavigatedFen()
    const setup = parseFen(pgnFen).unwrap()
    chessPosition.value = Chess.fromSetup(setup).unwrap()
    const newFen = makeFen(chessPosition.value.toSetup())
    fen.value = newFen

    const isChanged = prevFen !== newFen
    const currentNode = pgnService.getCurrentNode()
    const lastPgnMove = pgnService.getLastMove()

    // 1. Sync last move highlights (only if it's NOT the root)
    if (lastPgnMove && lastPgnMove.uci) {
      lastMove.value = [lastPgnMove.uci.slice(0, 2) as Key, lastPgnMove.uci.slice(2, 4) as Key]
    } else {
      lastMove.value = undefined
    }

    // 2. Sync NAGs (Annotation Glyphs) - can be on root too
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

    // 3. Sync shapes (arrows and squares)
    drawableShapes.value = (currentNode.shapes as DrawShape[]) || []
    autoShapes.value = []

    return { isChanged, lastPgnMove: currentNode }
  }

  function syncBoardWithPgn() {
    const result = _updateBoardStateFromPgn()
    boardSyncCounter.value++
    return result
  }

  function _playNavigationSound(san?: string) {
    if (!san) {
      soundService.playSound('board_load_position')
      return
    }

    if (
      san.includes('=') ||
      san.includes('Q') ||
      san.includes('R') ||
      san.includes('B') ||
      san.includes('N')
    ) {
      // Simple check for promotion in SAN if it follows standard notation
      if (san.includes('=')) {
        soundService.playSound('board_promote')
      }
    }

    if (san.includes('O-O')) {
      soundService.playSound('board_castle')
    } else if (san.includes('x')) {
      soundService.playSound('board_capture')
    } else {
      soundService.playSound('board_move')
    }

    // Check sounds
    if (playGameStatusSounds.value) {
      if (san.includes('#')) {
        soundService.playSound('board_checkmate')
      } else if (san.includes('+')) {
        soundService.playSound('board_check')
      }
    }
  }

  function setupPosition(newFen: string, newOrientation?: ChessgroundColor) {
    try {
      if (newOrientation) {
        orientation.value = newOrientation
      }
      pgnService.reset(newFen === 'start' ? INITIAL_FEN : newFen)
      syncBoardWithPgn()
      _playNavigationSound()
    } catch (e) {
      console.error('Invalid FEN provided:', newFen, e)
    }
  }

  function _playSoundsForMove(move: ChessopsMove, san: string): void {
    // Enable sounds for Study Mode (Analysis Mode)
    // if (isAnalysisModeActive.value) return

    const gameStatus = getGameStatus()

    if (isNormal(move) && move.promotion) {
      soundService.playSound('board_promote')
    }

    if (san.includes('O-O')) {
      soundService.playSound('board_castle')
    } else if (san.includes('x')) {
      soundService.playSound('board_capture')
    } else {
      soundService.playSound('board_move')
    }

    if (playGameStatusSounds.value) {
      if (gameStatus.isGameOver && gameStatus.outcome) {
        // ... (keep existing logic)
        switch (gameStatus.outcome.reason) {
          case 'checkmate':
            soundService.playSound('board_checkmate')
            break
          case 'stalemate':
            soundService.playSound('board_draw_stalemate')
            break
          case 'threefold_repetition':
            soundService.playSound('board_draw_repetition')
            break
          case 'fifty_move_rule':
            soundService.playSound('board_draw_fifty_moves')
            break
          case 'insufficient_material':
            soundService.playSound('board_draw_insufficient_material')
            break
        }
      } else if (gameStatus.isCheck) {
        // If it's currently the player's turn (gameStatus.turn === orientation),
        // it means the opponent (Bot) just moved and delivered check.
        if (gameStatus.turn === orientation.value) {
          soundService.playSound('board_bot_checks_player')
        } else {
          // Otherwise, the player just moved and delivered check to the Bot.
          soundService.playSound('board_check')
        }
      }
    }
  }

  function _applyUciMove(uci: string): boolean {
    logger.info(`[_applyUciMove] Attempting to apply UCI: ${uci}`)

    // Clear last NAG when a new move is applied
    lastNag.value = null

    const move = parseUciMove(uci)
    if (!move || !chessPosition.value.isLegal(move)) {
      logger.error(`[_applyUciMove] Illegal move or parse error for UCI: ${uci}`)
      syncBoardWithPgn() // Snap back the visual board
      return false
    }

    const fenBefore = makeFen(chessPosition.value.toSetup())
    const san = makeSan(toRaw(chessPosition.value) as unknown as Position, move)

    chessPosition.value.play(move)
    // Synchronize shallowRef by cloning the instance to trigger re-computations (e.g. dests/turn)
    chessPosition.value = chessPosition.value.clone()
    const fenAfter = makeFen(chessPosition.value.toSetup())
    fen.value = fenAfter

    if (isNormal(move)) {
      lastMove.value = [uci.slice(0, 2) as Key, uci.slice(2, 4) as Key]
    }

    logger.info(
      `[_applyUciMove] Move played. Adding to PGN. FenBefore: ${fenBefore}, FenAfter: ${fenAfter}`,
    )
    const node = pgnService.addNode({ san, uci, fenBefore, fenAfter })
    if (!node) {
      logger.error(`[_applyUciMove] Failed to add node to PGN tree.`)
    } else {
      logger.info(`[_applyUciMove] Node added successfully. ID: ${node.id}`)
    }

    _playSoundsForMove(move, san)
    // Verify sync and pulse UI
    syncBoardWithPgn()

    return true
  }

  function applyUciMove(uci: string) {
    _applyUciMove(uci)
  }

  async function handleUserMove({ orig, dest }: { orig: Key; dest: Key }): Promise<string | null> {
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
              _applyUciMove(uci)
              resolve(uci)
            } else {
              resolve(null)
            }
          },
        }
      })
    } else {
      const uci = makeUci({ from: fromSq, to: toSq })
      const success = _applyUciMove(uci)
      return success ? uci : null
    }
  }

  // ... (keep existing methods)

  async function handleAnalysisMove({
    orig,
    dest,
  }: {
    orig: Key
    dest: Key
  }): Promise<string | null> {
    logger.info(`[handleAnalysisMove] Request: ${orig}-${dest}`)
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
              _applyUciMove(uci)
              resolve(uci)
            } else {
              syncBoardWithPgn() // Revert visual board upon cancellation
              resolve(null)
            }
          },
        }
      })
    } else {
      const uci = makeUci({ from: fromSq, to: toSq })
      const move = parseUciMove(uci)

      // Check legality before applying.
      if (move && chessPosition.value.isLegal(move)) {
        logger.info(`[handleAnalysisMove] Move legal: ${uci}`)
        _applyUciMove(uci)
        return uci
      } else {
        logger.warn(`[handleAnalysisMove] Move illegal or invalid: ${uci}`)
        syncBoardWithPgn() // Correctly trigger the snap-back counter for illegal analysis moves
        return null
      }
    }
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

  function setPremove(orig: Key, dest: Key) {
    logger.info(`[BoardStore] Setting queued premove: ${orig}-${dest}`)
    queuedPremove.value = { orig, dest }
  }

  function clearPremove() {
    if (queuedPremove.value) {
      logger.info('[BoardStore] Clearing queued premove')
      queuedPremove.value = null
    }
  }

  function flipBoard() {
    orientation.value = orientation.value === 'white' ? 'black' : 'white'
  }

  function _getRepetitionFen(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ')
  }

  function getGameStatus() {
    const outcomeDetails: ChessopsOutcome | undefined = chessPosition.value.outcome()
    let isGameOver = !!outcomeDetails
    let gameEndOutcome: GameEndOutcome | undefined

    if (outcomeDetails) {
      let reason = 'draw'
      if (outcomeDetails.winner) {
        reason = chessPosition.value.isCheckmate() ? 'checkmate' : 'variant_win'
      } else {
        if (chessPosition.value.isStalemate()) reason = 'stalemate'
        else if (chessPosition.value.isInsufficientMaterial()) reason = 'insufficient_material'
        else if (chessPosition.value.halfmoves >= 100) reason = 'fifty_move_rule'
      }
      gameEndOutcome = { winner: outcomeDetails.winner, reason }
    }

    if (!isGameOver) {
      const fenHistory = pgnService.getFenHistoryForRepetition()
      const currentRepetitionFen = _getRepetitionFen(fen.value)
      const repetitionCount = fenHistory.filter(
        (historicFen) => _getRepetitionFen(historicFen) === currentRepetitionFen,
      ).length
      if (repetitionCount >= 3) {
        isGameOver = true
        gameEndOutcome = { winner: undefined, reason: 'threefold_repetition' }
        logger.info(`[BoardStore] Threefold repetition detected (count: ${repetitionCount}).`)
      }
    }

    return {
      isGameOver,
      outcome: gameEndOutcome,
      isCheck: chessPosition.value.isCheck(),
      turn: chessPosition.value.turn,
    }
  }

  function setDrawableShapes(shapes: DrawShape[]) {
    drawableShapes.value = shapes

    // Sync to PGN comment
    const currentNode = pgnService.getCurrentNode()
    if (currentNode) {
      pgnService.updateCommentShapes(
        currentNode,
        shapes as Parameters<typeof pgnService.updateCommentShapes>[1],
      )
    }
  }

  function setLastNag(marker: NagMarker | null) {
    lastNag.value = marker
  }

  function navigatePgn(
    move: 'start' | 'backward' | 'forward' | 'end',
    targetTurn?: ChessgroundColor | null,
  ) {
    // 1. Perform the primary move
    switch (move) {
      case 'start':
        pgnService.navigateToStart()
        break
      case 'backward':
        pgnService.navigateBackward()
        break
      case 'forward':
        pgnService.navigateForward()
        break
      case 'end':
        pgnService.navigateToEnd()
        break
    }
    const { isChanged, lastPgnMove } = syncBoardWithPgn()

    // 2. Play sound ONLY if board changed
    if (isChanged) {
      _playNavigationSound(lastPgnMove?.san)
    }

    // 3. Smart Navigation (Skip Bot Moves)
    // If targetTurn is set, and we are not at the very start/end (where jumping might not be possible),
    // and the resulting turn is NOT the target turn, we jump one more time.
    if (targetTurn && (move === 'backward' || move === 'forward')) {
      // Check current turn after the first move
      // Note: chessPosition.value.turn is the side to move
      if (turn.value !== targetTurn) {
        // We landed on Bot's turn. Skip it.
        if (move === 'backward') pgnService.navigateBackward()
        else pgnService.navigateForward()

        const skipResult = syncBoardWithPgn()

        // Play sound again for the skipped move if board changed
        if (skipResult.isChanged) {
          _playNavigationSound(skipResult.lastPgnMove?.san)
        }
      }
    }
  }

  function navigateToNode(node: PgnNode) {
    if (pgnService.navigateToNode(node)) {
      const { isChanged } = syncBoardWithPgn()
      if (isChanged) {
        _playNavigationSound(node.san)
      }
    }
  }

  function setAnalysisMode(isActive: boolean) {
    isAnalysisModeActive.value = isActive
    logger.info(`[BoardStore] Analysis mode set to: ${isActive}`)
  }

  function setPlayGameStatusSounds(enabled: boolean) {
    playGameStatusSounds.value = enabled
  }

  function resetBoardState() {
    pgnService.reset(INITIAL_FEN)
    syncBoardWithPgn()

    orientation.value = 'white'
    promotionState.value = null
    drawableShapes.value = []
    isAnalysisModeActive.value = false
    playGameStatusSounds.value = true // Reset sound setting

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
    isAnalysisModeActive,
    playGameStatusSounds,
    boardSyncCounter,
    queuedPremove,
    setupPosition,
    applyUciMove,
    handleUserMove,
    handleAnalysisMove,
    completePromotion,
    cancelPromotion,
    setPremove,
    clearPremove,
    flipBoard,
    getGameStatus,
    setDrawableShapes,
    setAutoShapes(shapes: DrawShape[]) {
      autoShapes.value = shapes
    },
    setLastNag,
    navigatePgn,
    navigateToNode,
    setAnalysisMode,
    setPlayGameStatusSounds,
    resetBoardState,
    lastNag,
    syncBoardWithPgn,
    // Watch for PGN tree changes to sync the board state
    // We only auto-sync if we are in Analysis/Study modes to avoid board jumps during game play
    registerWatcher: watch(pgnTreeVersion, () => {
      if (isAnalysisModeActive.value) {
        syncBoardWithPgn()
      }
    }),
  }
})
