import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import logger from '@/shared/lib/logger'
import {
  STANDARD_START_FEN,
  type DrawShape,
  type PgnNode,
  type PgnStringOptions,
} from './pgnTypes'
import { collectPathNodes } from './pgnTreeOps'

const BRUSH_TO_LICHESS: Record<string, string> = {
  green: 'G',
  red: 'R',
  blue: 'B',
  yellow: 'Y',
}

export function stripShapeTagsFromComment(comment: string): string {
  return comment
    .replace(/\[%(cal|csl)\s+[^\]]*\]/gi, '')
    .replace(/\s\s+/g, ' ')
    .trim()
}

export function formatShapesToTags(shapes: DrawShape[]): string {
  if (shapes.length === 0) return ''

  const cals: string[] = []
  const csls: string[] = []

  for (const shape of shapes) {
    const brushChar = BRUSH_TO_LICHESS[shape.brush || 'green'] || 'G'
    if (shape.dest) {
      cals.push(`${brushChar}${shape.orig}${shape.dest}`)
    } else {
      csls.push(`${brushChar}${shape.orig}`)
    }
  }

  let result = ''
  if (cals.length > 0) result += `[%cal ${cals.join(',')}]`
  if (csls.length > 0) result += `[%csl ${csls.join(',')}]`
  return result
}

export function formatCurrentLinePgn(
  rootNode: PgnNode,
  currentNode: PgnNode,
  gameResult: string,
  options?: PgnStringOptions,
): string {
  let pgn = ''
  const pathNodes = collectPathNodes(currentNode)

  if (pathNodes.length === 0) {
    return options?.showResult ? gameResult : ''
  }

  let currentFullMoveNumber = 1
  let isWhiteToMoveInitially = true

  try {
    const rootSetup = parseFen(rootNode.fenAfter).unwrap()
    const rootChessPos = Chess.fromSetup(rootSetup).unwrap()
    currentFullMoveNumber = rootChessPos.fullmoves
    isWhiteToMoveInitially = rootChessPos.turn === 'white'
  } catch (e: unknown) {
    logger.warn(
      `[PgnService] Could not parse root FEN or create Chess pos for PGN string: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  for (let i = 0; i < pathNodes.length; i++) {
    const node = pathNodes[i]
    if (!node) continue

    const isWhiteMoveInPgn =
      (node.ply % 2 === 1 && isWhiteToMoveInitially) ||
      (node.ply % 2 === 0 && !isWhiteToMoveInitially)

    if (isWhiteMoveInPgn) {
      if (pgn.length > 0) pgn += options?.showVariations ? ' ' : '\n'
      pgn += `${currentFullMoveNumber}. `
    } else {
      if (i === 0 && !isWhiteToMoveInitially) {
        pgn += `${currentFullMoveNumber}... `
      } else {
        pgn += ' '
      }
    }
    pgn += node.san

    if (node.comment && options?.showVariations) {
      pgn += ` {${node.comment}}`
    }

    if (!isWhiteMoveInPgn) {
      currentFullMoveNumber++
    }
  }

  if (options?.showResult && gameResult !== '*') {
    pgn += (pgn.length > 0 ? ' ' : '') + gameResult
  }
  return pgn.trim()
}

export function renderPgnSubtree(
  node: PgnNode,
  isWhiteToMove: boolean,
  fullMoveNumber: number,
  forceMoveNumber: boolean,
): string {
  if (node.children.length === 0) return ''

  const mainLine = node.children[0]
  if (!mainLine) return ''
  const variations = node.children.slice(1)

  const nextFullMove = isWhiteToMove ? fullMoveNumber : fullMoveNumber + 1
  const nextTurn = !isWhiteToMove

  let pgn = ''

  if (isWhiteToMove || forceMoveNumber) {
    pgn += `${fullMoveNumber}${isWhiteToMove ? '.' : '...'} `
  }
  pgn += mainLine.san
  if (mainLine.nag) pgn += ` $${mainLine.nag}`
  if (mainLine.comment) pgn += ` {${mainLine.comment}}`

  for (const variation of variations) {
    pgn += ` (${fullMoveNumber}${isWhiteToMove ? '.' : '...'} ${variation.san}${variation.nag ? ` $${variation.nag}` : ''}${variation.comment ? ` {${variation.comment}}` : ''}`
    const varContinuation = renderPgnSubtree(variation, nextTurn, nextFullMove, false)
    if (varContinuation) pgn += ' ' + varContinuation
    pgn += ')'
  }

  const continuation = renderPgnSubtree(mainLine, nextTurn, nextFullMove, variations.length > 0)
  if (continuation) pgn += ' ' + continuation

  return pgn
}

export function formatFullPgn(
  tags: Record<string, string>,
  targetRoot: PgnNode,
  gameResult: string,
): string {
  let pgn = ''
  for (const [key, value] of Object.entries(tags)) {
    pgn += `[${key} "${value}"]\n`
  }
  if (Object.keys(tags).length > 0) pgn += '\n'

  const rootSetup = parseFen(targetRoot.fenAfter).unwrap()
  const isWhiteToMoveInitially = rootSetup.turn === 'white'
  const initialFullMoveNumber = rootSetup.fullmoves

  pgn += renderPgnSubtree(targetRoot, isWhiteToMoveInitially, initialFullMoveNumber, false)
  pgn += ` ${gameResult}`
  return pgn.trim()
}

export function buildAnalysisPayloadContext(
  rootNode: PgnNode,
  currentNode: PgnNode,
  overrideLastMoveUci?: string | null,
): { startFen: string; moves: string[] } {
  const startFen = rootNode.fenAfter || STANDARD_START_FEN
  const pathNodes = collectPathNodes(currentNode)
  const moves = pathNodes.map((n) => n.uci).filter((u): u is string => !!u)

  if (overrideLastMoveUci) {
    const trimmedOverride = overrideLastMoveUci.trim()
    if (trimmedOverride && (moves.length === 0 || moves[moves.length - 1] !== trimmedOverride)) {
      moves.push(trimmedOverride)
    }
  }

  return { startFen, moves }
}
