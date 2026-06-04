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
import { usePuzzleStore, type PuzzleSubmode, type PuzzlePuzzle } from './puzzle.store'
import { usePreferencesStore } from '@/features/settings'

export class PuzzleStrategy implements IGameplayStrategy {
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

  private puzzle: PuzzlePuzzle
  private humanColor: 'white' | 'black'
  private submode: PuzzleSubmode
  private scenarioMoves: string[]
  private scenarioIndex = 0
  private isPlayoutMode: boolean

  private prevScenarioIndex = 0
  private prevPlayoutMode = false
  private nextPuzzleTimeout: number | null = null

  constructor(puzzle: PuzzlePuzzle, humanColor: 'white' | 'black', submode: PuzzleSubmode) {
    this.puzzle = puzzle
    this.humanColor = humanColor
    this.submode = submode
    this.isPlayoutMode = puzzle.strategy === 'playOutOnly'
    this.scenarioMoves = puzzle.tactical_solution ? puzzle.tactical_solution.split(' ') : []

    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode
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

  onGameStart() {
    if (this.boardStore.turn === this.humanColor) {
      useCoachStore().analyzeCurrentPosition()
    }
  }

  onDestroy() {
    if (this.nextPuzzleTimeout) {
      clearTimeout(this.nextPuzzleTimeout)
      this.nextPuzzleTimeout = null
    }
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

  async onUserMoveExecuted(uciMove: string): Promise<void> {
    this.prevScenarioIndex = this.scenarioIndex
    this.prevPlayoutMode = this.isPlayoutMode

    const coachStore = useCoachStore()

    // 1. In Playout Mode, wait for coach and check for blunder takebacks
    if (this.isPlayoutMode) {
      if (coachStore.isCoachEnabled) {
        try {
          const { waitForCoachAndCheckTakeback } = await import('@/features/coach/model/coach-gameplay')
          const wasTakeback = await waitForCoachAndCheckTakeback()
          if (wasTakeback) {
            return
          }
        } catch (err) {
          logger.error('[PuzzleStrategy] Error waiting for coach analysis in playout:', err)
        }
      }
      return
    }

    // 2. In Scenario Mode (following the predefined tactical solution)
    const expectedMove = this.scenarioMoves[this.scenarioIndex]
    if (uciMove === expectedMove) {
      this.scenarioIndex++

      if (this.scenarioIndex >= this.scenarioMoves.length) {
        logger.info('[PuzzleStrategy] Scenario completed successfully.')
        try {
          const { useCoachFeedbackStore } = await import('@/features/coach/model/coach-feedback.store')
          const feedbackStore = useCoachFeedbackStore()
          feedbackStore.coachMood = 'celebrating'
          feedbackStore.takebackMessage = 'Tactical Solution Completed!'
          feedbackStore.isTakebackPending = false
        } catch (err) {
          logger.error('[PuzzleStrategy] Error showing tactical completion feedback:', err)
        }

        if (this.puzzle.strategy === 'scenarioOnly') {
          soundService.playSound('game_tacktics_success')
          this.store.handleGameOver(
            this.puzzle,
            true,
            { winner: this.humanColor, reason: 'scenario_complete' },
            this.humanColor,
          )
          this.nextPuzzleTimeout = window.setTimeout(() => {
            this.store.loadNewPuzzle(this.puzzle.puzzle_type)
          }, this.config.nextPuzzleDelayMs)
        } else if (this.puzzle.strategy === 'scenarioPlus') {
          this.isPlayoutMode = true
          soundService.playSound('game_play_out_start')
          window.$message.success('Tacktics completed! Playout starts.')
        }
      } else {
        try {
          const { useCoachFeedbackStore } = await import('@/features/coach/model/coach-feedback.store')
          const feedbackStore = useCoachFeedbackStore()
          feedbackStore.coachMood = 'proud'
          feedbackStore.takebackMessage = 'Korrekt! wie gehts weiter?'
          feedbackStore.isTakebackPending = false
        } catch (err) {
          logger.error('[PuzzleStrategy] Error showing scenario correct feedback:', err)
        }
      }
    } else {
      // Deviation from the scenario
      if (coachStore.isCoachEnabled) {
        try {
          const { waitForCoachAndCheckTakeback } = await import('@/features/coach/model/coach-gameplay')
          const wasTakeback = await waitForCoachAndCheckTakeback()
          if (wasTakeback) {
            return
          }
        } catch (err) {
          logger.error('[PuzzleStrategy] Error checking deviation move quality:', err)
        }
      }

      if (this.puzzle.strategy === 'scenarioPlus') {
        this.isPlayoutMode = true
        this.scenarioIndex = this.scenarioMoves.length
        soundService.playSound('game_play_out_start')
        window.$message?.warning('Deviation! Continuing against the engine.')
      } else {
        logger.info(`[PuzzleStrategy] Takeback because expected move was: ${expectedMove}`)

        if (coachStore.isCoachEnabled) {
          try {
            const { useCoachFeedbackStore } = await import('@/features/coach/model/coach-feedback.store')
            const feedbackStore = useCoachFeedbackStore()
            feedbackStore.coachMood = 'warning'
            feedbackStore.takebackMessage = this.submode === 'tactics'
              ? 'Das ist nicht die Taktiklösung! Überleg noch mal.'
              : 'Das ist nicht der korrekte Endspiel-Zug! Überleg noch mal.'
            feedbackStore.isTakebackPending = true

            soundService.playSound('game_training_error')
            await new Promise((resolve) => setTimeout(resolve, 1000))

            this.gameStore.undoLastUserMove()
            return
          } catch (err) {
            logger.error('[PuzzleStrategy] Error setting coach feedback for wrong scenario move:', err)
          }
        }

        soundService.playSound('game_tacktics_error')
        this.store.handleGameOver(
          this.puzzle,
          false,
          { winner: undefined, reason: 'wrong_move' },
          this.humanColor,
        )
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.localRestart()
        }, this.config.restartDelayMs)
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
    useCoachStore().analyzeCurrentPosition()

    if (this.scenarioIndex >= this.scenarioMoves.length) {
      if (this.puzzle.strategy === 'scenarioOnly' || this.submode === 'tactics') {
        soundService.playSound('game_tacktics_success')
        this.store.handleGameOver(
          this.puzzle,
          true,
          { winner: this.humanColor, reason: 'scenario_complete' },
          this.humanColor,
        )
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.loadNewPuzzle(this.puzzle.puzzle_type)
        }, this.config.nextPuzzleDelayMs)
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
    const isWin = this.checkWinCondition(status)
    if (status.outcome) {
      this.store.handleGameOver(this.puzzle, isWin, status.outcome, this.humanColor)
      if (isWin) {
        soundService.playSound('game_tacktics_success')
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.loadNewPuzzle(this.puzzle.puzzle_type)
        }, this.config.nextPuzzleDelayMs)
      } else {
        soundService.playSound('game_tacktics_error')
        this.nextPuzzleTimeout = window.setTimeout(() => {
          this.store.localRestart()
        }, this.config.restartDelayMs)
      }
    }
  }
}
