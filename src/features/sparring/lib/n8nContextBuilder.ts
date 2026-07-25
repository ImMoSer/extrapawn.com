import { Chess } from 'chess.js'
import { useCoachStore } from '@/features/coach'
import { QUALITY_LABEL } from '@/shared/lib/engine/coach/coach.types'
import type { CoachTopMove } from '@/shared/lib/engine/coach/coach.types'

const PIECE_NAMES: Record<string, string> = {
  p: 'pawn',
  n: 'Knight',
  b: 'Bishop',
  r: 'Rook',
  q: 'Queen',
  k: 'King',
}

export interface MoveDescription {
  uci: string
  san: string
  verbal: string
}

/**
 * Parses a move (UCI or SAN) in a given FEN position and returns
 * { uci: 'e2e4', san: 'e4', verbal: 'pawn to e4' }
 */
export function parseMoveDescription(fen: string, moveInput: string): MoveDescription {
  if (!fen || !moveInput) {
    return { uci: moveInput || '', san: moveInput || '', verbal: moveInput || '' }
  }

  try {
    const chess = new Chess(fen)
    let move: import('chess.js').Move | null = null

    // 1. Try parsing moveInput as SAN first (e.g. "e4", "Nf3")
    try {
      move = chess.move(moveInput)
    } catch {
      /* ignore */
    }

    // 2. If SAN failed, try parsing moveInput as UCI (e.g. "e2e4")
    if (!move && moveInput.length >= 4) {
      try {
        const from = moveInput.slice(0, 2)
        const to = moveInput.slice(2, 4)
        const promotion = moveInput[4] || undefined
        move = chess.move({ from, to, promotion })
      } catch {
        /* ignore */
      }
    }

    if (!move) {
      return { uci: moveInput, san: moveInput, verbal: moveInput }
    }

    const uci = `${move.from}${move.to}${move.promotion || ''}`
    const san = move.san

    if (san === 'O-O') {
      return { uci, san, verbal: 'Kingside castling' }
    }
    if (san === 'O-O-O') {
      return { uci, san, verbal: 'Queenside castling' }
    }

    const pieceName = PIECE_NAMES[move.piece] || move.piece
    const action = move.captured ? 'takes' : 'to'
    const verbal = `${pieceName} ${action} ${move.to}`

    return { uci, san, verbal }
  } catch {
    return { uci: moveInput, san: moveInput, verbal: moveInput }
  }
}

/**
 * Formats last user move analysis into an LLM-Ready single-line string (compact format).
 * Example (Theory): "d2d4 (san: d4, "pawn to d4") | Theory: Queen's Pawn Game [A40] (33% plays, 50% W)"
 * Example (Engine): "c1g5 (san: Bg5, "Bishop to g5") | Quality: Neutral (-8.1%) | Better: a3"
 */
export function buildLastUserMoveText(): string | null {
  const coachStore = useCoachStore()
  const analysis = coachStore.lastMoveAnalysis
  if (!analysis || analysis.loading || !analysis.san) {
    return null
  }

  const fen = analysis.fen || ''
  const rawMove = (analysis.move as string) || (analysis.uci as string) || analysis.san
  const { uci, san, verbal } = parseMoveDescription(fen, rawMove)

  if (analysis.opening && (analysis.opening.name || analysis.opening.eco)) {
    const nameStr = analysis.opening.name || 'Theory Move'
    const ecoStr = analysis.opening.eco ? ` [${analysis.opening.eco}]` : ''
    const winStr = typeof analysis.opening.win_p === 'number' ? `, ${analysis.opening.win_p.toFixed(0)}% W` : ''
    const popStr = analysis.opening.popularity_p ? ` (${analysis.opening.popularity_p.toFixed(0)}% plays${winStr})` : ''

    return `${uci} (san: ${san}, "${verbal}") | Theory: ${nameStr}${ecoStr}${popStr}`
  }

  const quality = analysis.quality
    ? (QUALITY_LABEL[analysis.quality] || analysis.quality)
    : 'Neutral'

  const dropStr = typeof analysis.winRateLoss === 'number' && analysis.winRateLoss > 0
    ? ` (-${analysis.winRateLoss.toFixed(1)}%)`
    : ''

  const consequenceStr = coachStore.lastMoveConsequence ? ` | ${String(coachStore.lastMoveConsequence)}` : ''
  const betterStr = analysis.bestMoveSan && !analysis.isBestMove ? ` | Better: ${analysis.bestMoveSan}` : ''

  return `${uci} (san: ${san}, "${verbal}") | Quality: ${quality}${dropStr}${consequenceStr}${betterStr}`
}

/**
 * Formats top moves in position into an LLM-Ready text block.
 * Example:
 * 1. (+0.21) uci: e2e4 (san: e4, "pawn to e4") [King's Pawn Game] - Stakes a claim in the center. Plan: Improves piece activity.
 * 2. (+0.15) uci: d2d4 (san: d4, "pawn to d4") [Queen's Pawn Game] - Stakes a claim in the center. Plan: Improves piece activity.
 */
export function buildTopMovesText(fen: string): string | null {
  const coachStore = useCoachStore()
  const moves = coachStore.topMoves
  if (!moves || moves.length === 0) {
    return null
  }

  const lines: string[] = []
  const enrichedList = coachStore.currentExplanation?.engine_top_moves || []

  moves.slice(0, 5).forEach((m: CoachTopMove & { move?: string }, idx: number) => {
    const rank = idx + 1
    const evalStr = m.isMate
      ? `M${m.mateIn}`
      : (m.eval_pawns > 0 ? `+${m.eval_pawns.toFixed(2)}` : `${m.eval_pawns.toFixed(2)}`)

    const rawMove = m.move || m.uci || m.san
    const { uci, san, verbal } = parseMoveDescription(fen, rawMove)
    const enriched = enrichedList.find((em: CoachTopMove) => em.san === san)

    const openingPart = m.name ? ` [${m.name}]` : ''
    const taglinePart = m.tagline ? ` - ${m.tagline}` : ''
    const planPart = enriched?.plan_brief ? `. Plan: ${enriched.plan_brief}` : ''

    lines.push(`${rank}. (${evalStr}) uci: ${uci} (san: ${san}, "${verbal}")${openingPart}${taglinePart}${planPart}`)
  })

  return lines.join('\n')
}
