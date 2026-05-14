import { useAnalysisEngineStore } from '@/entities/analysis'
import {
  gameplayService,
  useGameStore,
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
import type {
  PracticalChessCategory,
  PracticalChessDifficulty,
  PracticalPuzzle,
} from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePracticalChessQueries } from '../api/practicalChess.queries'
import { useQueryClient } from '@tanstack/vue-query'

const t = i18n.global.t

export const usePracticalChessStore = defineStore('practicalChess', () => {
  const gameStore = useGameStore()
  const analysisStore = useAnalysisEngineStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const router = useRouter()
  const queryClient = useQueryClient()
  const activePuzzle = ref<PracticalPuzzle | null>(null)
  const activeCategory = ref<PracticalChessCategory>('extraPawn')
  const activeDifficulty = ref<PracticalChessDifficulty>('Novice')
  const requestedPuzzleId = ref<string | undefined>(undefined)

  const isProcessingGameOver = ref(false)
  const isWaitingForColorSelection = ref(false)
  const currentUserColor = ref<ChessgroundColor>('white')

  const { puzzleQuery, resultMutation } = usePracticalChessQueries({
    category: activeCategory,
    difficulty: activeDifficulty,
    puzzleId: requestedPuzzleId,
  })

  function selectCategory(cat: PracticalChessCategory) {
    activeCategory.value = cat
  }

  function selectDifficulty(diff: PracticalChessDifficulty) {
    activeDifficulty.value = diff
  }

  function _createStrategy(): IGameplayStrategy {
    return {
      onGameStart(api: IGameCoreApi) {
        if (isWaitingForColorSelection.value) {
          api.setPaused(true)
        }
      },
      checkWinCondition(currentState: GameStatusInfo): boolean {
        const outcome = currentState.outcome
        if (!outcome || outcome.reason === 'resign') return false

        return outcome.winner === currentUserColor.value
      },
      requestBotMove: async (fen: string) => {
        try {
          return await gameplayService.getBestMove(gameStore.botEngineId, fen)
        } catch (error) {
          logger.error('[PracticalChessStrategy] Failed to get bot move.', error)
          return null
        }
      },
      onGameOver(status: GameStatusInfo) {
        const isWin = this.checkWinCondition!(status)
        _handleGameOver(isWin)
      },
    }
  }

  async function loadNewPuzzle(id?: string) {
    isProcessingGameOver.value = false
    isWaitingForColorSelection.value = false

    gameStore.setGamePhase('LOADING')

    try {
      requestedPuzzleId.value = id
      const { data: puzzle, error: fetchError } = await puzzleQuery.refetch()

      if (fetchError) throw fetchError
      if (!puzzle) throw new Error('Puzzle data is null')

      activePuzzle.value = puzzle
      activeCategory.value = puzzle.category as PracticalChessCategory
      activeDifficulty.value = puzzle.difficulty as PracticalChessDifficulty

      if (puzzle.category === 'materialEquality') {
        isWaitingForColorSelection.value = true
        currentUserColor.value = 'white'
        gameStore.startWithStrategy(puzzle.initial_fen, _createStrategy(), 'white')
        return
      }

      // Determine human color: user plays the side that is the winner
      const humanColor = puzzle.winner as ChessgroundColor
      currentUserColor.value = humanColor

      gameStore.startWithStrategy(puzzle.initial_fen, _createStrategy(), humanColor)
    } catch (error) {
      const handled = await uiStore.handlePawnCoinsError(
        error,
        () => router.push('/pricing'),
        () => router.push('/'),
      )
      if (!handled) {
        logger.error('[PracticalChessStore] Failed to load puzzle:', error)
        gameStore.setGamePhase('IDLE')

        await uiStore.showConfirmation(
          t('common.actions.error'),
          t('features.gameplay.feedback.loadFailed') ||
            'Failed to load puzzle. It might not exist.',
          {
            showCancel: false,
            confirmText: t('common.actions.ok'),
          },
        )
        router.push('/practical-chess')
      }
    }
  }

  async function _handleGameOver(isWin: boolean) {
    if (isProcessingGameOver.value) return
    isProcessingGameOver.value = true

    gameStore.setGamePhase('GAMEOVER')
    analysisStore.setPlayerColor(currentUserColor.value)

    const puzzle = activePuzzle.value
    if (!puzzle) return

    let finalFenToSend = puzzle.initial_fen
    if (puzzle.category === 'materialEquality') {
      const parts = finalFenToSend.split(' ')
      parts[1] = currentUserColor.value === 'black' ? 'b' : 'w'
      finalFenToSend = parts.join(' ')
    }

    try {
      const response = await resultMutation.mutateAsync({
        category: puzzle.category,
        dto: {
          puzzleId: puzzle.puzzle_id,
          wasCorrect: isWin,
          pgn_moves: pgnService.getCurrentPgnString(),
          initial_fen: finalFenToSend,
          user_color: currentUserColor.value,
        },
      })
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

          if (response.userStatsUpdate.practical) {
            queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
          }
        } else {
          await authStore.checkSession()
        }
      }
    } catch (error) {
      logger.error('[PracticalChessStore] Error sending Practical Chess stats:', error)
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
          await loadNewPuzzle(activePuzzle.value.puzzle_id)
        }
      }
    } else if (activePuzzle.value) {
      await loadNewPuzzle(activePuzzle.value.puzzle_id)
    }
  }

  function startYouMoveGame(color: 'white' | 'black') {
    if (!activePuzzle.value) return
    isWaitingForColorSelection.value = false
    currentUserColor.value = color

    let fen = activePuzzle.value.initial_fen
    if (color === 'black') {
      // Replace 'w' with 'b' in the FEN side-to-move field
      // FEN format: [board] [turn] [castling] [enpassant] [halfmove] [fullmove]
      const parts = fen.split(' ')
      parts[1] = 'b'
      fen = parts.join(' ')
    } else {
      const parts = fen.split(' ')
      parts[1] = 'w'
      fen = parts.join(' ')
    }

    // Play the "YOU MOVE!" sound
    soundService.playSound('game_you_move')

    gameStore.startWithStrategy(fen, _createStrategy(), color)
  }

  function reset() {
    activePuzzle.value = null
    isProcessingGameOver.value = false
  }

  return {
    activePuzzle,
    topInfoDisplay: computed<TopInfoDisplay>(() => {
      const puzzle = activePuzzle.value
      if (!puzzle) return { title: '', badges: [], stats: [] }

      return {
        title: t(`chess.themes.${activeCategory.value}`).toUpperCase(),
        badges: [
          { text: 'PRACTICAL' },
          { text: t(`common.difficulties.level_${puzzle.difficulty.toLowerCase()}`).toUpperCase() },
        ],
        stats: [{ value: puzzle.rating || '?', label: 'Rating' }],
      }
    }),
    activeCategory,
    activeDifficulty,
    selectCategory,
    selectDifficulty,
    loadNewPuzzle,
    handleRestart,
    startYouMoveGame,
    isWaitingForColorSelection,
    reset,
  }
})
