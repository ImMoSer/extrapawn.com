// src/stores/tornado.store.ts
import { useBoardStore, useGameStore, type IGameplayStrategy } from '@/entities/game'
import { type TopInfoDisplay } from '@/entities/puzzle'
import { useAuthStore } from '@/entities/user'
import { InsufficientPawnCoinsError } from '@/shared/api/client'
import i18n from '@/shared/config/i18n'
import { Glicko2Calculator, type GlickoState } from '@/shared/lib/glicko2'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound.service'
import type { TornadoPuzzle, TornadoSessionResult } from '@/shared/types/api.types'
import { type TornadoMode } from '@/shared/types/api.types'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useQueryClient } from '@tanstack/vue-query'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTornadoQueries } from '../api/tornado.queries'


export type { TornadoMode } from '@/shared/types/api.types'

const t = i18n.global.t
const glicko = new Glicko2Calculator()

const MISTAKES_STORAGE_KEY = 'tornado_mistakes'

const timeControls: Record<TornadoMode, { initial: number; increment: number }> = {
  bullet: { initial: 1 * 60 * 1000, increment: 1 * 1000 },
  blitz: { initial: 3 * 60 * 1000, increment: 2 * 1000 },
  rapid: { initial: 5 * 60 * 1000, increment: 3 * 1000 },
  classic: { initial: 10 * 60 * 1000, increment: 5 * 1000 },
}

export const useTornadoStore = defineStore('tornado', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const router = useRouter()
  const uiStore = useUiStore()
  const authStore = useAuthStore()
  const queryClient = useQueryClient()

  const { startSessionMutation, endSessionMutation } = useTornadoQueries()

  const mode = ref<TornadoMode | null>(null)
  const sessionRating = ref(1000)
  const glickoState = ref<GlickoState>({ rating: 1000, rd: 350, vol: 0.06 })

  const sessionTheme = ref<string | null>(null)
  const activePuzzle = ref<TornadoPuzzle | null>(null)
  const puzzleReservoir = ref<TornadoPuzzle[]>([])
  const pendingResults = ref<TornadoSessionResult[]>([])

  const mistakenPuzzles = ref<TornadoPuzzle[]>([])
  const sessionId = ref<string | null>(null)

  const timerValueMs = ref(0)
  const timeIncrementMs = ref(0)
  const timerId = ref<number | null>(null)
  const isSessionActive = ref(false)
  const feedbackMessage = ref(t('features.tornado.feedback.selectMode'))
  const isProcessingMove = ref(false)
  const puzzlesSolved = ref(0)
  const puzzlesAttempted = ref(0)

  const fenFinal = computed(() => {
    const puzzle = activePuzzle.value
    if (!puzzle || !puzzle.initial_fen || !puzzle.tactical_solution) return ''

    try {
      const setup = parseFen(puzzle.initial_fen).unwrap()
      const chess = Chess.fromSetup(setup).unwrap()
      const moves = puzzle.tactical_solution.split(' ')
      for (const moveStr of moves) {
        const move = parseUci(moveStr)
        if (move) {
          chess.play(move)
        }
      }
      return makeFen(chess.toSetup())
    } catch (e) {
      logger.error('[TornadoStore] Failed to calculate fenFinal:', e)
      return ''
    }
  })

  const tenSecondsWarningPlayed = ref(false)
  const eightSecondsWarningPlayed = ref(false)

  const formattedTimer = computed(() => {
    const totalSeconds = Math.ceil(timerValueMs.value / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  })

  function reset() {
    _stopTimer()
    mode.value = null
    sessionRating.value = 1000
    glickoState.value = { rating: 1000, rd: 350, vol: 0.06 }
    sessionTheme.value = null
    activePuzzle.value = null
    puzzleReservoir.value = []
    pendingResults.value = []
    mistakenPuzzles.value = []
    sessionId.value = null
    timerValueMs.value = 0
    timeIncrementMs.value = 0
    isSessionActive.value = false
    puzzlesSolved.value = 0
    puzzlesAttempted.value = 0
    feedbackMessage.value = t('features.tornado.feedback.selectMode')
    isProcessingMove.value = false
    tenSecondsWarningPlayed.value = false
    eightSecondsWarningPlayed.value = false
    localStorage.removeItem(MISTAKES_STORAGE_KEY)

    // Restore default board sound behavior
    boardStore.setPlayGameStatusSounds(true)

    logger.info('[TornadoStore] State has been reset.')
  }

  function _popBestPuzzle(targetRating: number): TornadoPuzzle | null {
    if (puzzleReservoir.value.length === 0) return null

    // Находим пазл с ближайшим рейтингом
    let bestIdx = 0
    const first = puzzleReservoir.value[0]
    if (!first) return null

    let minDiff = Math.abs(first.tactical_rating - targetRating)

    for (let i = 1; i < puzzleReservoir.value.length; i++) {
      const p = puzzleReservoir.value[i]
      if (!p) continue

      const diff = Math.abs(p.tactical_rating - targetRating)
      if (diff < minDiff) {
        minDiff = diff
        bestIdx = i
      }
    }

    const puzzle = puzzleReservoir.value[bestIdx]
    if (!puzzle) return null

    puzzleReservoir.value.splice(bestIdx, 1)
    return puzzle
  }

  function _startTimer() {
    _stopTimer()
    if (timerValueMs.value <= 0) return

    timerId.value = window.setInterval(() => {
      timerValueMs.value -= 1000

      if (timerValueMs.value <= 10000 && !tenSecondsWarningPlayed.value) {
        soundService.playSound('board_timer_10s')
        tenSecondsWarningPlayed.value = true
      }

      if (timerValueMs.value <= 8000 && !eightSecondsWarningPlayed.value) {
        soundService.playSound('board_timer_8s')
        eightSecondsWarningPlayed.value = true
      }

      if (timerValueMs.value <= 0) {
        timerValueMs.value = 0
        soundService.playSound('board_timer_times_up')
        _handleSessionEnd()
      }
    }, 1000)
  }

  function _stopTimer() {
    if (timerId.value) {
      clearInterval(timerId.value)
      timerId.value = null
    }
  }

  async function _handleSessionEnd() {
    if (!mode.value || !sessionId.value) return
    _stopTimer()
    isSessionActive.value = false
    gameStore.setGamePhase('GAMEOVER')

    // Format stats message
    const themeLabel = sessionTheme.value
      ? t(`chess.tornado.${sessionTheme.value}`)
      : t('chess.tactics.auto')
    const message = t('features.tornado.sessionEnd.stats', {
      rating: sessionRating.value,
      solved: puzzlesSolved.value,
      total: puzzlesAttempted.value,
      theme: themeLabel,
    })

    feedbackMessage.value = message

    try {
      const response = await endSessionMutation.mutateAsync({
        mode: mode.value,
        dto: {
          sessionId: sessionId.value,
          finalScore: sessionRating.value,
          results: pendingResults.value,
        },
      })

      if (response && response.userStatsUpdate) {
        authStore.updateUserStats(response.userStatsUpdate)

        if (response.userStatsUpdate.tornado) {
          queryClient.invalidateQueries({ queryKey: ['user-cabinet', 'detailed-stats'] })
        }
      }
    } catch (error) {
      logger.error('[TornadoStore] Error ending session:', error)
    }

    const hasMistakes = mistakenPuzzles.value.length > 0

    const userResponse = await uiStore.showConfirmation(t('features.tornado.sessionEnd.title'), message, {
      confirmText: t('features.tornado.sessionEnd.newSession'),
      cancelText: t('features.tornado.sessionEnd.exit'),
      extraText: t('features.tornado.sessionEnd.mistakes'),
      showExtra: hasMistakes,
      persistent: true,
    })

    switch (userResponse) {
      case 'extra':
        router.push('/tornado/mistakes')
        break
      case 'confirm':
        if (mode.value) {
          startSession(mode.value) // reset() is called inside startSession
        }
        break
      case 'cancel':
      default:
        localStorage.removeItem(MISTAKES_STORAGE_KEY)
        router.push('/')
        break
    }
  }

  async function startSession(selectedMode: TornadoMode, theme?: string) {
    if (!timeControls[selectedMode]) {
      logger.error(`[TornadoStore] Invalid mode attempt: ${selectedMode}`)
      await uiStore.showConfirmation(
        t('common.actions.error'),
        t('features.gameplay.feedback.loadFailed') || 'Invalid game mode.',
        {
          showCancel: false,
          confirmText: t('common.actions.ok'),
        },
      )
      router.push('/tornado')
      return
    }

    reset()

    // Disable board game-over sounds for Tornado (speed chess)
    boardStore.setPlayGameStatusSounds(false)

    mode.value = selectedMode
    const controls = timeControls[selectedMode]
    timerValueMs.value = controls.initial
    timeIncrementMs.value = controls.increment
    feedbackMessage.value = t('features.tornado.feedback.loadingFirstPuzzle')

    try {
      const response = await startSessionMutation.mutateAsync({ mode: selectedMode, theme })
      logger.info('[TornadoStore] Start session response:', response)

      // Нам прилетает массив puzzles (basket)
      if (response && response.puzzles && response.puzzles.length > 0 && response.sessionId) {
        isSessionActive.value = true
        sessionId.value = response.sessionId
        sessionRating.value = response.sessionRating
        sessionTheme.value = response.sessionTheme || null

        // Заполняем резервуар и берем первый пазл
        puzzleReservoir.value = response.puzzles
        const firstPuzzle = _popBestPuzzle(sessionRating.value)

        if (firstPuzzle) {
          activePuzzle.value = firstPuzzle
          setupPuzzle(firstPuzzle)
          feedbackMessage.value = t('features.tornado.feedback.yourTurn')

          if (response.userStatsUpdate) {
            authStore.updateUserStats(response.userStatsUpdate)
          }
        }
      } else {
        throw new Error(t('features.tornado.feedback.loadingFailed'))
      }
    } catch (error) {
      if (error instanceof InsufficientPawnCoinsError) {
        const e = error as InsufficientPawnCoinsError
        const confirmed = await uiStore.showConfirmation(
          t('features.pricing.insufficientCoins.title'),
          t('features.pricing.insufficientCoins.message', {
            required: e.required,
            available: e.available,
          }) +
          '\n\n' +
          t('features.pricing.insufficientCoins.subMessage'),
          {
            confirmText: t('features.pricing.insufficientCoins.goToPricing'),
            cancelText: t('common.actions.close'),
          },
        )
        if (confirmed === 'confirm') {
          router.push('/pricing')
        } else {
          router.push('/')
        }
      } else {
        logger.error('[TornadoStore] Failed to start session:', error)
        feedbackMessage.value = t('features.tornado.feedback.startFailed')
      }
      isSessionActive.value = false
    }
  }

  function setupPuzzle(puzzle: TornadoPuzzle) {
    const scenarioMoves = puzzle.tactical_solution.split(' ')
    let currentScenarioIndex = 0

    const strategy: IGameplayStrategy = {
      config: {
        initialBotDelayMs: 300,
        playGameStatusSounds: false,
      },

      validateUserMove() {
        // Ошибочные ходы в Торнадо не отбрасываются доской (как в Diamond),
        // они просто мгновенно фейлят весь пазл. Значит pre-validation всегда true.
        return true
      },

      onUserMoveExecuted(uciMove: string) {
        if (isSessionActive.value && timerId.value === null) {
          _startTimer() // Таймер стартует при первом ходе
        }

        const expectedMove = scenarioMoves[currentScenarioIndex]

        if (uciMove === expectedMove) {
          currentScenarioIndex++

          if (currentScenarioIndex >= scenarioMoves.length) {
            handlePuzzleResult(true) // Пазл решен успешно
          }
        } else {
          // Joker: Check if the user delivered checkmate anyway
          const status = boardStore.getGameStatus()
          if (status.outcome?.reason === 'checkmate') {
            handlePuzzleResult(true)
          } else {
            handlePuzzleResult(false) // Ошибка - провал пазла
          }
        }
      },

      requestBotMove: async () => {
        // Бот ходит мгновенно по сценарию
        if (currentScenarioIndex < scenarioMoves.length) {
          const move = scenarioMoves[currentScenarioIndex] || null
          currentScenarioIndex++
          return move
        }
        return null
      },

      onGameOver: (status) => {
        if (status.isGameOver && status.outcome?.reason === 'resign') {
          _handleSessionEnd()
        }
      },
      checkWinCondition: () => false, // Не используется напрямую, Торнадо рулит через handlePuzzleResult
    }

    const setup = parseFen(puzzle.initial_fen).unwrap()
    const humanColor = setup.turn === 'white' ? 'black' : 'white'

    gameStore.startWithStrategy(puzzle.initial_fen, strategy, humanColor, false)
  }

  async function handlePuzzleResult(isCorrect: boolean) {
    if (!activePuzzle.value || !isSessionActive.value || !mode.value || !sessionId.value) return

    // 1. МГНОВЕННО ОБНОВЛЯЕМ ТАЙМЕР И СТАТЫ
    if (timerValueMs.value > 10000) {
      timerValueMs.value += timeIncrementMs.value
    }

    puzzlesAttempted.value++
    const lastPuzzle = activePuzzle.value

    if (isCorrect) {
      puzzlesSolved.value++
      soundService.playSound('game_tacktics_success')
    } else {
      soundService.playSound('game_tacktics_error')
      mistakenPuzzles.value.push(lastPuzzle)
      localStorage.setItem(MISTAKES_STORAGE_KEY, JSON.stringify(mistakenPuzzles.value))
    }

    // 2. ЛОКАЛЬНЫЙ РАСЧЕТ GLICKO (МГНОВЕННО)
    const newGlicko = glicko.calculate(
      glickoState.value,
      [{ rating: lastPuzzle.tactical_rating, rd: 50 }],
      [isCorrect ? 1 : 0],
    )
    glickoState.value = newGlicko
    sessionRating.value = newGlicko.rating

    // 3. МГНОВЕННО БЕРЕМ СЛЕДУЮЩИЙ ПАЗЛ
    const nextPuzzle = _popBestPuzzle(sessionRating.value)
    if (nextPuzzle) {
      activePuzzle.value = nextPuzzle
      setupPuzzle(nextPuzzle)
    } else {
      // Если резервуар пуст, показываем загрузку (но такого быть не должно с prefetch)
      feedbackMessage.value = t('tornado.feedback.loadingMorePuzzles')
    }

    // 4. ДОБАВИТЬ В ЛОКАЛЬНЫЙ БУФЕР ОЖИДАНИЯ
    pendingResults.value.push({
      puzzleId: lastPuzzle.puzzle_id,
      puzzleRating: lastPuzzle.tactical_rating,
      puzzleThemes: lastPuzzle.themes || [],
      isCorrect,
    })

    // Подпитка больше не нужна, Rainbow Basket покрывает все
  }

  function handleRestart() {
    if (mode.value) {
      logger.info(`[TornadoStore] Restarting session with mode: ${mode.value}`)
      startSession(mode.value)
    }
  }

  function handleNew() {
    reset()
    router.push('/tornado')
  }

  return {
    mode,
    sessionRating,
    sessionTheme,
    activePuzzle,
    mistakenPuzzles,
    isSessionActive,
    feedbackMessage,
    topInfoDisplay: computed<TopInfoDisplay>(() => ({
      title: formattedTimer.value,
      mainValue: Math.round(sessionRating.value),
      badges: [
        { text: 'TORNADO' },
        { text: (mode.value || '').toUpperCase() }
      ],
      stats: [
        {
          value: sessionTheme.value ? t(`chess.tactics.${sessionTheme.value}`) : t('chess.tactics.auto'),
          label: 'Theme',
        },
        {
          value: activePuzzle.value?.tactical_rating || '?',
          label: 'Puzzle Rating',
        },
      ],
      customType: 'tornado',
    })),
    startSession,
    reset,
    handleRestart,
    handleNew,
    fenFinal,
  }
})
