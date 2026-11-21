import type { PuzzlePuzzle } from '@/entities/game'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSyzygyProofUrl,
  doesMoveMatchTacticsStep,
  evaluateEndgameStockfishLine,
  evaluateLichessTablebaseVerdict,
  extractTacticsPlayerSteps,
  formatWhitePovScore,
  resolvePuzzleSolverFen,
  verifyPuzzleForReport,
  type EngineLineSnapshot,
} from '../puzzleReportVerifier'

function makeBasePuzzle(overrides: Partial<PuzzlePuzzle> = {}): PuzzlePuzzle {
  return {
    puzzle_id: 'pzl_test_1',
    puzzle_type: 'endgame_course',
    category: 'rookEnding',
    strategy: 'playOutOnly',
    first_move: 'user',
    user_color: 'white',
    objective: 'win',
    initial_fen: '4b3/8/p7/8/kPKN3P/8/8/8 w - - 0 1',
    ...overrides,
  }
}

describe('puzzleReportVerifier', () => {
  describe('buildSyzygyProofUrl', () => {
    it('formats spaces as underscores for syzygy-tables.info', () => {
      const fen = '4b3/8/p7/8/kPKN3P/8/8/8 w - - 0 1'
      expect(buildSyzygyProofUrl(fen)).toBe(
        'https://syzygy-tables.info/?fen=4b3/8/p7/8/kPKN3P/8/8/8_w_-_-_0_1',
      )
    })
  })

  describe('formatWhitePovScore', () => {
    it('keeps positive score positive when White is to move', () => {
      expect(formatWhitePovScore({ type: 'cp', value: 245 }, '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1')).toBe(
        '+2.45',
      )
      expect(formatWhitePovScore({ type: 'mate', value: 4 }, '8/8/4k3/8/4P3/4K3/8/8 w - - 0 1')).toBe(
        'M4',
      )
    })

    it('inverts raw UCI mover-POV score to White POV when Black is to move', () => {
      // Black is winning (+310 in mover POV) -> -3.10 in White POV
      expect(formatWhitePovScore({ type: 'cp', value: 310 }, '8/8/4k3/8/4p3/4K3/8/8 b - - 0 1')).toBe(
        '-3.10',
      )
      // Black is mating in 3 (+M3 in mover POV) -> -M3 in White POV
      expect(formatWhitePovScore({ type: 'mate', value: 3 }, '8/8/4k3/8/4p3/4K3/8/8 b - - 0 1')).toBe(
        '-M3',
      )
      // Exact 0.00
      expect(formatWhitePovScore({ type: 'cp', value: 0 }, '8/8/4k3/8/4p3/4K3/8/8 b - - 0 1')).toBe(
        '0.00',
      )
    })
  })

  describe('evaluateLichessTablebaseVerdict', () => {
    it('enforces strict FIDE win verdict for win objective (cursed-win is suspicious)', () => {
      expect(evaluateLichessTablebaseVerdict('win', 'win')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('maybe-win', 'win')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('cursed-win', 'win')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('draw', 'win')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('blessed-loss', 'win')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('loss', 'win')).toBe('suspicious')
    })

    it('accepts win/draw/blessed-loss for hold_draw and flags loss as suspicious', () => {
      expect(evaluateLichessTablebaseVerdict('win', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('cursed-win', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('draw', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('blessed-loss', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('loss', 'hold_draw')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('maybe-loss', 'hold_draw')).toBe('suspicious')
    })
  })

  describe('evaluateEndgameStockfishLine', () => {
    it('enforces strict wdl.win >= 995 threshold for win objective', () => {
      expect(
        evaluateEndgameStockfishLine(
          { depth: 15, score: { type: 'cp', value: 350 }, wdl: { win: 995, draw: 5, loss: 0 } },
          'win',
        ),
      ).toEqual({ isEarlyValid: true, isFinalValid: true })

      expect(
        evaluateEndgameStockfishLine(
          { depth: 20, score: { type: 'cp', value: 240 }, wdl: { win: 994, draw: 6, loss: 0 } },
          'win',
        ),
      ).toEqual({ isEarlyValid: false, isFinalValid: false })

      expect(
        evaluateEndgameStockfishLine(
          { depth: 15, score: { type: 'mate', value: 6 } },
          'win',
        ),
      ).toEqual({ isEarlyValid: true, isFinalValid: true })
    })

    it('uses mover-POV cp >= 0 for hold_draw (covers both White and Black)', () => {
      // Exact 0.00 is a valid draw at depth 20, does not early-exit at 15
      expect(
        evaluateEndgameStockfishLine(
          { depth: 15, score: { type: 'cp', value: 0 } },
          'hold_draw',
        ),
      ).toEqual({ isEarlyValid: false, isFinalValid: true })

      // +50 cp mover POV allows early exit at depth 15
      expect(
        evaluateEndgameStockfishLine(
          { depth: 15, score: { type: 'cp', value: 50 } },
          'hold_draw',
        ),
      ).toEqual({ isEarlyValid: true, isFinalValid: true })

      // Negative mover POV (-15 cp -> losing side) fails hold_draw
      expect(
        evaluateEndgameStockfishLine(
          { depth: 20, score: { type: 'cp', value: -15 } },
          'hold_draw',
        ),
      ).toEqual({ isEarlyValid: false, isFinalValid: false })
    })
  })

  describe('resolvePuzzleSolverFen & extractTacticsPlayerSteps', () => {
    it('applies bot first move when first_move === bot', () => {
      const puzzle = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'bot',
        user_color: 'white',
        initial_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
        tactical_solution: 'g8h8 e1e8',
      })
      const solverFen = resolvePuzzleSolverFen(puzzle)
      expect(solverFen).toContain('7k/5ppp/8/8/8/8/5PPP/4R1K1 w')

      const steps = extractTacticsPlayerSteps(puzzle)
      expect(steps).toHaveLength(1)
      expect(steps[0]?.expectedAlternatives).toEqual(['e1e8'])
      expect(steps[0]?.isFinalMove).toBe(true)
    })

    it('supports pipe alternatives and immediate mate on final move', () => {
      const fen = '7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1'
      expect(doesMoveMatchTacticsStep(fen, 'e1e8', ['e1e8'], true)).toBe(true)
      expect(doesMoveMatchTacticsStep(fen, 'e1e8', ['a1a8'], true)).toBe(true) // e1e8 is checkmate
      expect(doesMoveMatchTacticsStep(fen, 'e1e7', ['e1e8'], true)).toBe(false)
    })
  })

  describe('verifyPuzzleForReport integration branches', () => {
    it('uses Lichess Tablebase for <= 7 piece playOutOnly endgame and returns syzygyUrl', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: 'win' }),
      })

      const res = await verifyPuzzleForReport(makeBasePuzzle(), {
        discipline: 'endgame_course',
        fetchFn: fetchMock as unknown as typeof fetch,
      })

      expect(res.verdict).toBe('valid')
      expect(res.source).toBe('lichess_tablebase')
      expect(res.tablebaseCategory).toBe('win')
      expect(res.syzygyUrl).toBe(
        'https://syzygy-tables.info/?fen=4b3/8/p7/8/kPKN3P/8/8/8_w_-_-_0_1',
      )
    })

    it('returns network_error without false quarantine when Lichess returns 429', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
      })

      const res = await verifyPuzzleForReport(makeBasePuzzle(), {
        discipline: 'endgame_course',
        fetchFn: fetchMock as unknown as typeof fetch,
      })

      expect(res.verdict).toBe('network_error')
    })

    it('flags >7 piece endgame as suspicious if depth 20 WDL < 995 for win', async () => {
      const puzzle = makeBasePuzzle({
        puzzle_type: 'practical_chess',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
      })
      const mockSearch = vi.fn(async () => ({
        depth: 20,
        score: { type: 'cp', value: 180 },
        wdl: { win: 820, draw: 180, loss: 0 },
        bestMoveUci: 'a1d1',
      }) satisfies EngineLineSnapshot)

      const res = await verifyPuzzleForReport(puzzle, {
        discipline: 'practical_chess',
        runDepthSearchFn: mockSearch,
      })

      expect(res.verdict).toBe('suspicious')
      expect(res.source).toBe('local_stockfish')
      expect(res.whitePovEvalLabel).toBe('+1.80')
    })

    it('flags tactics_course puzzle as suspicious when Stockfish deviates from TacticalSolution', async () => {
      const puzzle = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'user',
        user_color: 'white',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
        tactical_solution: 'f1e1 f8e8 a1d1',
      })
      const mockSearch = vi.fn(async () => ({
        depth: 20,
        score: { type: 'cp', value: 45 },
        wdl: { win: 100, draw: 850, loss: 50 },
        bestMoveUci: 'a1e1',
      }) satisfies EngineLineSnapshot)

      const res = await verifyPuzzleForReport(puzzle, {
        discipline: 'tactics_course',
        runDepthSearchFn: mockSearch,
      })

      expect(res.verdict).toBe('suspicious')
      expect(res.mismatchPly).toBe(1)
      expect(res.engineBestMove).toBe('a1e1')
    })
  })
})
