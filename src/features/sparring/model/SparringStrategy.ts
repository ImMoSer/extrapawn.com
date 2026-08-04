import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
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
    try {
      const { useCoachStore } = await import('@/features/coach')
      const feedbackStore = useCoachStore()
      if (feedbackStore.isTakebackPending) {
        logger.info('[SparringStrategy] requestBotMove returned null due to pending coach takeback.')
        return null
      }
    } catch (err) {
      logger.error('[SparringStrategy] Failed to import coach store:', err)
    }

    const { buildLastUserMoveText, parseMoveDescription } = await import('../lib/n8nContextBuilder')
    const { usePreferencesStore } = await import('@/features/settings')
    const { useCoachStore } = await import('@/features/coach')
    const i18n = (await import('@/shared/config/i18n')).default
    const coachStore = useCoachStore()
    const preferencesStore = usePreferencesStore()
    const gameStore = useGameStore()

    const selectedEngineId = preferencesStore.selectedBotEngine || gameStore.botEngineId
    if (!selectedEngineId) {
      throw new Error('[SparringStrategy] Fail-Fast: No engine selected for bot move')
    }

    const lastUserMoveText = buildLastUserMoveText()

    // Helper to set local turn 1 greeting if bot plays White first move
    const applyTurn1BotGreeting = (moveUci: string) => {
      if (!lastUserMoveText) {
        const { san } = parseMoveDescription(fen, moveUci)
        const lang = String(i18n.global.locale.value || 'de')
        let greeting = `Hello! Let's have a great game. Playing ${san} — your move!`
        if (lang === 'ru') {
          greeting = `Привет! Сыграем отличную партию. Хожу ${san} — твой ход!`
        } else if (lang === 'de') {
          greeting = `Hallo! Auf ein gutes Spiel. Ich spiele ${san} — du bist am Zug!`
        }
        coachStore.setLlmThinking(false)
        coachStore.setLlmResponse({
          message: greeting,
          mood: 'neutral',
        })
      }
    }

    // 2. Direct Engine Move (Fail-Fast: no MozerBook fallback)
    logger.info(`[SparringStrategy] Requesting bot move from selected engine: ${selectedEngineId}`)
    const moveUci = await enginePlayService.getBestMove(selectedEngineId as EngineId, fen)
    if (!moveUci) {
      throw new Error(`[SparringStrategy] Fail-Fast: Engine "${selectedEngineId}" failed to calculate a move for FEN: ${fen}`)
    }

    applyTurn1BotGreeting(moveUci)
    return moveUci
  }

  async onUserMoveExecuted() {
    try {
      const { waitForCoachAndCheckTakeback } = await import('@/features/coach')
      await waitForCoachAndCheckTakeback()
    } catch (err) {
      logger.error('[SparringStrategy] Error waiting for coach analysis:', err)
    }
  }

  async onBotMoveExecuted(uciMove: string, fenAfter: string, fenBefore?: string) {
    try {
      const { useCoachStore } = await import('@/features/coach')
      const coachStore = useCoachStore()
      if (coachStore.isCoachEnabled) {
        await coachStore.runAnalysis(fenAfter, true, uciMove, fenBefore)
      }
    } catch (err) {
      logger.error('[SparringStrategy] Error executing coach analysis after bot move:', err)
    }
  }

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
    const authStore = useAuthStore()
    const profile = authStore.userProfile
    const isMo3ep = profile && (profile.id === 'mo3ep' || profile.username === 'MO3EP')

    if (isCrashtest && isMo3ep) {
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
