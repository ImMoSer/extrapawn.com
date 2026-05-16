import {
  gameplayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { useTheoryStore, type MozerBookResponse } from '@/entities/opening'
import { normalizeUciMove } from '@/shared/lib/chess-utils'
import { soundService } from '@/shared/lib/sound.service'
import { useOpeningSparringStore } from '../index'

/**
 * Encapsulates the core game loop for Opening Sparring.
 * Moves the heavy recursive async logic (processMoveQueue, triggerBotMove)
 * and direct PGN/Service manipulations out of the store.
 */
export function useSparringLoop() {
  const store = useOpeningSparringStore()
  const boardStore = useBoardStore()
  const theoryStore = useTheoryStore()

  async function fetchStats() {
    store.isLoading = true
    store.error = null
    try {
      if (store.showMozerBook) {
        await theoryStore.fetchMozerStats(boardStore.fen)
      }
      if (store.opponentSource === 'lichess' && boardStore.turn !== store.playerColor) {
        await theoryStore.fetchLichessStats(boardStore.fen)
      }
    } catch (e: unknown) {
      store.error = e instanceof Error ? e.message : String(e)
    } finally {
      store.isLoading = false
    }
  }

  async function getTheoryBotMoveUci(): Promise<string | null> {
    const isLichess = store.opponentSource === 'lichess'
    const fen = boardStore.fen

    const stats = isLichess
      ? await theoryStore.awaitLichessStatsForFen(fen, undefined, true)
      : await theoryStore.awaitMozerStatsForFen(fen, true)

    if (!stats || !stats.moves || stats.moves.length === 0) {
      store.isTheoryOver = true
      return null
    }

    // 1. Character Style override (Master DB only)
    if (!isLichess && store.opponentCharacter !== 'none') {
      const mozerStats = stats as MozerBookResponse
      if (mozerStats.styles) {
        const charStyle =
          mozerStats.styles[store.opponentCharacter as keyof typeof mozerStats.styles]
        if (charStyle && charStyle.uci) {
          return normalizeUciMove(charStyle.uci)
        }
      }
    }

    // Determine candidate moves
    const candidates = stats.moves
      .slice(0, store.variability)
      .map((m: { uci: string; total: number }) => ({ uci: m.uci, total: m.total }))

    if (candidates.length === 0) {
      store.isTheoryOver = true
      return null
    }

    const totalWeight = candidates.reduce((sum: number, c: { total: number }) => sum + c.total, 0)
    let random = Math.random() * totalWeight

    for (const c of candidates) {
      random -= c.total
      if (random <= 0) return normalizeUciMove(c.uci)
    }

    return normalizeUciMove(candidates[0]!.uci)
  }

  function handlePlayoutGameOver(
    isWin: boolean,
    outcome?: { winner?: 'white' | 'black'; reason?: string },
  ) {
    const gameStore = useGameStore()
    gameStore.setGamePhase('GAMEOVER')

    if (!store.isPlayoutMode) {
      store.isTheoryOver = true
    }

    console.log(`[OpeningSparring] Game Over. Win: ${isWin}, Reason: ${outcome?.reason}`)
  }

  async function startPlayout() {
    store.isPlayoutMode = true
    const gameStore = useGameStore()

    soundService.playSound('game_play_out_start')

    // Rebooting GameStore loop ensures bot will move if it's its turn
    gameStore.startWithStrategy(boardStore.fen, createStrategy(), store.playerColor, true)
  }

  function createStrategy(): IGameplayStrategy {
    return {
      config: {},
      async validateUserMove() {
        return true
      },
      async onUserMoveExecuted() {
        if (!store.isPlayoutMode) {
          await fetchStats()
        }
      },
      async requestBotMove(fen: string): Promise<string | null> {
        if (store.isPlayoutMode) {
          store.isProcessingMove = true
          const gameStore = useGameStore()
          const botEngineId = gameStore.botEngineId
          const uci = await gameplayService.getBestMove(botEngineId, fen)
          return uci
        }

        if (store.isTheoryOver || store.isDeviation) return null

        store.isProcessingMove = true
        const uci = await getTheoryBotMoveUci()
        return uci
      },
      async onBotMoveExecuted() {
        if (!store.isPlayoutMode) {
          await fetchStats()
        }
        store.isProcessingMove = false
      },
      onGameOver(status: GameStatusInfo) {
        handlePlayoutGameOver(status.outcome?.winner === store.playerColor, status.outcome)
      },
      checkWinCondition(status: GameStatusInfo) {
        return status.outcome?.winner === store.playerColor
      },
    }
  }

  return {
    fetchStats,
    createStrategy,
    startPlayout,
  }
}
