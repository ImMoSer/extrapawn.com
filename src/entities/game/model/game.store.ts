// src/stores/game.store.ts
import { useBoardStore } from './board.store'
import logger from '@/shared/lib/logger'
import type { EngineId } from '@/shared/types/api.types'
import type { Color as ChessgroundColor, Key } from '@lichess-org/chessground/types'
import { parseFen } from 'chessops/fen'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { soundService } from '@/shared/lib/sound.service'

import type { IGameCoreApi, IGameplayStrategy, GameStatusInfo } from './strategy.types'

export type GamePhase = 'IDLE' | 'LOADING' | 'PLAYING' | 'GAMEOVER'
export const useGameStore = defineStore('game', () => {
  const gamePhase = ref<GamePhase>('IDLE')

  const userMovesCount = ref(0)
  const isGameActive = ref(false)
  const botEngineId = ref<EngineId>('maia-2200')
  const currentStrategy = ref<IGameplayStrategy | null>(null)
  const playerColor = ref<ChessgroundColor>('white')

  const boardStore = useBoardStore()

  function _playOutcomeSound(status: GameStatusInfo) {
    // Only play if sounds are enabled in strategy config
    if (currentStrategy.value?.config?.playGameStatusSounds === false) return

    const isWin = currentStrategy.value?.checkWinCondition
      ? currentStrategy.value.checkWinCondition(status)
      : status.outcome?.winner === playerColor.value

    if (isWin) {
      soundService.playSound('game_user_won')
    } else {
      // For now, any non-win outcome in a puzzle/training context is treated as 'lost' sound-wise
      // unless it's a draw and the mode doesn't consider it a loss.
      // But usually, if checkWinCondition is false, it's a failure.
      soundService.playSound('game_user_lost')
    }
  }

  function _checkAndHandleGameOver(): boolean {
    if (gamePhase.value !== 'PLAYING') {
      return true
    }

    const gameStatus = boardStore.getGameStatus()
    if (gameStatus.isGameOver) {
      isGameActive.value = false

      // Centralized Sound Handling
      _playOutcomeSound(gameStatus)

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

    const status = {
      ...boardStore.getGameStatus(),
      isGameOver: true,
      outcome: { winner: undefined, reason: 'resign' },
    }

    // Sound logic for resignation (always a loss unless strategy says otherwise)
    _playOutcomeSound(status)

    if (currentStrategy.value) {
      currentStrategy.value.onGameOver?.(status)
    }
  }

  async function _triggerBotMove(overrideDelay?: number) {
    if (currentStrategy.value) {
      const uci = await currentStrategy.value.requestBotMove?.(boardStore.fen)

      const delay = overrideDelay ?? currentStrategy.value.config?.botDelayMs ?? 50
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      if (uci && gamePhase.value === 'PLAYING') {
        boardStore.applyUciMove(uci)
        _checkAndHandleGameOver()

        if (currentStrategy.value.onBotMoveExecuted) {
          await currentStrategy.value.onBotMoveExecuted(uci, boardStore.fen)
        }

        // After bot move, check if we have a premove to execute
        await _tryExecutePremove()
      }
    }
  }

  async function _tryExecutePremove() {
    if (boardStore.queuedPremove && gamePhase.value === 'PLAYING') {
      const pm = boardStore.queuedPremove
      logger.info(`[GameStore] Consuming queued premove: ${pm.orig}-${pm.dest}`)
      // Clear BEFORE executing to avoid potential loops or state mess
      boardStore.clearPremove()
      await handleUserMove(pm.orig, pm.dest)
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

      playerColor.value = userColor
      currentStrategy.value = strategy

      const humanPlayerColor = userColor

      if (!keepPgn) {
        boardStore.setupPosition(fen, humanPlayerColor)
      } else {
        boardStore.orientation = humanPlayerColor
      }

      if (strategy.config?.playGameStatusSounds !== undefined) {
        boardStore.setPlayGameStatusSounds(strategy.config.playGameStatusSounds)
      }

      userMovesCount.value = 0
      isGameActive.value = false
      gamePhase.value = 'PLAYING'

      strategy.onGameStart?.(coreApi)

      const isBotTurn = setup.turn !== humanPlayerColor
      if (isBotTurn) {
        _triggerBotMove(strategy.config?.initialBotDelayMs)
      } else {
        // If it's human turn at start, check if they already set a premove (unlikely but possible)
        _tryExecutePremove()
      }
    } catch (error) {
      logger.error('[GameStore] Invalid FEN provided for startWithStrategy:', fen, error)
      gamePhase.value = 'IDLE'
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

    // 1. Пре-валидация хода Стратегией (Dual-Boot)
    if (currentStrategy.value && currentStrategy.value.validateUserMove && intendedUci) {
      const isLegalForStrategy = await currentStrategy.value.validateUserMove(
        intendedUci,
        boardStore.fen,
      )
      if (!isLegalForStrategy) {
        logger.warn(`[GameStore] Move ${intendedUci} rejected by Strategy.`)
        boardStore.syncBoardWithPgn() // Возвращаем визуальную доску на место
        return // Прерываем процесс, ход не идет в ядро доски/PGN
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
        await _triggerBotMove()
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
    handleUserMove,
    setGamePhase,
    handleGameResignation,
    resetGame,
    userMovesCount,
    botEngineId,
    setBotEngineId,
  }
})
