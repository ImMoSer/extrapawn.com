import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { usePuzzleStore, type PuzzleSubmode } from '@/features/puzzle'
import { useTaskTodayStore } from '@/features/task-today'
import { usePreferencesStore } from '@/features/settings'
import { coachEngineManager } from '@/shared/lib/engine/coach/CoachEngineManager'
import type { CoachExplanation } from '@/shared/lib/engine/coach/coach.types'
import logger from '@/shared/lib/logger'
import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import type { Role as ChessopsRole } from 'chessops'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const useDemoplayStore = defineStore('demoplay', () => {
  const authStore = useAuthStore()
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const preferencesStore = usePreferencesStore()
  const puzzleStore = usePuzzleStore()
  const taskTodayStore = useTaskTodayStore()

  const activePuzzle = computed(() => {
    if (taskTodayStore.isPlaying && taskTodayStore.currentPuzzle) {
      return taskTodayStore.currentPuzzle
    }
    return puzzleStore.activePuzzle
  })

  // Configurable delays for the first demo move in the new position
  const USER_THINKING_TIME = computed(() => preferencesStore.preferences.delays.demoThinkingBeforVisualizeMs)
  const COACH_VISUALIZE_TIME = computed(() => preferencesStore.preferences.delays.demoFirstVisualizeMs)

  // Link isDemoplayEnabled directly to preferencesStore to maintain a single source of truth
  const isDemoplayEnabled = computed({
    get: () => preferencesStore.isDemoplayEnabled,
    set: (val) => {
      preferencesStore.isDemoplayEnabled = val
    }
  })

  // Initial Demo Play delay state (pause when new puzzle is loaded)
  const isInitialDelayActive = ref(false)
  const initialDelayTimer = ref<number | null>(null)

  // Demoplay status
  const isDemoplayAnalyzing = ref(false)
  const lastPlayedOrAnalyzedFen = ref<string | null>(null)
  const demoplayCount = ref(1)
  const hasJustReset = ref(true)
  const initialMateMoves = ref<number | null>(null)

  const isCompleteModalVisible = ref(false)

  function showCompleteModal() {
    isCompleteModalVisible.value = true
  }

  function hideCompleteModal() {
    isCompleteModalVisible.value = false
  }

  async function restartDemoplay() {
    isCompleteModalVisible.value = false
    isDemoplayEnabled.value = true
    demoplayCount.value = 1
    hasJustReset.value = true
    if (puzzleStore.activeSubmode) {
      await puzzleStore.loadNewPuzzle(puzzleStore.activeSubmode)
    }
  }

  const isIntroModalVisible = ref(false)
  const hasIntroBeenShown = ref(false)
  const introConfig = ref<{
    submode: PuzzleSubmode | '';
    category: string;
    difficulty: string;
  }>({
    submode: '',
    category: '',
    difficulty: ''
  })

  watch(hasJustReset, (val) => {
    if (val) {
      hasIntroBeenShown.value = false
    }
  })

  function showIntroModal(config: { submode: PuzzleSubmode; category: string; difficulty: string }) {
    introConfig.value = { ...config }
    isIntroModalVisible.value = true
  }

  function hideIntroModal() {
    isIntroModalVisible.value = false
  }

  async function startIntroDemoplay() {
    isIntroModalVisible.value = false
    isDemoplayEnabled.value = true
    hasIntroBeenShown.value = true
    demoplayCount.value = 1
    hasJustReset.value = true
    if (introConfig.value.submode) {
      await puzzleStore.loadNewPuzzle(introConfig.value.submode, {
        category: introConfig.value.category,
        difficulty: introConfig.value.difficulty
      })
    }
  }

  const isMo3ep = computed(() => {
    const profile = authStore.userProfile
    if (!profile) return false
    return profile.id === 'mo3ep' || profile.username === 'MO3EP'
  })

  const isCrashtestEnabled = computed(() => {
    return !!preferencesStore.preferences.gameplay.global_crashtest
  })

  // Safety watch: if crashtest is enabled, immediately turn off demoplay
  watch(isCrashtestEnabled, (enabled) => {
    if (enabled && isDemoplayEnabled.value) {
      isDemoplayEnabled.value = false
    }
  }, { immediate: true })

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

  // Trigger coach analysis and perform demoplay move
  async function triggerDemoplay(fenToAnalyze: string, prefetchedExplanation?: CoachExplanation | null) {
    if (isDemoplayAnalyzing.value || isInitialDelayActive.value || isCrashtestEnabled.value) return
    isDemoplayAnalyzing.value = true

    try {
      logger.info(`[Demoplay] Starting Coach analysis for FEN: ${fenToAnalyze}`)
      const explanation = prefetchedExplanation || await coachEngineManager.getExplanation(fenToAnalyze)

      // Check if state remains valid after async API request
      const postAnalysisFenChanged = boardStore.fen !== fenToAnalyze
      const postAnalysisPhaseInvalid = gameStore.gamePhase !== 'PLAYING'
      const postAnalysisDemoplayDisabled = !isDemoplayEnabled.value
      const postAnalysisDelayActive = isInitialDelayActive.value
      const postAnalysisCrashtestActive = isCrashtestEnabled.value

      if (
        postAnalysisFenChanged ||
        postAnalysisPhaseInvalid ||
        postAnalysisDemoplayDisabled ||
        postAnalysisDelayActive ||
        postAnalysisCrashtestActive
      ) {
        logger.info(
          `[Demoplay] Cleanly aborting analysis due to state change: ` +
          `fenChanged=${postAnalysisFenChanged} (current=${boardStore.fen}, expected=${fenToAnalyze}), ` +
          `gamePhase=${gameStore.gamePhase}, ` +
          `demoplayEnabled=${isDemoplayEnabled.value}, ` +
          `initialDelayActive=${isInitialDelayActive.value}, ` +
          `crashtestActive=${postAnalysisCrashtestActive}`
        )
        isDemoplayAnalyzing.value = false
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

      // Calculate move delay dynamically (skip if we already visualized during prefetched delay)
      let delay = prefetchedExplanation ? 0 : preferencesStore.preferences.delays.demoPlayMoveMs
      const topMove = explanation?.engine_top_moves?.[0]
      if (!prefetchedExplanation && topMove && topMove.mate !== null) {
        const n = Math.abs(topMove.mate)
        if (initialMateMoves.value === null) {
          initialMateMoves.value = n
        }
        const PM = preferencesStore.preferences.delays.demoPlayMoveMs
        const MM = preferencesStore.preferences.delays.demopMateMultiplierMs
        const N = initialMateMoves.value

        if (N > 0) {
          const BZ = (PM - MM) / N
          const calculatedDelay = MM + (n - 1) * BZ
          const minDelay = Math.min(PM, MM)
          const maxDelay = Math.max(PM, MM)
          delay = Math.max(minDelay, Math.min(maxDelay, calculatedDelay))
        } else {
          delay = MM
        }
        logger.info(`[Demoplay] Forced mate in ${topMove.mate} detected (initial N=${N}). Dynamic delay scaled to ${delay}ms.`)
      } else if (topMove && topMove.mate === null) {
        initialMateMoves.value = null
      }

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }

      // Check state again after delay
      const postDelayFenChanged = boardStore.fen !== fenToAnalyze
      const postDelayPhaseInvalid = gameStore.gamePhase !== 'PLAYING'
      const postDelayDemoplayDisabled = !isDemoplayEnabled.value
      const postDelayDelayActive = isInitialDelayActive.value
      const postDelayCrashtestActive = isCrashtestEnabled.value

      if (
        postDelayFenChanged ||
        postDelayPhaseInvalid ||
        postDelayDemoplayDisabled ||
        postDelayDelayActive ||
        postDelayCrashtestActive
      ) {
        logger.info(
          `[Demoplay] Cleanly aborting after wait delay due to state change: ` +
          `fenChanged=${postDelayFenChanged} (current=${boardStore.fen}, expected=${fenToAnalyze}), ` +
          `gamePhase=${gameStore.gamePhase}, ` +
          `demoplayEnabled=${isDemoplayEnabled.value}, ` +
          `initialDelayActive=${isInitialDelayActive.value}, ` +
          `crashtestActive=${postDelayCrashtestActive}`
        )
        isDemoplayAnalyzing.value = false
        return
      }

      // Get the best move from the coach
      const bestMoveUci = explanation?.engine_top_moves?.[0]?.uci
      if (!bestMoveUci || bestMoveUci.length < 4) {
        logger.error('[Demoplay] No valid best move returned by Coach.')
        isDemoplayAnalyzing.value = false
        return
      }

      logger.info(`[Demoplay] Demoplay best move: ${bestMoveUci}`)
      const orig = bestMoveUci.substring(0, 2) as Key
      const dest = bestMoveUci.substring(2, 4) as Key
      const promoChar = bestMoveUci.length === 5 ? bestMoveUci.charAt(4) : null

      if (promoChar) {
        setTimeout(() => {
          if (boardStore.promotionState) {
            const role = getPromotionRole(promoChar)
            boardStore.completePromotion(role)
            logger.info(`[Demoplay] Auto-completed promotion to: ${role}`)
          }
        }, 50)
      }

      isDemoplayAnalyzing.value = false

      await gameStore.handleUserMove(orig, dest)
    } catch (e) {
      logger.error('[Demoplay] Error during demoplay execution', e)
      isDemoplayAnalyzing.value = false
    }
  }

  const lastDelayedPuzzleId = ref<string | null>(null)

  function cleanFen(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ')
  }

  // Trigger initial delay when active puzzle is loaded on the board
  watch(
    [activePuzzle, () => boardStore.fen, () => gameStore.gamePhase],
    ([newPuzzle, currentFen, gamePhase]) => {
      if (gamePhase !== 'PLAYING') {
        lastDelayedPuzzleId.value = null
        return
      }

      if (!isDemoplayEnabled.value || !newPuzzle || isCrashtestEnabled.value) {
        return
      }

      // Check if this puzzle's position has actually been loaded on the board yet
      if (cleanFen(currentFen) !== cleanFen(newPuzzle.initial_fen)) {
        return
      }

      // Check if we already started the initial delay for this puzzle
      if (lastDelayedPuzzleId.value === newPuzzle.puzzle_id) {
        return
      }

      // Start initial delay!
      lastDelayedPuzzleId.value = newPuzzle.puzzle_id
      lastPlayedOrAnalyzedFen.value = null // Reset last played FEN for the new puzzle!
      initialMateMoves.value = null // Reset initial mate moves for the new puzzle!
      isInitialDelayActive.value = true

      logger.info(`[Demoplay] New puzzle ${newPuzzle.puzzle_id} loaded on board. Starting user thinking delay of ${USER_THINKING_TIME.value}ms.`)

      if (initialDelayTimer.value) {
        clearTimeout(initialDelayTimer.value)
        initialDelayTimer.value = null
      }

      initialDelayTimer.value = window.setTimeout(async () => {
        // Verify demoplay is still active before proceeding to Phase 2 (visualization)
        if (!isDemoplayEnabled.value || gameStore.gamePhase !== 'PLAYING' || isCrashtestEnabled.value) {
          isInitialDelayActive.value = false
          initialDelayTimer.value = null
          return
        }

        logger.info(`[Demoplay] User thinking delay ended. Fetching and showing coach visualizations for ${COACH_VISUALIZE_TIME.value}ms.`)

        const fenToAnalyze = boardStore.fen
        let explanation: CoachExplanation | null = null

        if (boardStore.turn === boardStore.orientation) {
          try {
            explanation = await coachEngineManager.getExplanation(fenToAnalyze)

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
          } catch (err) {
            logger.error('[Demoplay] Error fetching explanation during initial delay:', err)
          }
        }

        // Start the visualization phase timer
        initialDelayTimer.value = window.setTimeout(async () => {
          isInitialDelayActive.value = false
          initialDelayTimer.value = null
          logger.info('[Demoplay] Initial delay ended. Proceeding with gameplay.')

          if (
            isDemoplayEnabled.value &&
            gameStore.gamePhase === 'PLAYING' &&
            !isCrashtestEnabled.value &&
            boardStore.turn === boardStore.orientation &&
            boardStore.fen !== lastPlayedOrAnalyzedFen.value
          ) {
            lastPlayedOrAnalyzedFen.value = boardStore.fen
            await triggerDemoplay(boardStore.fen, explanation)
          }
        }, COACH_VISUALIZE_TIME.value)
      }, USER_THINKING_TIME.value)
    }
  )

  let isInitialized = false
  let colorGuessTimer: number | null = null

  function init() {
    if (isInitialized) return
    isInitialized = true

    logger.info('[DemoplayStore] Initializing global demoplay watchers.')

    watch(
      [() => boardStore.fen, () => boardStore.turn, () => gameStore.gamePhase, isDemoplayEnabled, isInitialDelayActive, isCrashtestEnabled],
      ([newFen, newTurn, gamePhase, demoplayEnabled, initialDelayActive, crashtestEnabled]) => {
        if (!isMo3ep.value || !demoplayEnabled || gamePhase !== 'PLAYING' || initialDelayActive || crashtestEnabled) {
          return
        }

        if (newTurn !== boardStore.orientation) {
          return
        }

        if (newFen === lastPlayedOrAnalyzedFen.value) {
          return
        }

        lastPlayedOrAnalyzedFen.value = newFen
        triggerDemoplay(newFen)
      },
      { immediate: true }
    )

    // Automatisches Raten der Farbe bei aktivem Demoplay nach der eingestellten Verzögerung
    watch(
      [() => puzzleStore.isWaitingForColorGuess, isDemoplayEnabled],
      ([isWaiting, demoplayEnabled]) => {
        if (colorGuessTimer) {
          clearTimeout(colorGuessTimer)
          colorGuessTimer = null
        }

        if (isWaiting && demoplayEnabled && isMo3ep.value) {
          const delay = USER_THINKING_TIME.value
          logger.info(`[Demoplay] Puzzle is waiting for color guess. Autoselecting correct side in ${delay}ms.`)
          colorGuessTimer = window.setTimeout(() => {
            if (puzzleStore.isWaitingForColorGuess && isDemoplayEnabled.value && isMo3ep.value) {
              const correctColor = puzzleStore.correctColor
              logger.info(`[Demoplay] Autoselected color guess: ${correctColor}`)
              puzzleStore.guessColor(correctColor)
            }
          }, delay)
        }
      },
      { immediate: true }
    )

    // Cleanup shapes and timers when demoplay gets disabled or game finishes
    watch(
      [isDemoplayEnabled, () => gameStore.gamePhase],
      ([demoplayEnabled, gamePhase]) => {
        if (!demoplayEnabled || gamePhase !== 'PLAYING') {
          boardStore.setCoachShapes([])
          if (initialDelayTimer.value) {
            clearTimeout(initialDelayTimer.value)
            initialDelayTimer.value = null
          }
          isInitialDelayActive.value = false
          initialMateMoves.value = null
        }
        if (!demoplayEnabled) {
          if (colorGuessTimer) {
            clearTimeout(colorGuessTimer)
            colorGuessTimer = null
          }
        }
      }
    )
  }

  return {
    isMo3ep,
    isDemoplayEnabled,
    isInitialDelayActive,
    demoplayCount,
    hasJustReset,
    isCompleteModalVisible,
    showCompleteModal,
    hideCompleteModal,
    restartDemoplay,
    isIntroModalVisible,
    hasIntroBeenShown,
    introConfig,
    showIntroModal,
    hideIntroModal,
    startIntroDemoplay,
    init,
  }
})
