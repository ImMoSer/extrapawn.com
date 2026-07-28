// Browser-side chess helpers backed by @lichess-org/chessops
import { Chess as ChessopsPosition } from 'chessops/chess'
import { parseFen, makeFen } from 'chessops/fen'
import { parseSquare, makeSquare, parseUci } from 'chessops/util'
import { makeSan, parseSan } from 'chessops/san'
import { isNormal } from 'chessops'
import type { Role as ChessopsRole } from 'chessops'

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface PieceInfo {
  type: string
  color: 'w' | 'b'
}

export interface SquarePieceInfo extends PieceInfo {
  square: string
}

export interface LegalMoveInfo {
  from: string
  to: string
  san: string
  flags: string
  promotion?: string
}

export interface ExecutedMoveInfo extends LegalMoveInfo {
  piece?: string
  color?: 'w' | 'b'
  captured?: string
}

export interface GameStatusInfo {
  inCheck: boolean
  isCheckmate: boolean
  isStalemate: boolean
  isDraw: boolean
  isInsufficientMaterial: boolean
  isThreefoldRepetition: boolean
  isDrawByFiftyMoves: boolean
  moveNumber: number
}

const ROLE_MAP: Record<string, ChessopsRole> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
  pawn: 'pawn',
  knight: 'knight',
  bishop: 'bishop',
  rook: 'rook',
  queen: 'queen',
  king: 'king',
}

const ROLE_TO_LETTER: Record<ChessopsRole, string> = {
  pawn: 'p',
  knight: 'n',
  bishop: 'b',
  rook: 'r',
  queen: 'q',
  king: 'k',
}

export class Chess {
  public pos!: ChessopsPosition

  constructor(fen?: string) {
    this.load(fen || INITIAL_FEN)
  }

  load(fen: string): void {
    try {
      const setup = parseFen(fen).unwrap()
      this.pos = ChessopsPosition.fromSetup(setup).unwrap()
    } catch {
      const setup = parseFen(INITIAL_FEN).unwrap()
      this.pos = ChessopsPosition.fromSetup(setup).unwrap()
    }
  }

  fen(): string {
    return makeFen(this.pos.toSetup())
  }

  turn(): 'w' | 'b' {
    return this.pos.turn === 'white' ? 'w' : 'b'
  }

  moveNumber(): number {
    return this.pos.fullmoves
  }

  inCheck(): boolean {
    return this.pos.isCheck()
  }

  isCheck(): boolean {
    return this.pos.isCheck()
  }

  isCheckmate(): boolean {
    return this.pos.isCheckmate(this.pos.ctx())
  }

  isStalemate(): boolean {
    return this.pos.isStalemate(this.pos.ctx())
  }

  isDraw(): boolean {
    return (
      this.isStalemate() ||
      this.isInsufficientMaterial() ||
      this.pos.halfmoves >= 100
    )
  }

  isInsufficientMaterial(): boolean {
    return this.pos.isInsufficientMaterial()
  }

  isThreefoldRepetition(): boolean {
    return false
  }

  isDrawByFiftyMoves(): boolean {
    return this.pos.halfmoves >= 100
  }

  board(): Array<Array<PieceInfo | null>> {
    const board: Array<Array<PieceInfo | null>> = []
    for (let r = 0; r < 8; r++) {
      const row: Array<PieceInfo | null> = []
      for (let c = 0; c < 8; c++) {
        const sq = (7 - r) * 8 + c
        const piece = this.pos.board.get(sq)
        row.push(piece ? { type: ROLE_TO_LETTER[piece.role], color: piece.color === 'white' ? 'w' : 'b' } : null)
      }
      board.push(row)
    }
    return board
  }

  get(square: string): PieceInfo | null {
    const sq = parseSquare(square)
    if (sq === undefined) return null
    const piece = this.pos.board.get(sq)
    return piece ? { type: ROLE_TO_LETTER[piece.role], color: piece.color === 'white' ? 'w' : 'b' } : null
  }

  put(piece: { type: string; color: string }, square: string): boolean {
    const sq = parseSquare(square)
    if (sq === undefined) return false
    const role = ROLE_MAP[piece.type]
    const color = piece.color === 'w' || piece.color === 'white' ? 'white' : 'black'
    if (!role) return false
    this.pos.board.set(sq, { role, color })
    return true
  }

  remove(square: string): void {
    const sq = parseSquare(square)
    if (sq !== undefined) {
      this.pos.board.take(sq)
    }
  }

  attackers(square: string, color?: string): string[] {
    const sq = parseSquare(square)
    if (sq === undefined) return []
    const c = color === 'w' || color === 'white' ? 'white' : 'black'
    const attacks = this.pos.kingAttackers(sq, c, this.pos.board.occupied)
    return Array.from(attacks, makeSquare)
  }

  moves(options?: { square?: string; verbose?: boolean }): LegalMoveInfo[] {
    const ctx = this.pos.ctx()
    const filterSq = options && options.square ? parseSquare(options.square) : undefined
    const result: LegalMoveInfo[] = []

    for (const [fromSq, dests] of this.pos.allDests(ctx)) {
      if (filterSq !== undefined && fromSq !== filterSq) continue
      const from = makeSquare(fromSq)
      for (const toSq of dests) {
        const to = makeSquare(toSq)
        const piece = this.pos.board.get(fromSq)
        const isPawn = piece?.role === 'pawn'
        const isPromotionRank =
          (this.pos.turn === 'white' && toSq >= 56) || (this.pos.turn === 'black' && toSq <= 7)

        if (isPawn && isPromotionRank) {
          for (const promoLetter of ['q', 'r', 'b', 'n'] as const) {
            const promoRole = ROLE_MAP[promoLetter]
            const m = { from: fromSq, to: toSq, promotion: promoRole }
            const san = makeSan(this.pos, m)
            result.push({ from, to, san, flags: '', promotion: promoLetter })
          }
        } else {
          const m = { from: fromSq, to: toSq }
          const san = makeSan(this.pos, m)
          result.push({ from, to, san, flags: '' })
        }
      }
    }

    return result
  }

  move(
    moveInput: string | { from: string; to: string; promotion?: string },
  ): ExecutedMoveInfo {
    let parsedMove = null

    if (typeof moveInput === 'object' && moveInput !== null) {
      const from = moveInput.from
      const to = moveInput.to
      const promotion = moveInput.promotion || ''
      
      // Try normal move first without forced promotion
      let tryMove = parseUci(`${from}${to}`)
      if (!tryMove || !this.pos.isLegal(tryMove)) {
        tryMove = parseUci(`${from}${to}${promotion}`)
      }
      if (tryMove && this.pos.isLegal(tryMove)) {
        parsedMove = tryMove
      }
    } else if (typeof moveInput === 'string') {
      parsedMove = parseSan(this.pos, moveInput)
      if (!parsedMove && moveInput.length >= 4) {
        parsedMove = parseUci(moveInput)
      }
    }

    if (!parsedMove || !isNormal(parsedMove) || !this.pos.isLegal(parsedMove)) {
      throw new Error(`Invalid or illegal move: ${JSON.stringify(moveInput)}`)
    }

    const from = makeSquare(parsedMove.from)
    const to = makeSquare(parsedMove.to)
    const san = makeSan(this.pos, parsedMove)
    const promotion = parsedMove.promotion ? ROLE_TO_LETTER[parsedMove.promotion] : undefined
    const piece = this.get(from)
    const captured = this.get(to)

    this.pos.play(parsedMove)

    return {
      from,
      to,
      san,
      promotion,
      piece: piece ? piece.type : undefined,
      color: piece ? piece.color : undefined,
      captured: captured ? captured.type : undefined,
      flags: '',
    }
  }
}

export function getPieces(fen: string): SquarePieceInfo[] {
  const chess = new Chess(fen)
  const pieces: SquarePieceInfo[] = []
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece) {
        pieces.push({
          square: String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r),
          type: piece.type,
          color: piece.color,
        })
      }
    }
  }
  return pieces
}

export function removePiece(fen: string, square: string): string {
  const chess = new Chess(fen)
  chess.remove(square)
  return chess.fen()
}

export function getSideToMove(fen: string): 'w' | 'b' {
  return new Chess(fen).turn()
}

export function getLegalMoves(fen: string, square?: string): LegalMoveInfo[] {
  const chess = new Chess(fen)
  return chess.moves({ square, verbose: true })
}

export function getLegalDestinations(fen: string, square: string): string[] {
  const chess = new Chess(fen)
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of chess.moves({ square, verbose: true })) {
    if (!seen.has(m.to)) {
      seen.add(m.to)
      out.push(m.to)
    }
  }
  return out
}

export function makeMove(
  fen: string,
  from: string,
  to: string,
  promotion = 'q',
): string | null {
  try {
    const chess = new Chess(fen)
    const move = chess.move({ from, to, promotion })
    if (move) return chess.fen()
  } catch {
    // illegal move
  }
  return null
}

export function isValidFen(fen: string): boolean {
  if (typeof fen !== 'string' || fen.trim().length === 0) return false
  try {
    const setup = parseFen(fen)
    if (!setup.isOk) return false
    const posRes = ChessopsPosition.fromSetup(setup.unwrap())
    return posRes.isOk
  } catch {
    return false
  }
}

export function uciToSan(fen: string, uci: string): string {
  if (typeof uci !== 'string' || uci.length < 4) return uci
  try {
    const chess = new Chess(fen)
    const from = uci.slice(0, 2)
    const to = uci.slice(2, 4)
    const promotion = uci[4] || undefined
    const move = chess.move({ from, to, promotion })
    return move ? move.san : uci
  } catch {
    return uci
  }
}

export function gameStatus(fen: string): GameStatusInfo | null {
  try {
    const c = new Chess(fen)
    return {
      inCheck: c.inCheck(),
      isCheckmate: c.isCheckmate(),
      isStalemate: c.isStalemate(),
      isDraw: c.isDraw(),
      isInsufficientMaterial: c.isInsufficientMaterial(),
      isThreefoldRepetition: false,
      isDrawByFiftyMoves: c.isDrawByFiftyMoves(),
      moveNumber: c.moveNumber(),
    }
  } catch {
    return null
  }
}
