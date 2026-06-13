import { Chess as ChessJs } from 'chess.js'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { parseUci } from 'chessops/util'

/**
 * Calculates the resulting FEN after applying a UCI move on a starting FEN.
 * Returns the original FEN if the move is invalid or illegal.
 */
export function getFenAfterMove(parentFen: string, uci: string): string {
  try {
    const setup = parseFen(parentFen).unwrap()
    const pos = Chess.fromSetup(setup).unwrap()
    const move = parseUci(uci)
    if (move && pos.isLegal(move)) {
      pos.play(move)
      return makeFen(pos.toSetup())
    }
  } catch (e) {
    console.error('[ChessUtils] Failed to calculate FEN after move:', parentFen, uci, e)
  }
  return parentFen
}

/**
 * Validates a sequence of space-separated SAN moves on a default starting board position
 * using chess.js. If any move is invalid/illegal, throws a fail-fast error.
 * Returns an array of validated SAN moves.
 */
export function validateAndCleanMoves(movesStr: string, gameId: string): string[] {
  const trimmed = movesStr.trim()
  if (!trimmed) {
    return []
  }
  const movesList = trimmed.split(/\s+/).filter(Boolean)
  const chess = new ChessJs()
  const validatedMoves: string[] = []

  for (const m of movesList) {
    try {
      const result = chess.move(m)
      validatedMoves.push(result.san)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Invalid move'
      throw new Error(`[Fail-Fast] Game ${gameId} has illegal or invalid moves: "${m}". Error: ${errMsg}`)
    }
  }

  return validatedMoves
}

/**
 * Formats game moves array into standard chess results.
 */
export function formatToPgn(movesArray: string[]): string {
  let pgnStr = ''
  for (let i = 0; i < movesArray.length; i++) {
    if (i % 2 === 0) {
      pgnStr += `${(i / 2) + 1}. ${movesArray[i]}`
    } else {
      pgnStr += ` ${movesArray[i]} `
    }
  }
  return pgnStr.trim() + ' *'
}
