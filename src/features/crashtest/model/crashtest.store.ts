import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useCoachStore } from '@/features/coach'
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

  const coachStore = useCoachStore()
  const lastPlayedFen = ref<string | null>(null)

  // Trigger coach analysis and perform crashtest move
  async function triggerCrashtest(fenToAnalyze: string) {
    if (isCrashtestAnalyzing.value) {
      logger.info('[DEBUG] [Crashtest] Trigger skipped: already analyzing a move.')
      return
    }
    isCrashtestAnalyzing.value = true
    logger.info(`[DEBUG] [Crashtest] Starting move execution pipeline for FEN: ${fenToAnalyze}`)

    try {
      // Draw visualizations if available
      const explanation = coachStore.posExplanation
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

      // Wait crashtest delay from preferences before executing move
      const delay = preferencesStore.preferences.delays.crashtestDelayMs
      if (delay > 0) {
        logger.info(`[DEBUG] [Crashtest] Waiting configured delay: ${delay}ms`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      // Check state validity after delay
      if (boardStore.fen !== fenToAnalyze) {
        logger.warn(`[DEBUG] [Crashtest] Aborted after delay: FEN changed from ${fenToAnalyze} to ${boardStore.fen}`)
        return
      }
      if (gameStore.gamePhase !== 'PLAYING') {
        logger.warn(`[DEBUG] [Crashtest] Aborted after delay: gamePhase is ${gameStore.gamePhase}`)
        return
      }
      if (!isCrashtestEnabled.value) {
        logger.warn('[DEBUG] [Crashtest] Aborted after delay: crashtest was disabled')
        return
      }
      if (gameStore.isMoveProcessing) {
        logger.warn('[DEBUG] [Crashtest] Aborted after delay: gameStore.isMoveProcessing is true')
        return
      }

      // Get 1st line move from coach analysis or fallback to Stockfish engine
      let bestMoveUci = coachStore.topMoves[0]?.uci || (explanation?.engine_candidates?.[0] as { uci?: string })?.uci

      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.info('[DEBUG] [Crashtest] Coach topMove not ready, requesting Stockfish fallback 1st line move...')
        try {
          const { enginePlayService } = await import('@/entities/game')
          bestMoveUci = (await enginePlayService.getBestMove(gameStore.botEngineId, fenToAnalyze)) || undefined
        } catch (err) {
          logger.error('[DEBUG] [Crashtest] Stockfish engine fallback failed:', err)
        }
      }

      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.error('[DEBUG] [Crashtest] No valid move found (Coach empty & Stockfish fallback failed). Aborting.')
        return
      }

      logger.info(`[DEBUG] [Crashtest] Executing 1st line move: ${bestMoveUci} for FEN: ${fenToAnalyze}`)
      const orig = bestMoveUci.substring(0, 2) as Key
      const dest = bestMoveUci.substring(2, 4) as Key
      const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

      // Schedule promotion completion before making the move to prevent deadlocks
      if (promoChar) {
        setTimeout(() => {
          if (boardStore.promotionState) {
            const role = getPromotionRole(promoChar)
            boardStore.completePromotion(role)
            logger.info(`[DEBUG] [Crashtest] Auto-completed promotion to: ${role}`)
          }
        }, 50)
      }

      // Record played FEN right before move execution to prevent duplicate triggers
      lastPlayedFen.value = fenToAnalyze

      // Make the move like a real user using gameStore.handleUserMove
      await gameStore.handleUserMove(orig, dest)
      logger.info(`[DEBUG] [Crashtest] Successfully completed handleUserMove(${orig}->${dest})`)
    } catch (e) {
      logger.error('[DEBUG] [Crashtest] Exception during crashtest execution:', e)
    } finally {
      isCrashtestAnalyzing.value = false
    }
  }

  let isInitialized = false

  // Watch board FEN, turn, phase, and coach analysis status
  function init() {
    if (isInitialized) return
    isInitialized = true

    logger.info('[DEBUG] [CrashtestStore] Initializing synthetic user crashtest watchers.')

    watch(
      [
        () => boardStore.fen,
        () => boardStore.turn,
        () => gameStore.gamePhase,
        () => gameStore.isMoveProcessing,
        () => coachStore.isAnalyzing,
        () => isCrashtestAnalyzing.value,
        isCrashtestEnabled
      ],
      ([newFen, newTurn, gamePhase, isMoveProcessing, isAnalyzing, isCrashtestAnalyzingVal, crashtestEnabled]) => {
        if (!isMo3ep.value) return
        if (!crashtestEnabled) return

        if (gamePhase !== 'PLAYING') {
          logger.info(`[DEBUG] [Crashtest Watcher] Idle: gamePhase is '${gamePhase}'`)
          return
        }
        if (isMoveProcessing) {
          logger.info('[DEBUG] [Crashtest Watcher] Idle: move transaction currently in progress')
          return
        }
        if (isAnalyzing) {
          logger.info('[DEBUG] [Crashtest Watcher] Waiting: Coach is currently analyzing FEN position...')
          return
        }
        if (isCrashtestAnalyzingVal) {
          logger.info('[DEBUG] [Crashtest Watcher] Waiting: crashtest move execution is currently in progress...')
          return
        }
        if (newTurn !== boardStore.orientation) {
          logger.info(`[DEBUG] [Crashtest Watcher] Idle: turn is ${newTurn}, user color is ${boardStore.orientation}`)
          return
        }
        if (newFen === lastPlayedFen.value) {
          logger.info(`[DEBUG] [Crashtest Watcher] Idle: FEN ${newFen} was already played`)
          return
        }

        logger.info(`[DEBUG] [Crashtest Watcher] All conditions met! Triggering move for FEN: ${newFen}`)
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
