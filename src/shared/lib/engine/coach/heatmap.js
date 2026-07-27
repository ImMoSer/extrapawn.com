// Position-level "heatmap" analyses.
//
//   getPieceValues(fen)       — for each non-king piece, compute its
//                                contribution to the static evaluation.
//                                Returns a value in centipawns AND a
//                                breakdown by head (material, psqt,
//                                mobility, threats, king-safety, pawns).
//   streamDestinationValues   — for each legal destination of the moving
//                                piece, compute the piece's contextual
//                                worth IF moved there. Streams results
//                                back via a callback as each destination
//                                completes.
//
// PRIMARY backend: the Rust/WASM static evaluator (Stockfish-style HCE
// with phase-tapered PSQTs, mobility tables, pawn structure, king safety,
// threats, bishop pair). One eval per piece, ~1ms total for the whole
// heatmap. Decomposable so the UI can attribute *why* a knight on f5 is
// worth +480cp.
//
// FALLBACK: the legacy engine-call-per-piece method, used only if WASM
// hasn't initialised yet. Slow (~50ms per square) but correct.

import { Chess } from 'chess.js';
import engine from './engine';
import {
  getPieces,
  removePiece,
  getSideToMove,
  getLegalDestinations,
  makeMove,
} from './chess';
import {
  isReady as wasmReady,
  pieceContributionsForFen,
  pieceValueAt,
} from './analyzer-rs.js';

const HEATMAP_DEPTH = 10;

// Mate-encoded scores from the engine are huge (≈ ±100,000 cp). Translate
// either side of the eval to a sane "owner-perspective cp" value where
// owner-mates → +1000 and owner-gets-mated → -1000. cp scores are clamped
// to ±1500 to defend against any latent mate-encoding bleed-through.
function ownerValue(evalRes, sideToMoveAtFen, ownerColor) {
  if (!evalRes) return 0;
  const cp = evalRes.cp ?? 0;
  const mate = evalRes.mate ?? null;
  // Engine reports from side-to-move's POV; normalize to white POV first.
  const whiteCp   = sideToMoveAtFen === 'w' ?  cp : -cp;
  const whiteMate = mate !== null
    ? (sideToMoveAtFen === 'w' ?  mate : -mate)
    : null;
  // Then to owner POV.
  const ownerCp   = ownerColor === 'w' ?  whiteCp : -whiteCp;
  const ownerMate = whiteMate !== null
    ? (ownerColor === 'w' ?  whiteMate : -whiteMate)
    : null;
  if (ownerMate !== null) {
    // Distinguish "owner mates" (+1000) from "owner gets mated" (-1000) but
    // ignore the mate distance — the heatmap just needs a magnitude to
    // reason about, not the exact ply count.
    return ownerMate > 0 ? 1000 : -1000;
  }
  return Math.max(-1500, Math.min(1500, ownerCp));
}

// Cap on |delta_cp| for display. 5 pawns is enough to convey "very
// important". Going higher (e.g. 15) makes every piece around a mating
// attack read identically and conveys no info.
const MAX_DELTA_CP = 500;

function clampDelta(cp) {
  if (cp > MAX_DELTA_CP) return MAX_DELTA_CP;
  if (cp < -MAX_DELTA_CP) return -MAX_DELTA_CP;
  return cp;
}

function normalizeToWhite(score, turn) {
  return turn === 'w' ? score : -score;
}

async function ensureReady() {
  await engine.init();
}

export async function getPieceValues(fen) {
  // Fast path: WASM static eval. ~1ms total for the whole board.
  if (wasmReady()) {
    const contributions = pieceContributionsForFen(fen);
    if (contributions) {
      const pieces = getPieces(fen);
      const byKey = new Map(contributions.map(c => [c.square + c.color + c.role, c]));
      const results = pieces.map(p => {
        if (p.type === 'k') {
          return { ...p, delta_cp: 0, delta_pawns: 0 };
        }
        const c = byKey.get(p.square + p.color + p.type);
        const value = c ? clampDelta(c.value_cp) : 0;
        return {
          ...p,
          delta_cp: value,
          delta_pawns: parseFloat((value / 100).toFixed(2)),
          breakdown: c ? {
            material: c.material,
            psqt: c.psqt,
            mobility: c.mobility,
            pawns: c.pawns,
            king_safety: c.king_safety,
            threats: c.threats,
            imbalance: c.imbalance,
          } : null,
        };
      });
      return { fen, eval_cp: 0, pieces: results }; // eval_cp not used by callers
    }
  }
  // Slow path: legacy engine-call-per-piece. Used only if WASM unavailable.
  await ensureReady();
  const turn = getSideToMove(fen);
  const baseRes = await engine.evaluate(fen, HEATMAP_DEPTH);
  const baseEvalCp = normalizeToWhite(baseRes.cp, turn);
  const pieces = getPieces(fen);
  const results = [];
  for (const piece of pieces) {
    let deltaCp = 0;
    if (piece.type !== 'k') {
      const fenWithoutPiece = removePiece(fen, piece.square);
      const evalRes = await engine.evaluate(fenWithoutPiece, HEATMAP_DEPTH);
      const baseOwner = ownerValue(baseRes, turn, piece.color);
      const removedOwner = ownerValue(evalRes, turn, piece.color);
      deltaCp = clampDelta(baseOwner - removedOwner);
    }
    results.push({
      ...piece,
      delta_cp: deltaCp,
      delta_pawns: parseFloat((deltaCp / 100).toFixed(2)),
    });
  }
  return { fen, eval_cp: baseEvalCp, pieces: results };
}

// For each legal destination, compute the moving piece's contextual worth
// at that destination — i.e., value_cp = baseEval(newFen) - eval(newFen
// minus piece on dest), from the piece's owner's POV. Two engine calls
// per destination instead of the 16 a full piece-values heatmap needs.
//
// Streams results: invokes `onResult({ dest, value_cp, value_pawns })`
// each time a destination completes. Returns a cancel function.
export function streamDestinationValues(fen, sourceSquare, onResult) {
  let cancelled = false;
  (async () => {
    const piece = new Chess(fen).get(sourceSquare);
    if (!piece) return;
    const dests = getLegalDestinations(fen, sourceSquare);

    // Fast path: WASM static eval per destination. The piece is on the
    // destination square in `newFen`, so `pieceValueAt` directly returns
    // its contribution there. ~50µs per destination — under 1ms total
    // for any moving piece.
    if (wasmReady()) {
      for (const dest of dests) {
        if (cancelled) break;
        const newFen = makeMove(fen, sourceSquare, dest);
        if (!newFen) continue;
        const c = pieceValueAt(newFen, dest);
        const valueCp = clampDelta(c ? c.value_cp : 0);
        onResult({
          dest,
          value_cp: valueCp,
          value_pawns: parseFloat((valueCp / 100).toFixed(2)),
          breakdown: c ? {
            material: c.material,
            psqt: c.psqt,
            mobility: c.mobility,
            pawns: c.pawns,
            king_safety: c.king_safety,
            threats: c.threats,
            imbalance: c.imbalance,
          } : null,
        });
        // Yield to the event loop so React can render incrementally.
        await Promise.resolve();
      }
      return;
    }

    // Slow path: engine-call-per-destination.
    await ensureReady();
    for (const dest of dests) {
      if (cancelled) break;
      const newFen = makeMove(fen, sourceSquare, dest);
      if (!newFen) continue;
      try {
        const newTurn = getSideToMove(newFen);
        const baseRes = await engine.evaluate(newFen, HEATMAP_DEPTH);
        if (cancelled) break;
        const fenWithoutPiece = removePiece(newFen, dest);
        const withoutRes = await engine.evaluate(fenWithoutPiece, HEATMAP_DEPTH);
        if (cancelled) break;
        const valueCp = clampDelta(
          ownerValue(baseRes, newTurn, piece.color)
          - ownerValue(withoutRes, newTurn, piece.color)
        );
        onResult({
          dest,
          value_cp: valueCp,
          value_pawns: parseFloat((valueCp / 100).toFixed(2)),
        });
      } catch {
        // Skip this destination on failure
      }
    }
  })();
  return () => { cancelled = true; };
}
