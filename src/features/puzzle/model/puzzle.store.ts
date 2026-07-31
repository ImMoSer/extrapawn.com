import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { parseFen } from 'chessops/fen'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'

import {
  useGameStore,
  useBoardStore,
  GameAudioEngine,
  type GameStatusInfo,
} from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useAnalysisEngineStore } from '@/entities/analysis'
import { soundService } from '@/shared/lib/sound.service'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useCrashtestStore } from '@/features/crashtest'
import { apiClient, InsufficientPawnCoinsError } from '@/shared/api/client'
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import type { TopInfoDisplay } from '@/entities/puzzle'
import { PuzzleStrategy } from './PuzzleStrategy'
import { useDemoplayStore } from '@/features/demoplay'

const t = i18n.global.t

export const VALID_SUBMODES = ['tactics', 'finish_him', 'practical_chess', 'theory_endings'] as const
export type PuzzleSubmode = typeof VALID_SUBMODES[number]

export type PuzzleStrategyType = 'playOutOnly' | 'scenarioOnly' | 'scenarioPlus'

export interface PuzzlePuzzle {
  puzzle_id: string
  puzzle_type: string
  category: string
  category_comby?: string[]
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

export interface PuzzleParams {
  type?: string
  category?: string
  difficulty?: string
  puzzleId?: string
}

function determineHumanColor(puzzle: PuzzlePuzzle): 'white' | 'black' {
  const setup = parseFen(puzzle.initial_fen).unwrap()
  const isBotFirst = puzzle.first_move === 'bot'
  return isBotFirst ? (setup.turn === 'white' ? 'black' : 'white') : setup.turn
}

function getStrategyType(submode: PuzzleSubmode): PuzzleStrategyType {
  if (submode === 'finish_him') return 'scenarioPlus'
  if (submode === 'tactics') return 'scenarioOnly'
  if (submode === 'practical_chess' || submode === 'theory_endings') return 'playOutOnly'
  throw new Error(`[PuzzleStore] Unsupported strategy mapping for submode: ${submode}. Fail-Fast!`)
}

export const usePuzzleStore = defineStore('puzzle', () => {
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const analysisStore = useAnalysisEngineStore()
  const router = useRouter()
  const crashtestStore = useCrashtestStore()

  const activeSubmode = ref<PuzzleSubmode | null>(null)
  const activePuzzle = ref<PuzzlePuzzle | null>(null)
  const activeParams = ref<PuzzleParams>({})
  const isDiscoveryMode = ref(false)
  const discoveryQueue = ref<PuzzlePuzzle[]>([])
  
  const feedbackMessage = ref(t('features.puzzle.feedback.pressNext'))
  const isProcessingGameOver = ref(false)
  const isWaitingForColorGuess = ref(false)
  const isWaitingForColorSelection = ref(false)
  const currentUserColor = ref<ChessgroundColor>('white')

  const correctColor = computed<'white' | 'black'>(() => {
    if (!activePuzzle.value) return 'white'
    return determineHumanColor(activePuzzle.value)
  })

  const gamePhase = computed(() => gameStore.gamePhase)
  const fenFinal = computed(() => activePuzzle.value?.puzzle_fen || '')

  function initialize(submode: PuzzleSubmode, puzzleId?: string) {
    if (!VALID_SUBMODES.includes(submode)) {
      throw new Error(`[PuzzleStore] Invalid submode initialized: "${submode}". Fail-Fast!`)
    }
    // Clear stale puzzle if the submode or requested puzzleId changed
    if (activePuzzle.value && (activePuzzle.value.puzzle_type !== submode || (puzzleId && activePuzzle.value.puzzle_id !== puzzleId))) {
      activePuzzle.value = null
      const demoplayStore = useDemoplayStore()
      demoplayStore.demoplayCount = 1
      demoplayStore.hasJustReset = true
    }
    const isNewRoom = activeSubmode.value !== submode
    activeSubmode.value = submode
    if (isNewRoom) {
      soundService.playSound('app_game_entry', 'puzzleStore.initSubmode (Room Entry)')
    }
    if (puzzleId && (!activePuzzle.value || activePuzzle.value.puzzle_id !== puzzleId)) {
      isDiscoveryMode.value = false
      void loadPuzzleById(submode, puzzleId)
    } else if (!activePuzzle.value) {
      startDiscovery(submode)
    } else {
      isDiscoveryMode.value = false
      activeParams.value = {
        ...activeParams.value,
        type: submode,
        category: activePuzzle.value.category,
        difficulty: activePuzzle.value.difficulty,
      }
    }
  }

  async function guessColor(guessedColor: 'white' | 'black') {
    if (!activePuzzle.value) {
      throw new Error('[PuzzleStore] Guessing color with no active puzzle. Fail-Fast!')
    }
    if (!activeSubmode.value) {
      throw new Error('[PuzzleStore] Guessing color with no active submode. Fail-Fast!')
    }
    
    const correctColor = determineHumanColor(activePuzzle.value)
    
    if (guessedColor === correctColor) {
      isWaitingForColorGuess.value = false
      currentUserColor.value = correctColor
      
      // Start the game for real
      gameStore.startWithStrategy(
        activePuzzle.value.initial_fen, 
        new PuzzleStrategy(activePuzzle.value, correctColor, activeSubmode.value), 
        correctColor, 
        false
      )
      feedbackMessage.value = t('features.puzzle.feedback.yourTurn')
      if (activeSubmode.value !== 'tactics') {
        soundService.playSound('game_you_move', 'puzzleStore.guessColor')
      }
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
    puzzle: PuzzlePuzzle,
    isWin: boolean,
    outcome: NonNullable<GameStatusInfo['outcome']>,
    humanColor: 'white' | 'black',
  ) {
    if (isProcessingGameOver.value) return
    isProcessingGameOver.value = true

    gameStore.setGamePhase('GAMEOVER')
    analysisStore.setPlayerColor(humanColor)
    GameAudioEngine.handleGameOutcome(outcome, humanColor)

    if (isWin) {
      feedbackMessage.value = t('features.puzzle.feedback.win')
    } else {
      const reason = outcome.reason
      if (reason === 'stalemate') {
        feedbackMessage.value = t('features.gameplay.gameOver.stalemate')
      } else if (reason === 'resign' || reason === 'wrong_move') {
        feedbackMessage.value = t('features.puzzle.feedback.loss')
      } else {
        feedbackMessage.value = t('features.puzzle.feedback.loss')
      }
    }

    try {
      if (!puzzle || !puzzle.puzzle_type) {
        throw new Error('[PuzzleStore] Puzzle or puzzle_type is missing during game over. Fail-Fast!')
      }

      const response = await apiClient<{ PawnCoins: number; dailyLimit: number; spentToday: number }>(
        `/billing/${puzzle.puzzle_type}`,
        { method: 'GET' }
      )

      if (response && response.PawnCoins !== undefined) {
        authStore.updateUserStats({
          PawnCoins: response.PawnCoins,
          dailyLimit: response.dailyLimit,
          spentToday: response.spentToday
        })
      }
    } catch (error) {
      logger.error('[PuzzleStore] Failed to trigger billing:', error)
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
    if (!activePuzzle.value) {
      throw new Error('[PuzzleStore] Restarting game with no active puzzle. Fail-Fast!')
    }
    if (!activeSubmode.value) {
      throw new Error('[PuzzleStore] Restarting game with no active submode. Fail-Fast!')
    }
    isProcessingGameOver.value = false
    gameStore.setGamePhase('PLAYING')
    
    const humanColor = determineHumanColor(activePuzzle.value)
    currentUserColor.value = humanColor

    gameStore.startWithStrategy(
      activePuzzle.value.initial_fen,
      new PuzzleStrategy(activePuzzle.value, humanColor, activeSubmode.value),
      humanColor,
      false
    )
    feedbackMessage.value = t('features.puzzle.feedback.yourTurn')
  }

  async function refillDiscoveryQueue(subMode: string) {
    try {
      const res = await apiClient<{ [key: string]: Array<{ category: string }> }>(`/training-plan/discovery/${subMode}`)
      const categoriesList = res[`discovery_${subMode}`] || []
      if (categoriesList.length === 0) {
        throw new Error(`[PuzzleStore] No categories found for discovery submode: ${subMode}. Fail-Fast!`)
      }

      const shuffledCats = [...categoriesList].sort(() => Math.random() - 0.5)
      const puzzlesPool: PuzzlePuzzle[] = []
      const difficulty = activeParams.value.difficulty || 'Novice'

      const fetchPromises = shuffledCats.map(async (catItem) => {
        try {
          const url = `/play-puzzle/start?puzzle_type=${subMode}&difficulty=${difficulty}&category=${catItem.category}&limit=10`
          const puzzles = await apiClient<PuzzlePuzzle[]>(url)
          return puzzles || []
        } catch (err) {
          logger.error(`[PuzzleStore] Failed to fetch puzzles for category ${catItem.category}:`, err)
          return []
        }
      })

      const results = await Promise.all(fetchPromises)
      results.forEach((puzzles) => {
        puzzlesPool.push(...puzzles)
      })

      if (puzzlesPool.length === 0) {
        throw new Error(`[PuzzleStore] No puzzles found in discovery pool for: ${subMode}. Fail-Fast!`)
      }

      discoveryQueue.value = puzzlesPool.sort(() => Math.random() - 0.5)
    } catch (err) {
      logger.error('[PuzzleStore] refillDiscoveryQueue failed:', err)
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

  async function loadNewPuzzle(type: string, queryParams: Partial<PuzzleParams> = {}) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false

    if (!VALID_SUBMODES.includes(type as PuzzleSubmode)) {
      throw new Error(`[PuzzleStore] Invalid submode requested for puzzle loading: "${type}". Fail-Fast!`)
    }
    activeSubmode.value = type as PuzzleSubmode

    const demoplayStore = useDemoplayStore()
    if (demoplayStore.isDemoplayEnabled) {
      if (!demoplayStore.hasIntroBeenShown) {
        demoplayStore.showIntroModal({
          submode: type as PuzzleSubmode,
          category: queryParams.category || activeParams.value.category || '',
          difficulty: queryParams.difficulty || activeParams.value.difficulty || 'Novice'
        })
        return
      }

      if (demoplayStore.hasJustReset) {
        demoplayStore.hasJustReset = false
      } else {
        if (demoplayStore.demoplayCount >= 100) {
          demoplayStore.isDemoplayEnabled = false
          demoplayStore.showCompleteModal()
          return
        }
        demoplayStore.demoplayCount++
      }
    }

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
    feedbackMessage.value = t('shared.app.loading')

    const targetPuzzleId = queryParams.puzzleId
    const baseActiveParams = { ...activeParams.value }
    delete baseActiveParams.puzzleId

    let category = queryParams.category || baseActiveParams.category
    if (!category) {
      if (type === 'tactics') category = 'fork'
      else if (type === 'practical_chess') category = 'extraPawn'
      else category = 'pawn'
    }
    const difficulty = queryParams.difficulty || baseActiveParams.difficulty || 'Novice'

    activeParams.value = {
      type,
      category,
      difficulty,
    }

    try {
      let mappedPuzzle: PuzzlePuzzle
      if (isDiscoveryMode.value && !targetPuzzleId) {
        if (discoveryQueue.value.length === 0) {
          await refillDiscoveryQueue(type)
        }
        const puzzle = discoveryQueue.value.shift()
        if (!puzzle) {
          throw new Error('[PuzzleStore] No puzzle in discovery queue. Fail-Fast!')
        }

        mappedPuzzle = {
          ...puzzle,
          puzzle_type: type,
          strategy: puzzle.strategy || getStrategyType(activeSubmode.value)
        }
      } else {
        let puzzle: PuzzlePuzzle
        if (targetPuzzleId) {
          puzzle = await apiClient<PuzzlePuzzle>(
            `/play-puzzle/puzzle/${targetPuzzleId}?puzzle_type=${type}`
          )
        } else {
          const url = `/play-puzzle/start?puzzle_type=${type}&difficulty=${difficulty}&category=${category}`
          puzzle = await apiClient<PuzzlePuzzle>(url)
        }

        if (!puzzle) {
          throw new Error('[PuzzleStore] Puzzle data is null from API. Fail-Fast!')
        }

        mappedPuzzle = {
          ...puzzle,
          puzzle_type: type,
          strategy: puzzle.strategy || getStrategyType(activeSubmode.value)
        }
      }

      activePuzzle.value = mappedPuzzle

      // Dynamically sync URL route parameter to active puzzle_id
      const currentRouteId = router.currentRoute.value.params.puzzleId
      if (mappedPuzzle.puzzle_id && currentRouteId !== mappedPuzzle.puzzle_id) {
        const routeName = router.currentRoute.value.name || type
        void router.replace({
          name: routeName,
          params: { ...router.currentRoute.value.params, puzzleId: mappedPuzzle.puzzle_id },
        })
      }
      
      const humanColor = determineHumanColor(mappedPuzzle)
      currentUserColor.value = humanColor

      // ONLY for practical_chess and materialEquality we show the color guess
      const isMaterialEqualityGuess = type === 'practical_chess' && mappedPuzzle.category === 'materialEquality'
      const isCrashtestActive = crashtestStore.isMo3ep && crashtestStore.isCrashtestEnabled

      if (isMaterialEqualityGuess && !isCrashtestActive) {
        isWaitingForColorGuess.value = true
        gameStore.setGamePhase('IDLE')
        boardStore.setupPosition(mappedPuzzle.initial_fen)
        boardStore.orientation = 'white'
        feedbackMessage.value = 'Guess which side you are playing!'
      } else {
        isWaitingForColorGuess.value = false
        gameStore.startWithStrategy(
          mappedPuzzle.initial_fen,
          new PuzzleStrategy(mappedPuzzle, humanColor, activeSubmode.value),
          humanColor,
          false
        )
        feedbackMessage.value = t('features.puzzle.feedback.yourTurn')
      }
    } catch (error) {
       const handled = await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'), () => router.push('/'))
       if (!handled) {
          logger.error('[PuzzleStore] Failed to load puzzle:', error)
          feedbackMessage.value = t('features.puzzle.feedback.loadFailed')
          gameStore.setGamePhase('IDLE')
          router.push('/')
       }
    }
  }

  async function loadPuzzleById(type: string, puzzleId: string) {
    return loadNewPuzzle(type, { puzzleId })
  }

  async function loadNextPuzzle(type: string, queryParams: Partial<PuzzleParams> = {}) {
    const cleanParams = { ...queryParams }
    delete cleanParams.puzzleId
    return loadNewPuzzle(type, cleanParams)
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
    activeSubmode.value = null
    feedbackMessage.value = t('features.puzzle.feedback.pressNext')
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false
    isWaitingForColorGuess.value = false
    gameStore.stop()
  }

  return {
    activeSubmode,
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

      const namespace = activeSubmode.value === 'tactics' ? 'tactics' : 'themes'
      const title = (puzzle.category ? t(`puzzleCategories.${namespace}.${puzzle.category}`) : puzzle.puzzle_type).toUpperCase()
      const badges = [{ text: puzzle.puzzle_type.toUpperCase() }]
      if (puzzle.difficulty) {
         badges.push({ text: t(`puzzleCategories.difficulties.level_${puzzle.difficulty.toLowerCase()}`).toUpperCase() })
      }

      const stats = []
      if (puzzle.rating) {
        stats.push({ value: puzzle.rating, label: t('pages.userCabinet.analyticsTable.rating') })
      }

      return {
        title,
        secondaryText: puzzle.sub_category ? t(`puzzleCategories.subThemes.${puzzle.sub_category}`) : undefined,
        badges,
        stats,
      }
    }),
    isDiscoveryMode,
    discoveryQueue,
    startDiscovery,
    initialize,
    loadNewPuzzle,
    loadPuzzleById,
    loadNextPuzzle,
    guessColor,
    correctColor,
    handleRestart,
    handleExit,
    reset,
    handleGameOver,
    localRestart,
    setProcessingGameOver,
  }
})
