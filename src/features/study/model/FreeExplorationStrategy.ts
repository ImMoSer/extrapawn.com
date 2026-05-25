import type { IGameplayStrategy } from '@/entities/game'

export class FreeExplorationStrategy implements IGameplayStrategy {
  config = {
    botDelayMs: 0,
    playGameStatusSounds: false,
  }

  validateUserMove(): boolean {
    return true
  }
}
