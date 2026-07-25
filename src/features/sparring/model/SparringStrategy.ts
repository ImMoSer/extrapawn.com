import type { IGameplayStrategy } from '@/entities/game'
import { enginePlayService, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { theoryRepository } from '@/entities/opening'
import logger from '@/shared/lib/logger'
import { usePreferencesStore } from '@/features/settings'

export class SparringStrategy implements IGameplayStrategy {
  readonly strategyId = 'sparring'

  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: true,
    }
  }

  private readonly ENGINE_ID: import('@/shared/types/api.types').EngineId = 'maia-2200'
  private isBookExhausted = false
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
      const { useCoachFeedbackStore } = await import('@/features/coach')
      const feedbackStore = useCoachFeedbackStore()
      if (feedbackStore.isTakebackPending) {
        logger.info('[SparringStrategy] requestBotMove returned null due to pending coach takeback.')
        return null
      }
    } catch (err) {
      logger.error('[SparringStrategy] Failed to import coach feedback store:', err)
    }

    const { useSparringStore } = await import('./sparring.store')
    const { sendSparringWebhook, createSparringWebhookPayload } = await import('../api/n8nCoachApi')
    const { buildLastUserMoveText, buildTopMovesText, getCandidateUciMoves, parseMoveDescription } = await import('../lib/n8nContextBuilder')
    const { useCoachStore } = await import('@/features/coach')
    const i18n = (await import('@/shared/config/i18n')).default
    const sparringStore = useSparringStore()
    const coachStore = useCoachStore()

    const lastUserMoveText = buildLastUserMoveText()

    // 1. Mid-game turn: Send user_move webhook to n8n ONLY if user has made a move
    if (sparringStore.gameId && lastUserMoveText) {
      try {
        coachStore.setLlmThinking(true)

        const topMovesText = buildTopMovesText(fen)
        const candidateUciList = getCandidateUciMoves(fen)

        const payload = createSparringWebhookPayload({
          event: 'user_move',
          gameId: sparringStore.gameId,
          userId: sparringStore.userId,
          userColor: sparringStore.userColor,
          startPosition: fen,
          lastUserMove: lastUserMoveText,
          topMovesInPosition: topMovesText,
          candidateUciMoves: candidateUciList,
        })

        const response = await sendSparringWebhook(payload)
        coachStore.setLlmThinking(false)

        if (response) {
          coachStore.setLlmResponse(response)
          if (response.bot_move) {
            logger.info(`[SparringStrategy] Using bot move from n8n user_move response: ${response.bot_move}`)
            return response.bot_move
          }
        }
      } catch (err) {
        coachStore.setLlmThinking(false)
        logger.error('[SparringStrategy] Failed to send n8n user_move webhook:', err)
      }
    }

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

    // 2. Fallback to MozerBook
    if (!this.isBookExhausted) {
      try {
        const stats = await theoryRepository.getMozerBookStats(fen, { skipDebounce: true })
        if (stats && stats.moves && stats.moves.length > 0) {
          const topMoves = stats.moves.slice(0, 5)
          const firstMove = topMoves[0]
          if (firstMove) {
            const totalPlays = topMoves.reduce((sum, m) => sum + m.total, 0)
            if (totalPlays > 0) {
              let random = Math.random() * totalPlays
              let selectedUci = firstMove.uci
              for (const move of topMoves) {
                random -= move.total
                if (random <= 0) {
                  selectedUci = move.uci
                  break
                }
              }
              logger.info(`[SparringStrategy] Fallback MozerBook move selected: ${selectedUci}`)
              applyTurn1BotGreeting(selectedUci)
              return selectedUci
            }
          }
        } else if (stats) {
          this.isBookExhausted = true
        }
      } catch (err) {
        logger.error('[SparringStrategy] Failed to fetch book stats:', err)
      }
    }

    // 3. Fallback to Engine (Maia)
    logger.info(`[SparringStrategy] Fallback using engine: ${this.ENGINE_ID}`)
    try {
      const moveUci = await enginePlayService.getBestMove(this.ENGINE_ID, fen)
      if (moveUci) {
        applyTurn1BotGreeting(moveUci)
      }
      return moveUci
    } catch (err) {
      logger.error('[SparringStrategy] Engine move failed:', err)
      return null
    }
  }

  async onUserMoveExecuted() {
    try {
      const { waitForCoachAndCheckTakeback } = await import('@/features/coach')
      await waitForCoachAndCheckTakeback()
    } catch (err) {
      logger.error('[SparringStrategy] Error waiting for coach analysis:', err)
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
    const isDemoplay = preferencesStore.isDemoplayEnabled
    const authStore = useAuthStore()
    const profile = authStore.userProfile
    const isMo3ep = profile && (profile.id === 'mo3ep' || profile.username === 'MO3EP')

    if ((isCrashtest || isDemoplay) && isMo3ep) {
      const delay = isCrashtest
        ? preferencesStore.preferences.delays.crashtestDelayMs
        : preferencesStore.preferences.delays.demoStayBeforNextMs

      logger.info(`[SparringStrategy] Auto-restart triggered (isCrashtest=${isCrashtest}, isDemoplay=${isDemoplay}). Restarting in ${delay}ms.`)

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
