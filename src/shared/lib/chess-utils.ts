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
 * Extracts the primary UCI move from a scenario move token that may contain
 * a 2-move finishing dual separated by '|' (e.g. "d1d5|f1d5" -> "d1d5").
 */
export function extractPrimaryUciMove(moveToken: string): string {
  if (!moveToken) return ''
  return moveToken.split('|')[0]?.trim() || ''
}

/**
 * Compares two UCI move tokens with normalization for castling and support for
 * pipe-separated finishing duals ("moveA|moveB").
 * This ensures that 'e1h1' (from book) matches 'e1g1' (from engine/user),
 * and that either alternative in "d1d5|f1d5" is accepted as a valid scenario move.
 */
export function areMovesEqual(move1: string, move2: string): boolean {
  if (!move1 || !move2) return false
  if (move1 === move2) return true

  if (!move1.includes('|') && !move2.includes('|')) {
    return normalizeUciMove(move1.trim()) === normalizeUciMove(move2.trim())
  }

  const candidates1 = move1
    .split('|')
    .map((m) => normalizeUciMove(m.trim()))
    .filter(Boolean)
  const candidates2 = move2
    .split('|')
    .map((m) => normalizeUciMove(m.trim()))
    .filter(Boolean)

  return candidates1.some((c1) => candidates2.includes(c1))
}
