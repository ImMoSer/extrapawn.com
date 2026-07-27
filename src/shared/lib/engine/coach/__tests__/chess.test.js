import { describe, it, expect } from 'vitest';
import {
  getPieces,
  removePiece,
  getSideToMove,
  getLegalMoves,
  getLegalDestinations,
  makeMove,
  isValidFen,
  uciToSan,
  gameStatus,
} from '../chess.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
// Simple position: only kings + a few pieces. Useful for terminal-state tests.
const FOOLS_MATE_AFTER = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
// White king on e8 stalemate position from a famous K+Q vs K trap.
const STALEMATE_FEN = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';

describe('getPieces', () => {
  it('returns 32 pieces in the starting position', () => {
    const ps = getPieces(START_FEN);
    expect(ps).toHaveLength(32);
    expect(ps.filter(p => p.color === 'w')).toHaveLength(16);
    expect(ps.filter(p => p.color === 'b')).toHaveLength(16);
  });

  it('reports squares in algebraic notation', () => {
    const ps = getPieces(START_FEN);
    const e1 = ps.find(p => p.square === 'e1');
    expect(e1).toEqual({ square: 'e1', type: 'k', color: 'w' });
    const a8 = ps.find(p => p.square === 'a8');
    expect(a8).toEqual({ square: 'a8', type: 'r', color: 'b' });
  });
});

describe('removePiece', () => {
  it('removes a piece and returns a valid FEN', () => {
    const newFen = removePiece(START_FEN, 'b1');
    expect(isValidFen(newFen)).toBe(true);
    const ps = getPieces(newFen);
    expect(ps.find(p => p.square === 'b1')).toBeUndefined();
    expect(ps).toHaveLength(31);
  });
});

describe('getSideToMove', () => {
  it('returns w for the starting position', () => {
    expect(getSideToMove(START_FEN)).toBe('w');
  });
  it('returns b after 1.e4', () => {
    const after = makeMove(START_FEN, 'e2', 'e4');
    expect(getSideToMove(after)).toBe('b');
  });
});

describe('getLegalMoves / getLegalDestinations', () => {
  it('lists 2 destinations for the e2 pawn from start', () => {
    const dests = getLegalDestinations(START_FEN, 'e2');
    expect(new Set(dests)).toEqual(new Set(['e3', 'e4']));
  });

  it('lists 2 destinations for the b1 knight from start', () => {
    const dests = getLegalDestinations(START_FEN, 'b1');
    expect(new Set(dests)).toEqual(new Set(['a3', 'c3']));
  });

  it('returns SAN with verbose move info', () => {
    const moves = getLegalMoves(START_FEN, 'e2');
    expect(moves).toContainEqual(expect.objectContaining({ to: 'e4', san: 'e4' }));
  });

  it('returns empty for a square with no piece of side-to-move', () => {
    expect(getLegalDestinations(START_FEN, 'e7')).toEqual([]);
    expect(getLegalDestinations(START_FEN, 'e5')).toEqual([]);
  });
});

describe('makeMove', () => {
  it('returns a new FEN for legal moves', () => {
    const after = makeMove(START_FEN, 'e2', 'e4');
    expect(isValidFen(after)).toBe(true);
    expect(getSideToMove(after)).toBe('b');
  });

  it('returns null for illegal moves (silent)', () => {
    expect(makeMove(START_FEN, 'e2', 'e5')).toBeNull();
    expect(makeMove(START_FEN, 'a1', 'h8')).toBeNull();
  });

  it('handles promotion via the optional promotion arg', () => {
    // Black to move, pawn on a2 — promote to knight.
    const fen = '4k3/8/8/8/8/8/p7/4K3 b - - 0 1';
    const after = makeMove(fen, 'a2', 'a1', 'n');
    expect(after).not.toBeNull();
    const ps = getPieces(after);
    const a1 = ps.find(p => p.square === 'a1');
    expect(a1).toEqual({ square: 'a1', type: 'n', color: 'b' });
  });
});

describe('isValidFen', () => {
  it('accepts the starting position', () => {
    expect(isValidFen(START_FEN)).toBe(true);
  });
  it('rejects malformed strings', () => {
    expect(isValidFen('')).toBe(false);
    expect(isValidFen('not a fen')).toBe(false);
    expect(isValidFen(null)).toBe(false);
    expect(isValidFen(undefined)).toBe(false);
    expect(isValidFen(123)).toBe(false);
  });
  it('rejects an obviously broken board layout', () => {
    expect(isValidFen('rnbqkbnr/8/8/8/8/8/8/8 w - - 0 1')).toBe(false);
  });
});

describe('uciToSan', () => {
  it('converts a legal UCI move to SAN', () => {
    expect(uciToSan(START_FEN, 'e2e4')).toBe('e4');
    expect(uciToSan(START_FEN, 'g1f3')).toBe('Nf3');
  });
  it('passes through unrecognised UCI', () => {
    // Not a legal move from the starting position — chess.js throws,
    // we fall back to the raw uci.
    expect(uciToSan(START_FEN, 'a1h8')).toBe('a1h8');
  });
  it('passes through too-short input', () => {
    expect(uciToSan(START_FEN, 'e2')).toBe('e2');
  });
});

describe('gameStatus', () => {
  it('reports starting position as in-progress', () => {
    const s = gameStatus(START_FEN);
    expect(s).not.toBeNull();
    expect(s.isCheckmate).toBe(false);
    expect(s.isStalemate).toBe(false);
    expect(s.isDraw).toBe(false);
    expect(s.inCheck).toBe(false);
  });
  it('detects the Fool\'s Mate position as checkmate', () => {
    const s = gameStatus(FOOLS_MATE_AFTER);
    expect(s.isCheckmate).toBe(true);
  });
  it('detects stalemate', () => {
    const s = gameStatus(STALEMATE_FEN);
    expect(s.isStalemate).toBe(true);
  });
});
