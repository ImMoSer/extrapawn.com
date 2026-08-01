import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { useCoachStore } from './coach.store'
import { uciToSan } from '@/shared/lib/engine/coach/chess'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { soundService } from '@/shared/lib/sound.service'
import { sendCoachWebhook } from '@/shared/api/n8nCoachApi'
import logger from '@/shared/lib/logger'
import type { Key } from '@lichess-org/chessground/types'

export type MoveState = 'IDLE' | 'USER_PENDING_EVAL' | 'DECISION_REQUIRED' | 'COMMITTED'

export interface PendingMoveInfo {
  uci: string
  san: string
  fenBefore: string
  fenAfter: string
  quality: string | null
  winRateLoss: number | null
  bestMoveSan: string | null
  nag: string | null
  summary: string | null
}

export type BotMoveHandler = (fen: string) => Promise<void>

export const useCoachOrchestratorStore = defineStore('coach-orchestrator', () => {
  const boardStore = useBoardStore()
  const coachStore = useCoachStore()
  const gameStore = useGameStore()

  const activeSessionId = ref<string | null>(null)
  const moveState = ref<MoveState>('IDLE')
  const pendingMove = ref<PendingMoveInfo | null>(null)
  const n8nLastPayload = ref<Record<string, unknown> | null>(null)
  const botMoveHandler = ref<BotMoveHandler | null>(null)

  const isPendingEval = computed(() => moveState.value === 'USER_PENDING_EVAL')
  const isDecisionRequired = computed(() => moveState.value === 'DECISION_REQUIRED')
  const isCommitted = computed(() => moveState.value === 'COMMITTED')

  // Register orchestrator handlers with GameStore (FSD-compliant DI)
  gameStore.registerUserMoveHandler(handleUserMove)
  gameStore.registerStopHandler(() => resetSession(null))

  registerBotMoveHandler(async () => {
    await gameStore.triggerBotMove()
  })

  function registerBotMoveHandler(handler: BotMoveHandler | null) {
    botMoveHandler.value = handler
  }

  function resetSession(newSessionId: string | null = null) {
    logger.info(`[ORCHESTRATOR] Resetting session. Old: ${activeSessionId.value} -> New: ${newSessionId}`)
    activeSessionId.value = newSessionId
    moveState.value = 'IDLE'
    pendingMove.value = null
    n8nLastPayload.value = null
    boardStore.lastNag = null
    coachStore.lastMoveAnalysis = null
    coachStore.resetVisualsAfterBlunderDecision()
  }

  function _qualityToNag(quality?: string | null): string {
    switch (quality) {
      case 'inaccuracy': return '?!'
      case 'mistake': return '?'
      case 'blunder': return '??'
      case 'missed_mate': return '??'
      default: return '!'
    }
  }

  async function handleUserMove(uciMove: string): Promise<boolean> {
    const currentSessionId = gameStore.currentStrategy?.sessionId || null
    if (activeSessionId.value !== currentSessionId) {
      resetSession(currentSessionId)
    }

    if (moveState.value === 'USER_PENDING_EVAL' || moveState.value === 'DECISION_REQUIRED') {
      logger.warn('[ORCHESTRATOR] Move submission rejected: previous move evaluation pending.')
      return false
    }

    const fenBefore = boardStore.fen
    const san = uciToSan(fenBefore, uciMove)
    const destSquare = uciMove.slice(2, 4) as Key

    logger.info(`[USER_MOVE] User played ${san} (UCI: ${uciMove}) | FEN before: ${fenBefore} | Session: ${currentSessionId}`)

    // 1. Visually execute move on board
    const moveOk = boardStore.applyUciMove(uciMove)
    if (!moveOk) {
      logger.error('[ORCHESTRATOR] Failed to execute move on boardStore:', uciMove)
      return false
    }

    const fenAfter = boardStore.fen
    moveState.value = 'USER_PENDING_EVAL'
    logger.info(`[ORCHESTRATOR] State -> USER_PENDING_EVAL | Analyzing user move ${san}...`)

    pendingMove.value = {
      uci: uciMove,
      san,
      fenBefore,
      fenAfter,
      quality: null,
      winRateLoss: null,
      bestMoveSan: null,
      nag: null,
      summary: null,
    }

    // Check for tactical scenario validation (scenarioOnly / scenarioPlus)
    const activeStrategy = gameStore.currentStrategy
    const scenarioValidation = activeStrategy?.getScenarioValidation?.(uciMove, fenAfter)

    if (scenarioValidation?.isScenario) {
      // Tactical Scenario Mode: Bypass Stockfish Engine
      if (scenarioValidation.isCorrect) {
        logger.info(`[UserMoveEval] Scenario move ${san} is CORRECT!`)
        pendingMove.value.quality = 'best'
        pendingMove.value.winRateLoss = 0
        pendingMove.value.nag = '!'
      } else {
        logger.info(`[UserMoveEval] Scenario deviation! Move ${san} is a BLUNDER. Expected: ${scenarioValidation.expectedMove}`)
        pendingMove.value.quality = 'blunder'
        pendingMove.value.winRateLoss = 40
        pendingMove.value.bestMoveSan = scenarioValidation.expectedMove || null
        pendingMove.value.summary = `Abweichung von der taktischen Lösung! Erwartet: ${scenarioValidation.expectedMove || ''}`
        pendingMove.value.nag = '??'

        boardStore.lastNag = {
          square: destSquare,
          quality: 'blunder',
        }

        coachStore.lastMoveAnalysis = {
          san,
          quality: 'blunder',
          summary: pendingMove.value.summary,
          fen: fenBefore,
          square: destSquare,
        }

        // Fetch Multi-PV & update arrows for fenAfterUserMove on scenario blunder
        if (coachStore.isCoachEnabled) {
          try {
            await coachStore.runAnalysis(fenAfter, true)
          } catch (err) {
            logger.error('[ORCHESTRATOR] Error running position analysis for scenario fenAfter:', err)
          }
        }
      }
    } else if (coachStore.isCoachEnabled) {
      // Standard Engine Analysis (single request evaluates last move AND updates top moves)
      try {
        await coachStore.runAnalysis(fenAfter, true, uciMove, fenBefore)
        const analysis = coachStore.lastMoveAnalysis
        
        logger.info(
          `[UserMoveEval] Move: ${uciMove} (${san}) | Quality: ${analysis?.quality || 'N/A'} | WinRateLoss: ${analysis?.winRateLoss ?? 'N/A'}% | BestMove: ${analysis?.bestMoveSan || 'N/A'}`
        )

        if (analysis) {
          pendingMove.value.quality = analysis.quality || null
          pendingMove.value.winRateLoss = typeof analysis.winRateLoss === 'number' ? analysis.winRateLoss : null
          pendingMove.value.bestMoveSan = analysis.bestMoveSan || null
          pendingMove.value.summary = analysis.summary || null
          pendingMove.value.nag = _qualityToNag(analysis.quality)

          // Synchronize lastMoveAnalysis & NAG badge for board & AnalysisPanel
          coachStore.lastMoveAnalysis = {
            ...analysis,
            loading: false,
            fen: fenBefore,
            square: destSquare,
          }

          if (analysis.quality) {
            boardStore.lastNag = {
              square: destSquare,
              quality: analysis.quality,
            }
          }
        }
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error evaluating move:', err)
      }
    }

    // 3. Evaluate if user blundered
    const isBlunder =
      pendingMove.value.quality === 'inaccuracy' ||
      pendingMove.value.quality === 'mistake' ||
      pendingMove.value.quality === 'blunder' ||
      pendingMove.value.quality === 'missed_mate' ||
      (typeof pendingMove.value.winRateLoss === 'number' && pendingMove.value.winRateLoss >= 20)

    if (isBlunder && coachStore.isCoachEnabled) {
      // Scenario B: User Blunder -> DECISION_REQUIRED
      moveState.value = 'DECISION_REQUIRED'

      // Auto-enable board visuals if eye was OFF
      coachStore.enableVisualsForBlunder()

      // Play ErrorChpock sound on blunder
      soundService.playSound('blunder_sound')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const puzzleObj = (activeStrategy as any)?.puzzle

      const authStore = useAuthStore()
      const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'

      n8nLastPayload.value = {
        user_id: userId,
        session_id: currentSessionId,
        mode: activeStrategy?.strategyId || puzzleObj?.puzzle_type || 'chess',
        event: 'user_blunder',
        user_color: boardStore.orientation,
        puzzle_metadata: puzzleObj ? {
          puzzle_id: puzzleObj.puzzle_id,
          puzzle_type: puzzleObj.puzzle_type,
          category: puzzleObj.category,
          difficulty: puzzleObj.difficulty,
          strategy: puzzleObj.strategy,
          first_move: puzzleObj.first_move,
          initial_fen: puzzleObj.initial_fen,
          tactical_solution: puzzleObj.tactical_solution,
          rating: puzzleObj.rating,
        } : null,
        fen_before: fenBefore,
        fen_after: fenAfter,
        last_user_move: {
          uci: uciMove,
          san,
          quality: pendingMove.value.quality,
          win_rate_loss: pendingMove.value.winRateLoss,
          best_move_san: pendingMove.value.bestMoveSan,
        },
        timestamp: Date.now(),
      }

      // Dispatch blunder webhook asynchronously to n8n
      if (n8nLastPayload.value) {
        coachStore.setLlmThinking(true)
        sendCoachWebhook(n8nLastPayload.value)
          .then((response) => {
            coachStore.setLlmThinking(false)
            if (response) {
              coachStore.setLlmResponse(response)
            }
          })
          .catch((err) => {
            coachStore.setLlmThinking(false)
            logger.error('[ORCHESTRATOR] Error sending n8n blunder webhook:', err)
          })
      }

      logger.info(
        `[ORCHESTRATOR] Blunder detected on ${san} (quality: ${pendingMove.value.quality}, winrate_loss: ${pendingMove.value.winRateLoss}%). State -> DECISION_REQUIRED. Bot execution BLOCKED until user decision (B1/B2).`
      )
      return false
    }

    // Scenario A: Good move -> Commit directly
    logger.info(`[ORCHESTRATOR] Move ${san} is good/acceptable. Committing to mainline.`)
    await _commitUserMoveMainline()
    return true
  }

  async function acceptTakeback(): Promise<void> {
    if (!pendingMove.value) return

    const { uci, san, fenBefore, fenAfter, nag, quality } = pendingMove.value

    logger.info(`[USER_DECISION] Option B1 chosen (Takeback accepted). Reverting board to ${fenBefore}. Saving side variation ${san}${nag || '??'} to PGN.`)

    // Play B1 sound (ThinkDeeperNextTime or tryAgain)
    soundService.playSound('blunder_takeback')

    const authStore = useAuthStore()
    const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'

    const currentSessionId = gameStore.currentStrategy?.sessionId || null
    void sendCoachWebhook({
      user_id: userId,
      session_id: currentSessionId,
      event: 'user_decision',
      decision: 'takeback_accepted',
      option: 'B1',
      user_move_uci: uci,
      user_move_san: san,
      fen_before: fenBefore,
    })

    // 1. Revert board to fenBefore & clear NAG
    boardStore.setupPosition(fenBefore)
    boardStore.lastNag = null
    coachStore.lastMoveAnalysis = null

    // 2. Record move as side variation with NAG in PGN Service
    pgnService.addBlunderVariation({
      uci,
      san,
      fenBefore,
      fenAfter,
      nag: nag || '??',
      quality: quality || 'blunder',
    })

    pendingMove.value = null
    moveState.value = 'IDLE'
    coachStore.resetVisualsAfterBlunderDecision()

    // 3. Restore candidate arrows & top moves for fenBefore
    if (coachStore.isCoachEnabled) {
      try {
        await coachStore.runAnalysis(fenBefore, true)
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error restoring analysis for fenBefore:', err)
      }
    }

    logger.info('[ORCHESTRATOR] State -> IDLE | Board reverted. Candidate arrows restored for fenBefore.')
  }

  async function insistUserMove(): Promise<void> {
    if (!pendingMove.value) return

    logger.info(`[USER_DECISION] Option B2 chosen (Insist on move). Committing ${pendingMove.value.san}${pendingMove.value.nag || ''} to mainline.`)
    // Play B2 sound (youllNeverWin)
    soundService.playSound('blunder_insist')

    const authStore = useAuthStore()
    const userId = authStore.userProfile?.id || authStore.effectiveLichessUsername || 'anonymous'

    const currentSessionId = gameStore.currentStrategy?.sessionId || null
    void sendCoachWebhook({
      user_id: userId,
      session_id: currentSessionId,
      event: 'user_decision',
      decision: 'insist_played',
      option: 'B2',
      user_move_uci: pendingMove.value.uci,
      user_move_san: pendingMove.value.san,
      fen_before: pendingMove.value.fenBefore,
    })

    await _commitUserMoveMainline()
  }

  async function _commitUserMoveMainline(): Promise<void> {
    if (!pendingMove.value) return

    const { uci, san, fenBefore, fenAfter, nag } = pendingMove.value

    // Add node to PGN mainline
    const node = pgnService.addNode({
      uci,
      san,
      fenBefore,
      fenAfter,
    })

    if (node && nag) {
      node.metadata = {
        ...node.metadata,
        nag,
      }
    }

    const committedFen = fenAfter
    pendingMove.value = null
    moveState.value = 'COMMITTED'
    logger.info(`[ORCHESTRATOR] Move ${san} COMMITTED to mainline. Current FEN: ${committedFen}`)

    // Notify active strategy of committed user move so scenario indices & status update prior to bot move request
    if (gameStore.currentStrategy?.onUserMoveExecuted) {
      try {
        await gameStore.currentStrategy.onUserMoveExecuted(uci, committedFen)
      } catch (err) {
        logger.error('[ORCHESTRATOR] Error in strategy onUserMoveExecuted:', err)
      }
    }

    // Trigger Bot Move if registered (only if game is playing and FEN matches committed position)
    if (boardStore.isGameOver || gameStore.gamePhase !== 'PLAYING' || boardStore.fen !== committedFen) {
      logger.info('[ORCHESTRATOR] Bot move trigger skipped: game over, non-playing phase, or position changed.')
    } else if (botMoveHandler.value) {
      logger.info('[BOT_MOVE] Triggering bot response...')
      try {
        await botMoveHandler.value(committedFen)
      } catch (err) {
        logger.error('[BOT_MOVE] Error executing bot move handler:', err)
      }
    }

    moveState.value = 'IDLE'
    coachStore.resetVisualsAfterBlunderDecision()
  }

  async function handleBotMove(uciMove: string): Promise<boolean> {
    const fenBefore = boardStore.fen
    const san = uciToSan(fenBefore, uciMove)
    const destSquare = uciMove.slice(2, 4) as Key

    logger.info(`[BOT_MOVE] Bot played ${san} (UCI: ${uciMove}) | FEN before: ${fenBefore}`)

    const moveOk = boardStore.applyUciMove(uciMove)
    if (!moveOk) {
      logger.error('[BOT_MOVE] Failed to execute bot move on boardStore:', uciMove)
      return false
    }

    const fenAfter = boardStore.fen

    // Add bot move to PGN mainline
    pgnService.addNode({
      uci: uciMove,
      san,
      fenBefore,
      fenAfter,
    })

    // Bot move analysis (Scenario Bot)
    if (coachStore.isCoachEnabled) {
      try {
        await coachStore.runAnalysis(fenAfter, true, uciMove, fenBefore)
        const analysis = coachStore.lastMoveAnalysis

        if (analysis) {
          coachStore.lastMoveAnalysis = {
            ...analysis,
            loading: false,
            fen: fenBefore,
            square: destSquare,
          }

          if (analysis.quality) {
            boardStore.lastNag = {
              square: destSquare,
              quality: analysis.quality,
            }
          }
        }

        if (analysis && (analysis.quality === 'blunder' || analysis.quality === 'mistake')) {
          const currentSessionId = gameStore.currentStrategy?.sessionId || null
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const puzzleObj = (gameStore.currentStrategy as any)?.puzzle

          n8nLastPayload.value = {
            session_id: currentSessionId,
            mode: gameStore.currentStrategy?.strategyId || puzzleObj?.puzzle_type || 'chess',
            event: 'bot_blunder',
            game_id: currentSessionId,
            user_color: boardStore.orientation,
            fen_before: fenBefore,
            fen_after: fenAfter,
            bot_move_uci: uciMove,
            bot_move_san: san,
            quality: analysis.quality,
            best_move: analysis.bestMoveSan,
            timestamp: Date.now(),
          }
          logger.info(`[BOT_MOVE] Bot blunder detected on ${san} (quality: ${analysis.quality}). Dispatching bot_blunder event.`)
        }
      } catch (err) {
        logger.error('[BOT_MOVE] Error analyzing bot move:', err)
      }
    }

    return true
  }

  return {
    activeSessionId,
    moveState,
    pendingMove,
    n8nLastPayload,
    isPendingEval,
    isDecisionRequired,
    isCommitted,
    registerBotMoveHandler,
    resetSession,
    handleUserMove,
    acceptTakeback,
    insistUserMove,
    handleBotMove,
  }
})
