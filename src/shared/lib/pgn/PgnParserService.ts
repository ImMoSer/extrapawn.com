import { Chess } from 'chessops/chess'
import { parseFen, makeFen } from 'chessops/fen'
import { parseSan } from 'chessops/san'
import { makeUci, parseUci } from 'chessops/util'
import type { Move } from 'chessops/types'
import { scalachessCharPair } from 'chessops/compat'
import { type PgnNode, type DrawShape } from './PgnService'

export interface ImportResult {
  tags: Record<string, string>
  root: PgnNode
}

export class PgnParserService {
  public parseMultiple(pgn: string): ImportResult[] {
    const games = pgn.split(/(?=\[Event )/g)
    return games
      .map((game) => this.parse(game.trim()))
      .filter((res): res is ImportResult => res !== null)
      .filter((res) => res.root.children.length > 0 || Object.keys(res.tags).length > 0)
  }

  public parse(pgn: string): ImportResult | null {
    const tags = this.extractTags(pgn)
    const moveText = this.extractMoveText(pgn)
    const tokens = this.tokenize(moveText)

    const startFen = tags['FEN'] || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    // Strict Variant check: allow Standard and From Position
    const variantTag = tags['Variant'] || tags['variant']
    const allowedVariants = ['standard', 'from position']
    if (variantTag && !allowedVariants.includes(variantTag.toLowerCase())) {
      console.warn(`[PgnParserService] Skipping chapter due to unsupported Variant: ${variantTag}`)
      return null
    }

    // Strict FEN validation
    try {
      const setup = parseFen(startFen).unwrap()
      Chess.fromSetup(setup).unwrap()
    } catch {
      console.warn('[PgnParserService] Skipping chapter due to invalid FEN:', startFen)
      return null
    }

    const root: PgnNode = {
      id: '__ROOT__',
      ply: 0,
      fenBefore: '',
      fenAfter: startFen,
      san: '',
      uci: '',
      children: [],
    }

    try {
      this.buildTree(tokens, root)
    } catch (e) {
      console.warn('[PgnParserService] Skipping chapter due to invalid moves/PGN structure:', e)
      return null
    }

    return { tags, root }
  }

  private getStandardUci(move: Move, pos: Chess): string {
    if ('from' in move && 'to' in move) {
      const piece = pos.board.get(move.from)
      const targetPiece = pos.board.get(move.to)

      // Standard rule: if King captures a friendly piece (Rook in chessops), it is Castling
      if (piece?.role === 'king' && targetPiece && piece.color === targetPiece.color) {
        const fileFrom = move.from % 8
        const rankFrom = Math.floor(move.from / 8)
        const fileTo = move.to % 8

        const isKingside = fileTo > fileFrom
        const targetFile = isKingside ? 6 : 2 // 'g' = 6, 'c' = 2

        const destSquare = rankFrom * 8 + targetFile
        return makeUci({ from: move.from, to: destSquare, promotion: move.promotion })
      }
    }
    return makeUci(move)
  }

  private extractTags(pgn: string): Record<string, string> {
    const tags: Record<string, string> = {}
    const tagRegex = /\[(\w+)\s+"(.*)"\]/g
    let match
    while ((match = tagRegex.exec(pgn)) !== null) {
      if (match[1] && match[2]) {
        tags[match[1]] = match[2]
      }
    }
    return tags
  }

  private extractMoveText(pgn: string): string {
    // Remove tags (lines starting with [)
    const text = pgn.replace(/^\[.*\]/gm, '')
    return text.trim()
  }

  private tokenize(moveText: string): string[] {
    // Tokenize into: comments, variations, NAGs, move numbers, results, SAN moves
    return (
      moveText.match(
        /\{[^}]*\}|\(|\)|\$\d+|\d+\.{1,3}|(?:\d+-\d+|1\/2-1\/2|\*)|[a-zA-Z0-9+#=/\-]+|[!?]+/g,
      ) || []
    )
  }

  public cleanComment(comment: string): string {
    // Remove [%cal ...] and [%csl ...] from the visible comment text
    // Handle multiple occurrences and potential case differences
    return comment
      .replace(/\[%(cal|csl)\s+[^\]]*\]/gi, '')
      .replace(/\s\s+/g, ' ')
      .trim()
  }

  public parseShapes(comment: string): DrawShape[] | undefined {
    const shapes: DrawShape[] = []
    const brushMap: Record<string, string> = {
      G: 'green',
      R: 'red',
      B: 'blue',
      Y: 'yellow',
    }

    // Use a simpler regex and loop to be more robust
    const tagRegex = /\[%(cal|csl)\s+([^\]]*)\]/gi
    let match
    while ((match = tagRegex.exec(comment)) !== null) {
      const type = match[1]?.toLowerCase()
      const content = match[2]
      if (!type || content === undefined) continue

      const items = content.split(',')

      for (const item of items) {
        const trimmed = item.trim()
        if (trimmed.length < 3) continue

        const key = trimmed[0]?.toUpperCase()
        if (!key) continue

        const brush = brushMap[key]
        if (!brush) continue

        if (type === 'cal' && trimmed.length >= 5) {
          const orig = trimmed.substring(1, 3)
          const dest = trimmed.substring(3, 5)
          shapes.push({ orig, dest, brush })
        } else if (type === 'csl') {
          const orig = trimmed.substring(1, 3)
          shapes.push({ orig, brush })
        }
      }
    }

    return shapes.length > 0 ? shapes : undefined
  }

  private buildTree(tokens: string[], root: PgnNode) {
    let currentNode = root
    const nodeStack: PgnNode[] = []
    const posStack: Chess[] = []

    const glyphToNag: Record<string, number> = {
      '!': 1,
      '?': 2,
      '!!': 3,
      '??': 4,
      '!?': 5,
      '?!': 6,
    }

    // FEN already validated in parse()
    const setup = parseFen(root.fenAfter).unwrap()
    let currentPos = Chess.fromSetup(setup).unwrap()

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      if (!token) continue

      if (token === '(') {
        // Variation start: push current node and clone the board state
        nodeStack.push(currentNode)
        posStack.push(currentPos.clone())

        if (currentNode.parent) {
          currentNode = currentNode.parent
        }

        const setup = parseFen(currentNode.fenAfter).unwrap()
        currentPos = Chess.fromSetup(setup).unwrap()
      } else if (token === ')') {
        // Variation end: pop node and position
        const prevNode = nodeStack.pop()
        if (prevNode) {
          currentNode = prevNode
        }
        const prevPos = posStack.pop()
        if (prevPos) {
          currentPos = prevPos
        }
      } else if (token.startsWith('{')) {
        const comment = token.substring(1, token.length - 1).trim()
        currentNode.comment = comment
        currentNode.shapes = this.parseShapes(comment)
      } else if (token.startsWith('$')) {
        if (currentNode !== root) {
          currentNode.nag = parseInt(token.substring(1))
        }
      } else if (token.match(/^[!?]+$/)) {
        if (currentNode !== root) {
          currentNode.nag = glyphToNag[token] || currentNode.nag
        }
      } else if (token.match(/^\d+\.{1,3}$/) || token.match(/^(?:1-0|0-1|1\/2-1\/2|\*)$/)) {
        continue
      } else {
        // It's a move (SAN)
        const move = parseSan(currentPos, token)

        if (move) {
          const uci = this.getStandardUci(move, currentPos)
          const fenBefore = currentNode.fenAfter

          // Fast execute move
          currentPos.play(move)
          const fenAfter = makeFen(currentPos.toSetup())

          let nextNode = currentNode.children.find((c) => c.san === token)

          if (!nextNode) {
            const moveData = parseUci(uci)
            const nodeId = moveData
              ? scalachessCharPair(moveData)
              : uci + Math.random().toString(36).substr(2, 4)

            nextNode = {
              id: nodeId,
              ply: currentNode.ply + 1,
              fenBefore: fenBefore,
              fenAfter: fenAfter,
              san: token,
              uci: uci,
              parent: currentNode,
              children: [],
            }
            currentNode.children.push(nextNode)
          }

          currentNode = nextNode
        } else {
          throw new Error(`Invalid move: ${token}`)
        }
      }
    }
  }
}

export const pgnParserService = new PgnParserService()
