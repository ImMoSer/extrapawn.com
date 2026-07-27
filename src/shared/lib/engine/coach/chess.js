// Browser-side chess helpers — port of the (deprecated) server helpers.
// Uses chess.js, no external state.

import { Chess } from 'chess.js';

export function getPieces(fen) {
  const chess = new Chess(fen);
  const pieces = [];
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        pieces.push({
          square: String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r),
          type: piece.type,
          color: piece.color,
        });
      }
    }
  }
  return pieces;
}

export function removePiece(fen, square) {
  const chess = new Chess(fen);
  chess.remove(square);
  return chess.fen();
}

export function getSideToMove(fen) {
  return new Chess(fen).turn();
}

export function getLegalMoves(fen, square) {
  const chess = new Chess(fen);
  return chess.moves({ square, verbose: true })
    .map(m => ({ to: m.to, san: m.san, flags: m.flags, promotion: m.promotion }));
}

export function getLegalDestinations(fen, square) {
  const chess = new Chess(fen);
  const seen = new Set();
  const out = [];
  for (const m of chess.moves({ square, verbose: true })) {
    if (!seen.has(m.to)) {
      seen.add(m.to);
      out.push(m.to);
    }
  }
  return out;
}

export function makeMove(fen, from, to, promotion = 'q') {
  try {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion });
    if (move) return chess.fen();
  } catch {
    // illegal move
  }
  return null;
}

export function isValidFen(fen) {
  if (typeof fen !== 'string' || fen.trim().length === 0) return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

export function uciToSan(fen, uci) {
  if (typeof uci !== 'string' || uci.length < 4) return uci;
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci[4] || undefined;
    const move = chess.move({ from, to, promotion });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

export function gameStatus(fen) {
  try {
    const chess = new Chess(fen);
    return {
      inCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      isInsufficientMaterial: chess.isInsufficientMaterial(),
      isThreefoldRepetition: chess.isThreefoldRepetition(),
      isDrawByFiftyMoves: chess.isDrawByFiftyMoves(),
      moveNumber: chess.moveNumber(),
    };
  } catch {
    return null;
  }
}
