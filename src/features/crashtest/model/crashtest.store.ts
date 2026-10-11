import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useCoachStore } from '@/features/coach'
import { usePreferencesStore } from '@/features/settings'
import logger from '@/shared/lib/logger'
import type { Key } from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const useCrashtestStore = defineStore('crashtest', () => {
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const coachStore = useCoachStore()
  const preferencesStore = usePreferencesStore()

  // 1. Check if the user is mo3ep / MO3EP
  const isMo3ep = computed(() => authStore.isMo3ep)

  // Use preferences store state for toggling crashtest
  const isCrashtestEnabled = computed({
    get: () => preferencesStore.preferences.gameplay.global_crashtest,
    set: (val: boolean) => preferencesStore.updatePreferences({ gameplay: { global_crashtest: val } }),
  })

  // Token of the current scheduled cycle to prevent race conditions & stale execution
  let currentCycleToken = 0
  let activeTimer: ReturnType<typeof setTimeout> | null = null

  // FEN for which the last move was successfully initiated, preventing duplicate dispatch
  const lastExecutedFen = ref<string | null>(null)

  // Promotion role currently planned for the pending move
  const plannedPromotionRole = ref<ChessopsRole | null>(null)

  function getPromotionRole(char: string): ChessopsRole {
    switch (char) {
      case 'q': return 'queen'
      case 'r': return 'rook'
      case 'b': return 'bishop'
      case 'n': return 'knight'
      default: return 'queen'
    }
  }

  function cancelPendingCycle() {
    currentCycleToken++
    if (activeTimer !== null) {
      clearTimeout(activeTimer)
      activeTimer = null
    }
  }

  // Synchronous watcher for promotionState to auto-complete promotions without blind timeouts
  watch(
    () => boardStore.promotionState,
    (promoState) => {
      if (promoState && plannedPromotionRole.value && isCrashtestEnabled.value) {
        const role = plannedPromotionRole.value
        logger.info(`[Crashtest] Deterministically resolving promotion to: ${role}`)
        boardStore.completePromotion(role)
      }
    },
    { flush: 'sync' }
  )

  // Predicate indicating whether all prerequisites for a synthetic user move are met
  const isReadyForCrashtestMove = computed(() => {
    if (!isMo3ep.value || !isCrashtestEnabled.value) return false
    if (gameStore.gamePhase !== 'PLAYING') return false
    if (gameStore.isMoveProcessing) return false
    if (boardStore.turn !== boardStore.orientation) return false
    if (coachStore.isAnalyzing) return false

    const topMove = coachStore.topMoves[0]?.uci
    if (!topMove || topMove.length < 4) return false

    if (lastExecutedFen.value === boardStore.fen) return false

    return true
  })

  async function executeMove(token: number, targetFen: string) {
    if (token !== currentCycleToken) {
      logger.info(`[Crashtest] Execution aborted: token mismatch (${token} !== ${currentCycleToken})`)
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

    const bestMoveUci = coachStore.topMoves[0]?.uci
    if (!bestMoveUci || bestMoveUci.length < 4) {
      logger.warn('[Crashtest] Execution aborted: topMoves empty after delay.')
      return
    }

    const orig = bestMoveUci.substring(0, 2) as Key
    const dest = bestMoveUci.substring(2, 4) as Key
    const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

    plannedPromotionRole.value = promoChar ? getPromotionRole(promoChar) : null
    lastExecutedFen.value = targetFen

    logger.info(`[Crashtest] Dispatching 1st line move: ${bestMoveUci} for FEN: ${targetFen}`)

    try {
      await gameStore.handleUserMove(orig, dest)
      logger.info(`[Crashtest] Successfully dispatched handleUserMove(${orig}->${dest})`)
    } catch (err) {
      logger.error('[Crashtest] Exception during handleUserMove execution:', err)
    } finally {
      plannedPromotionRole.value = null
      // If position did not change (e.g. move rejected or errored), clear lastExecutedFen so we don't deadlock
      if (boardStore.fen === targetFen) {
        lastExecutedFen.value = null
      }
    }
  }

  function scheduleMove(targetFen: string) {
    cancelPendingCycle()
    const token = currentCycleToken
    const delay = preferencesStore.preferences.delays.crashtestDelayMs

    logger.info(`[Crashtest] Scheduling move for FEN: ${targetFen} with delay: ${delay}ms (token: ${token})`)

    if (delay <= 0) {
      void executeMove(token, targetFen)
    } else {
      activeTimer = setTimeout(() => {
        activeTimer = null
        void executeMove(token, targetFen)
      }, delay)
    }
  }

  let isInitialized = false

  function init() {
    if (isInitialized) return
    isInitialized = true

    logger.info('[CrashtestStore] Initializing deterministic crashtest engine.')

    watch(
      [isReadyForCrashtestMove, () => boardStore.fen],
      ([ready, currentFen]) => {
        if (ready && lastExecutedFen.value !== currentFen) {
          scheduleMove(currentFen)
        } else if (!ready) {
          cancelPendingCycle()
          // If crashtest is active and it is user turn, but coach hasn't started analysis yet, trigger it
          if (
            isMo3ep.value &&
            isCrashtestEnabled.value &&
            gameStore.gamePhase === 'PLAYING' &&
            boardStore.turn === boardStore.orientation &&
            !coachStore.isAnalyzing &&
            coachStore.topMoves.length === 0 &&
            currentFen
          ) {
            void coachStore.runAnalysis(currentFen)
          }
        }
      },
      { immediate: true }
    )

    // Reset tracking and timers when crashtest is toggled or game phase changes away from PLAYING
    watch(
      [isCrashtestEnabled, () => gameStore.gamePhase],
      ([enabled, phase]) => {
        if (!enabled || phase !== 'PLAYING') {
          cancelPendingCycle()
          lastExecutedFen.value = null
          plannedPromotionRole.value = null
        }
      }
    )
  }

  return {
    isMo3ep,
    isCrashtestEnabled,
    init,
  }
})
