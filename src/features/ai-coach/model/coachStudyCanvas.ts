import {
  extractMentionedPathsFromText,
  type ChapterSanPathIndex,
} from '@/shared/lib/markdown/renderCoachMarkdown'
import { buildPathFromNode } from '@/shared/lib/pgn/pgnTreeOps'
import { NAG_MAPPING, STANDARD_START_FEN, type PgnNode } from '@/shared/lib/pgn/pgnTypes'
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
 * Builds a map of mainline-only `pgnPath -> ply` so assistant chat bookmarks stay
 * cleanly focused on key mainline moments rather than cluttering side-variation trees.
 */
export function buildMainlinePathPlyMap(rootNode: PgnNode): ReadonlyMap<string, number> {
  const map = new Map<string, number>()
  let cursor = rootNode.children[0]
  while (cursor) {
    map.set(buildPathFromNode(cursor), cursor.ply)
    cursor = cursor.children[0]
  }
  return map
}

/**
 * Maps chapter PGN paths to the latest chat `turn.id` that discussed that move:
 * - Assistant turns: strictly numbered mainline moves (`ply >= 5` on full games from startpos so
 *   opening-name citations like `1.e4 c5 2.f4` do not spam bookmarks; `ply >= 1` on custom FENs).
 * - User turns: explicitly numbered moves AND anchored board questions (`turn.board_fen`) on ANY
 *   node including side variations.
 */
export function buildDiscussedPathsMap(
  turns: readonly StudyTurnRecord[],
  sanIndex: ChapterSanPathIndex,
  fen4Index: ReadonlyMap<string, string>,
  rootFen: string,
  mainlinePathPlies?: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const result = new Map<string, number>()
  if (turns.length === 0) return result

  const rootFen4 = extractFen4(rootFen)
  const isStandardStart = rootFen4 === extractFen4(STANDARD_START_FEN)
  const minAssistantPly = isStandardStart ? 5 : 1

  for (const turn of turns) {
    if (turn.role === 'system') continue

    if (sanIndex.size > 0 && turn.content) {
      const mentioned = extractMentionedPathsFromText(turn.content, sanIndex, {
        numberedOnly: true,
      })
      for (const path of mentioned) {
        if (turn.role === 'assistant' && mainlinePathPlies) {
          const ply = mainlinePathPlies.get(path)
          if (ply === undefined || ply < minAssistantPly) continue
        }
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
