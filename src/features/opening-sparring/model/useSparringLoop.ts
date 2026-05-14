import {
  gameplayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import type { Key } from '@lichess-org/chessground/types'
import { useTheoryStore } from '@/entities/opening'
import type { MozerBookResponse, MozerBookMove } from '@/entities/opening'

import { areMovesEqual, normalizeUciMove } from '@/shared/lib/chess-utils'
import { serverEngineService, type AnalysisResponse, type EvalLine } from '@/shared/lib/engine'
import { pgnService } from '@/shared/lib/pgn/PgnService'
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

  // handlePlayerMove removed, handled by Strategy mapping directly to enrichUserMove

  async function enrichUserMove(moveUci: string) {
    store.isProcessingMove = true

    const node = pgnService.getLastMove()
    if (!node) {
      console.log('[OpeningSparring] Theory over: No stats available for enrichment.')
      store.isTheoryOver = true
      store.isProcessingMove = false
      return
    }

    const fenBefore = node.fenBefore
    const stats = await theoryStore.awaitMozerStatsForFen(fenBefore, true)

    if (!stats || !stats.moves || stats.moves.length === 0) {
      console.log('[OpeningSparring] Theory over: No stats available for enrichment.')
      store.isTheoryOver = true
      store.isProcessingMove = false
      return
    }

    const moveData = stats.moves.find((m: MozerBookMove) => areMovesEqual(m.uci, moveUci))

    if (!moveData) {
      console.log('[OpeningSparring] Deviation detected:', moveUci)
      store.isDeviation = true
      soundService.playSound('game_user_won')
      store.isProcessingMove = false
      return
    }

    const maxGamesForAnyMove =
      stats.moves.length > 0 ? Math.max(...stats.moves.map((m: MozerBookMove) => m.total)) : 1

    const popularity = (moveData.total / maxGamesForAnyMove) * 100
    const wins = store.playerColor === 'white' ? moveData.win_p : moveData.loss_p
    const winRateRaw = wins + 0.5 * moveData.draw_p
    const moveStats = {
      uci: moveData.uci,
      san: moveData.san,
      total: moveData.total,
      win_p: moveData.win_p,
      draw_p: moveData.draw_p,
      loss_p: moveData.loss_p,
    }

    // Enrich PGN
    pgnService.updateNode(node, {
      metadata: {
        phase: 'theory',
        stats: moveStats,
        popularity,
        winRate: winRateRaw,
      },
    })

    // Refresh reactive stats for UI (for the new FEN)
    await fetchStats()

    store.isProcessingMove = false
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

  async function enrichBotMove(selectedUci: string) {
    const isLichess = store.opponentSource === 'lichess'
    const node = pgnService.getLastMove()
    const fenBefore = node?.fenBefore || boardStore.fen

    const stats = isLichess
      ? await theoryStore.awaitLichessStatsForFen(fenBefore, undefined, true)
      : await theoryStore.awaitMozerStatsForFen(fenBefore, true)

    type UnifiedMove = {
      uci: string
      san: string
      total: number
      win_p: number
      draw_p: number
      loss_p: number
    }
    type UnifiedStats = { summary?: { total: number }; total?: number; moves: UnifiedMove[] }

    const moveData = (stats as UnifiedStats | null)?.moves.find((m) =>
      areMovesEqual(m.uci, selectedUci),
    )

    let moveStats = undefined
    let popularity = 0
    let winRateRaw = 0

    if (moveData) {
      const castedStats = stats as UnifiedStats

      const maxGamesForAnyMove =
        castedStats.moves.length > 0
          ? Math.max(...castedStats.moves.map((m: UnifiedMove) => m.total))
          : 1

      popularity = (moveData.total / maxGamesForAnyMove) * 100

      const wins = store.playerColor === 'white' ? moveData.win_p : moveData.loss_p
      winRateRaw = wins + 0.5 * moveData.draw_p

      moveStats = {
        uci: moveData.uci,
        san: moveData.san,
        total: moveData.total,
        win_p: moveData.win_p,
        draw_p: moveData.draw_p,
        loss_p: moveData.loss_p,
      }
    }

    if (node && node.uci === selectedUci) {
      pgnService.updateNode(node, {
        metadata: {
          phase: 'theory',
          stats: moveStats,
          popularity,
          winRate: winRateRaw,
        },
      })
    }

    // Refresh reactive stats for UI for the NEW position
    await fetchStats()

    if (!moveData) {
      store.isTheoryOver = true
    }
  }

  // Promise chain for playout move processing
  let recordQueue = Promise.resolve()
  let lastEvalAfter: EvalLine[] | undefined = undefined

  async function _recordPlayoutMove(uci: string) {
    const currentNode = pgnService.getLastMove()
    if (!currentNode || currentNode.uci !== uci) {
      console.warn(
        '[OpeningSparring] PGN Sync Error: Current node does not match played move.',
        currentNode?.uci,
        uci,
      )
      return
    }

    const fenBefore = currentNode.fenBefore

    pgnService.updateNode(currentNode, {
      metadata: {
        phase: 'playout',
        loading: true,
      },
    })

    recordQueue = recordQueue.then(async () => {
      try {
        const evalBeforeParam = lastEvalAfter
        const currentPgn = pgnService.getCurrentPgnString()
        const response = (await serverEngineService.analyzeMove(
          fenBefore,
          uci,
          currentPgn,
          evalBeforeParam,
        )) as AnalysisResponse

        if (response && response.quality && response.eval_after) {
          // Update the cache for the next turn
          lastEvalAfter = response.eval_after

          const bestLineBefore = response.eval_before?.[0]
          const bestLineAfter = response.eval_after?.[0]

          pgnService.updateNode(currentNode, {
            metadata: {
              phase: 'playout',
              loading: false,
              nag: response.quality.nag,
              quality: classifyMoveFromNag(response.quality.nag),
              chaos_index: response.quality.chaos_index,
              is_sacrifice: response.quality.is_sacrifice,
              evaluation: {
                score_cp: bestLineAfter?.cp || 0,
                win_prob: bestLineAfter?.win_prob || 0,
                depth: bestLineAfter?.depth || 0,
                best_move: bestLineBefore?.move_uci || '',
                delta_wp: response.quality.delta_wp,
                delta_cp: response.quality.delta_cp,
              },
            },
          })

          // Set the marker on the board
          const targetSquare = uci.slice(2, 4) as Key
          if (response.quality.nag && response.quality.nag !== 'OK') {
            boardStore.setLastNag({
              square: targetSquare,
              nag: response.quality.nag,
              quality: classifyMoveFromNag(response.quality.nag),
            })
          } else {
            boardStore.setLastNag(null)
          }
        }
      } catch (e) {
        console.error('[OpeningSparring] Error in playout recording:', e)
        pgnService.updateNode(currentNode, {
          metadata: { phase: 'playout', loading: false, error: true },
        })
      }
    })

    await recordQueue
  }

  function classifyMoveFromNag(nag: string): string {
    if (nag === '??') return 'blunder'
    if (nag === '?') return 'mistake'
    if (nag === '?!') return 'inaccuracy'
    if (nag === '!!') return 'brilliant'
    if (nag === '!') return 'best'
    if (nag === '!?') return 'interesting'
    return 'good'
  }

  function getNagDelay(nag?: string): number {
    if (nag === '??' || nag === '!!') return 2000
    if (nag === '?' || nag === '!') return 1500
    if (nag === '?!' || nag === '!?') return 1000
    return 0
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
    store.isFinalEvaluating = false
    const gameStore = useGameStore()

    soundService.playSound('game_play_out_start')

    // Rebooting GameStore loop ensures bot will move if it's its turn
    gameStore.startWithStrategy(boardStore.fen, createStrategy(), store.playerColor, true)
  }

  function createStrategy(): IGameplayStrategy {
    // Reset playout state to ensure fresh evaluation for the new session/phase
    lastEvalAfter = undefined
    recordQueue = Promise.resolve()

    return {
      config: {},
      async validateUserMove() {
        return true
      },
      async onUserMoveExecuted(uci: string) {
        if (store.isPlayoutMode) {
          await _recordPlayoutMove(uci)

          const lastNode = pgnService.getLastMove()
          const nag = lastNode?.metadata?.nag
          const delay = getNagDelay(nag)

          if (delay > 0) {
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        } else {
          await enrichUserMove(uci)
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
      async onBotMoveExecuted(uci: string) {
        if (store.isPlayoutMode) {
          await _recordPlayoutMove(uci)
        } else {
          await enrichBotMove(uci)
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
