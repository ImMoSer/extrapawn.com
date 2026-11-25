import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { parsePgn, startingPosition } from 'chessops/pgn'
import { parseSan } from 'chessops/san'

export type ImportSideColor = 'white' | 'black'

export interface LichessUrlValidationResult {
  valid: boolean
  gameId?: string
  urlColor?: ImportSideColor
  errorKey?: string
}

export interface PgnValidationResult {
  valid: boolean
  plies?: number
  white?: string
  black?: string
  result?: string
  errorKey?: string
  errorParams?: Record<string, string | number>
}

export interface FenValidationResult {
  valid: boolean
  turn?: ImportSideColor
  errorKey?: string
}

export const MAX_IMPORT_PGN_PLIES = 300

const LICHESS_URL_RE =
  /^https?:\/\/(?:www\.)?lichess\.org\/(?:game\/)?([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?(?:\/(white|black))?(?:[?#].*)?$/i
const BARE_GAME_ID_RE = /^([A-Za-z0-9]{8})(?:[A-Za-z0-9]{4})?$/

const HEADER_LINE_RE = /^\s*\[[^\]]*\]\s*$/gm
const SEMI_COMMENT_RE = /;[^\n]*/g
const BRACE_COMMENT_RE = /\{[^}]*\}/g
const INNER_PARENS_RE = /\([^()]*\)/g
const MOVE_NUM_JOIN_RE = /(\d+\.+)(?=[A-Za-z0O])/g
const MOVE_NUM_TOKEN_RE = /^\d+\.+$/
const NAG_TOKEN_RE = /^\$\d+$/
const RESULT_TOKENS = new Set(['1-0', '0-1', '1/2-1/2', '*'])

/**
 * Strictly validates a Lichess game URL (or bare 8/12-char ID), stripping any 4-char private player suffix.
 */
export function validateLichessUrlInput(raw: string): LichessUrlValidationResult {
  const cleaned = raw.trim()
  if (!cleaned) {
    return { valid: false, errorKey: 'pages.study.errInvalidLichessUrl' }
  }

  const m = LICHESS_URL_RE.exec(cleaned)
  if (m && m[1]) {
    const rawColor = m[2]?.toLowerCase()
    const urlColor: ImportSideColor | undefined =
      rawColor === 'white' ? 'white' : rawColor === 'black' ? 'black' : undefined
    return { valid: true, gameId: m[1], urlColor }
  }

  const bare = BARE_GAME_ID_RE.exec(cleaned)
  if (bare && bare[1]) {
    return { valid: true, gameId: bare[1] }
  }

  return { valid: false, errorKey: 'pages.study.errInvalidLichessUrl' }
}

function countChar(text: string, target: string): number {
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === target) count += 1
  }
  return count
}

function extractRawMainlineTokens(pgnText: string): string[] | null {
  let text = pgnText.replace(SEMI_COMMENT_RE, '')
  if (countChar(text, '{') !== countChar(text, '}')) return null
  text = text.replace(BRACE_COMMENT_RE, ' ')
  text = text.replace(HEADER_LINE_RE, '')
  if (countChar(text, '(') !== countChar(text, ')')) return null
  while (text.includes('(')) {
    const next = text.replace(INNER_PARENS_RE, ' ')
    if (next === text) return null
    text = next
  }
  text = text.replace(MOVE_NUM_JOIN_RE, '$1 ')
  const tokens: string[] = []
  for (const rawTok of text.split(/\s+/)) {
    const tok = rawTok.trim()
    if (!tok || RESULT_TOKENS.has(tok) || MOVE_NUM_TOKEN_RE.test(tok) || NAG_TOKEN_RE.test(tok)) {
      continue
    }
    tokens.push(tok)
  }
  return tokens
}

/**
 * Strictly validates a single-game PGN using `chessops/pgn` without `.unwrap()` (Fail-Fast on illegal moves).
 */
export function validatePgnInput(raw: string): PgnValidationResult {
  const cleaned = raw.trim()
  if (!cleaned) {
    return { valid: false, errorKey: 'pages.study.errEmptyPgn' }
  }

  const rawTokens = extractRawMainlineTokens(cleaned)
  if (rawTokens === null) {
    return { valid: false, errorKey: 'pages.study.errInvalidPgn' }
  }

  const games = parsePgn(cleaned)
  if (games.length === 0) {
    return { valid: false, errorKey: 'pages.study.errInvalidPgn' }
  }
  if (games.length > 1) {
    return { valid: false, errorKey: 'pages.study.errMultiGamePgn' }
  }

  const game = games[0]
  if (!game) {
    return { valid: false, errorKey: 'pages.study.errInvalidPgn' }
  }

  const variant = (game.headers.get('Variant') ?? 'Standard').trim().toLowerCase()
  if (variant !== 'standard' && variant !== 'from position' && variant !== 'fromposition') {
    return { valid: false, errorKey: 'pages.study.errInvalidPgn' }
  }

  const startRes = startingPosition(game.headers)
  if (startRes.isErr) {
    return { valid: false, errorKey: 'pages.study.errInvalidFen' }
  }

  const pos = startRes.value.clone()
  let ply = 0
  let cursor = game.moves

  while (cursor.children.length > 0) {
    const nextNode = cursor.children[0]
    if (!nextNode) break
    ply += 1
    if (ply > MAX_IMPORT_PGN_PLIES) {
      return {
        valid: false,
        errorKey: 'pages.study.errTooManyPlies',
        errorParams: { max: MAX_IMPORT_PGN_PLIES },
      }
    }
    const san = nextNode.data.san.trim()
    const move = parseSan(pos, san)
    if (!move || !pos.isLegal(move)) {
      return {
        valid: false,
        errorKey: 'pages.study.errIllegalMove',
        errorParams: { move: san || '?', ply },
      }
    }
    pos.play(move)
    cursor = nextNode
  }

  if (ply === 0) {
    return { valid: false, errorKey: 'pages.study.errEmptyPgn' }
  }
  if (ply < rawTokens.length) {
    return {
      valid: false,
      errorKey: 'pages.study.errIllegalMove',
      errorParams: { move: rawTokens[ply] ?? '?', ply: ply + 1 },
    }
  }

  return {
    valid: true,
    plies: ply,
    white: game.headers.get('White') || undefined,
    black: game.headers.get('Black') || undefined,
    result: game.headers.get('Result') || undefined,
  }
}

/**
 * Strictly validates a FEN string via `chessops/fen` + `Chess.fromSetup` without `.unwrap()`.
 */
export function validateFenInput(raw: string): FenValidationResult {
  const cleaned = raw.trim()
  if (!cleaned) {
    return { valid: false, errorKey: 'pages.study.errInvalidFen' }
  }

  const setupRes = parseFen(cleaned)
  if (setupRes.isErr) {
    return { valid: false, errorKey: 'pages.study.errInvalidFen' }
  }

  const posRes = Chess.fromSetup(setupRes.value)
  if (posRes.isErr) {
    return { valid: false, errorKey: 'pages.study.errInvalidFen' }
  }

  return { valid: true, turn: posRes.value.turn }
}
