import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Router } from 'vue-router'
import { useGameStore, useBoardStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import { useAuthStore } from '@/entities/user'
import { SparringStrategy } from './SparringStrategy'
import { soundService } from '@/shared/lib/sound.service'
import i18n from '@/shared/config/i18n'
import type { SparringGameStatus } from './types'

const DEFAULT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function getInitialUserWhiteGreeting(): string {
  const lang = String(i18n.global.locale.value || 'de')
  if (lang === 'ru') {
    return 'Привет! Я готов к спаррингу. Твой ход — сделай первый ход на доске!'
  }
  if (lang === 'de') {
    return 'Hallo! Ich bin bereit für das Sparring. Du bist am Zug — mache deinen ersten Zug!'
  }
  return "Hello! I'm ready for sparring. You play White — make your first move!"
}

export const useSparringStore = defineStore('sparring', () => {
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const coachStore = useCoachStore()
  const authStore = useAuthStore()

  const gameId = ref<string | null>(null)
  const userColor = ref<'white' | 'black'>('white')
  const startPosition = ref<string>(DEFAULT_FEN)
  const gameStatus = ref<SparringGameStatus>('setup')
  const isNewGameModalOpen = ref<boolean>(false)
  const localFen = ref<string>(DEFAULT_FEN)

  const userId = computed(() => authStore.effectiveLichessUsername || 'mo3ep')

  function generateGameId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  function openNewGameModal() {
    isNewGameModalOpen.value = true
  }

  function closeNewGameModal() {
    isNewGameModalOpen.value = false
  }

  async function startNewGame(
    params: { color: 'white' | 'black'; fen: string },
    router?: Router
  ) {
    const newId = generateGameId()
    gameId.value = newId
    userColor.value = params.color
    startPosition.value = params.fen
    localFen.value = params.fen
    gameStatus.value = 'playing'
    isNewGameModalOpen.value = false

    boardStore.orientation = params.color
    coachStore.setCoachEnabled(true)
    coachStore.resetLlmState()

    if (params.color === 'white') {
      coachStore.setLlmThinking(false)
      coachStore.setLlmResponse({
        message: getInitialUserWhiteGreeting(),
        mood: 'neutral',
      })
    } else {
      coachStore.setLlmThinking(true)
    }

    gameStore.startWithStrategy(
      params.fen,
      new SparringStrategy(),
      params.color,
      true
    )

    soundService.playSound('app_game_entry')

    if (router) {
      void router.push({ name: 'sparring', params: { gameId: newId } })
    }
  }

  function resignGame() {
    if (gameStatus.value !== 'playing') return
    gameStatus.value = 'analysis'
    gameStore.stop()
    void soundService.playSound('game_user_lost')
  }

  function initializeFromRoute(routeGameId?: string, router?: Router) {
    coachStore.setCoachEnabled(true)
    if (routeGameId) {
      if (gameId.value === routeGameId && gameStatus.value === 'playing') {
        return
      }
      gameId.value = null
      gameStatus.value = 'setup'
      isNewGameModalOpen.value = true
      if (router) {
        void router.replace({ name: 'sparring', params: {} })
      }
    } else {
      if (gameStatus.value === 'setup') {
        isNewGameModalOpen.value = true
      }
    }
  }

  function terminate() {
    gameStore.stop()
    coachStore.setCoachEnabled(false)
  }

  return {
    gameId,
    userColor,
    startPosition,
    gameStatus,
    isNewGameModalOpen,
    localFen,
    userId,
    openNewGameModal,
    closeNewGameModal,
    startNewGame,
    resignGame,
    initializeFromRoute,
    terminate,
  }
})
