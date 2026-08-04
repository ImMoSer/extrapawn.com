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
import { GameAudioEngine } from './GameAudioEngine'

export type GamePhase = 'IDLE' | 'LOADING' | 'PLAYING' | 'GAMEOVER' | 'ANALYSIS'
export type UserMoveHandler = (uciMove: string) => Promise<boolean>

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const useGameStore = defineStore('game', () => {
  const boardStore = useBoardStore()
  const gamePhase = ref<GamePhase>('IDLE')

  const userMovesCount = ref(0)
  const isGameActive = ref(false)
  const isMoveProcessing = ref(false)
  const botEngineId = ref<EngineId>('maia-2200')
  const currentStrategy = ref<IGameplayStrategy | null>(null)
  const isFreePlay = ref(false)
  const playerColor = computed<ChessgroundColor>(() => boardStore.orientation)

  const userMoveHandlers = ref<UserMoveHandler[]>([])
  const stopHandlers = ref<Array<() => void>>([])

  function registerUserMoveHandler(handler: UserMoveHandler | null): () => void {
    if (!handler) {
      userMoveHandlers.value = []
      return () => {}
    }
    if (!userMoveHandlers.value.includes(handler)) {
      userMoveHandlers.value.push(handler)
    }
    return () => {
      userMoveHandlers.value = userMoveHandlers.value.filter((h) => h !== handler)
    }
  }

  function registerStopHandler(handler: (() => void) | null): () => void {
    if (!handler) {
      stopHandlers.value = []
      return () => {}
    }
    if (!stopHandlers.value.includes(handler)) {
      stopHandlers.value.push(handler)
    }
    return () => {
      stopHandlers.value = stopHandlers.value.filter((h) => h !== handler)
    }
  }

  function _executeStopHandlers() {
    for (const handler of stopHandlers.value) {
      try {
        handler()
      } catch (err) {
        logger.error('[GameStore] Error executing stop handler:', err)
      }
    }
  }

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

      if (gameStatus.outcome && (currentStrategy.value?.config?.playGameStatusSounds !== false)) {
        GameAudioEngine.handleGameOutcome(gameStatus.outcome, playerColor.value)
      }

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

    if (status.outcome && (currentStrategy.value?.config?.playGameStatusSounds !== false)) {
      GameAudioEngine.handleGameOutcome(status.outcome, playerColor.value)
    }

    if (currentStrategy.value) {
      currentStrategy.value.onGameOver?.(status)
    }
  }

  function undoLastUserMove() {
    logger.info('[GameStore] Undoing last user move (Takeback).')
    
    // If it is the player's turn, it means the bot has already made a move.
    // We need to undo the bot's move first, then the user's move.
    const isPlayerTurn = boardStore.turn === playerColor.value
    if (isPlayerTurn && pgnService.getCurrentNode() !== pgnService.getRootNode()) {
      pgnService.undoLastMove()
    }

    if (pgnService.getCurrentNode() !== pgnService.getRootNode()) {
      pgnService.undoLastMove()
    }

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
    if (boardStore.isGameOver || gamePhase.value === 'GAMEOVER' || gamePhase.value === 'ANALYSIS' || gamePhase.value === 'IDLE') {
      logger.info('[GameStore] Skipping bot move request: game is over, in analysis, or idle.')
      return
    }

    if (currentStrategy.value) {
      const fenAtRequest = boardStore.fen
      const startTime = Date.now()
      const uci = await currentStrategy.value.requestBotMove?.(fenAtRequest)
      const elapsedTime = Date.now() - startTime

      const strategyBotDelay = currentStrategy.value.config?.botDelayMs ?? 0
      const targetDelay = overrideDelay ?? strategyBotDelay
      const remainingDelay = Math.max(0, targetDelay - elapsedTime)
      if (remainingDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingDelay))
      }

      // Ensure the previous move's animation is fully completed before showing the bot's response
      const elapsedSinceMove = Date.now() - boardStore.lastMoveTimestamp
      const animationDuration = boardStore.animationDurationMs
      if (elapsedSinceMove < animationDuration) {
        const remainingAnimationDelay = animationDuration - elapsedSinceMove
        logger.info(`[GameStore] Delaying bot move by ${remainingAnimationDelay}ms to let previous move animation finish.`)
        await new Promise((resolve) => setTimeout(resolve, remainingAnimationDelay))
      }

      // Race condition protection
      if (boardStore.fen !== fenAtRequest) {
        logger.warn('[GameStore] Bot move discarded due to position change (race condition protected).')
        return
      }

      if (uci && gamePhase.value === 'PLAYING') {
        const fenBefore = boardStore.fen
        // Apply the bot move in PGN
        const chessopsMove = (await import('chessops/util')).parseUci(uci)
        if (chessopsMove && boardStore.chessPosition.isLegal(chessopsMove)) {
          const san = (await import('chessops/san')).makeSan(boardStore.chessPosition, chessopsMove)
          
          boardStore.applyUciMove(uci)
          
          const fenAfter = boardStore.fen
          pgnService.addNode({ san, uci, fenBefore, fenAfter })
          boardStore.syncVisualCues()
          
          if (san.includes('+')) {
            GameAudioEngine.handleGameOutcome({ winner: undefined, reason: 'check' }, null)
          }
        } else {
          boardStore.applyUciMove(uci)
        }

        const isGameOver = _checkAndHandleGameOver()

        if (!isGameOver && currentStrategy.value.onBotMoveExecuted) {
          await currentStrategy.value.onBotMoveExecuted(uci, boardStore.fen, fenBefore)
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
    logger.info('[GameStore] Starting game with Strategy Context.')

    if (!fen) {
      throw new Error('[GameStore] FEN is required for startWithStrategy. Fail-Fast!')
    }

    if (!userColor) {
      throw new Error(
        '[GameStore] userColor is required for startWithStrategy. The director (feature) must explicitly define the side. Fail-Fast!',
      )
    }

    if (!strategy) {
      throw new Error('[GameStore] strategy is required for startWithStrategy. Fail-Fast!')
    }

    // Cleanup old strategy and reset Orchestrator state if exists
    currentStrategy.value?.onDestroy?.()
    _executeStopHandlers()

    const setupResult = parseFen(fen)
    if (setupResult.isErr) {
      throw new Error(`[GameStore] Invalid FEN provided for startWithStrategy: "${fen}". Fail-Fast!`)
    }
    const setup = setupResult.unwrap()

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
    if ((gamePhase.value !== 'PLAYING' && gamePhase.value !== 'ANALYSIS') || isMoveProcessing.value) {
      if (isMoveProcessing.value) {
        logger.warn('[GameStore] Rejected handleUserMove: move transaction already in progress.')
      }
      return
    }

    isMoveProcessing.value = true
    try {
      const intendedUci = await boardStore.prepareUserUciMove({ orig, dest })
      if (!intendedUci) {
        boardStore.loadPosition(boardStore.fen) // snapback visually
        return
      }

      const isAnalysis = gamePhase.value === 'ANALYSIS'

      // Pre-validate move with Strategy (only during PLAYING, not in ANALYSIS)
      if (!isAnalysis && !isFreePlay.value && currentStrategy.value && currentStrategy.value.validateUserMove) {
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

      let isCommitted = true
      if (userMoveHandlers.value.length > 0) {
        for (const handler of userMoveHandlers.value) {
          const res = await handler(intendedUci)
          if (!res) {
            isCommitted = false
            break
          }
        }
      } else {
        const fenBefore = boardStore.fen
        const positionBefore = boardStore.chessPosition.clone()
        const moveOk = boardStore.applyUciMove(intendedUci)
        if (!moveOk) return

        const chessopsMove = (await import('chessops/util')).parseUci(intendedUci)
        if (chessopsMove) {
          const san = (await import('chessops/san')).makeSan(positionBefore, chessopsMove)
          const fenAfter = boardStore.fen
          pgnService.addNode({ san, uci: intendedUci, fenBefore, fenAfter })
          boardStore.syncVisualCues()
          GameAudioEngine.playMoveSoundFromSan(san, false)
        }
      }

      if (userMovesCount.value === 0 && !isAnalysis) {
        isGameActive.value = true
      }
      userMovesCount.value++

      if (isFreePlay.value || isAnalysis) {
        return
      }

      const strategyAtStart = currentStrategy.value

      if (strategyAtStart && isCommitted && userMoveHandlers.value.length === 0) {
        await strategyAtStart.onUserMoveExecuted?.(intendedUci, boardStore.fen)
      }
    } finally {
      isMoveProcessing.value = false
    }
  }

  function setGamePhase(phase: GamePhase) {
    gamePhase.value = phase
    if (phase === 'GAMEOVER' || phase === 'IDLE') {
      isGameActive.value = false
    }
  }

  function enterAnalysisMode() {
    logger.info('[GameStore] Entering ANALYSIS / FREEPLAY mode.')
    gamePhase.value = 'ANALYSIS'
    isGameActive.value = false
  }

  function setBotEngineId(id: EngineId) {
    botEngineId.value = id
  }

  function stop() {
    logger.info('[GameStore] Stopping game and clearing entity states.')
    
    // 1. Clear Strategy
    currentStrategy.value?.onDestroy?.()
    currentStrategy.value = null
    
    // 2. Clear Phase & Activity
    gamePhase.value = 'IDLE'
    isGameActive.value = false
    userMovesCount.value = 0

    // 3. Clear Entity Systems
    pgnService.reset(INITIAL_FEN)
    boardStore.resetBoardState()

    // 4. Trigger registered stop handlers (e.g. Orchestrator reset)
    _executeStopHandlers()
  }

  async function resetGame() {
    logger.info('[GameStore] Resetting current game context.')
    stop()
  }

  return {
    gamePhase,
    isGameActive,
    isMoveProcessing,
    playerColor,
    currentStrategy,
    isFreePlay,
    startWithStrategy,
    loadPosition,
    navigatePgn,
    navigateToNode,
    handleUserMove,
    undoLastUserMove,
    setGamePhase,
    enterAnalysisMode,
    handleGameResignation,
    resetGame,
    stop,
    userMovesCount,
    botEngineId,
    setBotEngineId,
    triggerBotMove,
    registerUserMoveHandler,
    registerStopHandler,
  }
})

