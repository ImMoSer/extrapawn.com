import { computed, ref, watch, onUnmounted } from 'vue'
import { useAuthStore } from '@/entities/user'
import { useTaskTodayStore } from './taskToday.store'
import { useBoardStore, useGameStore } from '@/entities/game'
import { parseFen } from 'chessops/fen'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Role as ChessopsRole } from 'chessops'
import logger from '@/shared/lib/logger'

interface AutoplayExplanation {
  visual_commands?: Record<string, string>
  engine_top_moves?: Array<{
    uci: string
    san: string
  }>
}

export function useTaskTodayAutoplay() {
  const authStore = useAuthStore()
  const taskTodayStore = useTaskTodayStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()

  // 1. auttark / spy status check: only enabled for user mo3ep / MO3EP
  const isMo3ep = computed(() => {
    const profile = authStore.userProfile
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

  // LocalStorage state for toggling autoplay
  const isAutoplayEnabled = ref(localStorage.getItem('task_today_autoplay') === 'true')

  watch(isAutoplayEnabled, (val) => {
    localStorage.setItem('task_today_autoplay', String(val))
  })

  const isAutoplayAnalyzing = ref(false)
  const lastPlayedOrAnalyzedFen = ref<string | null>(null)

  // Determine human color for the current puzzle
  const humanColor = computed(() => {
    const puzzle = taskTodayStore.currentPuzzle
    if (!puzzle) return null
    try {
      const setup = parseFen(puzzle.initial_fen).unwrap()
      const isBotFirst = puzzle.first_move === 'bot'
      return isBotFirst ? (setup.turn === 'white' ? 'black' : 'white') : setup.turn
    } catch (e) {
      logger.error('[Autoplay] Failed to parse puzzle FEN', e)
      return null
    }
  })

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

  function getPromotionRole(char: string): ChessopsRole {
    switch (char) {
      case 'q': return 'queen'
      case 'r': return 'rook'
      case 'b': return 'bishop'
      case 'n': return 'knight'
      default: return 'queen'
    }
  }

  // Trigger coach analysis and perform autoplay move
  async function triggerAutoplay(fenToAnalyze: string) {
    if (isAutoplayAnalyzing.value) return
    isAutoplayAnalyzing.value = true

    try {
      logger.info(`[Autoplay] Starting Coach analysis for FEN: ${fenToAnalyze}`)
      // Fetch full explanation which calls POST /api/coach-engine/analyze under the hood
      const explanation = (await coachEngineManager.getExplanation(fenToAnalyze)) as AutoplayExplanation | null

      // Check if state remains valid after async API request
      if (
        boardStore.fen !== fenToAnalyze ||
        !taskTodayStore.isPlaying ||
        gameStore.gamePhase !== 'PLAYING' ||
        !isAutoplayEnabled.value
      ) {
        logger.warn('[Autoplay] State or FEN changed during analysis API request. Aborting.')
        isAutoplayAnalyzing.value = false
        return
      }

      // Draw the visualizations on the board
      if (explanation?.visual_commands) {
        const commands = Object.values(explanation.visual_commands).flat().join(';')
        if (commands) {
          const shapes = parseVisualCommands(commands)
          boardStore.setCoachShapes(shapes)
          logger.info(`[Autoplay] Rendered ${shapes.length} coach visualization shapes on board.`)
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
        !taskTodayStore.isPlaying ||
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

      // Schedule promotion completion before making the move to prevent deadlocks (since handleUserMove will await completePromotion)
      if (promoChar) {
        setTimeout(() => {
          if (boardStore.promotionState) {
            const role = getPromotionRole(promoChar)
            boardStore.completePromotion(role)
            logger.info(`[Autoplay] Auto-completed promotion to: ${role}`)
          } else {
            logger.warn('[Autoplay] Expected promotionState but found none during promotion timer.')
          }
        }, 50)
      }

      // Release the analysis lock before executing the move so that when the bot responds and FEN changes back to the user, the next autoplay can trigger immediately.
      isAutoplayAnalyzing.value = false

      // Make the move like a real user using gameStore.handleUserMove
      await gameStore.handleUserMove(orig, dest)
    } catch (e) {
      logger.error('[Autoplay] Error during autoplay execution', e)
    } finally {
      isAutoplayAnalyzing.value = false
    }
  }

  // Watch board FEN and trigger if it's the user's turn
  watch(
    [() => boardStore.fen, () => boardStore.turn, () => taskTodayStore.isPlaying, () => gameStore.gamePhase, isAutoplayEnabled],
    ([newFen, newTurn, isPlaying, gamePhase, autoplayEnabled]) => {
      if (!isMo3ep.value || !autoplayEnabled || !isPlaying || gamePhase !== 'PLAYING') {
        return
      }

      // It must be the user's turn to move
      if (newTurn !== humanColor.value) {
        return
      }

      // Only run once per FEN state
      if (newFen === lastPlayedOrAnalyzedFen.value) {
        return
      }

      lastPlayedOrAnalyzedFen.value = newFen
      triggerAutoplay(newFen)
    },
    { immediate: true }
  )

  // Cleanup shapes when autoplay gets disabled or game finishes
  watch(
    [isAutoplayEnabled, () => taskTodayStore.isPlaying],
    ([autoplayEnabled, isPlaying]) => {
      if (!autoplayEnabled || !isPlaying) {
        boardStore.setCoachShapes([])
      }
    }
  )

  // Cleanup shapes when page unmounts
  onUnmounted(() => {
    boardStore.setCoachShapes([])
  })

  return {
    isMo3ep,
    isAutoplayEnabled,
  }
}
