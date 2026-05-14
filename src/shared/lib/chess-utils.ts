/**
 * Normalizes UCI move notation, especially for castling.
 * Standard UCI (Stockfish) uses King destination: e1g1, e1c1.
 * Chess960/Some Books use King-x-Rook: e1h1, e1a1.
 */
export function normalizeUciMove(uci: string): string {
  if (!uci) return ''

  const CASTLING_MAP: Record<string, string> = {
    // White
    e1h1: 'e1g1', // O-O
    e1a1: 'e1c1', // O-O-O
    // Black
    e8h8: 'e8g8', // o-o
    e8a8: 'e8c8', // o-o-o
  }

  return CASTLING_MAP[uci] || uci
}

/**
 * Compares two UCI moves with normalization for castling.
 * This ensures that 'e1h1' (from book) matches 'e1g1' (from engine/user).
 */
export function areMovesEqual(move1: string, move2: string): boolean {
  if (move1 === move2) return true
  return normalizeUciMove(move1) === normalizeUciMove(move2)
}
