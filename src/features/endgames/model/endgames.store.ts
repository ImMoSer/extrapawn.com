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
import { useCoachStore } from '@/features/coach'
import { apiClient, InsufficientPawnCoinsError } from '@/shared/api/client'
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
  const isDiscoveryMode = ref(false)
  const discoveryQueue = ref<EndgamePuzzle[]>([])
  
  const feedbackMessage = ref(t('features.finishHim.feedback.pressNext'))
  const isProcessingGameOver = ref(false)
  const isWaitingForColorGuess = ref(false)
  const isWaitingForColorSelection = ref(false)
  const currentUserColor = ref<ChessgroundColor>('white')

  const gamePhase = computed(() => gameStore.gamePhase)
  const fenFinal = computed(() => activePuzzle.value?.puzzle_fen || '')

  function initialize() {
    soundService.playSound('app_game_entry')
    useCoachStore().setAutonomous(false)
    if (!activePuzzle.value) {
      startDiscovery('finish_him')
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
        puzzle: puzzle
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

        // Handle flat response or nested update
        if (response.PawnCoins !== undefined) {
          authStore.updateUserStats({
            PawnCoins: response.PawnCoins,
            dailyLimit: response.dailyLimit,
            spentToday: response.spentToday
          })
        } else if (response.userStatsUpdate) {
          authStore.updateUserStats(response.userStatsUpdate)
        }
      }
    } catch (error) {
      logger.error('[EndgamesStore] Failed to submit results:', error)
      if (error instanceof InsufficientPawnCoinsError) {
        authStore.setDailyLimitExceeded(true)
      }
      await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'))
    }
  }

  function setProcessingGameOver(value: boolean) {
    isProcessingGameOver.value = value
  }

  function localRestart() {
    if (!activePuzzle.value) return
    isProcessingGameOver.value = false
    gameStore.setGamePhase('PLAYING')
    
    const humanColor = determineHumanColor(activePuzzle.value)
    currentUserColor.value = humanColor

    gameStore.startWithStrategy(
      activePuzzle.value.initial_fen,
      new EndgamePuzzleStrategy(activePuzzle.value, humanColor),
      humanColor,
      false
    )
    feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
  }

  async function refillDiscoveryQueue(subMode: string) {
    try {
      const res = await apiClient<{ [key: string]: Array<{ category: string }> }>(`/training-plan/discovery/${subMode}`)
      const categoriesList = res[`discovery_${subMode}`] || []
      if (categoriesList.length === 0) {
        throw new Error('No categories found for discovery')
      }

      const shuffledCats = [...categoriesList].sort(() => Math.random() - 0.5)
      const puzzlesPool: EndgamePuzzle[] = []
      const difficulty = activeParams.value.difficulty || 'Novice'

      const fetchPromises = shuffledCats.map(async (catItem) => {
        try {
          const url = `/play-puzzle/start?puzzle_type=${subMode}&difficulty=${difficulty}&category=${catItem.category}&limit=10`
          const puzzles = await apiClient<EndgamePuzzle[]>(url)
          return puzzles || []
        } catch (err) {
          logger.error(`[EndgamesStore] Failed to fetch puzzles for category ${catItem.category}:`, err)
          return []
        }
      })

      const results = await Promise.all(fetchPromises)
      results.forEach((puzzles) => {
        puzzlesPool.push(...puzzles)
      })

      if (puzzlesPool.length === 0) {
        throw new Error('No puzzles found in discovery pool')
      }

      discoveryQueue.value = puzzlesPool.sort(() => Math.random() - 0.5)
    } catch (err) {
      logger.error('[EndgamesStore] refillDiscoveryQueue failed:', err)
      window.$message?.error('Failed to load discovery pool')
      isDiscoveryMode.value = false
      throw err
    }
  }

  async function startDiscovery(subMode: string) {
    isDiscoveryMode.value = true
    discoveryQueue.value = []
    activeParams.value = {
      ...activeParams.value,
      category: undefined
    }
    await loadNewPuzzle(subMode)
  }

  async function loadNewPuzzle(type: string, queryParams: Partial<EndgameParams> = {}) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false

    if (authStore.isDailyLimitExceeded()) {
      const error = new InsufficientPawnCoinsError('Daily PawnCoins limit exceeded', 5, 0)
      await uiStore.handlePawnCoinsError(
        error,
        () => router.push('/pricing'),
        () => router.push('/')
      )
      gameStore.setGamePhase('IDLE')
      return
    }

    gameStore.setGamePhase('LOADING')
    feedbackMessage.value = t('common.actions.loading')

    const mergedParams = { ...activeParams.value, ...queryParams, type }
    activeParams.value = mergedParams

    try {
      let mappedPuzzle: EndgamePuzzle
      if (isDiscoveryMode.value) {
        if (discoveryQueue.value.length === 0) {
          await refillDiscoveryQueue(type)
        }
        const puzzle = discoveryQueue.value.shift()
        if (!puzzle) throw new Error('No puzzle in discovery queue')

        mappedPuzzle = {
          ...puzzle,
          puzzle_type: type,
          strategy: puzzle.strategy || (type === 'finish_him' ? 'playOutOnly' : 'scenarioPlus')
        }
      } else {
        const category = mergedParams.category || 'pawn'
        const difficulty = mergedParams.difficulty || 'Novice'
        
        const url = `/play-puzzle/start?puzzle_type=${type}&difficulty=${difficulty}&category=${category}`

        const puzzle = await apiClient<EndgamePuzzle>(url)
        if (!puzzle) throw new Error('Puzzle data is null')

        mappedPuzzle = {
          ...puzzle,
          puzzle_type: type,
          strategy: puzzle.strategy || (type === 'finish_him' ? 'playOutOnly' : 'scenarioPlus')
        }
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
        gameStore.stop()
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
        gameStore.stop()
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
    useCoachStore().setAutonomous(true)
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
    isDiscoveryMode,
    discoveryQueue,
    startDiscovery,
    localRestart,
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
