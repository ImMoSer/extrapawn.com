// src/entities/game/model/game.store.ts
import { useBoardStore } from './board.store'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'
import type { Color as ChessgroundColor, Key } from '@lichess-org/chessground/types'
import { parseFen } from 'chessops/fen'
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { pgnService, type PgnNode } from '@/shared/lib/pgn/PgnService'
import type { Outcome as ChessopsOutcome } from 'chessops'

import type { IGameCoreApi, IGameplayStrategy, GameStatusInfo } from './strategy.types'

export type GamePhase = 'IDLE' | 'LOADING' | 'PLAYING' | 'GAMEOVER'

export const useGameStore = defineStore('game', () => {
  const boardStore = useBoardStore()
  const gamePhase = ref<GamePhase>('IDLE')

  const userMovesCount = ref(0)
  const isGameActive = ref(false)
  const botEngineId = ref<EngineId>('maia-2200')
  const currentStrategy = ref<IGameplayStrategy | null>(null)
  const playerColor = computed<ChessgroundColor>(() => boardStore.orientation)

  function getGameStatus(): GameStatusInfo {
    const chessPosition = boardStore.chessPosition
    const outcomeDetails: ChessopsOutcome | undefined = chessPosition.outcome()
    let isGameOver = !!outcomeDetails
    let gameEndOutcome

    if (outcomeDetails) {
      let reason = 'draw'
      if (outcomeDetails.winner) {
        reason = chessPosition.isCheckmate() ? 'checkmate' : 'variant_win'
      } else {
        if (chessPosition.isStalemate()) reason = 'stalemate'
        else if (chessPosition.isInsufficientMaterial()) reason = 'insufficient_material'
        else if (chessPosition.halfmoves >= 100) reason = 'fifty_move_rule'
      }
      gameEndOutcome = { winner: outcomeDetails.winner, reason }
    }

    if (!isGameOver) {
      const fenHistory = pgnService.getFenHistoryForRepetition()
      const currentRepetitionFen = boardStore.fen.split(' ').slice(0, 4).join(' ')
      const repetitionCount = fenHistory.filter(
        (historicFen) => historicFen.split(' ').slice(0, 4).join(' ') === currentRepetitionFen,
      ).length
      if (repetitionCount >= 3) {
        isGameOver = true
        gameEndOutcome = { winner: undefined, reason: 'threefold_repetition' }
        logger.info(`[GameStore] Threefold repetition detected (count: ${repetitionCount}).`)
      }
    }

    return {
      isGameOver,
      outcome: gameEndOutcome,
      isCheck: chessPosition.isCheck(),
      turn: chessPosition.turn,
    }
  }

  function _checkAndHandleGameOver(): boolean {
    if (gamePhase.value !== 'PLAYING') {
      return true
    }

    const gameStatus = getGameStatus()
    if (gameStatus.isGameOver) {
      isGameActive.value = false
      gamePhase.value = 'GAMEOVER'

      if (currentStrategy.value?.onGameOver) {
        currentStrategy.value.onGameOver(gameStatus)
      }
      return true
    }
    return false
  }

  function handleGameResignation() {
    if (gamePhase.value !== 'PLAYING') return
    logger.warn('[GameStore] Game resigned by user action.')

    const status: GameStatusInfo = {
      ...getGameStatus(),
      isGameOver: true,
      outcome: { winner: undefined, reason: 'resign' },
    }

    gamePhase.value = 'GAMEOVER'
    isGameActive.value = false

    if (currentStrategy.value) {
      currentStrategy.value.onGameOver?.(status)
    }
  }

  function undoLastUserMove() {
    logger.info('[GameStore] Undoing last user move (Takeback).')
    pgnService.undoLastMove()
    boardStore.loadPosition(pgnService.getCurrentNavigatedFen())

    if (gamePhase.value === 'GAMEOVER') {
      gamePhase.value = 'PLAYING'
      isGameActive.value = true
    }

    if (currentStrategy.value?.onUserMoveUndone) {
      currentStrategy.value.onUserMoveUndone()
    }
  }

  async function triggerBotMove(overrideDelay?: number) {
    if (currentStrategy.value) {
      const fenAtRequest = boardStore.fen
      const uci = await currentStrategy.value.requestBotMove?.(fenAtRequest)

      const delay = overrideDelay ?? currentStrategy.value.config?.botDelayMs ?? 50
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      // Race condition protection
      if (boardStore.fen !== fenAtRequest) {
        logger.warn('[GameStore] Bot move discarded due to position change (race condition protected).')
        return
      }

      if (uci && gamePhase.value === 'PLAYING') {
        // Apply the bot move in PGN
        const chessopsMove = (await import('chessops/util')).parseUci(uci)
        if (chessopsMove && boardStore.chessPosition.isLegal(chessopsMove)) {
          const fenBefore = boardStore.fen
          const san = (await import('chessops/san')).makeSan(boardStore.chessPosition, chessopsMove)
          
          boardStore.applyUciMove(uci)
          
          const fenAfter = boardStore.fen
          pgnService.addNode({ san, uci, fenBefore, fenAfter })
        } else {
          boardStore.applyUciMove(uci)
        }

        _checkAndHandleGameOver()

        if (currentStrategy.value.onBotMoveExecuted) {
          await currentStrategy.value.onBotMoveExecuted(uci, boardStore.fen)
        }
      }
    }
  }

  const coreApi: IGameCoreApi = {
    setPaused: (isPaused: boolean) => {
      gamePhase.value = isPaused ? 'IDLE' : 'PLAYING'
    },
    applyBotMove: (uci: string) => {
      boardStore.applyUciMove(uci)
      _checkAndHandleGameOver()
    },
  }

  function startWithStrategy(
    fen: string,
    strategy: IGameplayStrategy,
    userColor: ChessgroundColor,
    keepPgn: boolean = false,
  ) {
    try {
      logger.info('[GameStore] Starting game with Strategy Context.')
      const setup = parseFen(fen).unwrap()

      if (!userColor) {
        throw new Error(
          '[GameStore] userColor is required for startWithStrategy. The director (feature) must explicitly define the side.',
        )
      }

      currentStrategy.value = strategy

      if (!keepPgn) {
        pgnService.reset(fen)
        boardStore.setupPosition(fen, userColor)
      } else {
        boardStore.orientation = userColor
      }

      userMovesCount.value = 0
      isGameActive.value = false
      gamePhase.value = 'PLAYING'

      strategy.onGameStart?.(coreApi)

      const isBotTurn = setup.turn !== userColor
      if (isBotTurn) {
        triggerBotMove(strategy.config?.initialBotDelayMs)
      }
    } catch (error) {
      logger.error('[GameStore] Invalid FEN provided for startWithStrategy:', fen, error)
      gamePhase.value = 'IDLE'
    }
  }

  function loadPosition(fen: string) {
    logger.info(`[GameStore] Loading position: ${fen}`)
    boardStore.loadPosition(fen)
    _checkAndHandleGameOver()
  }

  function navigatePgn(
    move: 'start' | 'backward' | 'forward' | 'end',
    targetTurn?: ChessgroundColor | null,
  ) {
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

    if (targetTurn && (move === 'backward' || move === 'forward')) {
      const setup = parseFen(pgnService.getCurrentNavigatedFen()).unwrap()
      const currentColor = setup.turn === 'white' ? 'white' : 'black'
      if (currentColor !== targetTurn) {
        if (move === 'backward') pgnService.navigateBackward()
        else pgnService.navigateForward()
      }
    }

    loadPosition(pgnService.getCurrentNavigatedFen())
  }

  function navigateToNode(node: PgnNode) {
    if (pgnService.navigateToNode(node)) {
      loadPosition(node.fenAfter)
    }
  }

  async function handleUserMove(orig: Key, dest: Key) {
    if (gamePhase.value !== 'PLAYING') return

    const { makeUci, parseSquare } = await import('chessops/util')
    const fromSq = parseSquare(orig)
    const toSq = parseSquare(dest)

    let intendedUci: string | null = null
    if (fromSq !== undefined && toSq !== undefined) {
      intendedUci = makeUci({ from: fromSq, to: toSq })
    }

    // Pre-validate move with Strategy
    if (currentStrategy.value && currentStrategy.value.validateUserMove && intendedUci) {
      const isLegalForStrategy = await currentStrategy.value.validateUserMove(
        intendedUci,
        boardStore.fen,
      )
      if (!isLegalForStrategy) {
        logger.warn(`[GameStore] Move ${intendedUci} rejected by Strategy.`)
        boardStore.loadPosition(boardStore.fen) // snapback visually
        return
      }
    }

    const uciMove = await boardStore.handleUserMove({ orig, dest })

    if (!uciMove) {
      return
    }

    if (userMovesCount.value === 0) {
      isGameActive.value = true
    }
    userMovesCount.value++

    const strategyAtStart = currentStrategy.value

    const isGameOver = _checkAndHandleGameOver()

    if (strategyAtStart) {
      await strategyAtStart.onUserMoveExecuted?.(uciMove, boardStore.fen)

      if (!isGameOver && currentStrategy.value === strategyAtStart) {
        const isBotTurn = boardStore.turn !== playerColor.value
        if (isBotTurn) {
          await triggerBotMove()
        }
      }
    }
  }

  function setGamePhase(phase: GamePhase) {
    gamePhase.value = phase
    if (phase === 'GAMEOVER' || phase === 'IDLE') {
      isGameActive.value = false
    }
  }

  function setBotEngineId(id: EngineId) {
    botEngineId.value = id
  }

  function stop() {
    logger.info('[GameStore] Stopping game and resetting states.')
    currentStrategy.value = null
    gamePhase.value = 'IDLE'
    isGameActive.value = false
    userMovesCount.value = 0

    import('@/shared/lib/engine/coach/CoachEngineManager').then(({ coachEngineManager }) => {
      coachEngineManager.stop()
    })

    boardStore.resetBoardState()
  }

  async function resetGame() {
    boardStore.resetBoardState()

    gamePhase.value = 'IDLE'
    currentStrategy.value = null
    userMovesCount.value = 0
    isGameActive.value = false

    logger.info('[GameStore] Full game state has been reset.')
  }

  return {
    gamePhase,
    isGameActive,
    playerColor,
    currentStrategy,
    startWithStrategy,
    loadPosition,
    navigatePgn,
    navigateToNode,
    handleUserMove,
    undoLastUserMove,
    setGamePhase,
    handleGameResignation,
    resetGame,
    stop,
    userMovesCount,
    botEngineId,
    setBotEngineId,
    triggerBotMove,
  }
})
