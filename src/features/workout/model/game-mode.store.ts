import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useWorkoutStore } from './workout.store'
import { usePlayCoachStore } from './play-coach.store'
import { useGameStore, useBoardStore } from '@/entities/game'

export type GameMode = 'WINNING_ENDGAMES' | 'WINNING_TACTICS' | 'PLAY_COACH'

export const useGameModeStore = defineStore('gameMode', () => {
  const activeMode = ref<GameMode>('WINNING_ENDGAMES')
  
  const workoutStore = useWorkoutStore()
  const playCoachStore = usePlayCoachStore()
  const gameStore = useGameStore()
  const boardStore = useBoardStore()

  // Centralized mode switching logic
  watch(activeMode, (newMode) => {
    if (newMode === 'PLAY_COACH') {
      // Exclusivity: Clear workout state when entering PlayCoach
      workoutStore.reset()
      gameStore.resetGame()
      boardStore.setupPosition('start')
    } else {
      // Exclusivity: Stop PlayCoach when entering a puzzle/workout mode
      if (playCoachStore.isActive) {
        playCoachStore.stop()
      }
    }
  })

  return {
    activeMode
  }
})
