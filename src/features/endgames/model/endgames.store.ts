import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { parseFen } from 'chessops/fen'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

import {
  useGameStore,
  useBoardStore,
  type GameStatusInfo,
} from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useAnalysisEngineStore } from '@/entities/analysis'
import { soundService } from '@/shared/lib/sound.service'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { apiClient } from '@/shared/api/client'
import type { GameResultResponse } from '@/shared/types/api.types'
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import type { TopInfoDisplay } from '@/entities/puzzle'
import { EndgamePuzzleStrategy } from './EndgamePuzzleStrategy'

const t = i18n.global.t

export type PuzzleStrategyType = 'playOutOnly' | 'scenarioOnly' | 'scenarioPlus'

export interface EndgamePuzzle {
  puzzle_id: string
  puzzle_type: string
  category: string
  sub_category?: string
  difficulty: string
  rating?: number | string
  strategy: PuzzleStrategyType
  first_move: 'bot' | 'user'
  initial_fen: string
  tactical_solution?: string
  puzzle_fen?: string
  // UI Specific overrides
  userSelectedColor?: boolean
}

export interface EndgameParams {
  type?: string
  category?: string
  difficulty?: string
  puzzleId?: string
}

function determineHumanColor(puzzle: EndgamePuzzle): 'white' | 'black' {
  const setup = parseFen(puzzle.initial_fen).unwrap()
  const isBotFirst = puzzle.first_move === 'bot'
  return isBotFirst ? (setup.turn === 'white' ? 'black' : 'white') : setup.turn
}

export const useEndgamesStore = defineStore('endgames', () => {
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const analysisStore = useAnalysisEngineStore()
  const router = useRouter()

  const activePuzzle = ref<EndgamePuzzle | null>(null)
  const activeParams = ref<EndgameParams>({})
  
  const feedbackMessage = ref(t('features.finishHim.feedback.pressNext'))
  const isProcessingGameOver = ref(false)
  const isWaitingForColorGuess = ref(false)
  const isWaitingForColorSelection = ref(false)
  const currentUserColor = ref<ChessgroundColor>('white')

  const gamePhase = computed(() => gameStore.gamePhase)
  const fenFinal = computed(() => activePuzzle.value?.puzzle_fen || '')

  function initialize() {
    soundService.playSound('app_game_entry')
    if (!activePuzzle.value) {
      loadNewPuzzle('practical_chess', { category: 'extraPawn', difficulty: 'Novice' })
    }
  }

  async function guessColor(guessedColor: 'white' | 'black') {
    if (!activePuzzle.value) return
    
    const correctColor = determineHumanColor(activePuzzle.value)
    
    if (guessedColor === correctColor) {
      isWaitingForColorGuess.value = false
      currentUserColor.value = correctColor
      
      // Start the game for real
      gameStore.startWithStrategy(
        activePuzzle.value.initial_fen, 
        new EndgamePuzzleStrategy(activePuzzle.value, correctColor), 
        correctColor, 
        false
      )
      feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
      soundService.playSound('game_you_move')
    } else {
      // Wrong guess - instant game over
      isWaitingForColorGuess.value = false
      handleGameOver(
        activePuzzle.value, 
        false, 
        { winner: guessedColor === 'white' ? 'black' : 'white', reason: 'wrong_move' }, 
        guessedColor
      )
      window.$message?.error('Wrong color! Game Over.')
    }
  }

  async function handleGameOver(
    puzzle: EndgamePuzzle,
    isWin: boolean,
    outcome: NonNullable<GameStatusInfo['outcome']>,
    humanColor: 'white' | 'black',
  ) {
    if (isProcessingGameOver.value) return
    isProcessingGameOver.value = true

    gameStore.setGamePhase('GAMEOVER')
    analysisStore.setPlayerColor(humanColor)

    if (isWin) {
      feedbackMessage.value = t('features.finishHim.feedback.win')
    } else {
      const reason = outcome.reason
      if (reason === 'stalemate') {
        feedbackMessage.value = t('features.gameplay.gameOver.stalemate')
      } else if (reason === 'resign' || reason === 'wrong_move') {
        feedbackMessage.value = t('features.finishHim.feedback.loss')
      } else {
        feedbackMessage.value = t('features.finishHim.feedback.loss')
      }
    }

    try {
      const resultDto = {
        wasCorrect: isWin,
        puzzle_id: puzzle.puzzle_id,
        puzzle_type: puzzle.puzzle_type
      }

      const response = await apiClient<GameResultResponse>('/play-puzzle/result', {
        method: 'POST',
        body: JSON.stringify(resultDto),
      })

      if (response) {
         if (response.ratingDelta !== undefined) {
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
      logger.error('[EndgamesStore] Failed to submit results:', error)
    }
  }

  function setProcessingGameOver(value: boolean) {
    isProcessingGameOver.value = value
  }

  async function loadNewPuzzle(type: string, queryParams: Partial<EndgameParams> = {}) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false
    gameStore.setGamePhase('LOADING')
    feedbackMessage.value = t('common.actions.loading')

    const mergedParams = { ...activeParams.value, ...queryParams, type }
    activeParams.value = mergedParams

    try {
      const category = mergedParams.category || 'pawn'
      const difficulty = mergedParams.difficulty || 'Novice'
      
      const url = `/play-puzzle/start?puzzle_type=${type}&difficulty=${difficulty}&category=${category}`

      const puzzle = await apiClient<EndgamePuzzle>(url)
      if (!puzzle) throw new Error('Puzzle data is null')

      const mappedPuzzle: EndgamePuzzle = {
        ...puzzle,
        puzzle_type: type,
        strategy: puzzle.strategy || (type === 'finish_him' ? 'playOutOnly' : 'scenarioPlus')
      }

      activePuzzle.value = mappedPuzzle
      
      const humanColor = determineHumanColor(mappedPuzzle)
      currentUserColor.value = humanColor

      // ONLY for practical_chess and materialEquality we show the color guess
      const isMaterialEqualityGuess = type === 'practical_chess' && mappedPuzzle.category === 'materialEquality'

      if (isMaterialEqualityGuess) {
        isWaitingForColorGuess.value = true
        gameStore.setGamePhase('IDLE')
        boardStore.setupPosition(mappedPuzzle.initial_fen)
        boardStore.orientation = 'white'
        feedbackMessage.value = 'Guess which side you are playing!'
      } else {
        isWaitingForColorGuess.value = false
        gameStore.startWithStrategy(
          mappedPuzzle.initial_fen,
          new EndgamePuzzleStrategy(mappedPuzzle, humanColor),
          humanColor,
          false
        )
        feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
        soundService.playSound('game_you_move')
      }
    } catch (error) {
       const handled = await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'), () => router.push('/'))
       if (!handled) {
          logger.error('[EndgamesStore] Failed to load puzzle:', error)
          feedbackMessage.value = t('features.finishHim.feedback.loadFailed')
          gameStore.setGamePhase('IDLE')
          router.push('/')
       }
    }
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
          await loadNewPuzzle(activePuzzle.value.puzzle_type, { puzzleId: activePuzzle.value.puzzle_id, ...activeParams.value })
        }
      }
    } else if (activePuzzle.value) {
      await loadNewPuzzle(activePuzzle.value.puzzle_type, { puzzleId: activePuzzle.value.puzzle_id, ...activeParams.value })
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
    router.push('/')
  }

  function reset() {
    activePuzzle.value = null
    feedbackMessage.value = t('features.finishHim.feedback.pressNext')
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false
    isWaitingForColorGuess.value = false
    gameStore.stop()
  }

  return {
    gamePhase,
    activePuzzle,
    feedbackMessage,
    isWaitingForColorSelection,
    isWaitingForColorGuess,
    activeParams,
    fenFinal,
    topInfoDisplay: computed<TopInfoDisplay>(() => {
      const puzzle = activePuzzle.value
      if (!puzzle) return { title: '', badges: [], stats: [] }

      const title = (puzzle.category ? t(`chess.themes.${puzzle.category}`) : puzzle.puzzle_type).toUpperCase()
      const badges = [{ text: puzzle.puzzle_type.toUpperCase() }]
      if (puzzle.difficulty) {
         badges.push({ text: t(`common.difficulties.level_${puzzle.difficulty.toLowerCase()}`).toUpperCase() })
      }

      const stats = []
      if (puzzle.rating) {
        stats.push({ value: puzzle.rating, label: t('features.userCabinet.analyticsTable.rating') })
      }

      return {
        title,
        secondaryText: puzzle.sub_category ? t(`chess.subThemes.${puzzle.sub_category}`) : undefined,
        badges,
        stats,
      }
    }),
    initialize,
    loadNewPuzzle,
    guessColor,
    handleRestart,
    handleExit,
    reset,
    handleGameOver,
    setProcessingGameOver,
  }
})
