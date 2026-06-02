import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import logger from '@/shared/lib/logger'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { usePreferencesStore } from '@/features/settings'

export const useCrashtestStore = defineStore('crashtest', () => {
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()

  // 1. Check if the user is mo3ep / MO3EP
  const isMo3ep = computed(() => {
    const profile = authStore.userProfile
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

  const preferencesStore = usePreferencesStore()

  // Use preferences store state for toggling crashtest
  const isCrashtestEnabled = computed({
    get: () => preferencesStore.preferences.gameplay.global_crashtest,
    set: (val) => preferencesStore.updatePreferences({ gameplay: { global_crashtest: val } })
  })

  const isCrashtestAnalyzing = ref(false)
  const lastPlayedOrAnalyzedFen = ref<string | null>(null)

  function getPromotionRole(char: string): ChessopsRole {
    switch (char) {
      case 'q': return 'queen'
      case 'r': return 'rook'
      case 'b': return 'bishop'
      case 'n': return 'knight'
      default: return 'queen'
    }
  }

  // Parse visual commands string into Chessground DrawShapes
  function parseVisualCommands(actionStr: string): DrawShape[] {
    const subActions = actionStr.split(';')
    const allShapes: DrawShape[] = []
    const VALID_BRUSHES = ['green', 'red', 'blue', 'yellow', 'orange', 'purple', 'cyan', 'pink', 'brown', 'gray', 'bestmove']

    for (const sub of subActions) {
      if (!sub.trim()) continue

      const cleanSub = sub.replace(/[\[\]]/g, '').trim()
      const parts = cleanSub.split(':')
      const cmd = parts[0]?.trim()
      const data = parts[1]?.trim()
      let brush = parts[2]?.trim() || 'green'

      if (!VALID_BRUSHES.includes(brush)) {
        brush = 'green'
      }

      const coachBrush = brush === 'bestmove' ? 'bestmove' : `coach${brush}`

      if (cmd === 'clear') {
        return []
      }

      if (!data) continue

      if (cmd === 'arrow' || cmd === 'route' || cmd === 'root') {
        const squares = data.split('->')
        for (let i = 0; i < squares.length - 1; i++) {
          const orig = squares[i]?.trim()
          const dest = squares[i + 1]?.trim()

          if (orig && dest && orig.length === 2 && dest.length === 2) {
            allShapes.push({
              orig: orig as Key,
              dest: dest as Key,
              brush: coachBrush,
              modifiers: { lineWidth: 3 }
            })
          }
        }
      } else if (cmd === 'mark') {
        const squares = data.split(',')
        squares.forEach(sq => {
          const cleanSq = sq.trim()
          if (cleanSq && cleanSq.length === 2) {
            allShapes.push({
              orig: cleanSq as Key,
              brush: coachBrush
            })
          }
        })
      }
    }

    const COLOR_PRIORITY: Record<string, number> = {
      coachgray: 0, coachbrown: 1, coachyellow: 2, coachgreen: 3, coachcyan: 4, coachblue: 5, coachpurple: 6, coachpink: 7, coachorange: 8, coachred: 9, bestmove: 10
    }
    allShapes.sort((a, b) => {
      const pA = COLOR_PRIORITY[a.brush as string] ?? -1
      const pB = COLOR_PRIORITY[b.brush as string] ?? -1
      return pA - pB
    })

    return allShapes
  }

  // Trigger coach analysis and perform crashtest move
  async function triggerCrashtest(fenToAnalyze: string) {
    if (isCrashtestAnalyzing.value) return
    isCrashtestAnalyzing.value = true

    try {
      logger.info(`[Crashtest] Starting Coach analysis for FEN: ${fenToAnalyze}`)
      const explanation = await coachEngineManager.getExplanation(fenToAnalyze)

      // Check if state remains valid after async API request
      const postAnalysisFenChanged = boardStore.fen !== fenToAnalyze
      const postAnalysisPhaseInvalid = gameStore.gamePhase !== 'PLAYING'
      const postAnalysisCrashtestDisabled = !isCrashtestEnabled.value

      if (postAnalysisFenChanged || postAnalysisPhaseInvalid || postAnalysisCrashtestDisabled) {
        logger.info(
          `[Crashtest] Cleanly aborting analysis due to state change: ` +
          `fenChanged=${postAnalysisFenChanged} (current=${boardStore.fen}, expected=${fenToAnalyze}), ` +
          `gamePhase=${gameStore.gamePhase}, ` +
          `crashtestEnabled=${isCrashtestEnabled.value}`
        )
        isCrashtestAnalyzing.value = false
        return
      }

      // Draw the visualizations on the board
      if (explanation?.visual_commands) {
        const commands = Object.values(explanation.visual_commands).flat().join(';')
        if (commands) {
          const shapes = parseVisualCommands(commands)
          boardStore.setCoachShapes(shapes)
        } else {
          boardStore.setCoachShapes([])
        }
      } else {
        boardStore.setCoachShapes([])
      }

      // Wait crashtest delay from preferences before executing the move
      const delay = preferencesStore.preferences.delays.crashtestDelayMs
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Check state again after delay
      const postDelayFenChanged = boardStore.fen !== fenToAnalyze
      const postDelayPhaseInvalid = gameStore.gamePhase !== 'PLAYING'
      const postDelayCrashtestDisabled = !isCrashtestEnabled.value

      if (postDelayFenChanged || postDelayPhaseInvalid || postDelayCrashtestDisabled) {
        logger.info(
          `[Crashtest] Cleanly aborting after wait delay due to state change: ` +
          `fenChanged=${postDelayFenChanged} (current=${boardStore.fen}, expected=${fenToAnalyze}), ` +
          `gamePhase=${gameStore.gamePhase}, ` +
          `crashtestEnabled=${isCrashtestEnabled.value}`
        )
        isCrashtestAnalyzing.value = false
        return
      }

      // Get the best move from the coach
      const bestMoveUci = explanation?.engine_top_moves?.[0]?.uci
      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.error('[Crashtest] No valid best move returned by Coach.')
        isCrashtestAnalyzing.value = false
        return
      }

      logger.info(`[Crashtest] Crashtesting best move: ${bestMoveUci}`)
      const orig = bestMoveUci.substring(0, 2) as Key
      const dest = bestMoveUci.substring(2, 4) as Key
      const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

      // Schedule promotion completion before making the move to prevent deadlocks
      if (promoChar) {
        setTimeout(() => {
          if (boardStore.promotionState) {
            const role = getPromotionRole(promoChar)
            boardStore.completePromotion(role)
            logger.info(`[Crashtest] Auto-completed promotion to: ${role}`)
          }
        }, 50)
      }

      // Release the analysis lock before executing the move
      isCrashtestAnalyzing.value = false

      // Make the move like a real user using gameStore.handleUserMove
      await gameStore.handleUserMove(orig, dest)
    } catch (e) {
      logger.error('[Crashtest] Error during crashtest execution', e)
      isCrashtestAnalyzing.value = false
    }
  }

  let isInitialized = false

  // Watch board FEN and trigger if it's the user's turn
  function init() {
    if (isInitialized) return
    isInitialized = true

    logger.info('[CrashtestStore] Initializing global crashtest watchers.')

    watch(
      [() => boardStore.fen, () => boardStore.turn, () => gameStore.gamePhase, isCrashtestEnabled],
      ([newFen, newTurn, gamePhase, crashtestEnabled]) => {
        if (!isMo3ep.value || !crashtestEnabled || gamePhase !== 'PLAYING') {
          return
        }

        // It must be the user's turn to move (determined by board orientation)
        if (newTurn !== boardStore.orientation) {
          return
        }

        // Only run once per FEN state
        if (newFen === lastPlayedOrAnalyzedFen.value) {
          return
        }

        lastPlayedOrAnalyzedFen.value = newFen
        triggerCrashtest(newFen)
      },
      { immediate: true }
    )

    // Cleanup shapes when crashtest gets disabled or game finishes
    watch(
      [isCrashtestEnabled, () => gameStore.gamePhase],
      ([crashtestEnabled, gamePhase]) => {
        if (!crashtestEnabled || gamePhase !== 'PLAYING') {
          boardStore.setCoachShapes([])
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
