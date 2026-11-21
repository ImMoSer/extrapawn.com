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
  type MultiPvDepthSnapshot,
  type MultiPvSearchFn,
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

/**
 * Helper simulating iterative deepening MultiPV=2 snapshots from depth 1..maxDepth,
 * invoking `shouldEarlyStop` at each depth exactly as `runLocalMultiPvSearch` does.
 */
function buildMockMultiPvSearch(
  generator: (depth: number, fen: string) => { pv1: EngineLineSnapshot; pv2: EngineLineSnapshot },
): { fn: MultiPvSearchFn; stoppedAtDepths: number[] } {
  const stoppedAtDepths: number[] = []
  const fn: MultiPvSearchFn = vi.fn(async (params) => {
    let lastMove = ''
    let stableCount = 0
    let latest: MultiPvDepthSnapshot | null = null

    for (let d = 1; d <= params.maxDepth; d++) {
      const { pv1, pv2 } = generator(d, params.fen)
      if (pv1.bestMoveUci === lastMove) {
        stableCount += 1
      } else {
        lastMove = pv1.bestMoveUci
        stableCount = 1
      }
      latest = { depth: d, pv1, pv2, pv1StableCount: stableCount }
      params.onDepthProgress(latest)
      if (d >= params.maxDepth || params.shouldEarlyStop(latest)) {
        stoppedAtDepths.push(d)
        return latest
      }
    }
    return latest
  })
  return { fn, stoppedAtDepths }
}

describe('puzzleReportVerifier (Depth-21 PlayOut & Adaptive MultiPV=2 Scenario)', () => {
  describe('buildSyzygyProofUrl & UserColor POV', () => {
    it('formats spaces as underscores for syzygy-tables.info', () => {
      const fen = '4b3/8/p7/8/kPKN3P/8/8/8 w - - 0 1'
      expect(buildSyzygyProofUrl(fen)).toBe(
        'https://syzygy-tables.info/?fen=4b3/8/p7/8/kPKN3P/8/8/8_w_-_-_0_1',
      )
    })

    it('1Zzf9VPs regression: White (bot) to move, Black (user) winning -> userScore +508, userWdl.win 1000', () => {
      const pov = toUserPovEvaluation(
        { type: 'cp', value: -508 },
        { win: 0, draw: 0, loss: 1000 },
        '8/7p/5kq1/3p4/2p5/2P4Q/5K1P/8 w - - 0 1',
        'black',
      )
      expect(pov.isUserTurn).toBe(false)
      expect(pov.userScore).toEqual({ type: 'cp', value: 508 })
      expect(pov.whitePovEvalLabel).toBe('-5.08')
      expect(pov.userWdl).toEqual({ win: 1000, draw: 0, loss: 0 })
    })

    it('formats White-POV cp and mate labels', () => {
      const whiteTurnFen = '8/7p/5kq1/3p4/2p5/2P4Q/5K1P/8 w - - 0 1'
      const blackTurnFen = '8/7p/5kq1/3p4/2p5/2P4Q/4K2P/8 b - - 1 1'
      expect(formatWhitePovScore({ type: 'cp', value: 245 }, whiteTurnFen)).toBe('+2.45')
      expect(formatWhitePovScore({ type: 'mate', value: 4 }, whiteTurnFen)).toBe('M4')
      expect(formatWhitePovScore({ type: 'mate', value: 3 }, blackTurnFen)).toBe('-M3')
    })

    it('inverts Syzygy category via exact FIDE duality when first_move === bot', () => {
      const botBlackToMoveFen = '8/8/8/8/6K1/5Q2/8/6k1 b - - 0 1'
      expect(toUserTablebaseCategory('loss', botBlackToMoveFen, 'white')).toBe('win')
      expect(toUserTablebaseCategory('blessed-loss', botBlackToMoveFen, 'white')).toBe('cursed-win')
      expect(evaluateLichessTablebaseVerdict('win', 'win')).toBe('valid')
      expect(evaluateLichessTablebaseVerdict('cursed-win', 'win')).toBe('suspicious')
      expect(evaluateLichessTablebaseVerdict('blessed-loss', 'hold_draw')).toBe('valid')
    })
  })

  describe('PlayOutOnly (>7 pieces): strict fixed depth 21 with zero early exit', () => {
    it('enforces strict userWdl.win >= 995 for win and userScore cp >= 0 for hold_draw', () => {
      expect(
        evaluateEndgameStockfishLine(
          { score: { type: 'cp', value: 350 }, wdl: { win: 995, draw: 5, loss: 0 } },
          'win',
        ),
      ).toBe(true)
      expect(
        evaluateEndgameStockfishLine(
          { score: { type: 'cp', value: 240 }, wdl: { win: 994, draw: 6, loss: 0 } },
          'win',
        ),
      ).toBe(false)
      expect(evaluateEndgameStockfishLine({ score: { type: 'cp', value: 0 } }, 'hold_draw')).toBe(
        true,
      )
      expect(evaluateEndgameStockfishLine({ score: { type: 'cp', value: -10 } }, 'hold_draw')).toBe(
        false,
      )
    })

    it('always searches strictly to depth 21 even when user_move is first (no early exit)', async () => {
      const userFirstPlayOut = makeBasePuzzle({
        puzzle_id: 'endgame_9p_user',
        puzzle_type: 'endgame_course',
        strategy: 'playOutOnly',
        first_move: 'user',
        user_color: 'white',
        objective: 'win',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
      })

      const mockSearch = vi.fn(async (params) => {
        expect(params.targetDepth).toBe(21)
        return {
          depth: 21,
          score: { type: 'cp', value: 520 },
          wdl: { win: 998, draw: 2, loss: 0 },
          bestMoveUci: 'a1d1',
        } satisfies EngineLineSnapshot
      })

      const res = await verifyPuzzleForReport(userFirstPlayOut, {
        discipline: 'endgame_course',
        runDepthSearchFn: mockSearch,
      })

      expect(res.verdict).toBe('valid')
      expect(res.depth).toBe(21)
    })

    it('verifies practical_chess 1Zzf9VPs (first_move=bot, user_color=black) at depth 21 as VALID', async () => {
      const puzzle1Zzf9VPs = makeBasePuzzle({
        puzzle_id: '1Zzf9VPs',
        puzzle_type: 'practical_chess',
        strategy: 'playOutOnly',
        first_move: 'bot',
        user_color: 'black',
        objective: 'win',
        initial_fen: '8/7p/5kq1/3p4/2p5/2P4Q/5K1P/8 w - - 0 1',
      })

      const mockSearch = vi.fn(async (params) => {
        expect(params.targetDepth).toBe(21)
        return {
          depth: 21,
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
      expect(res.depth).toBe(21)
      expect(res.whitePovEvalLabel).toBe('-5.08')
    })
  })

  describe('ScenarioOnly (CreateTacticKURS MultiPV=2 adaptive depth 15..24)', () => {
    const standardTacticsPuzzle = makeBasePuzzle({
      puzzle_id: 'tac_std',
      puzzle_type: 'tactics_course',
      strategy: 'scenarioOnly',
      first_move: 'user',
      user_color: 'white',
      objective: 'win',
      initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w - - 0 1',
      tactical_solution: 'f1e1',
    })

    it('skips Stockfish completely (0 calls) when user has strictly 1 legal move matching scenario', async () => {
      // White: Kh1, Qa1, Pg2, Ph2; Black: Kb8, Bb6 (defending g1), Rg1+ -> ONLY legal move is Qxg1 (a1g1)
      const soleLegalPuzzle = makeBasePuzzle({
        puzzle_id: 'tac_sole_legal',
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'user',
        user_color: 'white',
        objective: 'win',
        initial_fen: '1k6/8/1b6/8/8/8/6PP/Q5rK w - - 0 1',
        tactical_solution: 'a1g1',
      })

      const steps = extractTacticsPlayerSteps(soleLegalPuzzle)
      expect(steps).toHaveLength(1)
      expect(steps[0]!.isSingleLegalMove).toBe(true)

      const mockMultiPv = vi.fn()
      const res = await verifyPuzzleForReport(soleLegalPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: mockMultiPv,
      })

      expect(mockMultiPv).not.toHaveBeenCalled()
      expect(res.verdict).toBe('valid')
    })

    it('confirms clear Only Move early at depth 15 when PV1 wins and PV2 is refuted', async () => {
      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: 540 },
          wdl: { win: 995, draw: 5, loss: 0 },
          bestMoveUci: 'f1e1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: -80 },
          wdl: { win: 40, draw: 600, loss: 360 },
          bestMoveUci: 'a1d1',
        },
      }))

      const res = await verifyPuzzleForReport(standardTacticsPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(res.verdict).toBe('valid')
      expect(stoppedAtDepths).toEqual([15])
      expect(res.depth).toBe(15)
    })

    it('breaks horizon effect: 0.00 at depth 20 -> +700 cp at depth 21 escalates past 20 and validates at 21', async () => {
      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: d <= 20 ? 0 : 700 },
          wdl: d <= 20 ? { win: 80, draw: 840, loss: 80 } : { win: 999, draw: 1, loss: 0 },
          bestMoveUci: 'f1e1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: -40 },
          wdl: { win: 50, draw: 750, loss: 200 },
          bestMoveUci: 'a1d1',
        },
      }))

      const res = await verifyPuzzleForReport(standardTacticsPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(res.verdict).toBe('valid')
      expect(stoppedAtDepths).toEqual([21])
      expect(res.depth).toBe(21)
      expect(res.whitePovEvalLabel).toBe('+7.00')
    })

    it('refutes false tempting PV2 try: PV2 looks +250 cp at d<=20, collapses to +30 cp at d=22 -> VALID at d=22', async () => {
      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: 550 },
          wdl: { win: 996, draw: 4, loss: 0 },
          bestMoveUci: 'f1e1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: d <= 21 ? 250 : 30 },
          wdl: d <= 21 ? { win: 780, draw: 210, loss: 10 } : { win: 110, draw: 850, loss: 40 },
          bestMoveUci: 'a1d1',
        },
      }))

      const res = await verifyPuzzleForReport(standardTacticsPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(res.verdict).toBe('valid')
      expect(stoppedAtDepths).toEqual([22])
    })

    it('flags genuine dual winning PV2 (+5.20 at depth 24) as SUSPICIOUS tactics_dual_move and reports PV2 move', async () => {
      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: 540 },
          wdl: { win: 997, draw: 3, loss: 0 },
          bestMoveUci: 'f1e1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: 520 },
          wdl: { win: 995, draw: 5, loss: 0 },
          bestMoveUci: 'a1d1',
        },
      }))

      const res = await verifyPuzzleForReport(standardTacticsPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(stoppedAtDepths).toEqual([24])
      expect(res.verdict).toBe('suspicious')
      expect(res.failureCriterion).toBe('tactics_dual_move')
      expect(res.engineBestMove).toBe('a1d1') // Dual move recorded for NocoDB!
      expect(res.userScore).toEqual({ type: 'cp', value: 520 })
    })

    it('flags scenario move that remains 0.00 (+15 cp) even at depth 24 as tactics_eval_insufficient', async () => {
      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: 15 },
          wdl: { win: 90, draw: 850, loss: 60 },
          bestMoveUci: 'f1e1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: -250 },
          wdl: { win: 5, draw: 295, loss: 700 },
          bestMoveUci: 'a1d1',
        },
      }))

      const res = await verifyPuzzleForReport(standardTacticsPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(stoppedAtDepths).toEqual([24])
      expect(res.verdict).toBe('suspicious')
      expect(res.failureCriterion).toBe('tactics_eval_insufficient')
    })

    it('flags move mismatch at depth 24 with tactics_move_mismatch', async () => {
      const mismatchPuzzle = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'bot',
        user_color: 'white',
        initial_fen: 'r4rk1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 b - - 0 1',
        tactical_solution: 'f8e8 f1e1',
      })
      expect(resolvePuzzleSolverFen(mismatchPuzzle)).toContain('r3r1k1/ppp2ppp/8/8/8/8/PPP2PPP/R4RK1 w')
      expect(doesMoveMatchTacticsStep('7k/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1', 'e1e8', ['a1a2'], true)).toBe(
        true,
      )

      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'cp', value: 450 },
          wdl: { win: 990, draw: 10, loss: 0 },
          bestMoveUci: 'a1d1',
        },
        pv2: {
          depth: d,
          score: { type: 'cp', value: -100 },
          wdl: { win: 20, draw: 580, loss: 400 },
          bestMoveUci: 'f1e1',
        },
      }))

      const res = await verifyPuzzleForReport(mismatchPuzzle, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(stoppedAtDepths).toEqual([24])
      expect(res.verdict).toBe('suspicious')
      expect(res.failureCriterion).toBe('tactics_move_mismatch')
      expect(res.mismatchPly).toBe(2)
      expect(res.engineBestMove).toBe('a1d1')
    })

    it('accepts alternative immediate checkmate (#1) on final ply without false dual flag', async () => {
      // Back-rank position where both Re8# and Rd8# (say Queen on d1 and Rook on e1 vs lone Kh8 behind g7,h7) deliver immediate mate in 1 on final ply
      const dualMateIn1FinalPly = makeBasePuzzle({
        puzzle_type: 'tactics_course',
        strategy: 'scenarioOnly',
        first_move: 'user',
        user_color: 'white',
        initial_fen: '7k/6pp/8/8/8/8/6PP/3QR1K1 w - - 0 1',
        tactical_solution: 'e1e8',
      })

      const { fn, stoppedAtDepths } = buildMockMultiPvSearch((d) => ({
        pv1: {
          depth: d,
          score: { type: 'mate', value: 1 },
          wdl: { win: 1000, draw: 0, loss: 0 },
          bestMoveUci: 'e1e8',
        },
        pv2: {
          depth: d,
          score: { type: 'mate', value: 1 },
          wdl: { win: 1000, draw: 0, loss: 0 },
          bestMoveUci: 'd1d8',
        },
      }))

      const res = await verifyPuzzleForReport(dualMateIn1FinalPly, {
        discipline: 'tactics_course',
        runMultiPvSearchFn: fn,
      })

      expect(res.verdict).toBe('valid')
      expect(stoppedAtDepths).toEqual([8])
    })
  })
})
