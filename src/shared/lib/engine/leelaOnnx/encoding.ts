// Encodes a chess position into the [1, 112, 8, 8] float32 tensor that Lc0 expects.
//
// Plane layout (112 planes total):
//   Planes 0-103:  13 planes x 8 history positions (most recent first)
//     Per position: 6 own pieces + 6 opponent pieces + 1 repetition
//   Planes 104-111: 8 auxiliary planes
//     104: our queenside castling
//     105: our kingside castling
//     106: opponent queenside castling
//     107: opponent kingside castling
//     108: is black to move (1.0 if black, 0.0 if white)
//     109: rule50 count / 99.0 (capped at 1.0)
//     110: zeros (move count, disabled)
//     111: all ones

const TOTAL_PLANES = 112
const HISTORY_LENGTH = 8
const PLANES_PER_HISTORY = 13
const PLANE_SIZE = 64
const RANKS = '12345678'

// Piece planes for WHITE's turn (white = "us" = planes 0-5, black = "them" = planes 6-11)
const PIECE_PLANES_WHITE: Record<string, number> = {
  P: 0, N: 1, B: 2, R: 3, Q: 4, K: 5,
  p: 6, n: 7, b: 8, r: 9, q: 10, k: 11,
}

// Piece planes for BLACK's turn (black = "us" = planes 0-5, white = "them" = planes 6-11)
const PIECE_PLANES_BLACK: Record<string, number> = {
  p: 0, n: 1, b: 2, r: 3, q: 4, k: 5,
  P: 6, N: 7, B: 8, R: 9, Q: 10, K: 11,
}

// Vertical flip only (rank flip) - matches lczerolens behavior
export function flipRank(square: string): string {
  const file = square[0]
  const rankIndex = RANKS.indexOf(square[1])
  if (rankIndex < 0) return square
  return `${file}${RANKS[7 - rankIndex]}`
}

export function flipUci(uci: string): string {
  if (uci.length < 4) return uci
  const from = flipRank(uci.slice(0, 2))
  const to = flipRank(uci.slice(2, 4))
  const promo = uci.length > 4 ? uci.slice(4) : ''
  return `${from}${to}${promo}`
}

function writeConstantPlane(planes: Float32Array, planeIndex: number, value: number) {
  const offset = planeIndex * PLANE_SIZE
  for (let i = 0; i < PLANE_SIZE; i++) {
    planes[offset + i] = value
  }
}

const normalizeFenKey = (fen: string) => fen.split(' ').slice(0, 4).join(' ')

function buildRepetitionFlags(fenHistory: string[]): boolean[] {
  const counts = new Map<string, number>()
  return fenHistory.map((fen) => {
    const key = normalizeFenKey(fen)
    const current = counts.get(key) ?? 0
    counts.set(key, current + 1)
    return current > 0
  })
}

/**
 * Encode a chess position (with history) into lc0's input tensor format.
 *
 * @param fenHistory - All FENs from the game, most recent LAST
 * @returns Float32Array of length 112 * 64 = 7168
 */
export function encodeFenHistory(fenHistory: string[]): Float32Array {
  if (fenHistory.length === 0) {
    throw new Error('fenHistory must include at least the current position')
  }

  const currentFen = fenHistory[fenHistory.length - 1]
  const fenParts = currentFen.split(' ')
  const sideToMove = (fenParts[1] ?? 'w') as 'w' | 'b'
  const castling = fenParts[2] ?? '-'
  const halfmoveClock = Number(fenParts[4] ?? '0')
  const isBlack = sideToMove === 'b'

  const piecePlanes = isBlack ? PIECE_PLANES_BLACK : PIECE_PLANES_WHITE
  const repetitionFlags = buildRepetitionFlags(fenHistory)
  const planes = new Float32Array(TOTAL_PLANES * PLANE_SIZE)

  // Most recent 8 positions, reversed (most recent first for encoding)
  const recentPositions = fenHistory.slice(-HISTORY_LENGTH).reverse()
  const recentRepetitions = repetitionFlags.slice(-HISTORY_LENGTH).reverse()

  for (let historyIndex = 0; historyIndex < HISTORY_LENGTH; historyIndex++) {
    const fen = recentPositions[historyIndex]
    if (!fen) continue

    const [boardPart] = fen.split(' ')
    const ranks = boardPart.split('/')
    const basePlane = historyIndex * PLANES_PER_HISTORY

    // FEN ranks go from rank 8 (top) to rank 1 (bottom)
    let rank = 7
    for (const rankStr of ranks) {
      let file = 0
      for (const ch of rankStr) {
        if (ch >= '1' && ch <= '8') {
          file += Number(ch)
        } else {
          const planeIndex = piecePlanes[ch]
          if (planeIndex !== undefined) {
            // For BLACK, flip the rank (vertical flip only, like lczerolens)
            const actualRank = isBlack ? 7 - rank : rank
            const squareIndex = actualRank * 8 + file
            planes[(basePlane + planeIndex) * PLANE_SIZE + squareIndex] = 1.0
          }
          file += 1
        }
      }
      rank -= 1
    }

    if (recentRepetitions[historyIndex]) {
      writeConstantPlane(planes, basePlane + 12, 1.0)
    }
  }

  // Castling rights from "us/them" perspective
  if (isBlack) {
    writeConstantPlane(planes, 104, castling.includes('q') ? 1.0 : 0.0) // us queenside
    writeConstantPlane(planes, 105, castling.includes('k') ? 1.0 : 0.0) // us kingside
    writeConstantPlane(planes, 106, castling.includes('Q') ? 1.0 : 0.0) // them queenside
    writeConstantPlane(planes, 107, castling.includes('K') ? 1.0 : 0.0) // them kingside
  } else {
    writeConstantPlane(planes, 104, castling.includes('Q') ? 1.0 : 0.0) // us queenside
    writeConstantPlane(planes, 105, castling.includes('K') ? 1.0 : 0.0) // us kingside
    writeConstantPlane(planes, 106, castling.includes('q') ? 1.0 : 0.0) // them queenside
    writeConstantPlane(planes, 107, castling.includes('k') ? 1.0 : 0.0) // them kingside
  }

  writeConstantPlane(planes, 108, isBlack ? 1.0 : 0.0)
  writeConstantPlane(planes, 109, Math.min(halfmoveClock / 99.0, 1.0))
  writeConstantPlane(planes, 110, 0.0)
  writeConstantPlane(planes, 111, 1.0)

  return planes
}
