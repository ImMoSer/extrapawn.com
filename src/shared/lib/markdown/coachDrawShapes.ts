import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'
import { parseSquare } from 'chessops/util'

const BRUSH_BY_CODE: Record<string, string> = {
  G: 'green',
  R: 'red',
  B: 'blue',
  Y: 'yellow',
}

const SINGLE_TOKEN_RE = /^([GRBY])([a-h][1-8])([a-h][1-8])?$/i
const DRAW_DIRECTIVE_RE = /\[\s*draw\s*:\s*([^\]]+)\]/gi

/**
 * Validates and normalizes a comma/space-separated Lichess draw token string
 * (e.g. `"Gc4c7, Rd8f8, Ye6"`) into canonical uppercase tokens (dropping malformed items).
 */
export function normalizeDrawTokens(raw: string): string[] {
  const tokens: string[] = []
  const seen = new Set<string>()
  for (const part of raw.split(/[\s,;]+/)) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const m = SINGLE_TOKEN_RE.exec(trimmed)
    if (!m || !m[1] || !m[2]) continue
    const color = m[1].toUpperCase()
    const fromSq = m[2].toLowerCase()
    const toSq = m[3]?.toLowerCase()
    if (parseSquare(fromSq) === undefined) continue
    if (toSq !== undefined) {
      if (toSq === fromSq || parseSquare(toSq) === undefined) continue
    }
    const canon = toSq ? `${color}${fromSq}${toSq}` : `${color}${fromSq}`
    if (!seen.has(canon)) {
      seen.add(canon)
      tokens.push(canon)
    }
  }
  return tokens
}

/**
 * Parses a validated draw string (`"Gc4c7,Rd8f8,Ye6"`) into Chessground `DrawShape[]`.
 */
export function parseDrawTokensToShapes(raw: string): DrawShape[] {
  const shapes: DrawShape[] = []
  for (const token of normalizeDrawTokens(raw)) {
    const colorCode = token[0] ?? ''
    const brush = BRUSH_BY_CODE[colorCode]
    if (!brush) continue
    const orig = token.slice(1, 3) as Key
    if (token.length === 5) {
      const dest = token.slice(3, 5) as Key
      shapes.push({ orig, dest, brush })
    } else {
      shapes.push({ orig, brush })
    }
  }
  return shapes
}

/**
 * Extracts shapes from the LAST standalone `[draw: ...]` directive in a coach message
 * (ignoring directives immediately attached to a backtick move chip like `` `19...Qd8`[draw: ...] ``).
 */
export function extractLatestStandaloneDrawShapes(rawText: string): DrawShape[] {
  let latestRaw = ''
  const text = rawText || ''
  DRAW_DIRECTIVE_RE.lastIndex = 0
  let match: RegExpExecArray | null = DRAW_DIRECTIVE_RE.exec(text)
  while (match !== null) {
    const before = text.slice(Math.max(0, match.index - 24), match.index)
    const attachedToCodeChip = /`[^`\n]+`\s*$/.test(before)
    if (!attachedToCodeChip && match[1]) {
      latestRaw = match[1]
    }
    match = DRAW_DIRECTIVE_RE.exec(text)
  }
  return latestRaw ? parseDrawTokensToShapes(latestRaw) : []
}
