import {
  enginePlayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { useCoachStore } from '@/features/coach'
import logger from '@/shared/lib/logger'
import { soundService } from '@/shared/lib/sound.service'
import { usePuzzleStore, type PuzzlePuzzle } from './puzzle.store'
import { usePreferencesStore } from '@/features/settings'

export interface PuzzleStrategyCallbacks {
  onSuccess?: (timeMs?: number) => void | Promise<void>
  onFailure?: () => void | Promise<void>
  onGameOver?: (status: GameStatusInfo) => void
  planId?: string
}

export class PuzzleStrategy implements IGameplayStrategy {
  private puzzle: PuzzlePuzzle
  private humanColor: 'white' | 'black'
  private submode: string
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean
  private callbacks?: PuzzleStrategyCallbacks

  private prevScenarioIndex = 0
  private prevPlayoutMode = false
  private nextPuzzleTimeout: number | null = null
  private isDestroyed = false

  constructor(
    puzzle: PuzzlePuzzle,
    humanColor: 'white' | 'black',
    submode: string,
    callbacks?: PuzzleStrategyCallbacks,
  ) {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.submode = submode
    this.callbacks = callbacks
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []

    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
  }

  get sessionId(): string {
    const prefix = this.callbacks?.planId
      ? `task_today_${this.callbacks.planId}`
      : (this.puzzle.puzzle_type || 'puzzle')
    return `${prefix}_${this.puzzle.puzzle_id}`
  }

  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      initialBotDelayMs: preferencesStore.preferences.delays.initialBotDelayMs,
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: false,
      nextPuzzleDelayMs: preferencesStore.preferences.delays.nextPuzzleDelayMs,
      restartDelayMs: preferencesStore.preferences.delays.restartDelayMs,
    }
  }

  private get store() {
    return usePuzzleStore()
  }

  private get gameStore() {
    return useGameStore()
  }

  private get boardStore() {
    return useBoardStore()
  }

  onGameStart() {}

  onDestroy() {
    this.isDestroyed = true
  }

  checkWinCondition(status: GameStatusInfo): boolean {
    const outcome = status.outcome
    if (!outcome || outcome.reason === 'resign') return false

    if (outcome.reason === 'checkmate' && outcome.winner === this.humanColor) {
      return true
    }

    const isScenarioComplete = this.scenarioIndex >= this.scenarioMoves.length

    if (this.puzzle.strategy === 'scenarioOnly') {
      return isScenarioComplete
    }

    if (this.puzzle.strategy === 'playOutOnly' || this.puzzle.strategy === 'scenarioPlus') {
      return outcome.reason === 'checkmate' && outcome.winner === this.humanColor
    }

    return false
  }

  getScenarioValidation(uciMove: string): { isScenario: boolean; isCorrect: boolean; expectedMove?: string } | null {
    if (this.isPlayoutMode) return null
    if (this.puzzle.strategy !== 'scenarioOnly' && this.puzzle.strategy !== 'scenarioPlus') return null
    if (this.scenarioIndex >= this.scenarioMoves.length) return null

    const expectedMove = this.scenarioMoves[this.scenarioIndex]
    const isCheckmate = this.boardStore.chessPosition.isCheckmate()
    const isCorrect = uciMove === expectedMove || isCheckmate

    return {
      isScenario: true,
      isCorrect,
      expectedMove,
    }
  }

  private async triggerSuccess(reason: string = 'scenario_complete'): Promise<void> {
    if (this.isDestroyed) return

    if (this.callbacks?.onSuccess) {
      await this.callbacks.onSuccess()
      return
    }

    soundService.playSound('game_tacktics_success', 'PuzzleStrategy.scenarioSuccess')
    await this.store.handleGameOver(
      this.puzzle,
      true,
      { winner: this.humanColor, reason },
      this.humanColor,
    )
  }

  private async triggerFailure(): Promise<void> {
    if (this.isDestroyed) return

    if (this.callbacks?.onFailure) {
      await this.callbacks.onFailure()
      return
    }

    soundService.playSound('game_tacktics_error')
    await this.store.handleGameOver(
      this.puzzle,
      false,
      { winner: undefined, reason: 'wrong_move' },
      this.humanColor,
    )
  }

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode

    const coachStore = useCoachStore()
    const isCheckmate = this.boardStore.chessPosition.isCheckmate()

    // 1. In Playout Mode, check for checkmate victory or blunder takebacks
    if (this.isPlayoutMode) {
      if (isCheckmate) {
        logger.info('[PuzzleStrategy] Checkmate delivered in playout mode. Game won!')
        await this.triggerSuccess('checkmate')
        return
      }

      return
    }

    // 2. In Scenario Mode (following the predefined tactical solution)
    const expectedMove = this.scenarioMoves[this.scenarioIndex]

    if (uciMove === expectedMove || isCheckmate) {
      if (uciMove === expectedMove) {
        this.scenarioIndex++
      } else {
        this.scenarioIndex = this.scenarioMoves.length
      }

      if (isCheckmate || this.scenarioIndex >= this.scenarioMoves.length) {
        logger.info('[PuzzleStrategy] Scenario completed successfully.')
        try {
          const { useCoachStore } = await import('@/features/coach')
          const feedbackStore = useCoachStore()
          feedbackStore.coachMood = 'celebrating'
        } catch (err) {
          logger.error('[PuzzleStrategy] Error showing tactical completion feedback:', err)
        }

        if (isCheckmate || this.puzzle.strategy === 'scenarioOnly') {
          await this.triggerSuccess(isCheckmate ? 'checkmate' : 'scenario_complete')
        } else if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          soundService.playSound('game_play_out_start')
          window.$message?.success('Tacktics completed! Playout starts.')
        }
      } else {
        try {
          const { useCoachStore } = await import('@/features/coach')
          const feedbackStore = useCoachStore()
          feedbackStore.coachMood = 'proud'
        } catch (err) {
          logger.error('[PuzzleStrategy] Error showing scenario correct feedback:', err)
        }
      }
    } else {
      if (this.puzzle.strategy === 'scenarioPlus') {
        this.isPlayoutMode = true
        this.scenarioIndex = this.scenarioMoves.length
        soundService.playSound('game_play_out_start')
        window.$message?.warning('Deviation! Continuing against the engine.')
      } else {
        logger.info(`[PuzzleStrategy] Takeback because expected move was: ${expectedMove}`)

        if (coachStore.isCoachEnabled) {
          try {
            const { useCoachStore } = await import('@/features/coach')
            const feedbackStore = useCoachStore()
            feedbackStore.coachMood = 'warning'

            soundService.playSound('game_training_error')
            await new Promise((resolve) => setTimeout(resolve, 1000))

            this.gameStore.undoLastUserMove()
            return
          } catch (err) {
            logger.error('[PuzzleStrategy] Error setting coach feedback for wrong scenario move:', err)
          }
        }

        await this.triggerFailure()
        return
      }
    }
  }

  onUserMoveUndone() {
    this.scenarioIndex = this.prevScenarioIndex
    this.isPlayoutMode = this.prevPlayoutMode
    this.store.setProcessingGameOver(false)
    if (this.nextPuzzleTimeout) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
  }

  async onBotMoveExecuted(): Promise<void> {
    if (this.scenarioIndex >= this.scenarioMoves.length) {
      if (this.puzzle.strategy === 'scenarioOnly' || this.submode === 'tactics') {
        await this.triggerSuccess('scenario_complete')
      }
    }
  }

  async requestBotMove(fen: string): Promise<string | null> {
    if (!this.isPlayoutMode && this.scenarioIndex < this.scenarioMoves.length) {
      const move = this.scenarioMoves[this.scenarioIndex] || null
      this.scenarioIndex++
      return move
    }

    if (this.puzzle.strategy === 'scenarioOnly') return null

    try {
      return await enginePlayService.getBestMove(this.gameStore.botEngineId, fen)
    } catch (error) {
      logger.error('[PuzzleStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo): void {
    if (this.isDestroyed) return

    if (this.callbacks) {
      this.callbacks.onGameOver?.(status)
      return
    }

    const isWin = this.checkWinCondition(status)
    if (status.outcome) {
      this.store.handleGameOver(this.puzzle, isWin, status.outcome, this.humanColor)
      if (isWin) {
        soundService.playSound('game_tacktics_success')
        if (this.store.autoNextPuzzle) {
          this.nextPuzzleTimeout = window.setTimeout(() => {
            if (this.isDestroyed) return
            void this.store.loadNewPuzzle(this.puzzle.puzzle_type)
          }, this.config.nextPuzzleDelayMs)
        }
      } else {
        soundService.playSound('game_tacktics_error')
        this.nextPuzzleTimeout = window.setTimeout(() => {
          if (this.isDestroyed) return
          this.store.localRestart()
        }, this.config.restartDelayMs)
      }
    }
  }
}
