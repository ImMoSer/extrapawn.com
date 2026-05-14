import type { StudyChapter } from '../model/study.store'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'

/**
 * Checks if a repertoire chapter is fully trimmed for the user's color.
 * Meaning: The user has exactly one prepared response for any given position.
 */
export function isChapterTrimmed(chapter: StudyChapter): boolean {
  if (chapter.chapter_type !== 'repertoire') return false
  if (!chapter.color) return false // Cannot determine without user color

  return checkTreeTrimmed(chapter.root, chapter.color)
}

function checkTreeTrimmed(node: PgnNode, userColor: 'white' | 'black'): boolean {
  if (!node.children || node.children.length === 0) {
    return true
  }

  // ply: 0 is root (start position).
  // ply: 1 is White's first move.
  // ply: 2 is Black's first move.
  // If userColor is 'white', user makes the move AT ply 0, 2, 4... (even ply)
  // If userColor is 'black', user makes the move AT ply 1, 3, 5... (odd ply)
  const isUserTurnToMove =
    (userColor === 'white' && node.ply % 2 === 0) || (userColor === 'black' && node.ply % 2 !== 0)

  if (isUserTurnToMove && node.children.length > 1) {
    return false
  }

  // Check all variations
  for (const child of node.children) {
    if (!checkTreeTrimmed(child, userColor)) {
      return false
    }
  }

  return true
}

/**
 * Checks if a specific node needs trimming.
 * Used for UI highlighting.
 * A node needs trimming if:
 * 1. It is a move by the user's color.
 * 2. It has siblings (parent has multiple children).
 * 3. It is the mainline node (index 0).
 */
export function isNodeNeedingTrim(node: PgnNode, userColor: 'white' | 'black'): boolean {
  if (!node.parent) return false

  // The parent's ply determines whose turn it was to make THIS move.
  const parentPly = node.parent.ply
  const isUserMove =
    (userColor === 'white' && parentPly % 2 === 0) || (userColor === 'black' && parentPly % 2 !== 0)

  if (!isUserMove) return false

  if (node.parent.children.length <= 1) return false

  // Highlight only the mainline node where the user has multiple choices
  if (node.parent.children[0] === node) {
    return true
  }

  return false
}
