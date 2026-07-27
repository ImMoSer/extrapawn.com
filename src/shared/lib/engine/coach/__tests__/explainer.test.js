import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import {
  winRate,
  getPSTValue,
  _see,
  _detectSkewer,
  _detectSacrificeViaSEE,
  explainMove,
} from '../explainer.js';

// ─────────────────────────────────────────────────────────────────────
// Win-rate sigmoid (Lichess-exact)
// ─────────────────────────────────────────────────────────────────────

describe('winRate', () => {
  it('returns 50 at zero', () => {
    expect(winRate(0)).toBeCloseTo(50, 5);
  });

  it('is monotonically increasing in cp', () => {
    const samples = [-1000, -500, -200, -50, 0, 50, 200, 500, 1000];
    for (let i = 1; i < samples.length; i++) {
      expect(winRate(samples[i])).toBeGreaterThan(winRate(samples[i - 1]));
    }
  });

  it('clamps |cp| to 1000', () => {
    expect(winRate(2000)).toBe(winRate(1000));
    expect(winRate(-2000)).toBe(winRate(-1000));
  });

  it('matches Lichess for a few known anchor points', () => {
    // Coefficient is 0.00368208. At cp = +200 → ≈ 67.6%; at cp = +500 → ≈ 86.3%.
    expect(winRate(200)).toBeGreaterThan(67);
    expect(winRate(200)).toBeLessThan(69);
    expect(winRate(500)).toBeGreaterThan(85);
    expect(winRate(500)).toBeLessThan(87);
  });
});

// ─────────────────────────────────────────────────────────────────────
// PST values
// ─────────────────────────────────────────────────────────────────────

describe('getPSTValue', () => {
  it('uses mirrored tables for white vs black', () => {
    // White pawn on e4: PST gives 20. Black pawn on e5 (mirrored) also 20.
    const whiteE4 = getPSTValue('p', 'e4', 'w');
    const blackE5 = getPSTValue('p', 'e5', 'b');
    expect(whiteE4).toBe(20);
    expect(blackE5).toBe(20);
  });

  it('returns 0 for unknown pieces', () => {
    expect(getPSTValue('z', 'a1', 'w')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// SEE
// ─────────────────────────────────────────────────────────────────────

describe('_see (Static Exchange Evaluation)', () => {
  it('returns 0 when the square is empty', () => {
    const c = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(_see(c, 'e4', 'w')).toBe(0);
  });

  it('captures a hanging pawn for free (gain ~100cp)', () => {
    // Black pawn on e5; white pawn on d4 attacks; nothing defends.
    const c = new Chess('4k3/8/8/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(_see(c, 'e5', 'w')).toBe(100);
  });

  it('reports a balanced trade as 0 net gain', () => {
    // White pawn on d4 attacks black pawn on e5; black pawn on f6
    // defends. After PxP, ...PxP — break-even (100 - 100 = 0).
    const c = new Chess('4k3/8/5p2/4p3/3P4/8/8/4K3 w - - 0 1');
    expect(_see(c, 'e5', 'w')).toBe(0);
  });

  it('returns 0 when there are no attackers (defended-only piece)', () => {
    const c = new Chess('4k3/8/8/4p3/8/8/8/4K3 w - - 0 1');
    expect(_see(c, 'e5', 'w')).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Skewer detector
// ─────────────────────────────────────────────────────────────────────

describe('_detectSkewer', () => {
  it('detects king-in-front-of-queen as a skewer', () => {
    // Black king on e7 and queen on e8; white rook moves to e1 attacking
    // the king with the queen behind it.
    const fenAfter = '4q3/4k3/8/8/8/8/8/4R1K1 b - - 0 1';
    const after = new Chess(fenAfter);
    const result = _detectSkewer(after, 'e1', { type: 'r', color: 'w' });
    expect(result).not.toBeNull();
    expect(result.skewered.type).toBe('k');
    expect(result.behind.type).toBe('q');
  });

  it('does NOT report queen-in-front-of-king as a skewer (it is a pin)', () => {
    // Black queen on e7 and king on e8; this is a pin, not a skewer.
    const fenAfter = '4k3/4q3/8/8/8/8/8/4R1K1 b - - 0 1';
    const after = new Chess(fenAfter);
    const result = _detectSkewer(after, 'e1', { type: 'r', color: 'w' });
    expect(result).toBeNull();
  });

  it('returns null for non-sliding pieces', () => {
    const c = new Chess('4k3/4q3/8/8/8/8/8/4R1K1 w - - 0 1');
    expect(_detectSkewer(c, 'e1', { type: 'n', color: 'w' })).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────
// SEE-based sacrifice detector
// ─────────────────────────────────────────────────────────────────────

describe('_detectSacrificeViaSEE', () => {
  it('flags a clearly losing capture as a sacrifice', () => {
    // Construct the post-move state directly. White knight just took
    // a pawn on f7 ("Nxf7+"), but the black king on e8 can recapture.
    // Net: +100 (pawn captured) − 300 (knight lost) = −200 → sacrifice.
    const sacFen = 'rnbqkb1r/ppppp1pp/5n2/8/8/8/PPPPPPPP/RNBQKB1R b KQkq - 0 1';
    const afterState = new Chess(sacFen);
    afterState.put({ type: 'n', color: 'w' }, 'f7');
    const movingPiece = { type: 'n', color: 'w' };
    const capturedPiece = { type: 'p', color: 'b' };
    expect(_detectSacrificeViaSEE(afterState, 'f7', movingPiece, capturedPiece)).toBe(true);
  });

  it('does NOT flag a balanced trade as a sacrifice', () => {
    // White pawn captures defended black pawn — balanced exchange.
    const fenBefore = '4k3/8/5p2/4p3/3P4/8/8/4K3 w - - 0 1';
    const after = new Chess(fenBefore);
    after.move({ from: 'd4', to: 'e5' });
    const movingPiece = { type: 'p', color: 'w' };
    const capturedPiece = { type: 'p', color: 'b' };
    expect(_detectSacrificeViaSEE(after, 'e5', movingPiece, capturedPiece)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────
// explainMove (top-level integration with engine top-moves stub)
// ─────────────────────────────────────────────────────────────────────

describe('explainMove', () => {
  it('classifies a played top-1 move as best', () => {
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenAfter = makeMoveFen(fenBefore, 'e2', 'e4');
    const result = explainMove(fenBefore, fenAfter, 'e2e4', 25, -25, {
      // mover-POV scores, e2e4 is the engine's top choice.
      topMoves: [
        { rank: 1, move: 'e2e4', score: 25, cp: 25, mate: null, isMate: false, pv: ['e2e4'] },
        { rank: 2, move: 'd2d4', score: 22, cp: 22, mate: null, isMate: false, pv: ['d2d4'] },
        { rank: 3, move: 'c2c4', score: 18, cp: 18, mate: null, isMate: false, pv: ['c2c4'] },
      ],
    });
    expect(result.quality).toBe('best');
    expect(result.isBestMove).toBe(true);
  });

  it('classifies a top-3 alternative within 4pp loss as excellent', () => {
    // Tight scores: best=25, played≈20 (mover POV). With cp ≈ 20-25 the
    // win-rate sigmoid yields a loss < 4pp → `excellent` classification.
    // We pass eval-after as -20 (white POV, after black's reply); that
    // matches winRate(-20) ≈ 48.2 vs winRate(25) ≈ 52.3 → loss ≈ 4.1pp,
    // close to the boundary. Bump played slightly higher to clear it.
    const fenBefore = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const fenAfter = makeMoveFen(fenBefore, 'd2', 'd4');
    const result = explainMove(fenBefore, fenAfter, 'd2d4', 25, -10, {
      topMoves: [
        { rank: 1, move: 'e2e4', score: 25, cp: 25, mate: null, isMate: false, pv: ['e2e4'] },
        { rank: 2, move: 'd2d4', score: 24, cp: 24, mate: null, isMate: false, pv: ['d2d4'] },
        { rank: 3, move: 'c2c4', score: 22, cp: 22, mate: null, isMate: false, pv: ['c2c4'] },
      ],
    });
    expect(result.quality).toBe('excellent');
  });

  it('reports checkmate as best and motif checkmate', () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4#
    let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    fen = makeMoveFen(fen, 'f2', 'f3');
    fen = makeMoveFen(fen, 'e7', 'e5');
    fen = makeMoveFen(fen, 'g2', 'g4');
    const fenAfter = makeMoveFen(fen, 'd8', 'h4');
    const result = explainMove(fen, fenAfter, 'd8h4', 0, -10000, {
      topMoves: [{ rank: 1, move: 'd8h4', score: 100000, mate: 1, isMate: true, pv: ['d8h4'] }],
    });
    expect(result.quality).toBe('best');
    expect(result.motifs).toContain('checkmate');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function makeMoveFen(fen, from, to, promotion = 'q') {
  const c = new Chess(fen);
  c.move({ from, to, promotion });
  return c.fen();
}
