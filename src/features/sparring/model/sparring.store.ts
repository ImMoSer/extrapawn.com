import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useGameStore, useBoardStore } from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import { SparringStrategy } from './SparringStrategy'
import { soundService } from '@/shared/lib/sound.service'

export const useSparringStore = defineStore('sparring', () => {
  const gameStore = useGameStore()
  const boardStore = useBoardStore()
  const coachStore = useCoachStore()

  const localFen = ref(boardStore.fen)

  function initialize() {
    coachStore.setCoachEnabled(true)
    boardStore.orientation = 'white'
    
    gameStore.startWithStrategy(
      boardStore.fen,
      new SparringStrategy(),
      boardStore.orientation,
      true
    )
    
    soundService.playSound('app_game_entry')
  }

  function applyFen(fen: string) {
    localFen.value = fen
    gameStore.startWithStrategy(
      fen,
      new SparringStrategy(),
      boardStore.orientation,
      false
    )
  }

  function handleFlip() {
    boardStore.flipBoard()
    if (boardStore.turn !== boardStore.orientation && gameStore.gamePhase === 'PLAYING') {
      gameStore.triggerBotMove()
    }
  }

  function restartGame() {
    const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    applyFen(initialFen)
  }

  function terminate() {
    gameStore.stop()
    coachStore.setCoachEnabled(false)
  }

  return {
    localFen,
    initialize,
    applyFen,
    handleFlip,
    restartGame,
    terminate
  }
})
