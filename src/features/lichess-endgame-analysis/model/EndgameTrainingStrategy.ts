import {
  enginePlayService,
  useBoardStore,
  useGameStore,
  type GameStatusInfo,
  type IGameplayStrategy,
} from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import { useLichessEndgameAnalysisStore } from './lichess-endgame-analysis.store'
import { usePreferencesStore } from '@/features/settings'
import type { EndgamePuzzle } from './lichess-endgame-analysis.types'
import type { Key } from '@lichess-org/chessground/types'

export class EndgameTrainingStrategy implements IGameplayStrategy {
  get config() {
    const preferencesStore = usePreferencesStore()
    return {
      initialBotDelayMs: preferencesStore.preferences.delays.initialBotDelayMs,
      botDelayMs: preferencesStore.preferences.delays.botDelayMs,
      playGameStatusSounds: false,
    }
  }

  readonly strategyId = 'endgame'

  get sessionId(): string {
    return `endgame_${this.puzzle.puzzle_id || this.puzzle.game_id || 'active'}`
  }

  private puzzle: EndgamePuzzle
  private humanColor: 'white' | 'black'
  private isPlayoutMode = true

  constructor(puzzle: EndgamePuzzle, humanColor: 'white' | 'black') {
    this.puzzle = puzzle
    this.humanColor = humanColor
  }

  private get store() {
    return useLichessEndgameAnalysisStore()
  }

  private get gameStore() {
    return useGameStore()
  }

  private get boardStore() {
    return useBoardStore()
  }

  onGameStart() {
    this.store.feedbackMessage = this.puzzle.puzzle_type === 'opp_blunders'
      ? 'features.lichessEndgameAnalysis.feedback.waitingForOpponent'
      : 'features.lichessEndgameAnalysis.feedback.correctPlayout'

    if (this.puzzle.puzzle_type === 'my_dropps' && this.puzzle.dropped_move_uci) {
      const orig = this.puzzle.dropped_move_uci.slice(0, 2)
      const dest = this.puzzle.dropped_move_uci.slice(2, 4)
      this.boardStore.setDrawableShapes([
        { orig: orig as Key, dest: dest as Key, brush: 'red' },
        { orig: dest as Key, dest: dest as Key, brush: 'red' }
      ])
    }
  }

  onDestroy() {}

  checkWinCondition(status: GameStatusInfo): boolean {
    const outcome = status.outcome
    if (!outcome) return false

    if (this.puzzle.user_target === 'win') {
      return outcome.reason === 'checkmate' && outcome.winner === this.humanColor
    } else if (this.puzzle.user_target === 'draw') {
      // Erfolg bei Remis ODER wenn der User die Partie gewinnt!
      return (outcome.winner === undefined && [
        'stalemate',
        'insufficient_material',
        'threefold_repetition',
        'fifty_move_rule',
        'draw'
      ].includes(outcome.reason || '')) || (outcome.winner === this.humanColor)
    }
    return false
  }

  async onUserMoveExecuted(): Promise<void> {
    try {
      const { useCoachStore, waitForCoachAndCheckTakeback } = await import('@/features/coach')
      const coachStore = useCoachStore()
      if (coachStore.isCoachEnabled) {
        await waitForCoachAndCheckTakeback()
      }
    } catch (err) {
      console.error('[EndgameTrainingStrategy] Error waiting for coach analysis in playout:', err)
    }
  }

  async onBotMoveExecuted(): Promise<void> {}

  async requestBotMove(fen: string): Promise<string | null> {
    if (!this.isPlayoutMode) {
      return null
    }

    try {
      return await enginePlayService.getBestMove(this.gameStore.botEngineId, fen)
    } catch (error) {
      console.error('[EndgameTrainingStrategy] Engine failed to generate move.', error)
      return null
    }
  }

  onGameOver(status: GameStatusInfo) {
    const isSuccess = this.checkWinCondition(status)
    if (isSuccess) {
      soundService.playSound('game_tacktics_success')
      this.store.handlePuzzleSuccess(this.puzzle.puzzle_id)
    } else {
      soundService.playSound('game_tacktics_error')
      this.store.handlePuzzleFailure(this.puzzle.puzzle_id)
    }
  }
}
