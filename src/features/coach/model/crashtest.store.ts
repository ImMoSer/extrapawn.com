import { enginePlayService, useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore, usePreferencesStore } from '@/entities/user'
import logger from '@/shared/lib/logger'
import type { CrashtestEngineId } from '@/shared/types/api.types'
import type { Key } from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useCoachStore } from './coach.store'

export const useCrashtestStore = defineStore('crashtest', () => {
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const coachStore = useCoachStore()
  const preferencesStore = usePreferencesStore()

  const isMo3ep = computed(() => authStore.isMo3ep)

  const isCrashtestEnabled = computed({
    get: () => preferencesStore.preferences.gameplay.global_crashtest,
    set: (val: boolean) =>
      preferencesStore.updatePreferences({ gameplay: { global_crashtest: val } }),
  })

  const crashtestEngine = computed<CrashtestEngineId>({
    get: () => preferencesStore.preferences.gameplay.crashtestEngine,
    set: (val: CrashtestEngineId) =>
      preferencesStore.updatePreferences({ gameplay: { crashtestEngine: val } }),
  })

  let currentCycleToken = 0
  let activeTimer: ReturnType<typeof setTimeout> | null = null

  const lastExecutedFen = ref<string | null>(null)
  const plannedPromotionRole = ref<ChessopsRole | null>(null)

  function getPromotionRole(char: string): ChessopsRole {
    switch (char) {
      case 'q':
        return 'queen'
      case 'r':
        return 'rook'
      case 'b':
        return 'bishop'
      case 'n':
        return 'knight'
      default:
        return 'queen'
    }
  }

  function cancelPendingCycle() {
    currentCycleToken++
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
  }

  function resetCycleState() {
    cancelPendingCycle()
    lastExecutedFen.value = null
    plannedPromotionRole.value = null
  }

  watch(
    () => boardStore.promotionState,
    (promoState) => {
      if (promoState && plannedPromotionRole.value && isCrashtestEnabled.value) {
        const role = plannedPromotionRole.value
        logger.info(`[Crashtest] Deterministically resolving promotion to: ${role}`)
        boardStore.completePromotion(role)
      }
    },
    { flush: 'sync' },
  )

  const isReadyForCrashtestMove = computed(() => {
    if (!isMo3ep.value || !isCrashtestEnabled.value) return false
    if (gameStore.gamePhase !== 'PLAYING') return false
    if (gameStore.isMoveProcessing) return false
    if (boardStore.turn !== boardStore.orientation) return false
    if (lastExecutedFen.value === boardStore.fen) return false

    if (crashtestEngine.value === 'stockfish') {
      if (coachStore.isAnalyzing) return false
      if (coachStore.lastFetchedFen !== boardStore.fen) return false
      const topMove = coachStore.topMoves[0]?.uci
      if (!topMove || topMove.length < 4) return false
    }

    return true
  })

  async function resolveBestMoveForCrashtest(
    token: number,
    targetFen: string,
    engineId: CrashtestEngineId,
  ): Promise<string | null> {
    if (engineId === 'stockfish') {
      if (coachStore.lastFetchedFen !== targetFen) return null
      return coachStore.topMoves[0]?.uci ?? null
    }

    try {
      const move = await enginePlayService.getBestMove(engineId, targetFen)
      if (token !== currentCycleToken) return null
      return move
    } catch (err) {
      logger.error(`[Crashtest] Neural engine "${engineId}" move fetch failed:`, err)
      return null
    }
  }

  async function executeMove(token: number, targetFen: string) {
    if (token !== currentCycleToken) {
      logger.info(
        `[Crashtest] Execution aborted: token mismatch (${token} !== ${currentCycleToken})`,
      )
      return
    }

    if (
      boardStore.fen !== targetFen ||
      gameStore.gamePhase !== 'PLAYING' ||
      gameStore.isMoveProcessing ||
      !isCrashtestEnabled.value
    ) {
      logger.warn('[Crashtest] Execution aborted: state changed after delay.')
      return
    }

    const activeEngine = crashtestEngine.value
    const bestMoveUci = await resolveBestMoveForCrashtest(token, targetFen, activeEngine)

    if (
      token !== currentCycleToken ||
      boardStore.fen !== targetFen ||
      gameStore.gamePhase !== 'PLAYING' ||
      gameStore.isMoveProcessing ||
      !isCrashtestEnabled.value
    ) {
      return
    }

    if (!bestMoveUci || bestMoveUci.length < 4) {
      logger.warn(`[Crashtest] Execution aborted: empty move from "${activeEngine}".`)
      return
    }

    const orig = bestMoveUci.substring(0, 2) as Key
    const dest = bestMoveUci.substring(2, 4) as Key
    const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

    plannedPromotionRole.value = promoChar ? getPromotionRole(promoChar) : null
    lastExecutedFen.value = targetFen

    logger.info(
      `[Crashtest] Dispatching move (${activeEngine}): ${bestMoveUci} for FEN: ${targetFen}`,
    )

    try {
      await gameStore.handleUserMove(orig, dest)
      logger.info(`[Crashtest] Successfully dispatched handleUserMove(${orig}->${dest})`)
    } catch (err) {
      logger.error('[Crashtest] Exception during handleUserMove execution:', err)
    } finally {
      plannedPromotionRole.value = null
      if (boardStore.fen === targetFen) {
        lastExecutedFen.value = null
      }
    }
  }

  function scheduleMove(targetFen: string) {
    cancelPendingCycle()
    const token = currentCycleToken
    const delay = preferencesStore.preferences.delays.crashtestDelayMs

    logger.info(
      `[Crashtest] Scheduling move (${crashtestEngine.value}) for FEN: ${targetFen} with delay: ${delay}ms (token: ${token})`,
    )

    if (delay <= 0) {
      void executeMove(token, targetFen)
    } else {
      activeTimer = setTimeout(() => {
        activeTimer = null
        void executeMove(token, targetFen)
      }, delay)
    }
  }

  function evaluateCrashtestCycle() {
    const currentFen = boardStore.fen
    const ready = isReadyForCrashtestMove.value
    const engine = crashtestEngine.value

    if (ready && currentFen && lastExecutedFen.value !== currentFen) {
      scheduleMove(currentFen)
    } else if (!ready) {
      cancelPendingCycle()
      if (
        engine === 'stockfish' &&
        isMo3ep.value &&
        isCrashtestEnabled.value &&
        gameStore.gamePhase === 'PLAYING' &&
        boardStore.turn === boardStore.orientation &&
        !coachStore.isAnalyzing &&
        (coachStore.topMoves.length === 0 || coachStore.lastFetchedFen !== currentFen) &&
        currentFen
      ) {
        void coachStore.runAnalysis(currentFen)
      }
    }
  }

  watch(
    [isReadyForCrashtestMove, () => boardStore.fen, crashtestEngine],
    () => {
      evaluateCrashtestCycle()
    },
    { immediate: true },
  )

  watch(
    [isCrashtestEnabled, () => gameStore.gamePhase, () => gameStore.currentStrategy],
    ([enabled, phase]) => {
      resetCycleState()
      if (enabled && phase === 'PLAYING') {
        evaluateCrashtestCycle()
      }
    },
  )

  function init() {
    logger.info('[CrashtestStore] Synchronizing deterministic crashtest engine.')
    resetCycleState()
    if (isCrashtestEnabled.value && gameStore.gamePhase === 'PLAYING') {
      evaluateCrashtestCycle()
    }
  }

  return {
    isMo3ep,
    isCrashtestEnabled,
    crashtestEngine,
    init,
  }
})
