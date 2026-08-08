import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService, useGameStore } from '@/entities/game'
import logger from '@/shared/lib/logger'
import { usePreferencesStore } from '@/features/settings'
import type { EngineId } from '@/shared/types/api.types'

export class SparringStrategy implements IGameplayStrategy {
  readonly strategyId = 'sparring'
  private gameId?: string

  constructor(gameId?: string) {
    this.gameId = gameId
  }

  get sessionId(): string {
    return `sparring_${this.gameId || 'active'}`
  }

  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: true,
    }
  }

  private restartTimeout: number | null = null

  onGameStart() {
    logger.info('[SparringStrategy] Game started')
  }

  onDestroy() {
    logger.info('[SparringStrategy] Strategy destroyed')
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout)
      this.restartTimeout = null
    }
  }

  async requestBotMove(fen: string): Promise<string | null> {
    const preferencesStore = usePreferencesStore()
    const gameStore = useGameStore()

    const selectedEngineId = preferencesStore.selectedBotEngine || gameStore.botEngineId
    if (!selectedEngineId) {
      throw new Error('[SparringStrategy] Fail-Fast: No engine selected for bot move')
    }

    // Direct Engine Move
    logger.info(`[SparringStrategy] Requesting bot move from selected engine: ${selectedEngineId}`)
    const moveUci = await enginePlayService.getBestMove(selectedEngineId as EngineId, fen)
    if (!moveUci) {
      throw new Error(`[SparringStrategy] Fail-Fast: Engine "${selectedEngineId}" failed to calculate a move for FEN: ${fen}`)
    }

    return moveUci
  }

  async onUserMoveExecuted() {}

  async onBotMoveExecuted() {}

  onUserMoveUndone() {
    logger.info('[SparringStrategy] Move undone')
  }

  forcePlayoutMode() {
    // Already in playout mode (against engine)
  }

  onGameOver(status: import('@/entities/game').GameStatusInfo) {
    logger.info('[SparringStrategy] Game over:', status)

    const preferencesStore = usePreferencesStore()
    const isCrashtest = preferencesStore.preferences.gameplay.global_crashtest

    if (isCrashtest) {
      const delay = preferencesStore.preferences.delays.crashtestDelayMs

      logger.info(`[SparringStrategy] Auto-restart triggered (isCrashtest=${isCrashtest}). Restarting in ${delay}ms.`)

      if (this.restartTimeout) {
        clearTimeout(this.restartTimeout)
      }

      this.restartTimeout = window.setTimeout(() => {
        const gameStore = useGameStore()
        const initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
        gameStore.startWithStrategy(
          initialFen,
          new SparringStrategy(),
          'white',
          false
        )
      }, delay)
    }
  }

  checkWinCondition(status: import('@/entities/game').GameStatusInfo): boolean {
    // Default chess rules
    return status.isGameOver
  }
}
