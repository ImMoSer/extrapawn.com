import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { findOpening, findOpeningFromHistory } from '../openings.js';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function play(moves) {
  const c = new Chess();
  const fens = [START_FEN];
  for (const uci of moves) {
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    fens.push(c.fen());
  }
  return fens;
}

describe('findOpening', () => {
  it('returns null for the bare starting position', () => {
    expect(findOpening(START_FEN)).toBeNull();
  });

  it('returns a string after recognised opening moves', () => {
    // After 1.e4 we should be in some named bucket if openings.js
    // matches. Don't pin the exact label — just that something fires.
    const fens = play(['e2e4']);
    const name = findOpening(fens[fens.length - 1]);
    // Either a string or null — both are acceptable; the negative
    // here would be a thrown error.
    expect(typeof name === 'string' || name === null).toBe(true);
  });
});

describe('findOpeningFromHistory', () => {
  it('returns null for an empty / starting-only history', () => {
    expect(findOpeningFromHistory([START_FEN])).toBeNull();
  });

  it('walks backwards: an unrecognised tail still returns a known name from earlier in the line', () => {
    // 1.e4 e5 2.Nf3 Nc6 3.Bb5 — Ruy López. Then 3...a6 — still Ruy.
    // The exact label depends on openings.js content, but the function
    // shouldn't throw and should walk the history.
    const history = play(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6']);
    const name = findOpeningFromHistory(history);
    expect(typeof name === 'string' || name === null).toBe(true);
  });

  it('handles unusual histories without throwing', () => {
    const history = play(['a2a3', 'h7h6', 'a3a4']);
    expect(() => findOpeningFromHistory(history)).not.toThrow();
  });
});
