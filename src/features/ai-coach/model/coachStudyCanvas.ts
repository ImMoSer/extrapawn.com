import {
  extractMentionedPathsFromText,
  type ChapterSanPathIndex,
} from '@/shared/lib/markdown/renderCoachMarkdown'
import { buildPathFromNode } from '@/shared/lib/pgn/pgnTreeOps'
import { NAG_MAPPING, type PgnNode } from '@/shared/lib/pgn/pgnTypes'
import type { StudyTurnRecord } from './coachStudy.types'

export interface StudyAnchorMoveInfo {
  moveLabel: string
  isBranch: boolean
}

/**
 * Extracts the first 4 positional fields of a FEN (`board turn castling ep`),
 * ignoring halfmove/fullmove counters for reliable position matching.
 */
export function extractFen4(fen: string): string {
  const trimmed = (fen || '').trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/).slice(0, 4).join(' ')
}

/**
 * Builds a mainline-first lookup map from 4-field FEN strings to PGN node paths.
 * Skips the root node (`ply === 0`) so start-position chats do not light up move bookmarks.
 */
export function buildChapterFen4PathIndex(rootNode: PgnNode): ReadonlyMap<string, string> {
  const index = new Map<string, string>()

  const visit = (node: PgnNode): void => {
    if (node.ply > 0 && node.fenAfter) {
      const fen4 = extractFen4(node.fenAfter)
      if (fen4 && !index.has(fen4)) {
        index.set(fen4, buildPathFromNode(node))
      }
    }
    for (const child of node.children) {
      visit(child)
    }
  }

  visit(rootNode)
  return index
}

/**
 * Maps chapter PGN paths to the latest chat `turn.id` that discussed that move
 * (either by explicit SAN mentions in chat text or by anchored user `board_fen`).
 */
export function buildDiscussedPathsMap(
  turns: readonly StudyTurnRecord[],
  sanIndex: ChapterSanPathIndex,
  fen4Index: ReadonlyMap<string, string>,
  rootFen: string,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>()
  if (turns.length === 0) return result

  const rootFen4 = extractFen4(rootFen)

  for (const turn of turns) {
    if (turn.role === 'system') continue

    if (sanIndex.size > 0 && turn.content) {
      const mentioned = extractMentionedPathsFromText(turn.content, sanIndex)
      for (const path of mentioned) {
        result.set(path, turn.id)
      }
    }

    if (turn.role === 'user' && turn.board_fen && fen4Index.size > 0) {
      const turnFen4 = extractFen4(turn.board_fen)
      if (turnFen4 && turnFen4 !== rootFen4) {
        const boardPath = fen4Index.get(turnFen4)
        if (boardPath) {
          result.set(boardPath, turn.id)
        }
      }
    }
  }

  return result
}

/**
 * Checks whether a PGN node sits strictly on the chapter's main line (first child all the way to root).
 */
export function isNodeOnMainline(node: PgnNode): boolean {
  let cursor: PgnNode | undefined = node
  while (cursor && cursor.parent) {
    if (cursor.parent.children[0] !== cursor) {
      return false
    }
    cursor = cursor.parent
  }
  return true
}

/**
 * Formats a concise human-readable move label for the chat composer's `📍` context anchor pill
 * (e.g. `19...Qd8??`, `5.Nf3`), returning empty `moveLabel` at root (`ply === 0`).
 */
export function formatStudyAnchorMoveLabel(node: PgnNode, rootNode: PgnNode): StudyAnchorMoveInfo {
  if (node.ply === 0 || !node.san) {
    return { moveLabel: '', isBranch: false }
  }

  const rootFenParts = (rootNode.fenAfter || '').split(' ')
  const whiteStarts = rootFenParts[1] !== 'b'
  const startMove = Math.max(1, Number.parseInt(rootFenParts[5] || '1', 10) || 1)
  const zeroOffset = whiteStarts ? node.ply - 1 : node.ply
  const fullMove = startMove + Math.floor(zeroOffset / 2)
  const isWhite = zeroOffset % 2 === 0
  const prefix = isWhite ? `${fullMove}.` : `${fullMove}...`
  const nagSymbol = node.nag !== undefined ? (NAG_MAPPING[node.nag]?.symbol ?? '') : ''

  return {
    moveLabel: `${prefix}${node.san}${nagSymbol}`,
    isBranch: !isNodeOnMainline(node),
  }
}
