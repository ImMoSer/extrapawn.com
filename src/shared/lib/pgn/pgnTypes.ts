import type { DrawShape } from '@lichess-org/chessground/draw'

export type { DrawShape }

export const ROOT_NODE_ID = '__ROOT__'
export const STANDARD_START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export const NAG_MAPPING: Record<number, { symbol: string; quality: string }> = {
  1: { symbol: '!', quality: 'best' },
  2: { symbol: '?', quality: 'mistake' },
  3: { symbol: '!!', quality: 'brilliant' },
  4: { symbol: '??', quality: 'blunder' },
  5: { symbol: '!?', quality: 'interesting' },
  6: { symbol: '?!', quality: 'inaccuracy' },
  7: { symbol: '□', quality: 'forced' },
  10: { symbol: '=', quality: 'equal' },
  13: { symbol: '∞', quality: 'unclear' },
  14: { symbol: '±', quality: 'better-white' },
  15: { symbol: '∓', quality: 'better-black' },
  16: { symbol: '±', quality: 'better-white' },
  17: { symbol: '∓', quality: 'better-black' },
  18: { symbol: '+-', quality: 'winning-white' },
  19: { symbol: '-+', quality: 'winning-black' },
  20: { symbol: '+-', quality: 'winning-white' },
  21: { symbol: '-+', quality: 'winning-black' },
  32: { symbol: '⟳', quality: 'development' },
  36: { symbol: '↑', quality: 'initiative' },
  40: { symbol: '→', quality: 'attack' },
  44: { symbol: '⇄', quality: 'counterplay' },
  132: { symbol: '⇆', quality: 'counterplay' },
  146: { symbol: 'N', quality: 'novelty' },
}

export interface PgnNodeMetadata {
  nag?: string
  quality?: string
  [key: string]: unknown
}

export interface PgnNode {
  id: string
  ply: number
  fenBefore: string
  fenAfter: string
  san: string
  uci: string
  parent?: PgnNode | undefined
  children: PgnNode[]
  comment?: string | undefined
  eval?: number | undefined
  nag?: number | undefined
  isCollapsed?: boolean | undefined
  shapes?: DrawShape[] | undefined
  metadata?: PgnNodeMetadata | undefined
}

export interface NewNodeData {
  san: string
  uci: string
  fenBefore: string
  fenAfter: string
  comment?: string
  eval?: number
}

export interface PgnStringOptions {
  showResult?: boolean
  showVariations?: boolean
}
