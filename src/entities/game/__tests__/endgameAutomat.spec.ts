import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { soundService } from '@/shared/lib/sound'
import * as automatRules from '../lib/endgameAutomatRules'
import * as hopelessRules from '../lib/endgameHopelessRules'
import { enginePlayService } from '../lib/EnginePlayService'
import { useBoardStore } from '../model/board.store'
import type { EndgameAutomatPromptRequest } from '../model/EndgameAutomatController'
import type { EndgameHopelessPromptRequest } from '../model/EndgameHopelessController'
import { useGameStore } from '../model/game.store'
import { PuzzleStrategy, type PuzzlePuzzle } from '../model/PuzzleStrategy'

vi.mock('@/shared/lib/sound', () => ({
  soundService: {
    play: vi.fn(),
  },
  registerVolumeProvider: vi.fn(),
}))

function createPuzzle(overrides: Partial<PuzzlePuzzle>): PuzzlePuzzle {
  const fen = overrides.initial_fen ?? '8/4P3/4K3/8/8/8/8/6k1 w - - 0 1'
  return {
    puzzle_id: 'AUTO-TEST-1',
    puzzle_type: 'theoretical_endgames',
    category: 'pawnEnding',
    domain: 'PAWN',
    difficulty: 'Novice',
    rating: 1200,
    strategy: 'playOutOnly',
    first_move: 'user',
    user_color: 'white',
    objective: 'win',
    initial_fen: fen,
    puzzle_fen: overrides.puzzle_fen ?? fen,
    ...overrides,
  }
}

describe('Endgame Automat — Universal Material & EndingFEN Rules', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('accepts <= 5-piece positions with lone bot king and >= 1 user heavy piece', () => {
    // 3 pieces: K+Q vs K, K+R vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/8/2K5/3Q4 w - - 0 1', 'white')).toBe(true)
    expect(automatRules.isAutomatMaterial('8/8/8/4K3/8/8/2k5/3r4 b - - 0 1', 'black')).toBe(true)
    // 4 pieces: K+2R vs K, K+R+B vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2R5/2K5/3R4 w - - 0 1', 'white')).toBe(true)
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2B5/2K5/3R4 w - - 0 1', 'white')).toBe(true)
    // 5 pieces: K+R+2P vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2P5/2K2P2/3R4 w - - 0 1', 'white')).toBe(
      true,
    )
  })

  it('rejects minor-piece mates (K+B+N, K+2B), pawn-only, non-lone bot king, and > 5 pieces', () => {
    // K+B+N vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2B1N3/2K5/8 w - - 0 1', 'white')).toBe(
      false,
    )
    // K+B+B vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2B1B3/2K5/8 w - - 0 1', 'white')).toBe(
      false,
    )
    // K+2P vs K
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/8/2P1P3/2K5/8 w - - 0 1', 'white')).toBe(
      false,
    )
    // K+Q vs K+P (bot king not alone)
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/4p3/8/2K5/3Q4 w - - 0 1', 'white')).toBe(
      false,
    )
    // 6 pieces: K+R+3P vs K (> 5 Gaviota limit)
    expect(automatRules.isAutomatMaterial('8/8/8/4k3/1P6/2P5/2K2P2/3R4 w - - 0 1', 'white')).toBe(
      false,
    )
  })

  it('blocks Automat when starting EndingFEN was already an Automat position', () => {
    // Elementary mate puzzle starting as K+Q vs K (in theoretical_endgames or batch_01)
    const elementaryQueen = createPuzzle({
      initial_fen: '8/8/8/8/5k2/8/8/K2Q4 w - - 0 1',
      puzzle_fen: '8/8/8/8/5k2/8/8/K2Q4 w - - 0 1',
    })
    expect(
      automatRules.isEligibleForEndgameAutomat({
        puzzle: elementaryQueen,
        currentFen: '8/8/8/4k3/8/8/1K6/3Q4 w - - 2 2',
        humanColor: 'white',
        isPlayoutMode: true,
        objective: 'win',
        isGameOver: false,
      }),
    ).toBe(false)

    // Starting as K+Q+P vs K -> even after promoting to K+Q+Q vs K, remains blocked
    const queenPawnVsLoneKing = createPuzzle({
      initial_fen: '7K/6P1/8/8/1k6/8/2Q5/8 b - - 0 1',
      puzzle_fen: '7K/6P1/8/8/1k6/8/2Q5/8 b - - 0 1',
      first_move: 'bot',
      user_color: 'white',
    })
    expect(
      automatRules.isEligibleForEndgameAutomat({
        puzzle: queenPawnVsLoneKing,
        currentFen: '6QK/8/8/8/2k5/8/2Q5/8 w - - 1 3',
        humanColor: 'white',
        isPlayoutMode: true,
        objective: 'win',
        isGameOver: false,
      }),
    ).toBe(false)
  })

  it('allows Automat after transforming K+P vs K -> K+Q vs K on human turn only', () => {
    const pawnPuzzle = createPuzzle({
      initial_fen: '8/4P3/4K3/8/8/8/8/6k1 w - - 0 1',
      puzzle_fen: '8/4P3/4K3/8/8/8/8/6k1 w - - 0 1',
    })

    // Right after e8=Q, it is Black's turn -> must NOT trigger before bot replies!
    expect(
      automatRules.isEligibleForEndgameAutomat({
        puzzle: pawnPuzzle,
        currentFen: '4Q3/8/4K3/8/8/8/8/6k1 b - - 0 1',
        humanColor: 'white',
        isPlayoutMode: true,
        objective: 'win',
        isGameOver: false,
      }),
    ).toBe(false)

    // After Black plays Kf2, it is White's turn with K+Q vs K -> ELIGIBLE!
    expect(
      automatRules.isEligibleForEndgameAutomat({
        puzzle: pawnPuzzle,
        currentFen: '4Q3/8/4K3/8/8/8/5k2/8 w - - 1 2',
        humanColor: 'white',
        isPlayoutMode: true,
        objective: 'win',
        isGameOver: false,
      }),
    ).toBe(true)
  })

  it('computes monotonically accelerating step delays from 750ms down to 250ms', () => {
    // 1-ply mate in 1 -> 750ms
    expect(automatRules.computeAutomatStepDelayMs(0, 1)).toBe(750)

    // 5-ply mate in 3 -> 750, 625, 500, 375, 250
    const delays5 = [0, 1, 2, 3, 4].map((idx) => automatRules.computeAutomatStepDelayMs(idx, 5))
    expect(delays5).toEqual([750, 625, 500, 375, 250])

    // Strict Fail-Fast on out-of-range indices
    expect(() => automatRules.computeAutomatStepDelayMs(-1, 5)).toThrow()
    expect(() => automatRules.computeAutomatStepDelayMs(5, 5)).toThrow()
    expect(() => automatRules.computeAutomatStepDelayMs(0, 0)).toThrow()
  })

  it('opens prompt in "unknown" mode, enforces 200ms piece animation override, and delivers Gaviota checkmate', async () => {
    vi.useFakeTimers()
    try {
      const gameStore = useGameStore()
      const boardStore = useBoardStore()
      boardStore.animationDurationMs = 0

      // White Kf6, Pd7 vs Black Kh7: 1. d8=Q -> bot Kh6 -> 2. Qh8# (mate in 1 move = 1 ply)
      const startFen = '8/3P3k/5K2/8/8/8/8/8 w - - 0 1'
      const puzzle = createPuzzle({ initial_fen: startFen, puzzle_fen: startFen })

      vi.spyOn(enginePlayService, 'getBestMove').mockResolvedValueOnce({
        bestMove: 'h7h6',
        playerTablebase: { wdl: 1, dtm: 1, fideLost: false },
      })
      vi.spyOn(automatRules, 'fetchGaviotaAutomatLine').mockResolvedValueOnce({
        eligible: true,
        mate_in_moves: 1,
        dtm_plies: 1,
        uci_line: ['d8h8'],
        source: 'gaviota',
      })

      let capturedPrompt: EndgameAutomatPromptRequest | null = null
      const onSuccess = vi.fn()

      const strategy = new PuzzleStrategy(puzzle, 'white', 'theoretical_endgames', {
        delays: { botDelayMs: 0, initialBotDelayMs: 0 },
        onSuccess,
        automat: {
          getMode: () => 'unknown',
          onPromptOpen: (prompt) => {
            capturedPrompt = prompt
          },
        },
      })

      gameStore.startWithStrategy(startFen, strategy, 'white')
      vi.spyOn(boardStore, 'prepareUserUciMove').mockResolvedValueOnce('d7d8q')

      await gameStore.handleUserMove('d7', 'd8')

      expect(capturedPrompt).not.toBeNull()
      expect(capturedPrompt!.mateInMoves).toBe(1)
      expect(strategy.validateUserMove()).toBe(false)
      expect(boardStore.animationDurationOverrideMs).toBeNull()
      expect(onSuccess).not.toHaveBeenCalled()

      capturedPrompt!.accept()

      // Immediately after accept, 200ms animation override is active while waiting 750ms pre-move delay
      expect(boardStore.animationDurationOverrideMs).toBe(automatRules.AUTOMAT_ANIMATION_MS)
      await vi.advanceTimersByTimeAsync(749)
      expect(boardStore.chessPosition.isCheckmate()).toBe(false)

      // At 750ms the mating move executes on the board, then waits 200ms for the piece slide
      await vi.advanceTimersByTimeAsync(1)
      expect(boardStore.chessPosition.isCheckmate()).toBe(true)
      expect(boardStore.animationDurationOverrideMs).toBe(automatRules.AUTOMAT_ANIMATION_MS)
      expect(onSuccess).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(automatRules.AUTOMAT_ANIMATION_MS)
      expect(boardStore.animationDurationOverrideMs).toBeNull()
      expect(onSuccess).toHaveBeenCalledWith('checkmate_automat', {
        firstMoveFailed: false,
        failStage: 'none',
        outcomeReason: 'checkmate_automat',
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('silently falls back to manual playout when Gaviota is unavailable (Zero-Fallback)', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    const startFen = '8/3P3k/5K2/8/8/8/8/8 w - - 0 1'
    const puzzle = createPuzzle({ initial_fen: startFen, puzzle_fen: startFen })

    vi.spyOn(enginePlayService, 'getBestMove').mockResolvedValueOnce({
      bestMove: 'h7h6',
      playerTablebase: { wdl: 1, dtm: 1, fideLost: false },
    })
    vi.spyOn(automatRules, 'fetchGaviotaAutomatLine').mockResolvedValueOnce(null)

    const onPromptOpen = vi.fn()
    const onSuccess = vi.fn()

    const strategy = new PuzzleStrategy(puzzle, 'white', 'theoretical_endgames', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      onSuccess,
      automat: {
        getMode: () => 'on',
        onPromptOpen,
      },
    })

    gameStore.startWithStrategy(startFen, strategy, 'white')
    vi.spyOn(boardStore, 'prepareUserUciMove').mockResolvedValueOnce('d7d8q')

    await gameStore.handleUserMove('d7', 'd8')

    expect(onPromptOpen).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(strategy.validateUserMove()).toBe(true)
    expect(gameStore.gamePhase).toBe('PLAYING')
  })

  it('evaluates playerTablebase hopeless WDL verdicts accurately (including FIDE 50-move fideLost flag)', () => {
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'win',
        tablebase: { wdl: 0, dtm: 0, fideLost: false },
      }),
    ).toBe('draw_when_win_required')
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'win',
        tablebase: { wdl: -1, dtm: -14, fideLost: true },
      }),
    ).toBe('lost_position')
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'win',
        tablebase: { wdl: 1, dtm: null, fideLost: false },
      }),
    ).toBeNull()
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'hold_draw',
        tablebase: { wdl: 0, dtm: 0, fideLost: false },
      }),
    ).toBeNull()
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'hold_draw',
        tablebase: { wdl: -1, dtm: -20, fideLost: true },
      }),
    ).toBe('lost_position')

    // Blessed loss (fideLost: false) -> player can claim FIDE 50-move draw, so NOT hopeless!
    expect(
      hopelessRules.evaluateHopelessVerdict({
        objective: 'hold_draw',
        tablebase: { wdl: -1, dtm: -20, fideLost: false },
      }),
    ).toBeNull()
  })

  it('plays you_will_never_win and opens Hopeless modal directly from /bestmove playerTablebase, then unlocks on "suffer"', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // White plays Ke3->d4?? allowing Black Ke7! opposition draw (3 pieces, objective=win)
    const startFen = '4k3/8/8/8/4P3/4K3/8/8 w - - 0 1'
    const puzzle = createPuzzle({ initial_fen: startFen, puzzle_fen: startFen, objective: 'win' })

    const bestMoveSpy = vi.spyOn(enginePlayService, 'getBestMove').mockResolvedValue({
      bestMove: 'e8e7',
      mode: 'leelaHoldDraw',
      source: 'tablebase_only_move',
      playerTablebase: { wdl: 0, dtm: 0, fideLost: false },
    })

    let capturedHopeless: EndgameHopelessPromptRequest | null = null

    const strategy = new PuzzleStrategy(puzzle, 'white', 'theoretical_endgames', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      hopeless: {
        isEnabled: () => true,
        onPromptOpen: (prompt) => {
          capturedHopeless = prompt
        },
      },
    })

    gameStore.startWithStrategy(startFen, strategy, 'white')
    vi.spyOn(boardStore, 'prepareUserUciMove').mockResolvedValueOnce('e3d4')

    await gameStore.handleUserMove('e3', 'd4')

    expect(bestMoveSpy).toHaveBeenCalledTimes(1)
    expect(soundService.play).toHaveBeenCalledWith(
      'coach_never_win',
      'GameAudioEngine.hopelessVerdict',
    )
    expect(capturedHopeless).not.toBeNull()
    expect(capturedHopeless!.verdict).toBe('draw_when_win_required')
    expect(strategy.validateUserMove()).toBe(false)

    // User clicks "Страдать" -> unlocks board and suppresses repeat modal on next turn
    capturedHopeless!.suffer()
    capturedHopeless = null
    expect(strategy.validateUserMove()).toBe(true)

    bestMoveSpy.mockResolvedValueOnce({
      bestMove: 'e7d7',
      mode: 'leelaHoldDraw',
      playerTablebase: { wdl: 0, dtm: 0, fideLost: false },
    })
    vi.spyOn(boardStore, 'prepareUserUciMove').mockResolvedValueOnce('d4d5')
    await gameStore.handleUserMove('d4', 'd5')

    expect(capturedHopeless).toBeNull()
    expect(bestMoveSpy).toHaveBeenCalledTimes(2)
  })

  it('opens Hopeless modal with source="syzygy" at >= 6 pieces when backend proves a Syzygy horizon draw', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // 6-piece pawn endgame from live test: after 1. f4 gxf4+ -> White plays 2. Kf3??, Black replies 2... Ke5!
    const fen6 = '8/8/8/p4k2/P4p2/6K1/5P2/8 w - - 0 2'
    const puzzle = createPuzzle({ initial_fen: fen6, puzzle_fen: fen6, objective: 'win' })

    vi.spyOn(enginePlayService, 'getBestMove').mockResolvedValueOnce({
      bestMove: 'f5e5',
      mode: 'leelaHoldDraw',
      source: 'mozero_vetted',
      playerTablebase: { wdl: 0, dtm: 0, fideLost: false, source: 'syzygy' },
    })

    let capturedHopeless: EndgameHopelessPromptRequest | null = null
    const strategy = new PuzzleStrategy(puzzle, 'white', 'theoretical_endgames', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      hopeless: {
        isEnabled: () => true,
        onPromptOpen: (prompt) => {
          capturedHopeless = prompt
        },
      },
    })

    gameStore.startWithStrategy(fen6, strategy, 'white')
    vi.spyOn(boardStore, 'prepareUserUciMove').mockResolvedValueOnce('g3f3')

    await gameStore.handleUserMove('g3', 'f3')

    expect(capturedHopeless).not.toBeNull()
    expect(capturedHopeless!.verdict).toBe('draw_when_win_required')
    expect(capturedHopeless!.source).toBe('syzygy')
  })
})
