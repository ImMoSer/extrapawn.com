import type { Key } from '@lichess-org/chessground/types'
import { scalachessCharPair } from 'chessops/compat'
import { makeFen } from 'chessops/fen'
import {
  parseComment,
  parsePgn,
  startingPosition,
  type ChildNode,
  type Node as ChessopsNode,
  type PgnNodeData,
} from 'chessops/pgn'
import { makeSan, parseSan } from 'chessops/san'
import { makeSquare, makeUci } from 'chessops/util'
import type { Position } from 'chessops/chess'
import { formatShapesToTags } from './pgnFormatter'
import {
  ROOT_NODE_ID,
  STANDARD_START_FEN,
  type DrawShape,
  type PgnNode,
} from './pgnTypes'

export interface ParsedStudyChapterPgn {
  headers: Record<string, string>
  startFen: string
  orientation: 'white' | 'black'
  result: string
  rootNode: PgnNode
}

function parseCommentAndShapes(rawComments: string[] | undefined): {
  comment: string | undefined
  shapes: DrawShape[]
} {
  if (!rawComments || rawComments.length === 0) {
    return { comment: undefined, shapes: [] }
  }
  const textParts: string[] = []
  const shapes: DrawShape[] = []

  for (const raw of rawComments) {
    const parsed = parseComment(raw)
    const trimmed = parsed.text.trim()
    if (trimmed) {
      textParts.push(trimmed)
    }
    for (const shape of parsed.shapes) {
      const orig = makeSquare(shape.from) as Key
      const dest = shape.from !== shape.to ? (makeSquare(shape.to) as Key) : undefined
      shapes.push(
        dest
          ? { orig, dest, brush: shape.color }
          : { orig, brush: shape.color },
      )
    }
  }

  return {
    comment: textParts.length > 0 ? textParts.join(' ') : undefined,
    shapes,
  }
}

function convertChildren(
  sourceParent: ChessopsNode<PgnNodeData>,
  targetParent: PgnNode,
  posBefore: Position,
): void {
  for (const child of sourceParent.children as ChildNode<PgnNodeData>[]) {
    const rawSan = child.data.san?.trim()
    if (!rawSan) continue

    const move = parseSan(posBefore, rawSan)
    if (!move) continue

    const fenBefore = makeFen(posBefore.toSetup())
    const canonicalSan = makeSan(posBefore, move)
    const uci = makeUci(move)
    const nodeId = scalachessCharPair(move)

    const nextPos = posBefore.clone()
    nextPos.play(move)
    const fenAfter = makeFen(nextPos.toSetup())

    const { comment, shapes } = parseCommentAndShapes(child.data.comments)
    const pgnNode: PgnNode = {
      id: nodeId,
      ply: targetParent.ply + 1,
      fenBefore,
      fenAfter,
      san: canonicalSan,
      uci,
      parent: targetParent,
      children: [],
      comment,
      nag: child.data.nags && child.data.nags.length > 0 ? child.data.nags[0] : undefined,
      shapes: shapes.length > 0 ? shapes : undefined,
    }

    targetParent.children.push(pgnNode)
    convertChildren(child, pgnNode, nextPos)
  }
}

/**
 * Parses a Lichess-compatible Study chapter PGN (with `{ comments }`, `[%csl]`/`[%cal]`,
 * NAGs, and nested variations) into an isolated `PgnNode` tree ready for `PgnTreeController`.
 */
export function parseLichessChapterPgn(
  pgnText: string,
  fallbackFen: string = STANDARD_START_FEN,
  fallbackOrientation: 'white' | 'black' = 'white',
): ParsedStudyChapterPgn {
  const games = parsePgn(pgnText)
  const game = games[0]

  if (!game) {
    return {
      headers: { FEN: fallbackFen, SetUp: '1', Orientation: fallbackOrientation },
      startFen: fallbackFen,
      orientation: fallbackOrientation,
      result: '*',
      rootNode: {
        id: ROOT_NODE_ID,
        ply: 0,
        fenBefore: '',
        fenAfter: fallbackFen,
        san: '',
        uci: '',
        children: [],
      },
    }
  }

  const headers: Record<string, string> = {}
  for (const [k, v] of game.headers.entries()) {
    headers[k] = v
  }

  const posResult = startingPosition(game.headers)
  const startPos = posResult.unwrap()
  const startFen = makeFen(startPos.toSetup())
  const rawOrientation = headers.Orientation?.toLowerCase()
  const orientation: 'white' | 'black' =
    rawOrientation === 'black'
      ? 'black'
      : rawOrientation === 'white'
        ? 'white'
        : fallbackOrientation
  const result = headers.Result || '*'

  const rootParsed = parseCommentAndShapes(game.comments)
  const rootNode: PgnNode = {
    id: ROOT_NODE_ID,
    ply: 0,
    fenBefore: '',
    fenAfter: startFen,
    san: '',
    uci: '',
    children: [],
    comment: rootParsed.comment,
    shapes: rootParsed.shapes.length > 0 ? rootParsed.shapes : undefined,
  }

  convertChildren(game.moves, rootNode, startPos)

  return {
    headers,
    startFen,
    orientation,
    result,
    rootNode,
  }
}

function buildCommentBlock(node: PgnNode): string {
  const prose = (node.comment || '').replace(/[{}]/g, '').trim()
  const tags = node.shapes && node.shapes.length > 0 ? formatShapesToTags(node.shapes) : ''
  if (prose && tags) return `{ ${prose} ${tags} }`
  if (prose) return `{ ${prose} }`
  if (tags) return `{ ${tags} }`
  return ''
}

function renderStudySubtree(
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
  const parts: string[] = []

  const prefix = isWhiteToMove
    ? `${fullMoveNumber}. `
    : forceMoveNumber
      ? `${fullMoveNumber}... `
      : ''
  let mainToken = `${prefix}${mainLine.san}`
  if (mainLine.nag !== undefined) mainToken += ` $${mainLine.nag}`
  const mainComment = buildCommentBlock(mainLine)
  if (mainComment) mainToken += ` ${mainComment}`
  parts.push(mainToken)

  for (const variation of variations) {
    const varPrefix = `${fullMoveNumber}${isWhiteToMove ? '.' : '...'} `
    let varToken = `(${varPrefix}${variation.san}`
    if (variation.nag !== undefined) varToken += ` $${variation.nag}`
    const varComment = buildCommentBlock(variation)
    if (varComment) varToken += ` ${varComment}`
    const varCont = renderStudySubtree(variation, nextTurn, nextFullMove, false)
    if (varCont) varToken += ` ${varCont}`
    varToken += ')'
    parts.push(varToken)
  }

  const cont = renderStudySubtree(mainLine, nextTurn, nextFullMove, variations.length > 0)
  if (cont) parts.push(cont)

  return parts.join(' ')
}

/**
 * Serializes a Study chapter tree back into Lichess-compatible PGN preserving root & node `[%csl]/[%cal]`.
 */
export function serializeStudyChapterPgn(
  headers: Record<string, string>,
  rootNode: PgnNode,
  result: string = '*',
): string {
  const headerLines: string[] = []
  const mergedHeaders: Record<string, string> = {
    Event: 'ExtraPawn AI Study',
    Result: result,
    ...headers,
    FEN: rootNode.fenAfter,
    SetUp: '1',
  }
  for (const [k, v] of Object.entries(mergedHeaders)) {
    headerLines.push(`[${k} "${v}"]`)
  }

  const fenParts = rootNode.fenAfter.split(' ')
  const isWhiteToMove = fenParts[1] !== 'b'
  const fullMoveNumber = Math.max(1, Number.parseInt(fenParts[5] || '1', 10) || 1)

  const bodyParts: string[] = []
  const rootBlock = buildCommentBlock(rootNode)
  if (rootBlock) bodyParts.push(rootBlock)

  const movesText = renderStudySubtree(rootNode, isWhiteToMove, fullMoveNumber, false)
  if (movesText) bodyParts.push(movesText)
  bodyParts.push(result || '*')

  return `${headerLines.join('\n')}\n\n${bodyParts.join(' ')}`.trim()
}
