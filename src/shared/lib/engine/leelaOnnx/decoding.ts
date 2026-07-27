import { POLICY_INDEX_MAP } from './policyIndex'
import { flipUci } from './encoding'

export interface DecodedMove {
  move: string // UCI format (e.g. "e2e4")
  confidence: number // probability 0-1
}

export interface DecodeResult {
  best: DecodedMove
  topMoves: DecodedMove[] // top 5 moves by probability
}

/**
 * Decode the 1858-element policy output into the best legal move.
 *
 * For black, moves are flipped to match the policy index (which is always
 * from white's perspective), then flipped back for the result.
 *
 * Knight promotion uses the normal move encoding (4 chars, no suffix).
 * Queen/rook/bishop promotions use explicit suffixes.
 */
export function decodePolicyOutput(
  policyLogits: Float32Array,
  legalMoves: string[],
  isBlack: boolean,
  temperature: number = 0
): DecodeResult {
  if (legalMoves.length === 0) {
    throw new Error('No legal moves to decode')
  }

  const moveLogits: { move: string; logit: number }[] = []

  for (const uci of legalMoves) {
    // For black, flip the move to white's perspective for policy lookup
    const canonicalMove = isBlack ? flipUci(uci) : uci
    let index = POLICY_INDEX_MAP.get(canonicalMove)

    // Knight promotion: strip the 'n' suffix and use normal move encoding
    if (index === undefined && canonicalMove.endsWith('n')) {
      index = POLICY_INDEX_MAP.get(canonicalMove.slice(0, 4))
    }

    if (index === undefined) {
      console.warn(`No policy index found for move: ${uci} (canonical: ${canonicalMove})`)
      continue
    }

    moveLogits.push({ move: uci, logit: policyLogits[index] })
  }

  if (moveLogits.length === 0) {
    throw new Error('No legal moves could be mapped to policy indices')
  }

  // Apply softmax to get probabilities (with temperature scaling)
  const maxLogit = Math.max(...moveLogits.map(m => m.logit))
  const temp = temperature > 0 ? temperature : 1 // temperature only affects sampling, not softmax shape when 0
  const exps = moveLogits.map(m => Math.exp((m.logit - maxLogit) / temp))
  const sumExp = exps.reduce((a, b) => a + b, 0)
  const probs = exps.map(e => e / sumExp)

  const scoredMoves: DecodedMove[] = moveLogits.map((m, i) => ({
    move: m.move,
    confidence: probs[i],
  }))

  scoredMoves.sort((a, b) => b.confidence - a.confidence)

  // Temperature 0 = always pick best move, >0 = sample from distribution
  let selected: DecodedMove
  if (temperature > 0) {
    const rand = Math.random()
    let cumulative = 0
    selected = scoredMoves[scoredMoves.length - 1] // fallback
    for (const move of scoredMoves) {
      cumulative += move.confidence
      if (rand <= cumulative) {
        selected = move
        break
      }
    }
  } else {
    selected = scoredMoves[0]
  }

  return {
    best: selected,
    topMoves: scoredMoves.slice(0, 5),
  }
}
