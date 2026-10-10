import { useBoardStore, useGameStore, enginePlayService } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useCoachStore } from '@/features/coach'
import { usePreferencesStore } from '@/features/settings'
import { pgnService } from '@/shared/lib/pgn/PgnService'
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
  const isResolvingMove = ref(false)

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
      if (promoState && isCrashtestEnabled.value) {
        const role = plannedPromotionRole.value || 'queen'
        logger.info(`[Crashtest] Deterministically resolving promotion to: ${role}`)
        boardStore.completePromotion(role)
      }
    },
    { flush: 'sync' }
  )

  const isEligibleForCrashtest = computed(() => {
    if (!isMo3ep.value || !isCrashtestEnabled.value) return false
    const phase = gameStore.gamePhase
    if (phase !== 'PLAYING' && phase !== 'FAIRPLAY') return false
    if (gameStore.isMoveProcessing) return false
    if (boardStore.turn !== boardStore.orientation) return false
    if (isResolvingMove.value) return false
    if (lastExecutedFen.value === boardStore.fen) return false

    return true
  })

  async function resolveBestMove(fen: string): Promise<string | null> {
    // 1. Priority: Deterministic scenario move if strategy has it (Tactics / ScenarioPlus)
    if (gameStore.currentStrategy?.getScenarioValidation) {
      const validation = gameStore.currentStrategy.getScenarioValidation('', fen)
      if (validation?.isScenario && validation.expectedMove) {
        logger.info(`[Crashtest] Deterministic scenario move found: ${validation.expectedMove}`)
        return validation.expectedMove
      }
    }

    // 2. If in PLAYING phase and coachStore already has ready moves:
    if (gameStore.gamePhase === 'PLAYING' && coachStore.topMoves.length > 0 && coachStore.topMoves[0]?.uci) {
      return coachStore.topMoves[0].uci
    }

    // 3. Headless server analysis request (silent mode, zero UI side-effects)
    try {
      const { startFen, moves } = pgnService.getAnalysisPayloadContext()
      const userId = authStore.effectiveLichessUsername || authStore.userProfile?.username || 'crashtest'
      const response = await fetch('/api/coach-engine/uci_fen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, start_fen: startFen, moves }),
      })
      if (response.ok) {
        const data = (await response.json()) as { top_moves?: Array<{ uci?: string }> }
        const uci = data?.top_moves?.[0]?.uci
        if (uci && uci.length >= 4) {
          logger.info(`[Crashtest] Headless engine move received: ${uci}`)
          return uci
        }
      }
    } catch (err) {
      logger.warn('[Crashtest] Headless coach engine request failed, falling back to engine service:', err)
    }

    // 4. Fallback: EnginePlayService (/api/bestmove)
    try {
      const botEngine = gameStore.botEngineId || 'maia-1500'
      const fallbackMove = await enginePlayService.getBestMove(botEngine, fen)
      if (fallbackMove) {
        logger.info(`[Crashtest] Fallback engine move received: ${fallbackMove}`)
        return fallbackMove
      }
    } catch (err) {
      logger.error('[Crashtest] Fallback engine move failed:', err)
    }

    return null
  }

  async function executeMove(token: number, targetFen: string) {
    if (token !== currentCycleToken) {
      logger.info(`[Crashtest] Execution aborted: token mismatch (${token} !== ${currentCycleToken})`)
      return
    }

    const currentPhase = gameStore.gamePhase
    if (
      boardStore.fen !== targetFen ||
      (currentPhase !== 'PLAYING' && currentPhase !== 'FAIRPLAY') ||
      boardStore.turn !== boardStore.orientation ||
      gameStore.isMoveProcessing ||
      !isCrashtestEnabled.value
    ) {
      logger.warn('[Crashtest] Execution aborted: state changed after delay.')
      return
    }

    isResolvingMove.value = true
    try {
      const bestMoveUci = await resolveBestMove(targetFen)

      // Post-fetch race condition check
      if (
        token !== currentCycleToken ||
        boardStore.fen !== targetFen ||
        !isCrashtestEnabled.value ||
        (gameStore.gamePhase !== 'PLAYING' && gameStore.gamePhase !== 'FAIRPLAY')
      ) {
        logger.warn('[Crashtest] Execution aborted: FEN or phase changed during move resolution.')
        return
      }

      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.warn(`[Crashtest] Execution aborted: no move resolved for FEN: ${targetFen}`)
        return
      }

      const orig = bestMoveUci.substring(0, 2) as Key
      const dest = bestMoveUci.substring(2, 4) as Key
      const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

      plannedPromotionRole.value = promoChar ? getPromotionRole(promoChar) : null
      lastExecutedFen.value = targetFen

      logger.info(`[Crashtest] Dispatching 1st line move: ${bestMoveUci} for FEN: ${targetFen}`)
      await gameStore.handleUserMove(orig, dest)
      logger.info(`[Crashtest] Successfully dispatched handleUserMove(${orig}->${dest})`)
    } catch (err) {
      logger.error('[Crashtest] Exception during handleUserMove execution:', err)
    } finally {
      isResolvingMove.value = false
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
      [isEligibleForCrashtest, () => boardStore.fen],
      ([eligible, currentFen]) => {
        if (eligible && lastExecutedFen.value !== currentFen) {
          scheduleMove(currentFen)
        } else if (!eligible && boardStore.turn !== boardStore.orientation) {
          cancelPendingCycle()
        }
      },
      { immediate: true }
    )

    // Reset tracking and timers when crashtest is toggled or game phase changes away from PLAYING/FAIRPLAY
    watch(
      [isCrashtestEnabled, () => gameStore.gamePhase],
      ([enabled, phase]) => {
        if (!enabled || (phase !== 'PLAYING' && phase !== 'FAIRPLAY')) {
          cancelPendingCycle()
          lastExecutedFen.value = null
          plannedPromotionRole.value = null
          isResolvingMove.value = false
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
