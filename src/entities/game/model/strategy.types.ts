import type { Color as ChessopsColor } from 'chessops/types'
import type { GameEndOutcome } from './board.store'

export interface GameStatusInfo {
  isGameOver: boolean
  outcome?: GameEndOutcome
  isCheck: boolean
  turn: ChessopsColor
}

export interface IGameCoreApi {
  setPaused: (isPaused: boolean) => void
  applyBotMove: (uciMove: string) => void
  // Сюда в будущем можем добавлять методы ядра, к которым нужен доступ из Стратегии
}

export interface IGameplayStrategy {
  readonly strategyId?: 'sparring' | 'puzzle' | 'endgame'
  config?: {
    botDelayMs?: number
    initialBotDelayMs?: number
    playGameStatusSounds?: boolean
    /** Delay before loading the next puzzle after success */
    nextPuzzleDelayMs?: number
    /** Delay before restarting the current puzzle after an error */
    restartDelayMs?: number
  }

  onGameStart?: (api: IGameCoreApi) => void
  onGameOver?: (status: GameStatusInfo) => void

  /**
   * Вызывается ДО реального применения хода на доске и в истории.
   * Позволяет отклонить ход (например, если он 'не по теории').
   * Если возвращает false, ход игнорируется ядром.
   */
  validateUserMove?: (uciMove: string, fen: string) => boolean | Promise<boolean>

  /**
   * Вызывается ПОСЛЕ того как ход был успешно применён ядром.
   */
  onUserMoveExecuted?: (uciMove: string, fen: string) => void | Promise<void>

  /**
   * Вызывается когда происходит Takeback (возврат хода),
   * позволяет стратегии откатить свой внутренний стейт.
   */
  onUserMoveUndone?: () => void

  /**
   * Форсирует переход в режим игры против движка (Playout).
   */
  forcePlayoutMode?: () => void

  /**
   * Делегирует ответственность за генерацию ответного хода Стратегии.
   * Может использовать Stockfish, Mozer, API, Сценарий.
   */
  requestBotMove?: (fen: string) => Promise<string | null>

  /**
   * Вызывается ПОСЛЕ того как ядро применило ход бота. Удобно для обогащения PGN.
   */
  onBotMoveExecuted?: (uciMove: string, fen: string) => void | Promise<void>

  /**
   * Валидация хода в рамках сценария (tactical_solution / scenarioOnly / scenarioPlus).
   */
  getScenarioValidation?: (
    uciMove: string,
    fenAfter: string,
  ) => { isScenario: boolean; isCorrect: boolean; expectedMove?: string } | null

  /**
   * Позволяет переопределить логику победы (например, ничья == победа в Theory Endings).
   */
  checkWinCondition?: (currentState: GameStatusInfo) => boolean

  /**
   * Вызывается при остановке игры или смене стратегии. 
   * Используется для очистки таймеров, подписок и т.д.
   */
  onDestroy?: () => void
}
