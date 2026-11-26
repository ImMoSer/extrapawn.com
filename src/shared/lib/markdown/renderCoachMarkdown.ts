import DOMPurify from 'dompurify'
import { buildPathFromNode } from '@/shared/lib/pgn/pgnTreeOps'
import type { PgnNode } from '@/shared/lib/pgn/pgnTypes'
import { normalizeDrawTokens } from './coachDrawShapes'

/**
 * Lookup index mapping normalized chess move tokens (numbered like `1.Nf7+`, `1...Kg8`
 * and bare SAN like `Nf7+`, `O-O`) to their PGN node path inside the active chapter.
 */
export type ChapterSanPathIndex = ReadonlyMap<string, string>

const MOVE_TOKEN_RE =
  /(^|[\s([{"'«„`>*])((?:\d+\.(?:\.\.)?\s*)?(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8](?:=[QRBN])?[+#]?))(?=[?!]*($|[\s.,;:!?)\]}"'»“`<*]))/g

const CODE_WITH_DRAW_RE = /`([^`\n]+)`(?:\s*\[\s*draw\s*:\s*([^\]]+)\])?/gi
const STANDALONE_DRAW_RE = /\[\s*draw\s*:\s*([^\]]+)\]/gi
const HAS_MOVE_NUM_RE = /^\d+\./
const PLACEHOLDER_RE = /\u0000CHIP(\d+)\u0000/g

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

function resolveSanPath(token: string, sanIndex?: ChapterSanPathIndex): string | undefined {
  if (!sanIndex || sanIndex.size === 0) return undefined
  const cleanKey = normalizeLookupKey(token)
  if (!cleanKey) return undefined
  // Strict priority: if an explicit move number was given (e.g. `5...dxe6`), NEVER jump to a different move!
  if (HAS_MOVE_NUM_RE.test(cleanKey)) {
    return sanIndex.get(cleanKey)
  }
  return sanIndex.get(cleanKey)
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

/**
 * Extracts all chapter PGN paths mentioned inside a chat turn's markdown text
 * (used to display reverse `💬` discussion bookmarks inside the PGN tree).
 */
export function extractMentionedPathsFromText(
  rawText: string,
  sanIndex: ChapterSanPathIndex,
): string[] {
  if (!rawText || sanIndex.size === 0) return []
  const found = new Set<string>()

  CODE_WITH_DRAW_RE.lastIndex = 0
  let cm: RegExpExecArray | null = CODE_WITH_DRAW_RE.exec(rawText)
  while (cm !== null) {
    const inner = (cm[1] ?? '').trim()
    const path = resolveSanPath(inner, sanIndex)
    if (path) found.add(path)
    cm = CODE_WITH_DRAW_RE.exec(rawText)
  }

  const withoutDraw = rawText.replace(STANDALONE_DRAW_RE, ' ')
  MOVE_TOKEN_RE.lastIndex = 0
  let mm: RegExpExecArray | null = MOVE_TOKEN_RE.exec(withoutDraw)
  while (mm !== null) {
    const tok = mm[2] ?? ''
    const path = resolveSanPath(tok, sanIndex)
    if (path) found.add(path)
    mm = MOVE_TOKEN_RE.exec(withoutDraw)
  }

  return Array.from(found)
}

function buildSanChipHtml(label: string, path: string, drawTokens: string[]): string {
  const safePath = escapeHtml(path)
  const safeLabel = escapeHtml(label)
  if (drawTokens.length > 0) {
    const safeDraw = escapeHtml(drawTokens.join(','))
    return (
      `<button type="button" class="coach-san-chip coach-san-chip--draw" ` +
      `data-pgn-path="${safePath}" data-draw="${safeDraw}">` +
      `${safeLabel}<span class="coach-draw-mark" aria-hidden="true">↗</span></button>`
    )
  }
  return `<button type="button" class="coach-san-chip" data-pgn-path="${safePath}">${safeLabel}</button>`
}

function buildStandaloneDrawHtml(drawTokens: string[]): string {
  if (drawTokens.length === 0) return ''
  const safeDraw = escapeHtml(drawTokens.join(','))
  return (
    `<button type="button" class="coach-draw-chip" data-draw="${safeDraw}" ` +
    `title="${safeDraw}">↗</button>`
  )
}

function linkSanMovesInEscapedSegment(escapedText: string, sanIndex?: ChapterSanPathIndex): string {
  if (!sanIndex || sanIndex.size === 0) return escapedText
  return escapedText.replace(MOVE_TOKEN_RE, (fullMatch, lead: string, token: string) => {
    const path = resolveSanPath(token, sanIndex)
    if (!path) return fullMatch
    return `${lead}${buildSanChipHtml(token, path, [])}`
  })
}

function renderInlineMarkdown(raw: string, sanIndex?: ChapterSanPathIndex): string {
  const chips: string[] = []
  const putChip = (html: string): string => {
    const idx = chips.length
    chips.push(html)
    return `\u0000CHIP${idx}\u0000`
  }

  // 1. Replace backtick code spans (+ optional attached `[draw: ...]`) with safe placeholders FIRST
  //    so `**` bold wrappers across `` `5...dxe6` `` never break!
  let staged = raw.replace(
    CODE_WITH_DRAW_RE,
    (_full, rawInner: string, rawDraw: string | undefined) => {
      const inner = rawInner.trim()
      const drawTokens = rawDraw ? normalizeDrawTokens(rawDraw) : []
      const path = resolveSanPath(inner, sanIndex)
      if (path) {
        return putChip(buildSanChipHtml(inner, path, drawTokens))
      }
      if (drawTokens.length > 0) {
        const safeDraw = escapeHtml(drawTokens.join(','))
        return putChip(
          `<button type="button" class="coach-md-code coach-draw-inline" data-draw="${safeDraw}">` +
            `${escapeHtml(inner)}<span class="coach-draw-mark" aria-hidden="true">↗</span></button>`,
        )
      }
      return putChip(`<code class="coach-md-code">${escapeHtml(inner)}</code>`)
    },
  )

  // 2. Replace any remaining standalone `[draw: ...]` directives cleanly
  staged = staged.replace(STANDALONE_DRAW_RE, (_full, rawDraw: string) => {
    const tokens = normalizeDrawTokens(rawDraw)
    return tokens.length > 0 ? putChip(buildStandaloneDrawHtml(tokens)) : ''
  })

  // 3. Escape remaining text, then apply Bold (**...**) and Italic (*...*) across placeholders!
  let html = escapeHtml(staged)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')

  // 4. Link plain-text SAN moves outside tags & placeholders
  html = html
    .split(/(<\/?(?:strong|em)>|\u0000CHIP\d+\u0000)/g)
    .map((part) => {
      if (part.startsWith('<') || part.startsWith('\u0000CHIP')) return part
      return linkSanMovesInEscapedSegment(part, sanIndex)
    })
    .join('')

  // 5. Restore chip HTML placeholders
  return html.replace(PLACEHOLDER_RE, (_m, idxStr: string) => chips[Number(idxStr)] ?? '')
}

/**
 * Renders AI Coach Markdown into XSS-safe HTML (sanitized by DOMPurify) with
 * clickable SAN chips (`data-pgn-path`) and inline Lichess visual arrows (`data-draw`).
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
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'h4', 'ul', 'ol', 'li', 'button', 'span'],
    ALLOWED_ATTR: ['class', 'type', 'data-pgn-path', 'data-draw', 'title', 'aria-hidden'],
  })
}
