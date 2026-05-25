import { defineStore } from 'pinia'
import { ref } from 'vue'

export type GameMode = 'WINNING_ENDGAMES' | 'WINNING_TACTICS'

export const useGameModeStore = defineStore('gameMode', () => {
  const activeMode = ref<GameMode>('WINNING_ENDGAMES')
  
  return {
    activeMode
  }
})
