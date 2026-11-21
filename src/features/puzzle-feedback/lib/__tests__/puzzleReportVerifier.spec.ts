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
  toUserPovEvaluation,
  toUserTablebaseCategory,
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

describe('puzzleReportVerifier (Universal UserColor POV)', () => {
  describe('buildSyzygyProofUrl', () => {
    it('formats spaces as underscores for syzygy-tables.info', () => {
      const fen = '4b3/8/p7/8/kPKN3P/8/8/8 w - - 0 1'
      expect(buildSyzygyProofUrl(fen)).toBe(
        'https://syzygy-tables.info/?fen=4b3/8/p7/8/kPKN3P/8/8/8_w_-_-_0_1',
      )
    })
  })

  describe('toUserPovEvaluation (all 4 turn x userColor combinations)', () => {
    const whiteTurnFen = '8/7p/5kq1/3p4/2p5/2P4Q/5K1P/8 w - - 0 1'
    const blackTurnFen = '8/7p/5kq1/3p4/2p5/2P4Q/4K2P/8 b - - 1 1'

    it('1Zzf9VPs regression: White (bot) to move, Black (user) winning -> userScore +508, userWdl.win 1000, White POV -5.08', () => {
      const pov = toUserPovEvaluation(
        { type: 'cp', value: -508 },
        { win: 0, draw: 0, loss: 1000 },
        whiteTurnFen,
        'black',
      )
      expect(pov.isUserTurn).toBe(false)
      expect(pov.userScore).toEqual({ type: 'cp', value: 508 })
      expect(pov.whiteScore).toEqual({ type: 'cp', value: -508 })
      expect(pov.whitePovEvalLabel).toBe('-5.08')
      expect(pov.userWdl).toEqual({ win: 1000, draw: 0, loss: 0 })
    })

    it('Black (bot) to move, White (user) winning -> userScore +580, userWdl.win 1000, White POV +5.80', () => {
      // Raw UCI for Black-to-move losing by 5.80 is -580 cp, wdl { win: 0, draw: 0, loss: 1000 }
      const pov = toUserPovEvaluation(
        { type: 'cp', value: -580 },
        { win: 0, draw: 0, loss: 1000 },
        blackTurnFen,
        'white',
      )
      expect(pov.isUserTurn).toBe(false)
      expect(pov.userScore).toEqual({ type: 'cp', value: 580 })
      expect(pov.whiteScore).toEqual({ type: 'cp', value: 580 })
      expect(pov.whitePovEvalLabel).toBe('+5.80')
      expect(pov.userWdl).toEqual({ win: 1000, draw: 0, loss: 0 })
    })

    it('Black (user) to move, Black winning -> userScore +440, White POV -4.40', () => {
      const pov = toUserPovEvaluation(
        { type: 'cp', value: 440 },
        { win: 998, draw: 2, loss: 0 },
        blackTurnFen,
        'black',
      )
      expect(pov.isUserTurn).toBe(true)
      expect(pov.userScore).toEqual({ type: 'cp', value: 440 })
      expect(pov.whiteScore).toEqual({ type: 'cp', value: -440 })
      expect(pov.whitePovEvalLabel).toBe('-4.40')
      expect(pov.userWdl).toEqual({ win: 998, draw: 2, loss: 0 })
    })

    it('White (user) to move, White winning -> userScore +245, White POV +2.45', () => {
      expect(formatWhitePovScore({ type: 'cp', value: 245 }, whiteTurnFen)).toBe('+2.45')
      expect(formatWhitePovScore({ type: 'mate', value: 4 }, whiteTurnFen)).toBe('M4')
      expect(formatWhitePovScore({ type: 'mate', value: 3 }, blackTurnFen)).toBe('-M3')
    })
  })

  describe('toUserTablebaseCategory & evaluateLichessTablebaseVerdict', () => {
    it('inverts Syzygy category via exact FIDE duality when first_move === bot', () => {
      // F1Cv8ejN from endgame_courses_all.csv: K+Q vs k, Black (bot) to move, White (user) wins!
      const botBlackToMoveFen = '8/8/8/8/6K1/5Q2/8/6k1 b - - 0 1'
      expect(toUserTablebaseCategory('loss', botBlackToMoveFen, 'white')).toBe('win')
      expect(toUserTablebaseCategory('blessed-loss', botBlackToMoveFen, 'white')).toBe('cursed-win')
      expect(toUserTablebaseCategory('cursed-win', botBlackToMoveFen, 'white')).toBe('blessed-loss')
      expect(toUserTablebaseCategory('draw', botBlackToMoveFen, 'white')).toBe('draw')
      expect(toUserTablebaseCategory('win', botBlackToMoveFen, 'white')).toBe('loss')
    })

    it('enforces strict FIDE win & hold_draw verdicts on userCategory', () => {
      expect(evaluateLichessTablebaseVerdict('win', 'win')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('cursed-win', 'win')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('draw', 'win')).toBe('suspicious')

      expect(evaluateLichessTablebaseVerdict('win', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('cursed-win', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('draw', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('blessed-loss', 'hold_draw')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('loss', 'hold_draw')).toBe('suspicious')
    })
  })

  describe('evaluateEndgameStockfishLine', () => {
    it('enforces strict userWdl.win >= 995 for win and userScore cp >= 0 for hold_draw', () => {
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
        evaluateEndgameStockfishLine({ depth: 20, score: { type: 'cp', value: 0 } }, 'hold_draw'),
      ).toEqual({ isEarlyValid: false, isFinalValid: true })

      expect(
        evaluateEndgameStockfishLine({ depth: 20, score: { type: 'cp', value: -10 } }, 'hold_draw'),
      ).toEqual({ isEarlyValid: false, isFinalValid: false })
    })
  })

  describe('verifyPuzzleForReport end-to-end across all 3 datasets', () => {
    it('verifies practical_chess 1Zzf9VPs (first_move=bot, user_color=black, 9 pieces) as VALID', async () => {
      const puzzle1Zzf9VPs = makeBasePuzzle({
        puzzle_id: '1Zzf9VPs',
        puzzle_type: 'practical_chess',
        strategy: 'playOutOnly',
        first_move: 'bot',
        user_color: 'black',
        objective: 'win',
        initial_fen: '8/7p/5kq1/3p4/2p5/2P4Q/5K1P/8 w - - 0 1',
      })

      // Raw Stockfish UCI on White-to-move EndingFEN: White is -508 cp and 100% lost
      const mockSearch = vi.fn(async (params) => {
        expect(params.targetDepth).toBe(21) // +1 ply because bot moves first
        return {
          depth: 16,
          score: { type: 'cp', value: -508 },
          wdl: { win: 0, draw: 0, loss: 1000 },
          bestMoveUci: 'f2e2',
        } satisfies EngineLineSnapshot
      })

      const res = await verifyPuzzleForReport(puzzle1Zzf9VPs, {
        discipline: 'practical_chess',
        runDepthSearchFn: mockSearch,
      })

      expect(res.verdict).toBe('valid')
      expect(res.failureCriterion).toBeUndefined()
      expect(res.whitePovEvalLabel).toBe('-5.08')
      expect(res.wdl).toEqual({ win: 1000, draw: 0, loss: 0 })
    })

    it('verifies endgame_course F1Cv8ejN (<=7 pieces, first_move=bot, user_color=white) via inverted Syzygy category', async () => {
      const puzzleF1Cv8ejN = makeBasePuzzle({
        puzzle_id: 'F1Cv8ejN',
        puzzle_type: 'endgame_course',
        strategy: 'playOutOnly',
        first_move: 'bot',
        user_color: 'white',
        objective: 'win',
        initial_fen: '8/8/8/8/6K1/5Q2/8/6k1 b - - 0 1',
      })

      // Lichess returns 'loss' for Black (the lone king to move) -> 'win' for White (user)!
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: 'loss' }),
      })

      const res = await verifyPuzzleForReport(puzzleF1Cv8ejN, {
        discipline: 'endgame_course',
        fetchFn: fetchMock as unknown as typeof fetch,
      })

      expect(res.verdict).toBe('valid')
      expect(res.tablebaseCategory).toBe('win')
    })

    it('verifies tactics_course SAVING_DRAW playOutOnly puzzle (2AFUNHG5, hold_draw, <=7 pieces) via Syzygy', async () => {
      const savingDraw = makeBasePuzzle({
        puzzle_id: '2AFUNHG5',
        puzzle_type: 'tactics_course',
        strategy: 'playOutOnly',
        first_move: 'user',
        user_color: 'black',
        objective: 'hold_draw',
        initial_fen: '7k/5Qp1/8/7P/7K/4B1P1/8/8 b - - 0 1',
        tactical_solution: 'g7g5',
      })

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ category: 'draw' }),
      })

      const res = await verifyPuzzleForReport(savingDraw, {
        discipline: 'tactics_course',
        fetchFn: fetchMock as unknown as typeof fetch,
      })

      expect(res.verdict).toBe('valid')
      expect(res.source).toBe('lichess_tablebase')
      expect(res.tablebaseCategory).toBe('draw')
    })

    it('flags >7 piece endgame with exact failureCriterion win_wdl_below_995 when drawn', async () => {
      const drawnEndgame = makeBasePuzzle({
        puzzle_type: 'practical_chess',
        first_move: 'user',
        user_color: 'white',
        objective: 'win',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
      })

      const mockSearch = vi.fn(async () => ({
        depth: 20,
        score: { type: 'cp', value: 15 },
        wdl: { win: 50, draw: 900, loss: 50 },
        bestMoveUci: 'a1d1',
      }) satisfies EngineLineSnapshot)

      const res = await verifyPuzzleForReport(drawnEndgame, {
        discipline: 'practical_chess',
        runDepthSearchFn: mockSearch,
      })

      expect(res.verdict).toBe('suspicious')
      expect(res.failureCriterion).toBe('win_wdl_below_995')
    })

    it('flags tactics_course scenarioOnly mismatch with exact failureCriterion tactics_move_mismatch', async () => {
      const tacticsPuzzle = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'bot',
        user_color: 'white',
        initial_fen: '6k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1',
        tactical_solution: 'g8h8 a1a2',
      })

      expect(resolvePuzzleSolverFen(tacticsPuzzle)).toContain('7k/5ppp/8/8/8/8/5PPP/4R1K1 w')
      expect(extractTacticsPlayerSteps(tacticsPuzzle)).toHaveLength(1)
      expect(doesMoveMatchTacticsStep('7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', 'e1e8', ['e1e8'], true)).toBe(true)

      const mockSearch = vi.fn(async () => ({
        depth: 20,
        score: { type: 'mate', value: 1 },
        bestMoveUci: 'e1e8',
      }) satisfies EngineLineSnapshot)

      // Note: on final move, immediate mate e1e8 IS accepted even if solution wrote a1a2;
      // test non-mate mismatch:
      const nonMateMismatch = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'user',
        user_color: 'white',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
        tactical_solution: 'f1e1 f8e8 a1d1',
      })
      const mockNonMate = vi.fn(async () => ({
        depth: 20,
        score: { type: 'cp', value: 30 },
        bestMoveUci: 'a1d1',
      }) satisfies EngineLineSnapshot)

      const res = await verifyPuzzleForReport(nonMateMismatch, {
        discipline: 'tactics_course',
        runDepthSearchFn: mockNonMate,
      })

      expect(mockSearch).not.toHaveBeenCalled()
      expect(res.verdict).toBe('suspicious')
      expect(res.failureCriterion).toBe('tactics_move_mismatch')
      expect(res.mismatchPly).toBe(1)
      expect(res.engineBestMove).toBe('a1d1')
    })
  })
})
