import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useAuthStore } from '@/entities/user'
import { useBoardStore, useGameStore } from '@/entities/game'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Role as ChessopsRole } from 'chessops'
import logger from '@/shared/lib/logger'
import { useTablebaseStore } from '@/features/tablebase-mainline'

export const useAutoplayStore = defineStore('autoplay', () => {
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const tablebaseStore = useTablebaseStore()

  // Developer control to automatically switch to Lichess Tablebase Mainline for 7 or fewer pieces
  const set_mainline_seven = ref(true)

  // 1. Check if the user is mo3ep / MO3EP
  const isMo3ep = computed(() => {
    const profile = authStore.userProfile
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

  // LocalStorage state for toggling autoplay
  const isAutoplayEnabled = ref(localStorage.getItem('global_autoplay') === 'true')

  watch(isAutoplayEnabled, (val) => {
    localStorage.setItem('global_autoplay', String(val))
  })

  const isAutoplayAnalyzing = ref(false)
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

  // Trigger coach analysis and perform autoplay move
  async function triggerAutoplay(fenToAnalyze: string) {
    if (isAutoplayAnalyzing.value) return
    isAutoplayAnalyzing.value = true

    try {
      logger.info(`[Autoplay] Starting Coach analysis for FEN: ${fenToAnalyze}`)
      const explanation = await coachEngineManager.getExplanation(fenToAnalyze)

      // Check if state remains valid after async API request
      if (
        boardStore.fen !== fenToAnalyze ||
        gameStore.gamePhase !== 'PLAYING' ||
        !isAutoplayEnabled.value
      ) {
        logger.warn('[Autoplay] State or FEN changed during analysis. Aborting.')
        isAutoplayAnalyzing.value = false
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

      // Wait 1000 ms before executing the move
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Check state again after delay
      if (
        boardStore.fen !== fenToAnalyze ||
        gameStore.gamePhase !== 'PLAYING' ||
        !isAutoplayEnabled.value
      ) {
        logger.warn('[Autoplay] State or FEN changed during wait delay. Aborting.')
        isAutoplayAnalyzing.value = false
        return
      }

      // Get the best move from the coach
      const bestMoveUci = explanation?.engine_top_moves?.[0]?.uci
      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.error('[Autoplay] No valid best move returned by Coach.')
        isAutoplayAnalyzing.value = false
        return
      }

      logger.info(`[Autoplay] Autoplaying best move: ${bestMoveUci}`)
      const orig = bestMoveUci.substring(0, 2) as Key
      const dest = bestMoveUci.substring(2, 4) as Key
      const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

      // Schedule promotion completion before making the move to prevent deadlocks
      if (promoChar) {
        setTimeout(() => {
          if (boardStore.promotionState) {
            const role = getPromotionRole(promoChar)
            boardStore.completePromotion(role)
            logger.info(`[Autoplay] Auto-completed promotion to: ${role}`)
          }
        }, 50)
      }

      // Release the analysis lock before executing the move
      isAutoplayAnalyzing.value = false

      // Make the move like a real user using gameStore.handleUserMove
      await gameStore.handleUserMove(orig, dest)
    } catch (e) {
      logger.error('[Autoplay] Error during autoplay execution', e)
      isAutoplayAnalyzing.value = false
    }
  }

  let isInitialized = false

  // Watch board FEN and trigger if it's the user's turn
  function init() {
    if (isInitialized) return
    isInitialized = true

    logger.info('[AutoplayStore] Initializing global autoplay watchers.')

    watch(
      [() => boardStore.fen, () => boardStore.turn, () => gameStore.gamePhase, isAutoplayEnabled],
      ([newFen, newTurn, gamePhase, autoplayEnabled]) => {
        if (!isMo3ep.value || !autoplayEnabled || gamePhase !== 'PLAYING') {
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

        // Delegate to tablebase mainline playback if enabled and piece count <= 7
        if (set_mainline_seven.value && tablebaseStore.getPieceCount(newFen) <= 7) {
          if (!gameStore.isTablebasePlaybackActive) {
            lastPlayedOrAnalyzedFen.value = newFen
            tablebaseStore.playMainline()
          }
          return
        }

        lastPlayedOrAnalyzedFen.value = newFen
        triggerAutoplay(newFen)
      },
      { immediate: true }
    )

    // Cleanup shapes when autoplay gets disabled or game finishes
    watch(
      [isAutoplayEnabled, () => gameStore.gamePhase],
      ([autoplayEnabled, gamePhase]) => {
        if (!autoplayEnabled || gamePhase !== 'PLAYING') {
          boardStore.setCoachShapes([])
        }
      }
    )
  }

  return {
    isMo3ep,
    isAutoplayEnabled,
    set_mainline_seven,
    init,
  }
})
