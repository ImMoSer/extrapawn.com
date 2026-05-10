// src/stores/theoryEndings.store.ts
import {
  gameplayService,
  useGameStore,
  type GameEndOutcome,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useAuthStore } from '@/entities/user'
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import type {
  TheoryEndingCategory,
  TheoryEndingDifficulty,
  TheoryEndingResultDto,
  TheoryEndingType,
  TheoryPuzzle,
} from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTheoryEndingsQueries } from '../api/theoryEndings.queries'
import { useQueryClient } from '@tanstack/vue-query'

const t = i18n.global.t

export const useTheoryEndingsStore = defineStore('theoryEndings', () => {
  const gameStore = useGameStore()
  const authStore = useAuthStore()
  const router = useRouter()
  const uiStore = useUiStore()
  const queryClient = useQueryClient()
  const activePuzzle = ref<TheoryPuzzle | null>(null)
  const activeType = ref<TheoryEndingType | null>(null)
  const activeDifficulty = ref<TheoryEndingDifficulty | null>(null)
  const activeCategory = ref<TheoryEndingCategory | null>(null)
  const requestedPuzzleId = ref<string | undefined>(undefined)

  const feedbackMessage = ref(t('features.theoryEndgames.feedback.pressNext'))
  const isProcessingGameOver = ref(false)

  const { puzzleQuery, resultMutation } = useTheoryEndingsQueries({
    type: activeType,
    difficulty: activeDifficulty,
    category: activeCategory,
    puzzleId: requestedPuzzleId,
  })

  function reset() {
    activePuzzle.value = null
    feedbackMessage.value = t('features.theoryEndgames.feedback.pressNext')
    isProcessingGameOver.value = false
    logger.info('[TheoryEndingsStore] Local state has been reset.')
  }

  function setParams(
    type: TheoryEndingType,
    diff: TheoryEndingDifficulty,
    cat: TheoryEndingCategory,
  ) {
    activeType.value = type
    activeDifficulty.value = diff
    activeCategory.value = cat
  }

  // Эти функции перенесены внутрь объекта strategy ниже

  function _handleGameOver(isWin: boolean, outcome?: GameEndOutcome) {
    if (gameStore.gamePhase === 'GAMEOVER' || isProcessingGameOver.value) {
      return
    }
    isProcessingGameOver.value = true

    // Explicitly set game phase, Strategy API doesn't do this by itself
    gameStore.setGamePhase('GAMEOVER')

    if (isWin) {
      feedbackMessage.value =
        activeType.value === 'win'
          ? t('features.theoryEndgames.feedback.win')
          : t('features.theoryEndgames.feedback.drawSuccess')
    } else {
      const reason = outcome?.reason
      if (reason === 'resign') {
        feedbackMessage.value = t('features.finishHim.feedback.resigned')
      } else {
        feedbackMessage.value = t('features.finishHim.feedback.loss')
      }
    }

    _updateAndSendStats(isWin)
    logger.info(`[TheoryEndingsStore] Game Over. Result: ${isWin ? 'Success' : 'Failure'}`)
  }

  async function _updateAndSendStats(isWin: boolean) {
    const user = authStore.userProfile
    const puzzle = activePuzzle.value

    if (!user || !puzzle) {
      logger.info('[TheoryEndingsStore] User not logged in or no active puzzle. Stats not sent.')
      return
    }

    const dto: TheoryEndingResultDto = {
      puzzleId: puzzle.puzzle_id,
      wasCorrect: isWin,
    }

    try {
      const response = await resultMutation.mutateAsync(dto)
      if (response) {
        // Show rating feedback messages
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
          
          queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
        } else {
          await authStore.checkSession()
        }
      }
    } catch (error) {
      logger.error('[TheoryEndingsStore] Error sending Theory Endings stats:', error)
    }
  }

  async function loadNewPuzzle(type?: TheoryEndingType, puzzleId?: string) {
    isProcessingGameOver.value = false

    gameStore.setGamePhase('LOADING')
    _clearGame() // If any

    try {
      requestedPuzzleId.value = puzzleId
      if (type) activeType.value = type

      const { data: puzzle, error: fetchError } = await puzzleQuery.refetch()

      if (fetchError) throw fetchError
      if (!puzzle) throw new Error('Puzzle data is null')

      activePuzzle.value = puzzle
      // activeType is managed by setParams or preserved if loading by ID with known type
      if (type) activeType.value = type

      activeDifficulty.value = puzzle.difficulty as TheoryEndingDifficulty
      activeCategory.value = puzzle.category as TheoryEndingCategory

      // Determine human color
      let humanColor: 'white' | 'black'
      // Use activeType.value for game type logic
      if (activeType.value === 'win') {
        humanColor = 'white'
      } else {
        if (puzzle.weak_side === 'even') {
          humanColor = Math.random() > 0.5 ? 'white' : 'black'
        } else {
          humanColor = puzzle.weak_side as 'white' | 'black'
        }
      }

      const strategy: IGameplayStrategy = {
        config: {
          // Используется системная задержка 20мс
        },

        checkWinCondition(currentState: GameStatusInfo): boolean {
          const outcome = currentState.outcome
          if (!outcome) return false

          // Resignation is always a loss
          if (outcome.reason === 'resign') return false

          if (activeType.value === 'win') {
            return outcome.winner === humanColor && outcome.reason === 'checkmate'
          } else {
            // Draw mode: any draw (winner is undefined) or win for human is success
            return outcome.winner === humanColor || outcome.winner === undefined
          }
        },

        requestBotMove: async (fen: string) => {
          // Вызываем тяжелый Stockfish (или Mozer) через gameplayService
          try {
            return await gameplayService.getBestMove(gameStore.botEngineId, fen)
          } catch (error) {
            logger.error('[TheoryEndingsStrategy] Failed to get bot move.', error)
            return null
          }
        },

        onGameOver(status: GameStatusInfo) {
          const isWin = this.checkWinCondition!(status)
          _handleGameOver(isWin, status.outcome)
        },
      }

      gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor, false)

      feedbackMessage.value = t('features.finishHim.feedback.yourTurn')
    } catch (error) {
      const handled = await uiStore.handlePawnCoinsError(
        error,
        () => router.push('/pricing'),
        () => router.push('/'),
      )
      if (!handled) {
        logger.error('[TheoryEndingsStore] Failed to load puzzle:', error)
        feedbackMessage.value = t('features.finishHim.feedback.loadFailed')
        gameStore.setGamePhase('IDLE')

        await uiStore.showConfirmation(
          t('common.actions.error'),
          t('features.gameplay.feedback.loadFailed') || 'Failed to load puzzle. It might not exist.',
          {
            showCancel: false,
            confirmText: t('common.actions.ok'),
          },
        )
        router.push('/theory-endings')
      }
    }
  }

  function _clearGame() {
    // any cleanup
  }

  async function handleRestart() {
    if (activePuzzle.value) {
      if (gameStore.isGameActive) {
        const confirmed = await uiStore.showConfirmation(
          t('features.gameplay.confirmExit.title'),
          t('features.gameplay.confirmExit.message'),
        )
        if (confirmed === 'confirm') {
          gameStore.handleGameResignation()
          await loadNewPuzzle(activeType.value!, activePuzzle.value.puzzle_id)
        }
      } else {
        await loadNewPuzzle(activeType.value!, activePuzzle.value.puzzle_id)
      }
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
    router.push('/theory-endings')
  }

  return {
    gamePhase: computed(() => gameStore.gamePhase),
    activePuzzle,
    topInfoDisplay: computed<TopInfoDisplay>(() => {
      const puzzle = activePuzzle.value
      if (!puzzle) return { title: '', badges: [], stats: [] }

      const resultKey = puzzle.result === 'win' ? 'win' : 'draw'

      return {
        title: t(`chess.themes.${activeCategory.value}`).toUpperCase(),
        mainValue: t(`chess.types.${resultKey}`).toUpperCase(),
        badges: [
          { text: 'THEORY' },
          { text: t(`common.difficulties.level_${puzzle.difficulty.toLowerCase()}`).toUpperCase() },
        ],
        stats: [
          { value: puzzle.rating || '?', label: 'Rating' },
        ],
      }
    }),
    activeType,
    activeDifficulty,
    activeCategory,
    feedbackMessage,
    loadNewPuzzle,
    handleRestart,
    handleExit,
    reset,
    setParams,
  }
})
