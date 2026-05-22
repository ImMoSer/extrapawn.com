import { useAnalysisEngineStore } from '@/entities/analysis'
import {
  gameplayService,
  useGameStore,
  useBoardStore,
  type GameStatusInfo,
  type IGameCoreApi,
  type IGameplayStrategy,
} from '@/entities/game'
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useAuthStore } from '@/entities/user'
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { apiClient } from '@/shared/api/client'
import { parseFen } from 'chessops/fen'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useEndgamesMutations } from '../api/endgames.queries'
import type { GameResultResponse } from '@/shared/types/api.types'
// eslint-disable-next-line boundaries/element-types
import { useCoachStore, coachEngineManager } from '@/features/coach'

const t = i18n.global.t

export interface EndgamePuzzle {
  puzzle_id: string
  initial_fen: string
  first_move?: 'bot' | 'user'
  game_modus: 'finish_him' | 'theory_endings' | 'practical_chess' | 'tactics'
  tactical_solution?: string
  winner?: 'white' | 'black'
  category?: string
  sub_category?: string
  difficulty?: string
  tactical_rating?: number | string
  rating?: number | string
  engm_rating?: number | string
  puzzle_fen?: string
  userSelectedColor?: boolean
}

export interface EndgameParams {
  mode?: 'finish_him' | 'theory_endings' | 'practical_chess' | 'tactics'
  theme?: string
  difficulty?: string
  category?: string
  type?: string
  puzzleId?: string
}

function determineHumanColor(puzzle: EndgamePuzzle): 'white' | 'black' {
  if (puzzle.game_modus === 'theory_endings') return 'white'
  if (puzzle.game_modus === 'practical_chess' && puzzle.category !== 'materialEquality') {
    return puzzle.winner as 'white' | 'black'
  }
  const setup = parseFen(puzzle.initial_fen).unwrap()
  const isBotFirst = puzzle.first_move === 'bot'
  if (isBotFirst) {
    return setup.turn === 'white' ? 'black' : 'white'
  }
  return setup.turn
}

export const useEndgameStore = defineStore('endgames', () => {
  const gameStore = useGameStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const analysisStore = useAnalysisEngineStore()
  const router = useRouter()

  const { finishHimMutation, practicalMutation, theoryMutation } = useEndgamesMutations()

  const activePuzzle = ref<EndgamePuzzle | null>(null)
  const feedbackMessage = ref(t('features.finishHim.feedback.pressNext'))
  const isProcessingGameOver = ref(false)

  // Practical Chess specific
  const isWaitingForColorSelection = ref(false)
  const currentUserColor = ref<ChessgroundColor>('white')

  // UI state for the current active configuration
  const activeParams = ref<EndgameParams>({})

  const fenFinal = computed(() => {
    return activePuzzle.value?.puzzle_fen || ''
  })

  function initialize() {
    soundService.playSound('app_game_entry')
  }

  function startPlayoutFromFen(fen: string, color: 'white' | 'black') {
    isProcessingGameOver.value = false
    gameStore.setGamePhase('LOADING')
    feedbackMessage.value = t('features.finishHim.feedback.yourTurnPlayout')

    const dummyPuzzle: EndgamePuzzle = { puzzle_id: '', game_modus: 'finish_him', tactical_solution: '', initial_fen: fen }
    gameStore.startWithStrategy(fen, createEndgameStrategy(dummyPuzzle, color), color, false)
  }

  function startGameFromPuzzle(puzzle: EndgamePuzzle) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false

    gameStore.setGamePhase('LOADING')
    activePuzzle.value = puzzle

    if (puzzle.game_modus === 'practical_chess' && puzzle.category === 'materialEquality') {
      isWaitingForColorSelection.value = true
      currentUserColor.value = 'white'
      puzzle.userSelectedColor = false
      gameStore.startWithStrategy(puzzle.initial_fen, createEndgameStrategy(puzzle, 'white'), 'white')
      return
    }

    const humanColor = determineHumanColor(puzzle)
    currentUserColor.value = humanColor

    gameStore.startWithStrategy(puzzle.initial_fen, createEndgameStrategy(puzzle, humanColor), humanColor, false)
    feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
  }

  function reset() {
    activePuzzle.value = null
    feedbackMessage.value = t('features.finishHim.feedback.pressNext')
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false
    logger.info('[EndgameStore] Local state has been reset.')
  }

  function setParams(params: Partial<EndgameParams>) {
    activeParams.value = { ...activeParams.value, ...params }
  }

  function createEndgameStrategy(puzzle: EndgamePuzzle, humanColor: 'white' | 'black'): IGameplayStrategy {
    const scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []
    let currentScenarioIndex = 0
    let isPlayoutMode = scenarioMoves.length === 0
    
    // State backups for takebacks
    let prevScenarioIndex = 0
    let prevPlayoutMode = isPlayoutMode
    let isForcedPlayout = false

    return {
      config: {
        initialBotDelayMs: puzzle.game_modus === 'finish_him' ? 300 : 50,
        botDelayMs: 50,
      },

      onGameStart(api: IGameCoreApi) {
        if (
          puzzle.game_modus === 'practical_chess' &&
          puzzle.category === 'materialEquality' &&
          !puzzle.userSelectedColor
        ) {
          api.setPaused(true)
        }
      },

      checkWinCondition(currentState: GameStatusInfo): boolean {
        const outcome = currentState.outcome
        if (!outcome || outcome.reason === 'resign') return false
        return outcome.reason === 'checkmate' && outcome.winner === humanColor
      },

      async onUserMoveExecuted(uciMove: string) {
        prevScenarioIndex = currentScenarioIndex
        prevPlayoutMode = isPlayoutMode

        const coachStore = useCoachStore()
        let isBlunder = false
        let blunderQuality = ''

        if (!isPlayoutMode && scenarioMoves.length > 0) {
          const expectedMove = scenarioMoves[currentScenarioIndex]
          if (uciMove === expectedMove) {
            currentScenarioIndex++
            
            if (puzzle.game_modus === 'tactics' && currentScenarioIndex >= scenarioMoves.length) {
              _handleGameOverUnified(puzzle, true, { winner: humanColor, reason: 'checkmate' }, humanColor)
              setTimeout(() => {
                loadNewPuzzle('tactics', activeParams.value)
              }, 1000)
            }
          } else {
            isBlunder = true
            blunderQuality = 'wrong move'
          }
        } else {
          // Playout phase or playout-only mode
          if (coachStore.isCoachEnabled) {
            await coachStore.fetchLastMoveAnalysis()
            const quality = coachStore.lastMoveAnalysis?.quality
            if (quality && ['inaccuracy', 'mistake', 'blunder'].includes(quality)) {
              isBlunder = true
              blunderQuality = quality
            }
          }
        }

        if (isBlunder) {
          if (coachStore.isCoachEnabled) {
            coachStore.isCoachIntervening = true
            gameStore.setGamePhase('IDLE')

            const currentFen = useBoardStore().fen
            coachStore.fetchTopMoves(currentFen)
            try {
              coachStore.previousExplanation = coachStore.currentExplanation || coachStore.previousExplanation
              const explanation = await coachEngineManager.getExplanation(currentFen)
              coachStore.currentExplanation = explanation

              if (coachStore.showVisuals && explanation?.visual_commands) {
                const commands = Object.values(explanation.visual_commands).flat().join(';')
                if (commands) {
                  coachStore.executeVisualCommands(commands)
                } else {
                  useBoardStore().setCoachShapes([])
                }
              }
            } catch (e) {
              logger.error('[EndgameStrategy] Error explaining blunder:', e)
            }

            const takeback = await coachStore.promptTakeback(blunderQuality)

            coachStore.isCoachIntervening = false
            useBoardStore().setCoachShapes([])

            if (takeback) {
              gameStore.undoLastUserMove()
              return
            } else {
              isPlayoutMode = true
              currentScenarioIndex = scenarioMoves.length
              isForcedPlayout = true
              useBoardStore().setAnalysisMode(false)
              isProcessingGameOver.value = false
              gameStore.setGamePhase('PLAYING')
              soundService.playSound('game_play_out_start')
              logger.info('[EndgameStrategy] Forced playout mode by coach.')
            }
          } else {
            // Coach is disabled, default fallback
            if (puzzle.game_modus === 'tactics') {
              useBoardStore().setAnalysisMode(true)
              _handleGameOverUnified(puzzle, false, { winner: undefined, reason: 'resign' }, humanColor)
              return
            }
            isPlayoutMode = true
            currentScenarioIndex = scenarioMoves.length
            soundService.playSound('game_play_out_start')
          }
        }
      },

      onUserMoveUndone() {
        currentScenarioIndex = prevScenarioIndex
        isPlayoutMode = prevPlayoutMode
        isProcessingGameOver.value = false
        useBoardStore().setAnalysisMode(false)
        isForcedPlayout = false
        logger.info(`[EndgameStrategy] Reverted to index ${currentScenarioIndex}, playout: ${isPlayoutMode}`)
      },

      forcePlayoutMode() {
        isForcedPlayout = true
        isPlayoutMode = true
        currentScenarioIndex = scenarioMoves.length
        useBoardStore().setAnalysisMode(false)
        isProcessingGameOver.value = false
        gameStore.setGamePhase('PLAYING')
        soundService.playSound('game_play_out_start')
        logger.info('[EndgameStrategy] Forced playout mode by coach.')
      },

      async onBotMoveExecuted() {
        if (puzzle.game_modus === 'tactics' && !isForcedPlayout && currentScenarioIndex >= scenarioMoves.length) {
          _handleGameOverUnified(puzzle, true, { winner: humanColor, reason: 'checkmate' }, humanColor)
          setTimeout(() => {
            loadNewPuzzle('tactics', activeParams.value)
          }, 1000)
        }
      },

      requestBotMove: async (fen: string) => {
        if (!isPlayoutMode && currentScenarioIndex < scenarioMoves.length) {
          const move = scenarioMoves[currentScenarioIndex] || null
          currentScenarioIndex++
          return move
        }

        if (puzzle.game_modus === 'tactics' && !isForcedPlayout) return null;

        try {
          return await gameplayService.getBestMove(gameStore.botEngineId, fen)
        } catch (error) {
          logger.error('[EndgameStrategy] Engine failed to generate move.', error)
          return null
        }
      },

      onGameOver(status: GameStatusInfo) {
        const isWin = this.checkWinCondition!(status)
        if (status.outcome) {
          _handleGameOverUnified(puzzle, isWin, status.outcome, humanColor)
        }
      },
    }
  }

  async function _handleGameOverUnified(
    puzzle: EndgamePuzzle,
    isWin: boolean,
    outcome: NonNullable<GameStatusInfo['outcome']>,
    humanColor: 'white' | 'black',
  ) {
    if (isProcessingGameOver.value) return
    isProcessingGameOver.value = true

    gameStore.setGamePhase('GAMEOVER')

    if (puzzle.game_modus === 'practical_chess') {
      analysisStore.setPlayerColor(humanColor)
    }

    if (isWin) {
      feedbackMessage.value = t('features.finishHim.feedback.win')
    } else {
      const reason = outcome.reason
      if (reason === 'stalemate') {
        feedbackMessage.value = t('features.gameplay.gameOver.stalemate')
      } else if (reason === 'resign') {
        feedbackMessage.value = t('features.finishHim.feedback.resigned')
      } else {
        feedbackMessage.value = t('features.finishHim.feedback.loss')
      }
    }

    const commonDto = {
      puzzleId: puzzle.puzzle_id,
      wasCorrect: isWin,
      pgn_moves: pgnService.getCurrentPgnString(),
      initial_fen: puzzle.initial_fen,
      user_color: humanColor,
    }

    try {
      let response: GameResultResponse | undefined
      switch (puzzle.game_modus) {
        case 'finish_him':
          response = await finishHimMutation.mutateAsync(commonDto)
          break
        case 'practical_chess':
          response = await practicalMutation.mutateAsync({
            category: puzzle.category || '',
            dto: commonDto,
          })
          break
        case 'theory_endings':
          response = await theoryMutation.mutateAsync({
            puzzleId: puzzle.puzzle_id,
            wasCorrect: isWin,
          })
          break
      }

      if (response) {
        if (response.attempts && response.attempts > 1) {
          window.$message?.info(t('common.stats.attemptNoRating', { count: response.attempts }))
        } else if (response.ratingDelta !== undefined) {
          const delta = response.ratingDelta
          const sign = delta >= 0 ? '+' : ''
          const msg = t('common.stats.ratingChange', { delta: `${sign}${delta}` })

          if (delta >= 0) {
            window.$message?.success(msg)
          } else {
            window.$message?.error(msg)
          }
        }

        if (response.userStatsUpdate) {
          authStore.updateUserStats(response.userStatsUpdate)
        } else {
          await authStore.checkSession()
        }
      }
    } catch (error) {
      logger.error('[EndgameStore] Failed to submit results:', error)
    }
  }

  async function loadNewPuzzle(mode: 'finish_him' | 'theory_endings' | 'practical_chess' | 'tactics', queryParams: Partial<EndgameParams> = {}) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false

    gameStore.setGamePhase('LOADING')
    feedbackMessage.value = t('common.actions.loading')

    const mergedParams = { ...activeParams.value, ...queryParams, mode }
    activeParams.value = mergedParams

    try {
      let puzzle: EndgamePuzzle | undefined

      if (mode === 'finish_him') {
        if (mergedParams.puzzleId) {
          puzzle = await apiClient<EndgamePuzzle>(`/finish-him/PuzzleId/${mergedParams.puzzleId}`)
        } else {
          puzzle = await apiClient<EndgamePuzzle>(`/finish-him/start?theme=${mergedParams.theme ?? 'auto'}&difficulty=${mergedParams.difficulty ?? 'Novice'}`)
        }
        if (puzzle) puzzle.game_modus = 'finish_him'
      } else if (mode === 'theory_endings') {
        if (mergedParams.puzzleId && mergedParams.type) {
          puzzle = await apiClient<EndgamePuzzle>(`/theory-endings/puzzle/${mergedParams.type}/${mergedParams.puzzleId}`)
        } else {
          puzzle = await apiClient<EndgamePuzzle>(`/theory-endings/puzzle?mode=${mergedParams.type}&difficulty=${mergedParams.difficulty}&category=${mergedParams.category}`)
        }
        if (puzzle) puzzle.game_modus = 'theory_endings'
      } else if (mode === 'practical_chess') {
        if (mergedParams.puzzleId) {
          puzzle = await apiClient<EndgamePuzzle>(`/practical-chess/puzzle/${mergedParams.puzzleId}`)
        } else {
          const category = mergedParams.category ?? 'extraPawn'
          puzzle = await apiClient<EndgamePuzzle>(`/practical-chess/${category}/puzzle?difficulty=${mergedParams.difficulty ?? 'Novice'}`)
        }
        if (puzzle) puzzle.game_modus = 'practical_chess'
      } else if (mode === 'tactics') {
        puzzle = await apiClient<EndgamePuzzle>(`/tactics/start?theme=${mergedParams.theme ?? 'fork'}&difficulty=${mergedParams.difficulty ?? 'Novice'}`)
        if (puzzle) puzzle.game_modus = 'tactics'
      }

      if (!puzzle) throw new Error('Puzzle data is null')

      activePuzzle.value = puzzle
      activeParams.value = { ...activeParams.value, ...queryParams, mode }

      if (mode === 'practical_chess' && puzzle.category === 'materialEquality') {
        isWaitingForColorSelection.value = true
        currentUserColor.value = 'white'
        puzzle.userSelectedColor = false
        gameStore.startWithStrategy(puzzle.initial_fen, createEndgameStrategy(puzzle, 'white'), 'white')
        return
      }

      const humanColor = determineHumanColor(puzzle)
      currentUserColor.value = humanColor

      gameStore.startWithStrategy(puzzle.initial_fen, createEndgameStrategy(puzzle, humanColor), humanColor, false)

      feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
    } catch (error) {
      const handled = await uiStore.handlePawnCoinsError(
        error,
        () => router.push('/pricing'),
        () => router.push('/'),
      )
      if (!handled) {
        logger.error('[EndgameStore] Failed to load puzzle:', error)
        feedbackMessage.value = t('features.finishHim.feedback.loadFailed')
        gameStore.setGamePhase('IDLE')

        await uiStore.showConfirmation(
          t('common.actions.error'),
          t('features.gameplay.feedback.loadFailed') || 'Failed to load puzzle. It might not exist.',
          { showCancel: false, confirmText: t('common.actions.ok') }
        )
        // Router push back based on mode
        router.push(`/${mode.replace('_', '-')}`)
      }
    }
  }

  function startYouMoveGame(color: 'white' | 'black') {
    if (!activePuzzle.value) return
    isWaitingForColorSelection.value = false
    currentUserColor.value = color
    activePuzzle.value.userSelectedColor = true

    let fen = activePuzzle.value.initial_fen
    const parts = fen.split(' ')
    parts[1] = color === 'black' ? 'b' : 'w'
    fen = parts.join(' ')

    soundService.playSound('game_you_move')

    gameStore.startWithStrategy(fen, createEndgameStrategy(activePuzzle.value, color), color)
  }

  async function handleRestart() {
    if (gameStore.isGameActive) {
      const confirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )
      if (confirmed === 'confirm') {
        gameStore.handleGameResignation()
        if (activePuzzle.value) {
          await loadNewPuzzle(activePuzzle.value.game_modus, { puzzleId: activePuzzle.value.puzzle_id, ...activeParams.value })
        }
      }
    } else if (activePuzzle.value) {
      await loadNewPuzzle(activePuzzle.value.game_modus, { puzzleId: activePuzzle.value.puzzle_id, ...activeParams.value })
    }
  }

  async function handleExit() {
    if (gameStore.isGameActive) {
      const confirmed = await uiStore.showConfirmation(
        t('features.gameplay.confirmExit.title'),
        t('features.gameplay.confirmExit.message'),
      )
      if (confirmed === 'confirm') {
        gameStore.handleGameResignation()
      } else {
        return
      }
    }

    await gameStore.resetGame()
    if (activeParams.value.mode) {
      router.push(`/${activeParams.value.mode.replace('_', '-')}`)
    } else {
      router.push('/')
    }
  }

  return {
    gamePhase: computed(() => gameStore.gamePhase),
    activePuzzle,
    topInfoDisplay: computed<TopInfoDisplay>(() => {
      const puzzle = activePuzzle.value
      if (!puzzle) return { title: '', badges: [], stats: [] }

      const badges = []
      let title = ''

      if (puzzle.game_modus === 'finish_him') {
        title = t(`chess.themes.${puzzle.category}`).toUpperCase()
        badges.push({ text: 'FINISH-HIM' })
        badges.push({ text: t(`common.difficulties.level_${puzzle.difficulty?.toLowerCase() || 'novice'}`) })
      } else if (puzzle.game_modus === 'theory_endings') {
        title = t(`chess.themes.${activeParams.value.category || puzzle.category}`).toUpperCase()
        badges.push({ text: 'THEORY' })
        badges.push({ text: t(`common.difficulties.level_${(activeParams.value.difficulty || puzzle.difficulty)?.toLowerCase() || 'novice'}`).toUpperCase() })
      } else if (puzzle.game_modus === 'practical_chess') {
        title = t(`chess.themes.${puzzle.category}`).toUpperCase()
        badges.push({ text: 'PRACTICAL' })
        badges.push({ text: t(`common.difficulties.level_${puzzle.difficulty?.toLowerCase() || 'novice'}`).toUpperCase() })
      }

      const stats = []
      if (puzzle.rating || puzzle.tactical_rating) {
        stats.push({ value: puzzle.tactical_rating || puzzle.rating || '?', label: t('features.puzzleInfo.tacticalRating') || 'Rating' })
      }
      if (puzzle.engm_rating) {
        stats.push({ value: puzzle.engm_rating, label: 'ENgm' })
      }

      return {
        title,
        secondaryText: puzzle.sub_category ? t(`chess.subThemes.${puzzle.sub_category}`) : undefined,
        badges,
        stats,
      }
    }),
    feedbackMessage,
    isWaitingForColorSelection,
    activeParams,
    fenFinal,

    initialize,
    loadNewPuzzle,
    startGameFromPuzzle,
    startYouMoveGame,
    startPlayoutFromFen,
    handleRestart,
    handleExit,
    reset,
    setParams,
  }
})
