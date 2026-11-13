import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enginePlayService } from '../lib/EnginePlayService'
import { useBoardStore } from '../model/board.store'
import { useGameStore } from '../model/game.store'
import {
  determineHumanColor,
  PuzzleStrategy,
  type PuzzleAttemptTelemetry,
  type PuzzlePuzzle,
} from '../model/PuzzleStrategy'

vi.mock('@/shared/lib/sound', () => ({
  soundService: {
    play: vi.fn(),
  },
  registerVolumeProvider: vi.fn(),
}))

function createEndgamePuzzle(overrides: Partial<PuzzlePuzzle>): PuzzlePuzzle {
  return {
    puzzle_id: 'TH-TEST-1',
    puzzle_type: 'theoretical_endgames',
    category: 'queenVsPawns',
    domain: 'QUEEN',
    difficulty: 'Pro',
    rating: 1650,
    strategy: 'playOutOnly',
    first_move: 'user',
    user_color: 'white',
    objective: 'hold_draw',
    initial_fen: '7k/5Q2/7K/8/8/8/8/8 w - - 0 1',
    ...overrides,
  }
}

describe('PuzzleStrategy — FIDE Hold Draw, Telemetry & Bot Ladder', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('validates user_color strictly against initial_fen + first_move (Fail-Fast)', () => {
    const valid = createEndgamePuzzle({
      initial_fen: '7k/5Q2/7K/8/8/8/8/8 b - - 0 1',
      first_move: 'bot',
      user_color: 'white',
    })
    expect(determineHumanColor(valid)).toBe('white')

    const mismatch = createEndgamePuzzle({
      initial_fen: '7k/5Q2/7K/8/8/8/8/8 w - - 0 1',
      first_move: 'user',
      user_color: 'black',
    })
    expect(() => determineHumanColor(mismatch)).toThrow(/user_color mismatch/)
  })

  it('treats stalemate as WIN for hold_draw and LOSS for win objective', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // White Qf7->g6 stalemates Black king on h8 (White Kh6, Qf7, Black Kh8)
    const fen = '7k/5Q2/7K/8/8/8/8/8 w - - 0 1'

    // 1. Hold Draw -> WIN
    const onHoldSuccess = vi.fn()
    const onHoldFailure = vi.fn()
    const holdPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'hold_draw' })
    const holdStrategy = new PuzzleStrategy(holdPuzzle, 'white', 'theoretical_endgames', {
      onSuccess: onHoldSuccess,
      onFailure: onHoldFailure,
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
    })

    gameStore.startWithStrategy(fen, holdStrategy, 'white')
    await gameStore.handleUserMove('f7', 'g6')

    expect(onHoldSuccess).toHaveBeenCalledTimes(1)
    expect(onHoldSuccess).toHaveBeenCalledWith('stalemate', {
      firstMoveFailed: false,
      failStage: 'none',
      outcomeReason: 'stalemate',
    })
    expect(onHoldFailure).not.toHaveBeenCalled()

    // 2. Win -> LOSS
    const onWinSuccess = vi.fn()
    const onWinFailure = vi.fn()
    const winPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'win' })
    const winStrategy = new PuzzleStrategy(winPuzzle, 'white', 'theoretical_endgames', {
      onSuccess: onWinSuccess,
      onFailure: onWinFailure,
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
    })

    gameStore.startWithStrategy(fen, winStrategy, 'white')
    await gameStore.handleUserMove('f7', 'g6')

    expect(onWinSuccess).not.toHaveBeenCalled()
    expect(onWinFailure).toHaveBeenCalledTimes(1)
    expect(onWinFailure).toHaveBeenCalledWith({
      firstMoveFailed: true,
      failStage: 'playout',
      outcomeReason: 'stalemate',
    })
  })

  it('treats insufficient_material as WIN for hold_draw and LOSS for win objective', async () => {
    const gameStore = useGameStore()
    // White Kxe4 captures Black's last pawn leaving K vs K
    const fen = '8/8/4k3/8/4p3/4K3/8/8 w - - 0 1'

    const onHoldSuccess = vi.fn()
    const holdPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'hold_draw' })
    gameStore.startWithStrategy(
      fen,
      new PuzzleStrategy(holdPuzzle, 'white', 'theoretical_endgames', {
        onSuccess: onHoldSuccess,
      }),
      'white',
    )
    await gameStore.handleUserMove('e3', 'e4')
    expect(onHoldSuccess).toHaveBeenCalledTimes(1)
    expect(onHoldSuccess.mock.calls[0]?.[0]).toBe('insufficient_material')

    const onWinFailure = vi.fn()
    const winPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'win' })
    gameStore.startWithStrategy(
      fen,
      new PuzzleStrategy(winPuzzle, 'white', 'theoretical_endgames', {
        onFailure: onWinFailure,
      }),
      'white',
    )
    await gameStore.handleUserMove('e3', 'e4')
    expect(onWinFailure).toHaveBeenCalledTimes(1)
    expect(onWinFailure.mock.calls[0]?.[0]).toEqual({
      firstMoveFailed: true,
      failStage: 'playout',
      outcomeReason: 'insufficient_material',
    })
  })

  it('detects FIDE 50-move rule (halfmoves >= 100) and scores hold_draw as WIN (while 100th-ply checkmate still wins)', async () => {
    const gameStore = useGameStore()

    // Non-checkmate 100th halfmove: White Ra1->a2 (halfmoves 99 -> 100)
    const draw50Fen = '7k/8/6K1/8/8/8/8/R7 w - - 99 50'
    const onHoldSuccess = vi.fn()
    const holdPuzzle = createEndgamePuzzle({ initial_fen: draw50Fen, objective: 'hold_draw' })
    gameStore.startWithStrategy(
      draw50Fen,
      new PuzzleStrategy(holdPuzzle, 'white', 'theoretical_endgames', {
        onSuccess: onHoldSuccess,
      }),
      'white',
    )
    await gameStore.handleUserMove('a1', 'a2')
    expect(onHoldSuccess).toHaveBeenCalledTimes(1)
    expect(onHoldSuccess.mock.calls[0]?.[0]).toBe('fifty_move_rule')

    // 100th halfmove is checkmate: White Ra1->a8# (halfmoves 99 -> 100, Black Kh8, White Kg6)
    const mate100Fen = '7k/8/6K1/8/8/8/8/R7 w - - 99 50'
    const onMateSuccess = vi.fn()
    const winPuzzle = createEndgamePuzzle({ initial_fen: mate100Fen, objective: 'win' })
    gameStore.startWithStrategy(
      mate100Fen,
      new PuzzleStrategy(winPuzzle, 'white', 'theoretical_endgames', {
        onSuccess: onMateSuccess,
      }),
      'white',
    )
    await gameStore.handleUserMove('a1', 'a8')
    // Wait — Kh8, Kg6, Ra8 is checkmate! Verify single-fire onSuccess('checkmate')
    expect(onMateSuccess).toHaveBeenCalledTimes(1)
    expect(onMateSuccess.mock.calls[0]?.[0]).toBe('checkmate')
  })

  it('detects FIDE threefold_repetition and scores hold_draw as WIN and win as LOSS', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    const fen = '6k1/8/6K1/8/8/8/8/R7 w - - 0 1'
    let botToggle = false
    vi.spyOn(enginePlayService, 'getBestMove').mockImplementation(async () => {
      botToggle = !botToggle
      return botToggle ? 'g8h8' : 'h8g8'
    })

    const onHoldSuccess = vi.fn()
    const holdPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'hold_draw' })
    const strategy = new PuzzleStrategy(holdPuzzle, 'white', 'theoretical_endgames', {
      onSuccess: onHoldSuccess,
      botEngineOverride: 'mozero',
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
    })

    gameStore.startWithStrategy(fen, strategy, 'white')

    // Occurrence 1 is root FEN. Repeat position twice more:
    await gameStore.handleUserMove('a1', 'b1') // bot plays g8h8
    await gameStore.handleUserMove('b1', 'a1') // bot plays h8g8 -> Occurrence 2
    await gameStore.handleUserMove('a1', 'b1') // bot plays g8h8
    await gameStore.handleUserMove('b1', 'a1') // bot plays h8g8 -> Occurrence 3!

    expect(onHoldSuccess).toHaveBeenCalledTimes(1)
    expect(onHoldSuccess.mock.calls[0]?.[0]).toBe('threefold_repetition')
    expect(enginePlayService.getBestMove).toHaveBeenCalledWith('mozero', expect.any(String))
  })

  it('always treats resignation as LOSS even in hold_draw', () => {
    const gameStore = useGameStore()
    const fen = '7k/5Q2/7K/8/8/8/8/8 w - - 0 1'

    const onSuccess = vi.fn()
    const onFailure = vi.fn()
    const holdPuzzle = createEndgamePuzzle({ initial_fen: fen, objective: 'hold_draw' })
    gameStore.startWithStrategy(
      fen,
      new PuzzleStrategy(holdPuzzle, 'white', 'theoretical_endgames', {
        onSuccess,
        onFailure,
      }),
      'white',
    )

    gameStore.handleGameResignation()

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure.mock.calls[0]?.[0]).toEqual({
      firstMoveFailed: true,
      failStage: 'playout',
      outcomeReason: 'resign',
    })
  })

  it('attributes FinishHim (scenarioPlus) failure to scenario vs playout accurately', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // White Kh6, Qf5, Black Kg8. Tactical solution: "f5d5 g8h8" -> transitions to playout!
    const fen = '6k1/8/7K/5Q2/8/8/8/8 w - - 0 1'
    const baseFinishHim: PuzzlePuzzle = {
      puzzle_id: 'FH-TEST-1',
      puzzle_type: 'finishhim',
      category: 'queenEnding',
      domain: 'QUEEN',
      difficulty: 'Master',
      rating: 2100,
      strategy: 'scenarioPlus',
      first_move: 'user',
      user_color: 'white',
      objective: 'win',
      initial_fen: fen,
      tactical_solution: 'f5d5 g8h8',
      puzzle_fen: '7k/8/7K/3Q4/8/8/8/8 w - - 2 2',
    }

    // Case A: User completes tactical_solution (f5d5 -> bot g8h8), then stalemates Black in playout (Qd5->g5) -> failStage: 'playout', firstMoveFailed: false
    let capturedTelemetryA: PuzzleAttemptTelemetry | undefined
    const strategyA = new PuzzleStrategy(baseFinishHim, 'white', 'finishhim', {
      botEngineOverride: 'mozero',
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      onFailure: (tel) => {
        capturedTelemetryA = tel
      },
    })
    gameStore.startWithStrategy(fen, strategyA, 'white')

    await gameStore.handleUserMove('f5', 'd5') // matches scenario; bot plays g8h8 -> playout starts!
    expect(strategyA.isPlayout).toBe(true)

    await gameStore.handleUserMove('d5', 'g5') // stalemates Black king on h8 during playout!
    expect(capturedTelemetryA).toEqual({
      firstMoveFailed: false,
      failStage: 'playout',
      outcomeReason: 'stalemate',
    })

    // Case B: User deviates on first move (plays Kh6->g5 instead of f5d5) and then resigns -> failStage: 'scenario', firstMoveFailed: true
    vi.spyOn(enginePlayService, 'getBestMove').mockResolvedValue('g8h8')

    let capturedTelemetryB: PuzzleAttemptTelemetry | undefined
    gameStore.startWithStrategy(
      fen,
      new PuzzleStrategy(baseFinishHim, 'white', 'finishhim', {
        botEngineOverride: 'mozero',
        delays: { botDelayMs: 0, initialBotDelayMs: 0 },
        onFailure: (tel) => {
          capturedTelemetryB = tel
        },
      }),
      'white',
    )

    await gameStore.handleUserMove('h6', 'g5') // Deviates on move 1! Bot plays g8h8 in playout.
    gameStore.handleGameResignation()

    expect(capturedTelemetryB).toEqual({
      firstMoveFailed: true,
      failStage: 'scenario',
      outcomeReason: 'resign',
    })
  })

  it('accepts both moveA and moveB in a pipe-separated Finishing Dual (moveA|moveB) in scenarioOnly', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // White Kh6, Qf5, Rc1; Black Kg8. Solution: "f5d5 g8h8 d5d7|c1c7"
    const fen = '6k1/8/7K/5Q2/8/8/8/2R5 w - - 0 1'
    const dualPuzzle: PuzzlePuzzle = {
      puzzle_id: 'DUAL-FIN-1',
      puzzle_type: 'tactics_course',
      category: 'deflection',
      domain: 'COMBINATIONAL_IDEAS',
      difficulty: 'Pro',
      rating: 1600,
      strategy: 'scenarioOnly',
      first_move: 'user',
      user_color: 'white',
      objective: 'win',
      initial_fen: fen,
      tactical_solution: 'f5d5 g8h8 d5d7|c1c7',
    }

    // Subcase 1: User plays first alternative (d5d7) on move 2 -> success!
    const onSuccess1 = vi.fn()
    const onFailure1 = vi.fn()
    const strat1 = new PuzzleStrategy(dualPuzzle, 'white', 'tactics_course', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      onSuccess: onSuccess1,
      onFailure: onFailure1,
    })
    gameStore.startWithStrategy(fen, strat1, 'white')
    await gameStore.handleUserMove('f5', 'd5')
    await gameStore.handleUserMove('d5', 'd7')
    expect(onSuccess1).toHaveBeenCalledTimes(1)
    expect(onFailure1).not.toHaveBeenCalled()

    // Subcase 2: User plays second alternative (c1c7) on move 2 -> success!
    const onSuccess2 = vi.fn()
    const onFailure2 = vi.fn()
    const strat2 = new PuzzleStrategy(dualPuzzle, 'white', 'tactics_course', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      onSuccess: onSuccess2,
      onFailure: onFailure2,
    })
    gameStore.startWithStrategy(fen, strat2, 'white')
    await gameStore.handleUserMove('f5', 'd5')
    await gameStore.handleUserMove('c1', 'c7')
    expect(onSuccess2).toHaveBeenCalledTimes(1)
    expect(onFailure2).not.toHaveBeenCalled()
  })

  it('does not leak triggerBotMove or corrupt scenarioIndex when next puzzle is launched inside onSuccess', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    // Puzzle 1: Black plays h7h5, White plays e4d5, Black plays g8f8, White plays d5a2
    const puzzle1: PuzzlePuzzle = {
      puzzle_id: 'TAC-1',
      puzzle_type: 'tactics',
      category: 'fork',
      difficulty: 'Pro',
      rating: 1500,
      strategy: 'scenarioOnly',
      first_move: 'bot',
      user_color: 'white',
      objective: 'win',
      initial_fen: '6k1/p5pp/2N5/2P5/1P2B1n1/6P1/r7/5K2 b - - 0 32',
      tactical_solution: 'h7h5 e4d5 g8f8 d5a2',
    }

    // Puzzle 2: Black plays d6b4, White plays e4f6, Black plays g7f6, White plays h4b4
    const puzzle2: PuzzlePuzzle = {
      puzzle_id: 'TAC-2',
      puzzle_type: 'tactics',
      category: 'discoveredAttack',
      difficulty: 'Pro',
      rating: 1550,
      strategy: 'scenarioOnly',
      first_move: 'bot',
      user_color: 'white',
      objective: 'win',
      initial_fen: 'r3r1k1/1bp2ppp/p1pq4/3pn3/4N2Q/8/PPP1BPPP/3RR1K1 b - - 1 16',
      tactical_solution: 'd6b4 e4f6 g7f6 h4b4',
    }

    const onPuzzle2Success = vi.fn()
    const onPuzzle2Failure = vi.fn()

    const strategy1 = new PuzzleStrategy(puzzle1, 'white', 'tactics', {
      delays: { initialBotDelayMs: 0, botDelayMs: 0 },
      onSuccess: async () => {
        const strategy2 = new PuzzleStrategy(puzzle2, 'white', 'tactics', {
          delays: { initialBotDelayMs: 20, botDelayMs: 0 },
          onSuccess: onPuzzle2Success,
          onFailure: onPuzzle2Failure,
        })
        gameStore.startWithStrategy(puzzle2.initial_fen, strategy2, 'white')
      },
    })

    gameStore.startWithStrategy(puzzle1.initial_fen, strategy1, 'white')
    // Wait for Puzzle 1's initial bot move (h7h5)
    await new Promise((r) => setTimeout(r, 5))

    await gameStore.handleUserMove('e4', 'd5')
    await gameStore.handleUserMove('d5', 'a2')

    // Wait for Puzzle 2's initial bot move (d6b4) to finish its 20ms delay
    await new Promise((r) => setTimeout(r, 35))
    expect(boardStore.fen).toContain('r3r1k1/1bp2ppp/p1p5/3pn3/1q2N2Q/8/PPP1BPPP/3RR1K1 w')

    // Now play Puzzle 2's user moves: e4f6 -> (bot g7f6) -> h4b4
    await gameStore.handleUserMove('e4', 'f6')
    expect(onPuzzle2Failure).not.toHaveBeenCalled()

    await gameStore.handleUserMove('h4', 'b4')
    expect(onPuzzle2Success).toHaveBeenCalledTimes(1)
    expect(onPuzzle2Failure).not.toHaveBeenCalled()
  })

  it('executes blunderSpy strategy (100/110 -> bot_reply from cache -> 111 userLastMove solved) without calling enginePlayService', async () => {
    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    boardStore.animationDurationMs = 0

    const engineSpy = vi.spyOn(enginePlayService, 'getBestMove')
    const fen = '6k1/8/7K/5Q2/8/8/8/2R5 w - - 0 1'

    const blunderSpyPuzzle: PuzzlePuzzle = {
      puzzle_id: 'BSPY-1',
      puzzle_type: 'tactics_course',
      course_slug: 'tactics_classical_1',
      course_id: 1,
      global_batch_id: 1,
      batch_id: 1,
      category: 'doubleAttack',
      domain: 'TACTICAL_GEOMETRY',
      strategy: 'blunderSpy',
      first_move: 'user',
      user_color: 'white',
      objective: 'win',
      initial_fen: fen,
      tactical_solution: 'f5d5 g8h8 c1c7',
    }

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, opts) => {
      const body = JSON.parse(String(opts?.body || '{}'))
      if (body.move_uci === 'f5d5') {
        return new Response(
          JSON.stringify({
            status: 'continue',
            reason: 'minefield_survived',
            state_mask: '100',
            move_ok: true,
            bot_reply: 'g8h8',
            next_fen: '7k/8/7K/3Q4/8/8/8/2R5 w - - 2 2',
            next_state: '111',
            allowed_moves: ['f5d5'],
            cache_hit: true,
          }),
          { status: 200 },
        )
      }
      if (body.move_uci === 'c1c7') {
        return new Response(
          JSON.stringify({
            status: 'solved',
            reason: 'plateau_111_completed',
            state_mask: '111',
            move_ok: true,
            bot_reply: null,
            next_fen: null,
            next_state: 'solved',
            allowed_moves: ['c1c7', 'd5d7', 'd5e5'],
            cache_hit: true,
          }),
          { status: 200 },
        )
      }
      return new Response(
        JSON.stringify({
          status: 'blunder',
          reason: 'stepped_on_mine',
          state_mask: '100',
          move_ok: false,
          bot_reply: null,
          next_fen: null,
          next_state: null,
          allowed_moves: ['f5d5'],
          cache_hit: true,
        }),
        { status: 200 },
      )
    })

    const onSuccess = vi.fn()
    const onFailure = vi.fn()
    const onStep = vi.fn()

    const strategy = new PuzzleStrategy(blunderSpyPuzzle, 'white', 'tactics_course', {
      delays: { botDelayMs: 0, initialBotDelayMs: 0 },
      onSuccess,
      onFailure,
      onBlunderSpyStep: onStep,
    })

    gameStore.startWithStrategy(fen, strategy, 'white')

    // Move 1: f5d5 -> blunderSpy returns 'continue' with bot_reply 'g8h8'
    await gameStore.handleUserMove('f5', 'd5')
    expect(onFailure).not.toHaveBeenCalled()
    expect(onSuccess).not.toHaveBeenCalled()
    expect(engineSpy).not.toHaveBeenCalled()
    // Bot reply g8h8 should have been applied on board
    expect(boardStore.fen).toContain('7k/8/7K/3Q4/8/8/8/2R5 w')

    // Move 2 (userLastMove on 111): c1c7 -> blunderSpy returns 'solved'
    await gameStore.handleUserMove('c1', 'c7')
    expect(onSuccess).toHaveBeenCalledTimes(1)
    expect(onSuccess.mock.calls[0]?.[0]).toBe('plateau_111_completed')
    expect(onStep).toHaveBeenCalledTimes(2)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(engineSpy).not.toHaveBeenCalled()
  })
})

