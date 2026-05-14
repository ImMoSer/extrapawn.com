// Browser-side move explainer.
// Lichess-style win-rate sigmoid + top-N comparison.
// SEE-based sacrifice detection. Tactical motifs: fork, pin, skewer,
// discovered check, removal-of-defender.

import { Chess } from 'chess.js'
import { analyzeMove as wasmAnalyzeMove, isReady as wasmReady } from './analyzer-rs.js'

const PIECE_VALUE = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 20_000 }
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

const PST = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Coordinate / board helpers
// ───────────────────────────────────────────────────────────────────────────

function squareToFR(sq) {
  return [sq.charCodeAt(0) - 97, parseInt(sq[1], 10) - 1]
}

function frToSquare(file, rank) {
  return String.fromCharCode(97 + file) + (rank + 1)
}

export function getPSTValue(pieceType, square, color) {
  const [file, rank] = squareToFR(square)
  const table = PST[pieceType]
  if (!table) return 0
  const row = color === 'w' ? 7 - rank : rank
  return table[row][file]
}

function findKing(chess, color) {
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      if (p && p.type === 'k' && p.color === color) return frToSquare(f, 7 - r)
    }
  }
  return null
}

function iterateBoardSquares(chess, callback) {
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f]
      if (piece) callback(frToSquare(f, 7 - r), piece)
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Win-rate model (Lichess-style sigmoid)
// ───────────────────────────────────────────────────────────────────────────

// Lichess win-rate model. cp clamped to ±1000 (the sigmoid is essentially
// flat past ±10 pawns); coefficient 0.00368208 matches lichess/lila exactly.
export function winRate(cpWhitePOV) {
  const clamped = Math.max(-1000, Math.min(1000, cpWhitePOV))
  return 100 / (1 + Math.exp(-0.00368208 * clamped))
}

// Loss-based judgment ladder. `loss` is win-rate percentage-points lost
// vs. engine best. Thresholds tuned slightly tighter than vanilla Lichess
// (4 / 8 / 12 / 20 / 30) so the ladder has a usable middle: most "looks
// fine" moves land in `good`/`neutral` rather than collapsing into a
// single bucket.
function classifyByLoss(loss) {
  if (loss < 4) return 'excellent'
  if (loss < 8) return 'good'
  if (loss < 12) return 'neutral'
  if (loss < 20) return 'inaccuracy'
  if (loss < 30) return 'mistake'
  return 'blunder'
}

// ───────────────────────────────────────────────────────────────────────────
// Static Exchange Evaluation (SEE)
//
// Returns the net material that the side starting an exchange on `square`
// expects to gain (in centipawns). Exchanges that lose material return 0
// thanks to the "stand pat" `Math.max(0, …)` at each level of the recursion.
//
// chess.attackers() correctly accounts for x-ray attackers as we mutate the
// board, because each recursive call recomputes attackers on the current
// position. We snapshot the FEN before mutating and restore afterwards.
// ───────────────────────────────────────────────────────────────────────────

export function see(chess, square, attackingColor) {
  const target = chess.get(square)
  if (!target) return 0
  const attackers = chess.attackers(square, attackingColor)
  if (!attackers || attackers.length === 0) return 0

  // Cheapest attacker
  let cheapestSq = attackers[0]
  let cheapestVal = PIECE_VALUE[chess.get(cheapestSq).type]
  for (const sq of attackers) {
    const v = PIECE_VALUE[chess.get(sq).type]
    if (v < cheapestVal) {
      cheapestVal = v
      cheapestSq = sq
    }
  }

  const capturedValue = PIECE_VALUE[target.type]
  const fenSnap = chess.fen()
  const attackerPiece = { ...chess.get(cheapestSq) }

  chess.remove(cheapestSq)
  chess.remove(square)
  chess.put({ type: attackerPiece.type, color: attackerPiece.color }, square)

  const opponent = attackingColor === 'w' ? 'b' : 'w'
  const opponentGain = see(chess, square, opponent)

  chess.load(fenSnap)

  return Math.max(0, capturedValue - opponentGain)
}

// ───────────────────────────────────────────────────────────────────────────
// Tactical motifs
// ───────────────────────────────────────────────────────────────────────────

function squaresAttackedFrom(chess, fromSquare) {
  const piece = chess.get(fromSquare)
  if (!piece) return []
  const attacked = []
  iterateBoardSquares(chess, (sq) => {
    if (sq === fromSquare) return
    const a = chess.attackers(sq, piece.color)
    if (a && a.includes(fromSquare)) attacked.push(sq)
  })
  return attacked
}

function detectFork(chessAfter, toSquare, movingPiece) {
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const attacked = squaresAttackedFrom(chessAfter, toSquare).filter((sq) => {
    const p = chessAfter.get(sq)
    return p && p.color === opponent
  })
  if (attacked.length < 2) return null
  const targets = attacked.map((sq) => ({ square: sq, type: chessAfter.get(sq).type }))
  const moverVal = PIECE_VALUE[movingPiece.type]
  const significant = targets.filter((t) => t.type === 'k' || PIECE_VALUE[t.type] > moverVal)
  if (significant.length === 0) return null
  return targets
}

function detectDiscoveredCheck(chessAfter, toSquare, movingPiece) {
  if (!chessAfter.inCheck()) return false
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const kingSq = findKing(chessAfter, opponent)
  if (!kingSq) return false
  const checkers = chessAfter.attackers(kingSq, movingPiece.color)
  if (!checkers || checkers.length === 0) return false
  return !checkers.includes(toSquare)
}

function rayDirections(pieceType) {
  if (pieceType === 'r')
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
  if (pieceType === 'b')
    return [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]
  if (pieceType === 'q')
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]
  return []
}

// Pin: along a ray from the moving (sliding) piece, the first enemy is
// LESS valuable than the second.
function detectPin(chessAfter, toSquare, movingPiece) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const [fromFile, fromRank] = squareToFR(toSquare)
  for (const [df, dr] of rayDirections(movingPiece.type)) {
    let first = null
    let second = null
    for (let i = 1; i < 8; i++) {
      const f = fromFile + df * i
      const r = fromRank + dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const sq = frToSquare(f, r)
      const piece = chessAfter.get(sq)
      if (!piece) continue
      if (!first) {
        if (piece.color === opponent) first = { square: sq, type: piece.type }
        else break
      } else {
        if (piece.color === opponent) second = { square: sq, type: piece.type }
        break
      }
    }
    if (first && second && PIECE_VALUE[second.type] > PIECE_VALUE[first.type]) {
      return { pinned: first, behind: second }
    }
  }
  return null
}

// Skewer: the inverse of a pin. First enemy along the ray is MORE valuable;
// it must move and exposes a less-valuable piece behind it.
function detectSkewer(chessAfter, toSquare, movingPiece) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const [fromFile, fromRank] = squareToFR(toSquare)
  for (const [df, dr] of rayDirections(movingPiece.type)) {
    let first = null
    let second = null
    for (let i = 1; i < 8; i++) {
      const f = fromFile + df * i
      const r = fromRank + dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const sq = frToSquare(f, r)
      const piece = chessAfter.get(sq)
      if (!piece) continue
      if (!first) {
        if (piece.color === opponent) first = { square: sq, type: piece.type }
        else break
      } else {
        if (piece.color === opponent) second = { square: sq, type: piece.type }
        break
      }
    }
    if (first && second && PIECE_VALUE[first.type] > PIECE_VALUE[second.type]) {
      return { skewered: first, behind: second }
    }
  }
  return null
}

function detectRemovalOfDefender(chessBefore, chessAfter, capturedSquare) {
  if (!capturedSquare) return null
  const captured = chessBefore.get(capturedSquare)
  if (!captured) return null
  let result = null
  iterateBoardSquares(chessAfter, (sq, piece) => {
    if (result) return
    if (piece.color !== captured.color || piece.type === 'k') return
    const defendersBefore = chessBefore.attackers(sq, captured.color)
    if (!defendersBefore || !defendersBefore.includes(capturedSquare)) return
    if (!isHangingByMaterial(chessBefore, sq) && isHangingByMaterial(chessAfter, sq)) {
      result = { square: sq, type: piece.type }
    }
  })
  return result
}

// Quick "hangs material" check used by removal-of-defender. Cheap heuristic
// (cheapest attacker < piece value); the SEE-based version below is for
// real sacrifice detection.
function isHangingByMaterial(chess, square) {
  const piece = chess.get(square)
  if (!piece || piece.type === 'k') return false
  const opponent = piece.color === 'w' ? 'b' : 'w'
  const attackers = chess.attackers(square, opponent)
  if (!attackers || attackers.length === 0) return false
  const defenders = chess.attackers(square, piece.color)
  if (!defenders || defenders.length === 0) return true
  const minAttackerVal = Math.min(...attackers.map((s) => PIECE_VALUE[chess.get(s).type]))
  return minAttackerVal < PIECE_VALUE[piece.type]
}

// SEE-based sacrifice: would the opponent's optimal capture sequence
// against `toSquare` net them at least 200cp, accounting for any piece we
// captured on this move?
function detectSacrificeViaSEE(chessAfter, toSquare, movingPiece, capturedPiece) {
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const opponentGain = see(chessAfter, toSquare, opponent)
  const recovered = capturedPiece ? PIECE_VALUE[capturedPiece.type] : 0
  const netMaterial = recovered - opponentGain // mover's POV
  return netMaterial <= -200
}

// ───────────────────────────────────────────────────────────────────────────
// Move metadata
// ───────────────────────────────────────────────────────────────────────────

function getMoveMeta(fenBefore, moveUCI) {
  const chess = new Chess(fenBefore)
  const from = moveUCI.slice(0, 2)
  const to = moveUCI.slice(2, 4)
  const promotion = moveUCI[4] || 'q'
  try {
    const m = chess.move({ from, to, promotion })
    if (m) return { san: m.san, flags: m.flags, promotion: m.promotion }
  } catch {
    /* fallthrough */
  }
  return { san: moveUCI, flags: '', promotion: null }
}

// ───────────────────────────────────────────────────────────────────────────
// Classifier
//
//   loss   = wrBest_mover - wrPlayed_mover    (in win-rate percentage points)
//   onlyMoveGap = wrBest_mover - wrSecondBest_mover
//   isOnlyMove  = onlyMoveGap >= 15           (best is uniquely good)
//   difficulty  = how skewed the position already was
//                 (decided positions weight loss less)
//
// Quality ladder:
//   brilliant = best move + only-move + real (SEE) sacrifice + position not already won
//   great     = best move + only-move
//   best      = engine's top choice
//   good      = effective loss < 3 pp
//   neutral   = effective loss < 6 pp
//   inaccuracy= effective loss < 12 pp
//   mistake   = effective loss < 20 pp
//   blunder   = effective loss ≥ 20 pp
// ───────────────────────────────────────────────────────────────────────────

function moverScoreToWhite(scoreMoverPOV, moverColor) {
  return moverColor === 'w' ? scoreMoverPOV : -scoreMoverPOV
}

// ───────────────────────────────────────────────────────────────────────────
// Sophisticated move classifier
//
// The signal is a fusion of THREE engine-derived dimensions:
//
//   1. Win-rate loss (the standard Lichess metric).
//        loss = wrBest − wrPlayed, in percentage points.
//
//   2. Position complexity (how hard was it to find the best move?).
//        complexity = number of multi-PV alternatives within 50cp of best.
//        Forced positions (complexity = 1) are easy → finding best ≈ free.
//        Rich positions (complexity ≥ 4) reward finding best more strongly.
//
//   3. Sacrifice quality (is "best" a non-obvious tactical resource?).
//        We use the Rust analyzer's eval-aware sacrifice flag — which fires
//        only when the offered piece pays for itself with structural,
//        threat, or king-safety compensation. Plain SEE-based detection
//        misclassifies routine captures as sacrifices.
//
// Quality ladder:
//
//   brilliant   — best move + REAL sacrifice + complexity ≥ 2 + position
//                 not already won. Demands all three: there's plausible
//                 alternatives, the chosen move offers material, and that
//                 offering is sound (Rust verifies). One-dim "best+SEE<0"
//                 over-fires here.
//   great       — best move AND (only-move OR critical decision).
//                 only-move:     wrBest − wrSecond ≥ 10pp
//                 critical:      wrBefore moved by ≥ 15pp from this turn
//   best        — engine's top choice; nothing else special.
//   excellent   — non-best top-3 with loss < 4pp (effectively as good).
//   good        — loss < 8pp.
//   neutral     — loss < 12pp (kept for backwards-compat with the UI ladder).
//   inaccuracy  — loss < 20pp.
//   mistake     — loss < 30pp.
//   blunder     — loss ≥ 30pp, OR drops a winning position to losing.
//   missed_mate — best had mate, played didn't.
// ───────────────────────────────────────────────────────────────────────────

const COMPLEXITY_BAND_CP = 50 // moves within this much of best are "plausible"

function classifyMove({
  fenBefore,
  moveUCI,
  moverColor,
  evalBeforeWhite,
  evalAfterWhite,
  topMoves,
  legacySacrifice,
}) {
  const wrMover = (cpWhite) => (moverColor === 'w' ? winRate(cpWhite) : 100 - winRate(cpWhite))

  const best = topMoves && topMoves[0]
  const second = topMoves && topMoves[1]
  const playedInTop = topMoves && topMoves.find((m) => m.move === moveUCI)

  const bestWhite = best ? moverScoreToWhite(best.score, moverColor) : evalAfterWhite
  const secondWhite = second ? moverScoreToWhite(second.score, moverColor) : bestWhite

  const wrBefore = wrMover(evalBeforeWhite)
  const wrPlayed = wrMover(evalAfterWhite)
  const wrBest = wrMover(bestWhite)
  const wrSecond = wrMover(secondWhite)

  const loss = Math.max(0, wrBest - wrPlayed)
  const onlyMoveGap = wrBest - wrSecond
  const isOnlyMove = onlyMoveGap >= 10
  const isBestMove = best && best.move === moveUCI
  const inTop3 = topMoves && topMoves.slice(0, 3).some((m) => m.move === moveUCI)

  // Position complexity: how many multi-PV alternatives are within 50cp
  // of the best move's score? Mover-POV scores from the engine.
  let complexity = 1
  if (topMoves && topMoves.length > 0) {
    const bestScore = topMoves[0].score
    complexity = topMoves.filter((m) => Math.abs(m.score - bestScore) <= COMPLEXITY_BAND_CP).length
  }
  const isCriticalPosition = onlyMoveGap >= 15 || (best && Math.abs(bestWhite - secondWhite) >= 100)

  // Eval-aware sacrifice from the Rust analyzer when available. This is
  // the gating signal for "brilliant": only a verified sacrifice (visible
  // compensation) qualifies — never a plain SEE-negative move.
  let realSacrifice = false
  if (wasmReady() && fenBefore && moveUCI) {
    try {
      const r = wasmAnalyzeMove(fenBefore, moveUCI)
      if (r && Array.isArray(r.motifs)) {
        realSacrifice = r.motifs.some((m) => m.id === 'sacrifice')
      }
    } catch {
      /* ignore */
    }
  }
  // Fall back to the old SEE-only check ONLY if WASM isn't ready and the
  // caller already computed a legacy sacrifice flag for us.
  if (!wasmReady() && legacySacrifice) {
    realSacrifice = true
  }

  // Decided-position guard: brilliant requires real stakes. If the side
  // is already winning by 600cp+ (≈90% win rate), no shot at brilliant.
  const positionDecided = wrBefore >= 90 || wrBefore <= 10

  // Detect missed mate.
  const bestHasMate = best && best.mate !== null && best.mate !== undefined
  const playedHasMate = playedInTop && playedInTop.mate !== null && playedInTop.mate !== undefined
  const missedMate = bestHasMate && !playedHasMate

  // Brutal threshold: dropping winning to losing is always a blunder
  // even when raw loss is small (e.g. wrBefore=92, wrPlayed=8 = -84pp).
  const lostWin = wrBefore >= 75 && wrPlayed <= 35

  // "Obvious move" guard. Even a forced-only-move is *not* a "great"
  // move if it's something a beginner would play instinctively:
  //   - Recapture: opponent just took our piece, we take theirs back.
  //   - Free capture: enemy piece sitting on a SEE-positive square,
  //                   capturing it gains material outright.
  //   - Forced response: only one legal move (e.g. the only check escape).
  //
  // We demote `great` → `best` for these. (We still keep them as "best"
  // so the user knows they played the engine's choice — just not the
  // "brilliant find" implication of `great`.)
  const isObviousCapture = (() => {
    if (!fenBefore) return false
    try {
      const c = new Chess(fenBefore)
      const fromSq = moveUCI.slice(0, 2)
      const toSq = moveUCI.slice(2, 4)
      const movingPiece = c.get(fromSq)
      const targetPiece = c.get(toSq)
      if (!movingPiece || !targetPiece) return false
      // Must be capturing an enemy piece.
      if (targetPiece.color === movingPiece.color) return false
      // Recovered ≥ moved (so we win or break even materially) AND the
      // SEE on the target square is non-negative for us before we move.
      const recovered = PIECE_VALUE[targetPiece.type]
      const moved = PIECE_VALUE[movingPiece.type]
      if (recovered < moved - 50) return false
      const oppGain = see(c, toSq, movingPiece.color === 'w' ? 'b' : 'w')
      return recovered - oppGain >= 0
    } catch {
      return false
    }
  })()
  // Strict "is there literally only one legal move?" check via chess.js.
  // Previously this used `topMoves.length === 1`, which is the engine's
  // MultiPV reply count — semantically wrong (a position with 30 legal
  // moves and MultiPV=1 would have a single-element topMoves but
  // shouldn't be treated as forced).
  const onlyLegalMove = (() => {
    if (!fenBefore) return false
    try {
      const c = new Chess(fenBefore)
      return c.moves().length === 1
    } catch {
      return false
    }
  })()

  let quality
  if (missedMate) {
    quality = 'missed_mate'
  } else if (isBestMove && realSacrifice && complexity >= 2 && !positionDecided) {
    quality = 'brilliant'
  } else if (
    isBestMove &&
    (isOnlyMove || isCriticalPosition) &&
    !isObviousCapture &&
    !onlyLegalMove
  ) {
    quality = 'great'
  } else if (isBestMove) {
    quality = 'best'
  } else if (lostWin) {
    quality = 'blunder'
  } else if (inTop3 && loss < 4) {
    quality = 'excellent'
  } else {
    quality = classifyByLoss(loss)
  }

  return {
    quality,
    loss,
    effectiveLoss: loss,
    wrBefore,
    wrPlayed,
    wrBest,
    wrSecond,
    onlyMoveGap,
    isBestMove,
    isOnlyMove,
    isCriticalPosition,
    complexity,
    realSacrifice,
    bestMoveUCI: best ? best.move : null,
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Public entry point
// ───────────────────────────────────────────────────────────────────────────

export function explainMove(fenBefore, fenAfter, moveUCI, evalBefore, evalAfter, opts = {}) {
  const chessBefore = new Chess(fenBefore)
  const chessAfter = new Chess(fenAfter)

  const from = moveUCI.slice(0, 2)
  const to = moveUCI.slice(2, 4)
  const movingPiece = chessBefore.get(from)
  const captured = chessBefore.get(to)
  const sideToMove = chessBefore.turn()
  const opponent = sideToMove === 'w' ? 'b' : 'w'

  const { san, flags, promotion: promotedTo } = getMoveMeta(fenBefore, moveUCI)
  const explanations = []
  const factors = []
  const motifs = []

  // Legacy SEE-only sacrifice flag — used only as fallback when the WASM
  // analyzer hasn't initialised yet. The classifier prefers the eval-aware
  // version from Rust whenever available.
  const legacySacrifice = movingPiece
    ? detectSacrificeViaSEE(chessAfter, to, movingPiece, captured)
    : false

  // Classify against engine top moves.
  const cls = classifyMove({
    fenBefore,
    moveUCI,
    moverColor: sideToMove,
    evalBeforeWhite: evalBefore,
    evalAfterWhite: evalAfter,
    topMoves: opts.topMoves || [],
    legacySacrifice,
  })
  // Use whichever sacrifice signal the classifier ended up trusting so
  // motifs / tagline composition stay consistent with the verdict.
  const sacrifice = cls.realSacrifice
  if (sacrifice) motifs.push('sacrifice')
  let quality = cls.quality

  // Eval delta from mover's POV (display only).
  const evalDeltaCp = sideToMove === 'w' ? evalAfter - evalBefore : evalBefore - evalAfter

  // ───── Terminal-state shortcuts ─────
  if (chessAfter.isCheckmate()) {
    return {
      san,
      summary: 'Checkmate!',
      details: 'Delivers checkmate. The opponent has no legal response.',
      // Mate is the best possible outcome — classify as 'best', not
      // 'brilliant'. Brilliant is reserved for non-obvious sacrifices.
      quality: 'best',
      factors: [{ type: 'checkmate', value_pawns: 100 }],
      motifs: ['checkmate'],
      evalBefore: evalBefore / 100,
      evalAfter: evalAfter / 100,
      evalDelta: evalDeltaCp / 100,
      winRateLoss: 0,
      isBestMove: true,
      isOnlyMove: cls.isOnlyMove,
      bestMoveUCI: cls.bestMoveUCI,
    }
  }
  if (chessAfter.isStalemate()) {
    const wasWinning = sideToMove === 'w' ? evalBefore > 200 : evalBefore < -200
    return {
      san,
      summary: wasWinning ? 'Stalemate — throws away the win!' : 'Stalemate (draw)',
      details: 'The opponent has no legal moves and is not in check.',
      quality: wasWinning ? 'blunder' : 'neutral',
      factors: [{ type: 'stalemate', value_pawns: 0 }],
      motifs: ['stalemate'],
      evalBefore: evalBefore / 100,
      evalAfter: 0,
      evalDelta: wasWinning ? -evalBefore / 100 : 0,
      winRateLoss: cls.loss,
      isBestMove: cls.isBestMove,
      isOnlyMove: cls.isOnlyMove,
      bestMoveUCI: cls.bestMoveUCI,
    }
  }

  if (chessAfter.isThreefoldRepetition()) motifs.push('threefold-repetition')
  if (chessAfter.isDrawByFiftyMoves()) motifs.push('fifty-move-rule')
  if (chessAfter.isInsufficientMaterial()) motifs.push('insufficient-material')

  // ───── Capture / castling / en passant / promotion (via Move flags) ─────
  if (captured) {
    explanations.push(`Captures the ${PIECE_NAME[captured.type]}`)
    factors.push({
      type: 'capture',
      piece: captured.type,
      value_pawns: PIECE_VALUE[captured.type] / 100,
    })
    motifs.push('capture')
  }
  if (flags.includes('k')) {
    explanations.push('Castles kingside')
    factors.push({ type: 'castling', side: 'king', value_pawns: 0.5 })
    motifs.push('castling-kingside')
  } else if (flags.includes('q')) {
    explanations.push('Castles queenside')
    factors.push({ type: 'castling', side: 'queen', value_pawns: 0.5 })
    motifs.push('castling-queenside')
  }
  if (flags.includes('e')) {
    explanations.push('Captures en passant')
    motifs.push('en-passant')
  }
  if (flags.includes('p') && promotedTo) {
    explanations.push(`Promotes to ${PIECE_NAME[promotedTo]}`)
    factors.push({
      type: 'promotion',
      piece: promotedTo,
      value_pawns: PIECE_VALUE[promotedTo] / 100,
    })
    motifs.push('promotion')
  }

  // ───── Tactical motifs ─────
  if (movingPiece) {
    const fork = detectFork(chessAfter, to, movingPiece)
    if (fork) {
      const targetNames = fork.map((t) => PIECE_NAME[t.type]).join(' and ')
      explanations.push(`Forks the opponent's ${targetNames}`)
      factors.push({ type: 'fork', targets: fork.map((t) => t.type), value_pawns: 1.5 })
      motifs.push('fork')
    }

    if (detectDiscoveredCheck(chessAfter, to, movingPiece)) {
      explanations.push('Reveals a discovered check')
      factors.push({ type: 'discovered_check', value_pawns: 1.0 })
      motifs.push('discovered-check')
    }

    const pin = detectPin(chessAfter, to, movingPiece)
    if (pin) {
      explanations.push(
        `Pins the ${PIECE_NAME[pin.pinned.type]} against the ${PIECE_NAME[pin.behind.type]}`,
      )
      factors.push({ type: 'pin', value_pawns: 0.7 })
      motifs.push('pin')
    }

    const skewer = detectSkewer(chessAfter, to, movingPiece)
    if (skewer) {
      explanations.push(
        `Skewers the ${PIECE_NAME[skewer.skewered.type]}, exposing the ${PIECE_NAME[skewer.behind.type]}`,
      )
      factors.push({ type: 'skewer', value_pawns: 1.0 })
      motifs.push('skewer')
    }

    const removal = detectRemovalOfDefender(chessBefore, chessAfter, captured ? to : null)
    if (removal) {
      explanations.push(`Removes the defender of the ${PIECE_NAME[removal.type]}`)
      factors.push({ type: 'removal_of_defender', value_pawns: 0.8 })
      motifs.push('removal-of-defender')
    }

    if (chessAfter.inCheck() && !motifs.includes('discovered-check')) {
      explanations.push('Gives check')
      factors.push({ type: 'check', value_pawns: 0.5 })
      motifs.push('check')
    }

    if (sacrifice) {
      explanations.push(`Sacrifices the ${PIECE_NAME[movingPiece.type]} for tactical compensation`)
      factors.push({ type: 'sacrifice', value_pawns: PIECE_VALUE[movingPiece.type] / 100 })
    }

    // (The legacy positional explanations — "improves activity",
    //  "retreats to a passive square", "stakes a claim in the center",
    //  "centralizes a piece", "develops the X", "increases pressure
    //  on the opponent's king" — were tell-not-show filler that got
    //  spammed onto every move regardless of whether it was actually
    //  the reason. They've been removed.
    //
    //  The Rust motif analyzer's concrete tagline ("Knight invades f5",
    //  "Greek gift sacrifice — Bxh7+", "Trades into the endgame")
    //  already covers this ground with WHO + WHERE + WHAT, so
    //  the explainer's job here is now strictly classification +
    //  win-rate math, not duplicate prose generation.)
    void movingPiece
    void from
    void to
    void opponent
    void chessAfter
    void chessBefore
  }

  // Mate-in-N annotation.
  let mateNote = ''
  if (opts.mateAfter !== undefined && opts.mateAfter !== null) {
    const myMate =
      (sideToMove === 'w' && opts.mateAfter > 0) || (sideToMove === 'b' && opts.mateAfter < 0)
    const n = Math.abs(opts.mateAfter)
    mateNote = myMate ? ` Forces mate in ${n}.` : ` (Opponent has mate in ${n}.)`
  }

  // Build summary using both quality and a context-aware addendum.
  const summaries = {
    brilliant: 'A brilliant move — a non-obvious tactical resource.',
    great: 'A great move — the only move that keeps the advantage.',
    best: 'The best move in the position.',
    excellent: 'Excellent — practically as strong as the engine choice.',
    good: 'A solid move that maintains the balance.',
    neutral: 'A reasonable move; close alternatives were marginally better.',
    inaccuracy: 'A slight inaccuracy — better options were available.',
    mistake: 'A mistake. The position is now worse than it should be.',
    blunder: 'A blunder. This loses significant advantage.',
    missed_mate: 'Missed a forced mate.',
  }
  let summary = summaries[quality] || 'A move.'

  // Append "best was X" for non-best classifications, when we know the alternative.
  let bestMoveSan = null
  if (!cls.isBestMove && cls.bestMoveUCI && cls.bestMoveUCI !== moveUCI) {
    bestMoveSan = uciToSanSafe(fenBefore, cls.bestMoveUCI)
  }

  const details =
    explanations.length > 0
      ? explanations.join('. ') + '.' + mateNote
      : 'A quiet positional move.' + mateNote

  return {
    san,
    summary,
    details,
    quality,
    factors,
    motifs,
    evalBefore: evalBefore / 100,
    evalAfter: evalAfter / 100,
    evalDelta: evalDeltaCp / 100,
    winRateLoss: parseFloat(cls.loss.toFixed(2)),
    effectiveLoss: parseFloat(cls.effectiveLoss.toFixed(2)),
    onlyMoveGap: parseFloat(cls.onlyMoveGap.toFixed(2)),
    isBestMove: cls.isBestMove,
    isOnlyMove: cls.isOnlyMove,
    bestMoveUCI: cls.bestMoveUCI,
    bestMoveSan,
  }
}

// Local helper so explainer doesn't need to import from chess.js helpers.
function uciToSanSafe(fen, uci) {
  if (typeof uci !== 'string' || uci.length < 4) return uci
  try {
    const c = new Chess(fen)
    const m = c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })
    return m ? m.san : uci
  } catch {
    return uci
  }
}

export {
  see as _see, // exported for tests / debugging
  detectSkewer as _detectSkewer,
  detectSacrificeViaSEE as _detectSacrificeViaSEE,
}
