import DOMPurify from 'dompurify'
import { buildPathFromNode } from '@/shared/lib/pgn/pgnTreeOps'
import type { PgnNode } from '@/shared/lib/pgn/pgnTypes'

/**
 * Lookup index mapping normalized chess move tokens (numbered like `1.Nf7+`, `1...Kg8`
 * and bare SAN like `Nf7+`, `O-O`) to their PGN node path inside the active chapter.
 */
export type ChapterSanPathIndex = ReadonlyMap<string, string>

const MOVE_TOKEN_RE =
  /(^|[\s([{"'«„`])((?:\d+\.(?:\.\.)?\s*)?(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?))(?=[?!]*($|[\s.,;:!?)\]}"'»“`]))/g

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeLookupKey(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/[?!]+$/g, '')
}

/**
 * Builds a deterministic lookup map from SAN strings in a chapter tree to `PgnTreeController` paths.
 * Earlier mainline occurrences win on duplicate bare SANs so clicking jumps to the primary appearance.
 */
export function buildChapterSanPathIndex(rootNode: PgnNode): ChapterSanPathIndex {
  const index = new Map<string, string>()
  const rootFenParts = (rootNode.fenAfter || '').split(' ')
  const whiteStarts = rootFenParts[1] !== 'b'
  const startMove = Math.max(1, Number.parseInt(rootFenParts[5] || '1', 10) || 1)

  const register = (key: string, path: string): void => {
    const norm = normalizeLookupKey(key)
    if (norm && !index.has(norm)) {
      index.set(norm, path)
    }
  }

  const visit = (node: PgnNode): void => {
    if (node.ply > 0 && node.san) {
      const path = buildPathFromNode(node)
      const zeroOffset = whiteStarts ? node.ply - 1 : node.ply
      const fullMove = startMove + Math.floor(zeroOffset / 2)
      const isWhite = zeroOffset % 2 === 0
      const numbered = isWhite ? `${fullMove}.${node.san}` : `${fullMove}...${node.san}`
      register(numbered, path)
      register(node.san, path)
      const strippedCheck = node.san.replace(/[+#]$/, '')
      if (strippedCheck !== node.san) {
        register(isWhite ? `${fullMove}.${strippedCheck}` : `${fullMove}...${strippedCheck}`, path)
        register(strippedCheck, path)
      }
    }
    for (const child of node.children) {
      visit(child)
    }
  }

  visit(rootNode)
  return index
}

function linkSanMovesInEscapedSegment(escapedText: string, sanIndex?: ChapterSanPathIndex): string {
  if (!sanIndex || sanIndex.size === 0) return escapedText
  return escapedText.replace(MOVE_TOKEN_RE, (fullMatch, lead: string, token: string) => {
    const cleanKey = normalizeLookupKey(token)
    const bareKey = cleanKey.replace(/^\d+\.(?:\.\.)?/, '')
    const path = sanIndex.get(cleanKey) ?? sanIndex.get(bareKey)
    if (!path) return fullMatch
    const safePath = escapeHtml(path)
    return `${lead}<button type="button" class="coach-san-chip" data-pgn-path="${safePath}">${token}</button>`
  })
}

function renderInlineMarkdown(raw: string, sanIndex?: ChapterSanPathIndex): string {
  // Split around inline code spans first so formatting rules do not mangle code content
  const segments = raw.split(/(`[^`\n]+`)/g)
  return segments
    .map((seg) => {
      if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
        const inner = seg.slice(1, -1).trim()
        if (sanIndex && sanIndex.size > 0) {
          const cleanKey = normalizeLookupKey(inner)
          const bareKey = cleanKey.replace(/^\d+\.(?:\.\.)?/, '')
          const path = sanIndex.get(cleanKey) ?? sanIndex.get(bareKey)
          if (path) {
            return `<button type="button" class="coach-san-chip" data-pgn-path="${escapeHtml(path)}">${escapeHtml(inner)}</button>`
          }
        }
        return `<code class="coach-md-code">${escapeHtml(inner)}</code>`
      }

      let html = escapeHtml(seg)
      // Bold (**text**)
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      // Italic (*text*)
      html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
      // Turn matching chess SANs inside text and bold spans into clickable chapter chips
      html = html
        .split(/(<\/?(?:strong|em)>)/g)
        .map((part) => (part.startsWith('<') ? part : linkSanMovesInEscapedSegment(part, sanIndex)))
        .join('')
      return html
    })
    .join('')
}

/**
 * Renders AI Coach Markdown into XSS-safe HTML (sanitized by DOMPurify) with optional
 * clickable SAN move chips bound via `data-pgn-path` to the active chapter tree.
 */
export function renderCoachMarkdown(rawText: string, sanIndex?: ChapterSanPathIndex): string {
  const normalized = (rawText || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) return ''

  const lines = normalized.split('\n')
  const blocks: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: string[] = []
  let paraLines: string[] = []

  const flushParagraph = (): void => {
    if (paraLines.length === 0) return
    const body = paraLines.map((ln) => renderInlineMarkdown(ln, sanIndex)).join('<br>')
    blocks.push(`<p class="coach-md-p">${body}</p>`)
    paraLines = []
  }

  const flushList = (): void => {
    if (!listType || listItems.length === 0) return
    const cls = listType === 'ul' ? 'coach-md-ul' : 'coach-md-ol'
    blocks.push(`<${listType} class="${cls}">${listItems.join('')}</${listType}>`)
    listType = null
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/)
    if (headingMatch && headingMatch[1]) {
      flushParagraph()
      flushList()
      blocks.push(`<h4 class="coach-md-h">${renderInlineMarkdown(headingMatch[1], sanIndex)}</h4>`)
      continue
    }

    const ulMatch = trimmed.match(/^[-*•]\s+(.+)$/)
    if (ulMatch && ulMatch[1]) {
      flushParagraph()
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(`<li>${renderInlineMarkdown(ulMatch[1], sanIndex)}</li>`)
      continue
    }

    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    // Guard against chess move lines like `1. Nf7+ Kg8` being turned into numbered lists
    const looksLikeChessMove = /^\d+\.\s*(?:O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8])/.test(trimmed)
    if (olMatch && olMatch[1] && !looksLikeChessMove) {
      flushParagraph()
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(`<li>${renderInlineMarkdown(olMatch[1], sanIndex)}</li>`)
      continue
    }

    flushList()
    paraLines.push(trimmed)
  }

  flushParagraph()
  flushList()

  const rawHtml = blocks.join('')
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'h4', 'ul', 'ol', 'li', 'button'],
    ALLOWED_ATTR: ['class', 'type', 'data-pgn-path'],
  })
}
