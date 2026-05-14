// Comprehensive positional motif detection for the move list.
//
// PRIMARY backend: the Rust/WASM analyzer in ./analyzer-rs.js. It does
// rigorous bitboard-based detection with proper SEE — pin/skewer
// require strict value differences, fork/trapped-piece are SEE-aware,
// hanging is SEE-aware, etc.
//
// FALLBACK backend (this file, below): pure-JS chess.js detectors that
// run when the WASM module hasn't initialised yet (the very first move
// after page load) or fails. Same output shape so callers don't care.
//
// Output:
//   quickExplain(fen, moveUCI) → { san, motifs[], tagline, fenAfter }
//   explainPV(startFen, pvUcis, plies) → [{ san, tagline }, …]

import { Chess } from 'chess.js'
import { analyzeMove, analyzePv, composeTagline, isReady } from './analyzer-rs.js'

const PIECE_VALUE = { p: 100, n: 300, b: 320, r: 500, q: 900, k: 20_000 }
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

// ── Geometry ────────────────────────────────────────────────────────────────
function frToSquare(f, r) {
  return String.fromCharCode(97 + f) + (r + 1)
}
function squareToFR(sq) {
  return [sq.charCodeAt(0) - 97, parseInt(sq[1], 10) - 1]
}
function fileLetter(idx) {
  return String.fromCharCode(97 + idx)
}
function squareIsLight(sq) {
  const [f, r] = squareToFR(sq)
  return (f + r) % 2 === 1
}

// ── Board scans ─────────────────────────────────────────────────────────────
function findKing(chess, color) {
  const board = chess.board()
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      if (p && p.type === 'k' && p.color === color) return frToSquare(f, 7 - r)
    }
  return null
}
function findPieces(chess, color, type) {
  const out = []
  const board = chess.board()
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      if (p && p.color === color && (type ? p.type === type : true)) {
        out.push({ square: frToSquare(f, 7 - r), type: p.type })
      }
    }
  return out
}

// Squares attacked by the piece on `fromSquare` (for any side).
function squaresAttackedFrom(chess, fromSquare) {
  const piece = chess.get(fromSquare)
  if (!piece) return []
  const out = []
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const sq = frToSquare(f, r)
      if (sq === fromSquare) continue
      const a = chess.attackers(sq, piece.color)
      if (a && a.includes(fromSquare)) out.push(sq)
    }
  return out
}

// Cheap "is square X hanging?" — attacker cheaper than piece, or no defenders.
function isHangingApprox(chess, square) {
  const piece = chess.get(square)
  if (!piece || piece.type === 'k') return false
  const opp = piece.color === 'w' ? 'b' : 'w'
  const a = chess.attackers(square, opp)
  if (!a || a.length === 0) return false
  const d = chess.attackers(square, piece.color)
  if (!d || d.length === 0) return true
  const minA = Math.min(...a.map((s) => PIECE_VALUE[chess.get(s).type] || 100))
  return minA < PIECE_VALUE[piece.type]
}

// ── Pawn structure ──────────────────────────────────────────────────────────
function pawnsByFile(chess, color) {
  const counts = new Array(8).fill(0)
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = chess.get(frToSquare(f, r))
      if (p && p.type === 'p' && p.color === color) counts[f]++
    }
  return counts
}
function isIsolated(file, pawnsByFileArr) {
  const left = file > 0 ? pawnsByFileArr[file - 1] : 0
  const right = file < 7 ? pawnsByFileArr[file + 1] : 0
  return left === 0 && right === 0
}
function isPassed(chess, square, color) {
  const [file, rank] = squareToFR(square)
  const enemy = color === 'w' ? 'b' : 'w'
  for (const df of [-1, 0, 1]) {
    const f = file + df
    if (f < 0 || f > 7) continue
    for (let r = 0; r < 8; r++) {
      const p = chess.get(frToSquare(f, r))
      if (!p || p.type !== 'p' || p.color !== enemy) continue
      if (color === 'w' && r > rank) return false
      if (color === 'b' && r < rank) return false
    }
  }
  return true
}
function isBackwardPawn(chess, square, color) {
  // Pawn that can't be defended by a friendly pawn (no friendly pawn behind on
  // adjacent files) AND is blocked from advancing by an enemy pawn or piece on
  // the next square.
  const piece = chess.get(square)
  if (!piece || piece.type !== 'p' || piece.color !== color) return false
  const [file, rank] = squareToFR(square)
  const forward = color === 'w' ? 1 : -1
  // Friendly pawn behind on adjacent files?
  for (const df of [-1, 1]) {
    const f = file + df
    if (f < 0 || f > 7) continue
    for (let r = 0; r < 8; r++) {
      const p = chess.get(frToSquare(f, r))
      if (!p || p.type !== 'p' || p.color !== color) continue
      // White: behind = lower rank. Black: behind = higher rank.
      if (color === 'w' && r <= rank) return false
      if (color === 'b' && r >= rank) return false
    }
  }
  // Front square blocked or under attack by enemy pawn that we can't dispute?
  const frontR = rank + forward
  if (frontR < 0 || frontR > 7) return false
  const front = chess.get(frToSquare(file, frontR))
  if (front && front.color !== color) return true
  // Enemy pawn covers our front square?
  const enemy = color === 'w' ? 'b' : 'w'
  for (const df of [-1, 1]) {
    const f = file + df
    if (f < 0 || f > 7) continue
    const r2 = rank + 2 * forward
    if (r2 < 0 || r2 > 7) continue
    const p = chess.get(frToSquare(f, r2))
    if (p && p.type === 'p' && p.color === enemy) return true
  }
  return false
}
function isOutpost(chess, square, piece) {
  if (!['n', 'b'].includes(piece.type)) return false
  const [file, rank] = squareToFR(square)
  if (piece.color === 'w' && rank < 4) return false
  if (piece.color === 'b' && rank > 3) return false
  const enemy = piece.color === 'w' ? 'b' : 'w'
  for (const df of [-1, 1]) {
    const f = file + df
    if (f < 0 || f > 7) continue
    for (let r = 0; r < 8; r++) {
      const p = chess.get(frToSquare(f, r))
      if (!p || p.type !== 'p' || p.color !== enemy) continue
      if (piece.color === 'w' && r >= rank + 1) return false
      if (piece.color === 'b' && r <= rank - 1) return false
    }
  }
  // Outpost is meaningful only if the piece is defended by a friendly pawn
  // OR the piece is on rank 5/6 (4 in 0-index for white) — high-impact even
  // without a pawn supporter.
  const supportRank = rank + (piece.color === 'w' ? -1 : 1)
  for (const df of [-1, 1]) {
    const f = file + df
    if (f < 0 || f > 7) continue
    if (supportRank < 0 || supportRank > 7) continue
    const p = chess.get(frToSquare(f, supportRank))
    if (p && p.type === 'p' && p.color === piece.color) return true
  }
  // Without pawn support: only count rank 5+ for white, rank 4- for black.
  return piece.color === 'w' ? rank >= 4 : rank <= 3
}

// Bucketed value for pin/skewer reasoning. Knight ≡ bishop here so a real
// pin requires a *strictly heavier* piece behind: rook (5) or queen (9)
// behind a minor (3), queen behind a rook, king (100) behind anything.
// Using raw centipawn values caused "knight pinned to bishop" to fire
// because bishop (320) > knight (300).
const PIN_VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 }

// ── Tactical helpers ────────────────────────────────────────────────────────
function detectPin(chessAfter, fromSq, movingPiece) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const dirs =
    movingPiece.type === 'r'
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : movingPiece.type === 'b'
        ? [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
        : [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
  const [f0, r0] = squareToFR(fromSq)
  for (const [df, dr] of dirs) {
    let first = null,
      second = null
    for (let i = 1; i < 8; i++) {
      const f = f0 + df * i,
        r = r0 + dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const p = chessAfter.get(frToSquare(f, r))
      if (!p) continue
      if (!first) {
        if (p.color === opponent) first = { type: p.type }
        else break
      } else {
        if (p.color === opponent) second = { type: p.type }
        break
      }
    }
    // Rear piece must be STRICTLY heavier on the bucketed scale.
    if (first && second && (PIN_VALUE[second.type] || 0) > (PIN_VALUE[first.type] || 0)) {
      return { pinned: first.type, behind: second.type }
    }
  }
  return null
}
function detectSkewer(chessAfter, fromSq, movingPiece) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const dirs =
    movingPiece.type === 'r'
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : movingPiece.type === 'b'
        ? [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
        : [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
  const [f0, r0] = squareToFR(fromSq)
  for (const [df, dr] of dirs) {
    let first = null,
      second = null
    for (let i = 1; i < 8; i++) {
      const f = f0 + df * i,
        r = r0 + dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const p = chessAfter.get(frToSquare(f, r))
      if (!p) continue
      if (!first) {
        if (p.color === opponent) first = { type: p.type }
        else break
      } else {
        if (p.color === opponent) second = { type: p.type }
        break
      }
    }
    // Front piece must be STRICTLY heavier on the bucketed scale.
    if (first && second && (PIN_VALUE[first.type] || 0) > (PIN_VALUE[second.type] || 0)) {
      return { skewered: first.type, behind: second.type }
    }
  }
  return null
}
function detectDiscoveredCheck(chessAfter, toSq, movingPiece) {
  if (!chessAfter.inCheck()) return false
  const opponent = movingPiece.color === 'w' ? 'b' : 'w'
  const kingSq = findKing(chessAfter, opponent)
  if (!kingSq) return false
  const checkers = chessAfter.attackers(kingSq, movingPiece.color)
  if (!checkers || checkers.length === 0) return false
  return !checkers.includes(toSq)
}
// Trapped piece: opponent piece (n/b/r/q) where every legal move lands it
// on a hanging square. Skipped if 0 moves (likely pinned, separate concept).
function isTrappedOpponentPiece(chess, square) {
  const piece = chess.get(square)
  if (!piece || piece.type === 'k' || piece.type === 'p') return false
  const moves = chess.moves({ square, verbose: true })
  if (moves.length === 0) return false
  const fenSnap = chess.fen()
  for (const m of moves) {
    try {
      chess.move(m)
      const safe = !isHangingApprox(chess, m.to)
      chess.load(fenSnap)
      if (safe) return false
    } catch {
      try {
        chess.load(fenSnap)
      } catch {
        /* ignore */
      }
    }
  }
  return true
}

// ── Centralization (real central control gain) ─────────────────────────────
const CENTER_LARGE = new Set([
  'c3',
  'c4',
  'c5',
  'c6',
  'd3',
  'd4',
  'd5',
  'd6',
  'e3',
  'e4',
  'e5',
  'e6',
  'f3',
  'f4',
  'f5',
  'f6',
])
const CENTER_CORE = new Set(['d4', 'd5', 'e4', 'e5'])
function centralControlOf(chess, fromSquare) {
  const attacked = squaresAttackedFrom(chess, fromSquare)
  let core = 0,
    large = 0
  for (const sq of attacked) {
    if (CENTER_CORE.has(sq)) core++
    else if (CENTER_LARGE.has(sq)) large++
  }
  return { core, large }
}

// ── Bishop diagnostics ──────────────────────────────────────────────────────
function isBadBishop(chess, square, piece) {
  if (piece.type !== 'b') return false
  const myColor = piece.color
  const lightBishop = squareIsLight(square)
  let blocking = 0
  const board = chess.board()
  for (let r = 0; r < 8; r++)
    for (let f = 0; f < 8; f++) {
      const p = board[r][f]
      if (!p || p.type !== 'p' || p.color !== myColor) continue
      const sq = frToSquare(f, 7 - r)
      if (squareIsLight(sq) === lightBishop) blocking++
    }
  return blocking >= 5
}
function countBishops(chess, color) {
  return findPieces(chess, color, 'b').length
}

// ── Battery (must be aimed at a meaningful target) ─────────────────────────
function detectBatteryAimed(chessAfter, fromSquare, movingPiece) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  const dirs =
    movingPiece.type === 'r'
      ? [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]
      : movingPiece.type === 'b'
        ? [
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
        : [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [-1, 1],
            [1, -1],
            [-1, -1],
          ]
  const [f0, r0] = squareToFR(fromSquare)
  // Search both forward and backward along every ray for a friendly slider
  // partner; in either case, also check if the SAME line (extended outward
  // from us) terminates at a meaningful enemy target (king / queen / rook).
  for (const [df, dr] of dirs) {
    // Outward (looking for target through enemies)
    let target = null
    for (let i = 1; i < 8; i++) {
      const f = f0 + df * i,
        r = r0 + dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const p = chessAfter.get(frToSquare(f, r))
      if (!p) continue
      if (p.color === movingPiece.color) break // friendly blocks
      if (['k', 'q', 'r'].includes(p.type)) target = { sq: frToSquare(f, r), type: p.type }
      break
    }
    // Backward (looking for partner)
    let partner = null
    for (let i = 1; i < 8; i++) {
      const f = f0 - df * i,
        r = r0 - dr * i
      if (f < 0 || f > 7 || r < 0 || r > 7) break
      const p = chessAfter.get(frToSquare(f, r))
      if (!p) continue
      if (p.color !== movingPiece.color) break
      if (['b', 'r', 'q'].includes(p.type)) {
        // Partner must move along this ray's directions.
        const partnerDirs =
          p.type === 'r'
            ? [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
              ]
            : p.type === 'b'
              ? [
                  [1, 1],
                  [-1, 1],
                  [1, -1],
                  [-1, -1],
                ]
              : [
                  [1, 0],
                  [-1, 0],
                  [0, 1],
                  [0, -1],
                  [1, 1],
                  [-1, 1],
                  [1, -1],
                  [-1, -1],
                ]
        if (partnerDirs.some(([dx, dy]) => dx === df && dy === dr)) {
          partner = { type: p.type }
        }
      }
      break
    }
    if (partner && target) return { partner, target }
  }
  return null
}

// ── Connected rooks ────────────────────────────────────────────────────────
function detectConnectsRooks(chessAfter, color) {
  const rooks = findPieces(chessAfter, color, 'r')
  if (rooks.length < 2) return false
  // Same back rank with no pieces between?
  const backRank = color === 'w' ? 0 : 7
  const onBack = rooks.filter((r) => squareToFR(r.square)[1] === backRank)
  if (onBack.length < 2) return false
  const [a, b] = onBack
  const [af] = squareToFR(a.square)
  const [bf] = squareToFR(b.square)
  const lo = Math.min(af, bf),
    hi = Math.max(af, bf)
  for (let f = lo + 1; f < hi; f++) {
    if (chessAfter.get(frToSquare(f, backRank))) return false
  }
  return true
}

// ── Knight on the rim (a/h file, opening) ──────────────────────────────────
function isKnightOnRim(chess, square, piece, moveNumber) {
  if (piece.type !== 'n' || moveNumber > 16) return false
  const [file] = squareToFR(square)
  return file === 0 || file === 7
}

// ── Luft (back-rank king + adjacent pawn pushes one) ───────────────────────
// Real luft is created in response to a back-rank threat. This detector
// only fires when ALL of:
//   • king is on its first rank
//   • the pawn is directly adjacent to the king (within 1 file)
//   • the pawn is on its starting rank (single push from rank 2 / rank 7)
//   • there's an actual back-rank threat: an enemy rook or queen on a
//     file with no friendly pawn blocking it from the king's rank
// Without that last condition, h3 / f3 fires constantly for any quiet
// king-side pawn move, which is the bug the user flagged.
function isLuft(chessBefore, chessAfter, fromSquare, toSquare, movingPiece, moverColor) {
  if (movingPiece.type !== 'p') return false
  const kingSq = findKing(chessAfter, moverColor)
  if (!kingSq) return false
  const [kf, kr] = squareToFR(kingSq)
  const expectedKingRank = moverColor === 'w' ? 0 : 7
  if (kr !== expectedKingRank) return false
  const [pf, fr] = squareToFR(fromSquare)
  if (Math.abs(kf - pf) > 1) return false // adjacent only
  const [, tr] = squareToFR(toSquare)
  if (Math.abs(tr - fr) !== 1) return false // single push
  const expectedPawnRank = moverColor === 'w' ? 1 : 6
  if (fr !== expectedPawnRank) return false

  // Back-rank threat check: any enemy R/Q on a file with no friendly pawn
  // blocking. We check chessBefore (the position the move is responding to).
  const enemy = moverColor === 'w' ? 'b' : 'w'
  for (let f = 0; f < 8; f++) {
    let hasEnemyHeavy = false
    let myPawnOnFile = false
    for (let r = 0; r < 8; r++) {
      const p = chessBefore.get(frToSquare(f, r))
      if (!p) continue
      if (p.color === enemy && (p.type === 'r' || p.type === 'q')) hasEnemyHeavy = true
      if (p.color === moverColor && p.type === 'p') myPawnOnFile = true
    }
    if (hasEnemyHeavy && !myPawnOnFile) return true
  }
  return false
}

// ── Pawn-structure flags (computed once per call from pawnsByFile counts) ─
function isIQP(pawnsByFileArr) {
  // d-file pawn with no friendly pawns on c or e files.
  return pawnsByFileArr[3] >= 1 && pawnsByFileArr[2] === 0 && pawnsByFileArr[4] === 0
}
function detectHangingPawnsPair(pawnsByFileArr) {
  // Two adjacent pawns with no friendly pawns on flanking files.
  // "c+d hanging" = pawns on c & d, none on b or e.
  if (
    pawnsByFileArr[2] >= 1 &&
    pawnsByFileArr[3] >= 1 &&
    pawnsByFileArr[1] === 0 &&
    pawnsByFileArr[4] === 0
  )
    return 'cd'
  if (
    pawnsByFileArr[3] >= 1 &&
    pawnsByFileArr[4] >= 1 &&
    pawnsByFileArr[2] === 0 &&
    pawnsByFileArr[5] === 0
  )
    return 'de'
  return null
}

// ── Long diagonal posting (bishop or queen on a1-h8 or h1-a8) ─────────────
function isLongDiagonal(square) {
  const [f, r] = squareToFR(square)
  if (f === r) return 'a1-h8' // long light diagonal
  if (f === 7 - r) return 'h1-a8' // long dark diagonal
  return null
}

// ── Pawn storm (multiple advanced pawns toward enemy king's wing) ───────────
function isPawnStorm(chessAfter, toSquare, movingPiece, moverColor, opponentColor) {
  if (movingPiece.type !== 'p') return false
  const oppKing = findKing(chessAfter, opponentColor)
  if (!oppKing) return false
  const [okf] = squareToFR(oppKing)
  const [tf, tr] = squareToFR(toSquare)
  // Same wing: queenside (files 0-3) or kingside (files 4-7).
  const sameWing = okf <= 3 === tf <= 3
  if (!sameWing) return false
  // The moving pawn must be advanced past its starting rank (white > 1, black < 6).
  const pawnAdvanced = moverColor === 'w' ? tr >= 3 : tr <= 4
  if (!pawnAdvanced) return false
  // At least one OTHER friendly pawn already advanced past starting rank on the same wing.
  let buddies = 0
  for (let f = 0; f < 8; f++) {
    if (sameWing && (okf <= 3 ? f > 3 : f <= 3)) continue
    for (let r = 0; r < 8; r++) {
      const p = chessAfter.get(frToSquare(f, r))
      if (!p || p.type !== 'p' || p.color !== moverColor) continue
      const adv = moverColor === 'w' ? r >= 3 : r <= 4
      if (adv) buddies++
    }
  }
  return buddies >= 2 // includes the just-moved pawn itself
}

// ── SEE-style sacrifice ────────────────────────────────────────────────────
function detectSacrificeApprox(chessAfter, toSquare, movingPiece, capturedPiece) {
  if (!isHangingApprox(chessAfter, toSquare)) return false
  const moverVal = PIECE_VALUE[movingPiece.type] || 100
  const recovered = capturedPiece ? PIECE_VALUE[capturedPiece.type] || 0 : 0
  return moverVal - recovered >= 200
}

// ── Activity (uses real mobility, not just PST) ─────────────────────────────
function activityChange(chessBefore, chessAfter, fromSquare, toSquare, _movingPiece) {
  const before = squaresAttackedFrom(chessBefore, fromSquare).length
  const after = squaresAttackedFrom(chessAfter, toSquare).length
  return { before, after, delta: after - before }
}

// ── Prepares castling ─────────────────────────────────────────────────────
// Minor piece moves off the back rank, freeing the path between king and
// rook on a side where the side still has castling rights.
function detectPreparesCastling(chessAfter, fromSq, movingPiece, color) {
  if (!['n', 'b', 'q'].includes(movingPiece.type)) return null
  const [, fromR] = squareToFR(fromSq)
  const expectedBack = color === 'w' ? 0 : 7
  if (fromR !== expectedBack) return null
  const rights = chessAfter.fen().split(' ')[2] || ''
  const rank = color === 'w' ? '1' : '8'
  const fromFile = fromSq[0]
  const KOk =
    rights.includes(color === 'w' ? 'K' : 'k') &&
    !chessAfter.get('f' + rank) &&
    !chessAfter.get('g' + rank)
  const QOk =
    rights.includes(color === 'w' ? 'Q' : 'q') &&
    !chessAfter.get('b' + rank) &&
    !chessAfter.get('c' + rank) &&
    !chessAfter.get('d' + rank)
  if (KOk && (fromFile === 'f' || fromFile === 'g')) return 'kingside'
  if (QOk && (fromFile === 'b' || fromFile === 'c' || fromFile === 'd')) return 'queenside'
  return null
}

// ── Attacks an enemy pawn (newly) ────────────────────────────────────────
// Reports whether the move puts the moving piece in attacking range of an
// enemy pawn it wasn't attacking before. Optionally flags weakness
// (isolated / backward).
function detectAttacksEnemyPawn(chessBefore, chessAfter, fromSq, toSq, movingPiece, opponentColor) {
  const attackedBefore = new Set(squaresAttackedFrom(chessBefore, fromSq))
  const attackedAfter = squaresAttackedFrom(chessAfter, toSq)
  const oppPawnsAfter = pawnsByFile(chessAfter, opponentColor)
  for (const sq of attackedAfter) {
    if (attackedBefore.has(sq)) continue
    const p = chessAfter.get(sq)
    if (!p || p.type !== 'p' || p.color !== opponentColor) continue
    const [pf] = squareToFR(sq)
    const isolated = isIsolated(pf, oppPawnsAfter)
    const backward = isBackwardPawn(chessAfter, sq, opponentColor)
    return {
      sq,
      file: fileLetter(pf),
      weak: isolated || backward,
      kind: backward ? 'backward' : isolated ? 'isolated' : null,
    }
  }
  return null
}

// ── Eyes the enemy king zone ──────────────────────────────────────────────
// Long-range piece (B / R / Q) whose newly attacked squares include any of
// the 3×3 zone around the enemy king, AND it didn't attack any of those
// squares from its previous square. Excludes direct check (already
// detected as `check`).
function detectEyesKingZone(chessBefore, chessAfter, fromSq, toSq, movingPiece, opponentColor) {
  if (!['b', 'r', 'q'].includes(movingPiece.type)) return null
  if (chessAfter.inCheck()) return null
  const oppKing = findKing(chessAfter, opponentColor)
  if (!oppKing) return null
  const [kf, kr] = squareToFR(oppKing)
  const zone = new Set()
  for (let df = -1; df <= 1; df++)
    for (let dr = -1; dr <= 1; dr++) {
      const f = kf + df,
        r = kr + dr
      if (f < 0 || f > 7 || r < 0 || r > 7) continue
      zone.add(frToSquare(f, r))
    }
  const before = new Set(squaresAttackedFrom(chessBefore, fromSq))
  const after = squaresAttackedFrom(chessAfter, toSq)
  const newlyEyed = after.filter((sq) => zone.has(sq) && !before.has(sq))
  if (newlyEyed.length === 0) return null
  return { count: newlyEyed.length }
}

// ── Restriction (opponent's mobility shrinks) ──────────────────────────────
function opponentMobility(chess, opponentColor) {
  // chess.moves() returns moves for the side to move. We need opponent's,
  // so quickly hack the FEN turn flag.
  const fen = chess.fen()
  const parts = fen.split(' ')
  parts[1] = opponentColor
  // Pseudo-legal moves only (we just need a count, not legality).
  try {
    const swapped = new Chess()
    swapped.load(parts.join(' '))
    return swapped.moves({ verbose: true }).length
  } catch {
    return 0
  }
}

// ── Move metadata + main entry ──────────────────────────────────────────────
function parseMove(fenBefore, moveUCI) {
  if (typeof moveUCI !== 'string' || moveUCI.length < 4) return null
  const chess = new Chess(fenBefore)
  const from = moveUCI.slice(0, 2)
  const to = moveUCI.slice(2, 4)
  const movingPiece = chess.get(from)
  if (!movingPiece) return null
  const capturedBefore = chess.get(to)
  let san, flags, promoted
  try {
    const m = chess.move({ from, to, promotion: moveUCI[4] || 'q' })
    if (!m) return null
    san = m.san
    flags = m.flags || ''
    promoted = m.promotion
  } catch {
    return null
  }
  const fenAfter = chess.fen()
  return {
    chessBefore: new Chess(fenBefore),
    chessAfter: new Chess(fenAfter),
    fenAfter,
    from,
    to,
    movingPiece,
    capturedBefore,
    san,
    flags,
    promoted,
    moverColor: movingPiece.color,
    opponentColor: movingPiece.color === 'w' ? 'b' : 'w',
    moveNumber: new Chess(fenBefore).moveNumber(),
  }
}

// ── Top-level entry: prefers Rust/WASM analyzer when ready ─────────────────
//
// `quickExplain` tries the Rust analyzer first; if WASM isn't ready or
// the call fails, it falls back to the JS implementation below.
export function quickExplain(fenBefore, moveUCI) {
  if (isReady()) {
    const r = analyzeMove(fenBefore, moveUCI)
    if (r) return composeTagline(r)
  }
  return quickExplainJs(fenBefore, moveUCI)
}

// ── JS fallback (legacy detectors) ─────────────────────────────────────────
function quickExplainJs(fenBefore, moveUCI) {
  const M = parseMove(fenBefore, moveUCI)
  if (!M) return { san: moveUCI, motifs: [], tagline: '' }

  const motifs = []
  const phrases = []
  const add = (motif, phrase) => {
    motifs.push(motif)
    if (phrase) phrases.push(phrase)
  }

  // Terminal states (early-out).
  if (M.chessAfter.isCheckmate()) {
    return {
      san: M.san,
      motifs: ['checkmate'],
      tagline: 'Delivers checkmate',
      fenAfter: M.fenAfter,
    }
  }
  if (M.chessAfter.isStalemate()) add('stalemate', 'Stalemates the position')
  if (M.chessAfter.isThreefoldRepetition()) add('threefold_repetition', 'Repeats the position')
  if (M.chessAfter.isDrawByFiftyMoves()) add('fifty_move', 'Triggers the 50-move rule')
  if (M.chessAfter.isInsufficientMaterial())
    add('insufficient_material', 'Reaches insufficient material')

  // ── Move-class basics ────────────────────────────────────────────────────
  if (M.flags.includes('k')) {
    add('castles_kingside', 'Castles kingside')
    if (detectConnectsRooks(M.chessAfter, M.moverColor)) add('connects_rooks', null)
  } else if (M.flags.includes('q')) {
    add('castles_queenside', 'Castles queenside')
    if (detectConnectsRooks(M.chessAfter, M.moverColor)) add('connects_rooks', null)
  }
  if (M.flags.includes('e')) add('en_passant', 'Captures en passant')
  if (M.flags.includes('p') && M.promoted) add('promotion', `Promotes to ${PIECE_NAME[M.promoted]}`)

  // Captures and trades — discriminate.
  if (M.capturedBefore && !M.flags.includes('e')) {
    const capName = PIECE_NAME[M.capturedBefore.type]
    if (M.capturedBefore.type === 'q' && M.movingPiece.type === 'q') {
      add('queen_trade', 'Trades queens')
    } else if (M.capturedBefore.type === M.movingPiece.type) {
      add('piece_trade', `Trades ${PIECE_NAME[M.movingPiece.type]}s`)
    } else if (M.movingPiece.type === 'r' && ['n', 'b'].includes(M.capturedBefore.type)) {
      add('exchange_sacrifice', `Gives the exchange for the ${capName}`)
    } else {
      add('capture', `Captures the ${capName}`)
    }
  }

  // Check / discovered check.
  if (M.chessAfter.inCheck()) {
    if (detectDiscoveredCheck(M.chessAfter, M.to, M.movingPiece)) {
      add('discovered_check', 'Discovered check')
    } else {
      add('check', 'Gives check')
    }
  }

  // ── Tactical motifs ──────────────────────────────────────────────────────
  const attackedAfter = squaresAttackedFrom(M.chessAfter, M.to).filter((sq) => {
    const p = M.chessAfter.get(sq)
    return p && p.color === M.opponentColor
  })
  const moverVal = PIECE_VALUE[M.movingPiece.type] || 100

  if (attackedAfter.length >= 2) {
    const significant = attackedAfter.filter((sq) => {
      const p = M.chessAfter.get(sq)
      return p.type === 'k' || (PIECE_VALUE[p.type] || 0) > moverVal
    })
    if (significant.length >= 1) {
      const types = [...new Set(attackedAfter.map((sq) => PIECE_NAME[M.chessAfter.get(sq).type]))]
      add('fork', `Forks ${types.slice(0, 2).join(' and ')}`)
    }
  }
  if (!motifs.includes('fork')) {
    const valuable = attackedAfter.filter((sq) => {
      const p = M.chessAfter.get(sq)
      return p.type !== 'k' && (PIECE_VALUE[p.type] || 0) > moverVal
    })
    if (valuable.length > 0) {
      add('threatens', `Threatens the ${PIECE_NAME[M.chessAfter.get(valuable[0]).type]}`)
    }
  }

  const pin = detectPin(M.chessAfter, M.to, M.movingPiece)
  if (pin) add('pin', `Pins the ${PIECE_NAME[pin.pinned]} to the ${PIECE_NAME[pin.behind]}`)

  const skewer = detectSkewer(M.chessAfter, M.to, M.movingPiece)
  if (skewer)
    add(
      'skewer',
      `Skewers the ${PIECE_NAME[skewer.skewered]}, exposing the ${PIECE_NAME[skewer.behind]}`,
    )

  if (detectSacrificeApprox(M.chessAfter, M.to, M.movingPiece, M.capturedBefore)) {
    add('sacrifice', `Sacrifices the ${PIECE_NAME[M.movingPiece.type]}`)
  } else if (isHangingApprox(M.chessAfter, M.to) && M.movingPiece.type !== 'p') {
    add('hangs', `The ${PIECE_NAME[M.movingPiece.type]} is left undefended`)
  }

  // Defends a previously-hanging friendly piece.
  {
    const board = M.chessBefore.board()
    let defended = null
    for (let r = 0; r < 8 && !defended; r++)
      for (let f = 0; f < 8 && !defended; f++) {
        const p = board[r][f]
        if (!p || p.color !== M.moverColor || p.type === 'k') continue
        const sq = frToSquare(f, 7 - r)
        if (sq === M.from) continue
        if (isHangingApprox(M.chessBefore, sq) && !isHangingApprox(M.chessAfter, sq)) {
          defended = { sq, type: p.type }
        }
      }
    if (defended) add('defends', `Defends the ${PIECE_NAME[defended.type]}`)
  }

  // Creates threat: opponent piece becomes hanging.
  if (!motifs.includes('threatens') && !motifs.includes('fork')) {
    const board = M.chessAfter.board()
    let newlyHanging = null
    for (let r = 0; r < 8 && !newlyHanging; r++)
      for (let f = 0; f < 8 && !newlyHanging; f++) {
        const p = board[r][f]
        if (!p || p.color !== M.opponentColor || p.type === 'k') continue
        const sq = frToSquare(f, 7 - r)
        if (isHangingApprox(M.chessAfter, sq) && !isHangingApprox(M.chessBefore, sq)) {
          newlyHanging = { sq, type: p.type }
        }
      }
    if (newlyHanging)
      add('creates_threat', `Creates a threat on the ${PIECE_NAME[newlyHanging.type]}`)
  }

  // Trapped piece — does this move trap an opponent piece?
  // Only check pieces we attack (cheaper than scanning all opponent pieces).
  {
    let trapped = null
    for (const sq of attackedAfter) {
      const p = M.chessAfter.get(sq)
      if (!p || p.type === 'k' || p.type === 'p') continue
      if (isTrappedOpponentPiece(M.chessAfter, sq)) {
        trapped = { sq, type: p.type }
        break
      }
    }
    if (trapped) add('traps_piece', `Traps the ${PIECE_NAME[trapped.type]}`)
  }

  // ── King-attack ──────────────────────────────────────────────────────────
  // (Legacy "Increases pressure on the king" suppressed — it was the
  //  same vague tell-don't-show phrase. The Rust attacks_king detector
  //  now produces a concrete phrase like "Knight on f5 attacks 3
  //  squares around the king (e7, g7, h6)"; this JS taglines layer is
  //  a fallback-only path and shouldn't compete.)

  // Luft — back-rank king + 1-square pawn push next to it.
  if (isLuft(M.chessBefore, M.chessAfter, M.from, M.to, M.movingPiece, M.moverColor)) {
    add('luft', 'Creates luft for the king')
  }

  // ── Piece-specific positional ───────────────────────────────────────────
  // Develops: minor piece off the back rank in the opening. Tracked as a
  // motif but emits NO phrase by itself — "Develops the X" alone just
  // restates the SAN. Used only as context for combined phrases.
  if (M.moveNumber <= 12 && ['n', 'b'].includes(M.movingPiece.type)) {
    const startRank = M.moverColor === 'w' ? '1' : '8'
    if (M.from[1] === startRank) add('develops', null)
  }

  // Knight on the rim — usually a bad sign in the opening.
  if (isKnightOnRim(M.chessAfter, M.to, M.movingPiece, M.moveNumber)) {
    add('knight_on_rim', `${PIECE_NAME[M.movingPiece.type]} drifts to the rim`)
  }

  // Centralizes — actual central control gain, not just "lands on d4".
  if (['n', 'b', 'q', 'r', 'p'].includes(M.movingPiece.type)) {
    const before =
      M.movingPiece.type === 'p'
        ? CENTER_CORE.has(M.from)
          ? 1
          : 0
        : centralControlOf(M.chessBefore, M.from).core +
          0.5 * centralControlOf(M.chessBefore, M.from).large
    const after =
      M.movingPiece.type === 'p'
        ? CENTER_CORE.has(M.to)
          ? 1
          : 0
        : centralControlOf(M.chessAfter, M.to).core +
          0.5 * centralControlOf(M.chessAfter, M.to).large
    if (after - before >= 1.5 && !motifs.includes('develops')) {
      if (M.movingPiece.type === 'p' && CENTER_CORE.has(M.to)) {
        add('centralizes', 'Stakes a claim in the center')
      } else if (['n', 'b'].includes(M.movingPiece.type)) {
        add('centralizes', `Centralizes the ${PIECE_NAME[M.movingPiece.type]}`)
      } else {
        add('centralizes', `Brings the ${PIECE_NAME[M.movingPiece.type]} into the center`)
      }
    }
  }

  // Outpost on a strong square (with friendly-pawn support or rank 5+).
  if (['n', 'b'].includes(M.movingPiece.type) && isOutpost(M.chessAfter, M.to, M.movingPiece)) {
    add('outpost', `Establishes an outpost on ${M.to}`)
  }

  // Fianchetto.
  if (M.movingPiece.type === 'b') {
    if (
      (M.moverColor === 'w' && (M.to === 'b2' || M.to === 'g2')) ||
      (M.moverColor === 'b' && (M.to === 'b7' || M.to === 'g7'))
    ) {
      add('fianchetto', 'Fianchettos the bishop')
    }
  }

  // ── Rook-specific ───────────────────────────────────────────────────────
  if (M.movingPiece.type === 'r') {
    const [fileIdx] = squareToFR(M.to)
    let ourRooksOnFile = 0,
      myPawns = 0,
      theirPawns = 0
    for (let r = 0; r < 8; r++) {
      const p = M.chessAfter.get(frToSquare(fileIdx, r))
      if (!p) continue
      if (p.type === 'r' && p.color === M.moverColor) ourRooksOnFile++
      if (p.type === 'p') {
        if (p.color === M.moverColor) myPawns++
        else theirPawns++
      }
    }
    if (ourRooksOnFile >= 2)
      add('doubles_rooks', `Doubles rooks on the ${fileLetter(fileIdx)}-file`)
    else if (myPawns === 0 && theirPawns === 0)
      add('open_file', `Posts the rook on the open ${fileLetter(fileIdx)}-file`)
    else if (myPawns === 0 && theirPawns >= 1)
      add('semi_open_file', `Posts on the semi-open ${fileLetter(fileIdx)}-file`)
    if ((M.moverColor === 'w' && M.to[1] === '7') || (M.moverColor === 'b' && M.to[1] === '2')) {
      add('rook_seventh', 'Rook on the seventh')
    }
  }

  // Battery — only if it's actually aimed at a meaningful target.
  if (!motifs.includes('doubles_rooks')) {
    const battery = detectBatteryAimed(M.chessAfter, M.to, M.movingPiece)
    if (battery)
      add(
        'battery',
        `Lines up with the ${PIECE_NAME[battery.partner.type]} aimed at the ${PIECE_NAME[battery.target.type]}`,
      )
  }

  // Bishop pair lost?
  {
    const before = countBishops(M.chessBefore, M.moverColor)
    const after = countBishops(M.chessAfter, M.moverColor)
    if (M.movingPiece.type === 'b' && after < before) {
      const oppBefore = countBishops(M.chessBefore, M.opponentColor)
      if (oppBefore >= 2 && before === 2) add('bishop_pair_lost', 'Gives up the bishop pair')
    }
  }

  // Bad-bishop diagnosis.
  if (M.movingPiece.type === 'b' && isBadBishop(M.chessAfter, M.to, M.movingPiece)) {
    add('bad_bishop', 'Bishop is hemmed in by its own pawns')
  }

  // ── Pawn-specific ───────────────────────────────────────────────────────
  if (M.movingPiece.type === 'p') {
    if (M.capturedBefore) {
      add('pawn_break', 'Pawn break')
    } else {
      // Lever
      const [tf, tr] = squareToFR(M.to)
      const fwd = M.moverColor === 'w' ? 1 : -1
      let lever = false
      for (const df of [-1, 1]) {
        const f = tf + df,
          r = tr + fwd
        if (f < 0 || f > 7 || r < 0 || r > 7) continue
        const p = M.chessAfter.get(frToSquare(f, r))
        if (p && p.type === 'p' && p.color === M.opponentColor) {
          lever = true
          break
        }
      }
      if (lever) add('pawn_lever', 'Creates a pawn lever')
    }
    if (isPassed(M.chessAfter, M.to, M.moverColor)) {
      add('passed_pawn', 'Creates a passed pawn')
    }
    if (
      isPawnStorm(M.chessAfter, M.to, M.movingPiece, M.moverColor, M.opponentColor) &&
      !motifs.includes('pawn_break')
    ) {
      add('pawn_storm', 'Joins the pawn storm')
    }
  }

  // Pawn structure side-effects (whoever moved).
  const myPawnsBefore = pawnsByFile(M.chessBefore, M.moverColor)
  const myPawnsAfter = pawnsByFile(M.chessAfter, M.moverColor)
  const oppPawnsAfter = pawnsByFile(M.chessAfter, M.opponentColor)
  const oppPawnsBefore = pawnsByFile(M.chessBefore, M.opponentColor)

  // IQP — created for either side?
  if (!isIQP(myPawnsBefore) && isIQP(myPawnsAfter)) {
    add('iqp_self', 'Accepts an isolated queen pawn (IQP)')
  } else if (!isIQP(oppPawnsBefore) && isIQP(oppPawnsAfter)) {
    add('iqp_them', 'Saddles the opponent with an isolated queen pawn')
  }
  // Hanging pawns — created for either side?
  const hpSelfBefore = detectHangingPawnsPair(myPawnsBefore)
  const hpSelfAfter = detectHangingPawnsPair(myPawnsAfter)
  if (!hpSelfBefore && hpSelfAfter) {
    add('hanging_pawns_self', `Creates hanging ${hpSelfAfter} pawns`)
  }
  const hpThemBefore = detectHangingPawnsPair(oppPawnsBefore)
  const hpThemAfter = detectHangingPawnsPair(oppPawnsAfter)
  if (!hpThemBefore && hpThemAfter) {
    add('hanging_pawns_them', `Saddles the opponent with hanging ${hpThemAfter} pawns`)
  }

  // Long-diagonal posting (B/Q only). Only fires if the piece wasn't on
  // the same long diagonal before — i.e. arriving at it for the first time.
  if (['b', 'q'].includes(M.movingPiece.type)) {
    const fromDiag = isLongDiagonal(M.from)
    const toDiag = isLongDiagonal(M.to)
    if (toDiag && fromDiag !== toDiag) {
      add('long_diagonal', `Posts on the long ${toDiag} diagonal`)
    }
  }

  if (M.capturedBefore && M.capturedBefore.type === 'p' && M.movingPiece.type !== 'p') {
    const [tf] = squareToFR(M.to)
    if (oppPawnsAfter[tf] >= 2 && oppPawnsBefore[tf] < 2) {
      add('doubled_pawns_them', "Doubles the opponent's pawns")
    }
  }
  if (M.movingPiece.type === 'p') {
    const [tf] = squareToFR(M.to)
    if (myPawnsAfter[tf] >= 1 && isIsolated(tf, myPawnsAfter)) {
      add('isolated_pawn', 'Isolates the pawn')
    }
  }
  // Backward pawn imposed on opponent? Check enemy pawns near our move.
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const sq = frToSquare(f, r)
      const p = M.chessAfter.get(sq)
      if (!p || p.type !== 'p' || p.color !== M.opponentColor) continue
      const wasBackward = isBackwardPawn(M.chessBefore, sq, M.opponentColor)
      const isBackwardNow = isBackwardPawn(M.chessAfter, sq, M.opponentColor)
      if (!wasBackward && isBackwardNow) {
        add('backward_pawn_them', `Saddles the opponent with a backward ${fileLetter(f)}-pawn`)
        break
      }
    }
    if (motifs.includes('backward_pawn_them')) break
  }

  // ── Activity / restriction (real mobility, not PST) ─────────────────────
  const act = activityChange(M.chessBefore, M.chessAfter, M.from, M.to, M.movingPiece)
  // Restriction: opponent's pseudo-legal move count drops noticeably.
  let oppMobBefore = 0,
    oppMobAfter = 0
  try {
    oppMobBefore = opponentMobility(M.chessBefore, M.opponentColor)
    oppMobAfter = opponentMobility(M.chessAfter, M.opponentColor)
  } catch {
    /* ignore */
  }
  const restrictionDelta = oppMobBefore - oppMobAfter
  if (restrictionDelta >= 4 && !motifs.includes('check') && !motifs.includes('discovered_check')) {
    add('restricts', "Restricts the opponent's pieces")
  }

  // Tempo: develops AND has a threat.
  if (
    motifs.includes('develops') &&
    (motifs.includes('threatens') ||
      motifs.includes('attacks_king') ||
      motifs.includes('creates_threat'))
  ) {
    add('tempo', null)
  }

  // ── New high-signal positional detectors ───────────────────────────────
  // Prepares castling.
  const castlingSide = detectPreparesCastling(M.chessAfter, M.from, M.movingPiece, M.moverColor)
  if (castlingSide) {
    add(`prepares_castling_${castlingSide}`, `Clears the way for ${castlingSide} castle`)
  }

  // Attacks an enemy pawn (especially weak ones).
  if (
    !motifs.includes('threatens') &&
    !motifs.includes('fork') &&
    !motifs.includes('capture') &&
    M.movingPiece.type !== 'p'
  ) {
    const attacksPawn = detectAttacksEnemyPawn(
      M.chessBefore,
      M.chessAfter,
      M.from,
      M.to,
      M.movingPiece,
      M.opponentColor,
    )
    if (attacksPawn) {
      const adj = attacksPawn.kind ? `${attacksPawn.kind} ` : ''
      add('attacks_pawn', `Attacks the ${adj}${attacksPawn.file}-pawn`)
    }
  }

  // Eyes the enemy king zone.
  if (
    !motifs.includes('attacks_king') &&
    !motifs.includes('threatens') &&
    !motifs.includes('fork') &&
    !motifs.includes('check') &&
    !motifs.includes('discovered_check') &&
    !motifs.includes('attacks_pawn')
  ) {
    const eyes = detectEyesKingZone(
      M.chessBefore,
      M.chessAfter,
      M.from,
      M.to,
      M.movingPiece,
      M.opponentColor,
    )
    if (eyes) {
      // Phrase by piece type so it reads naturally.
      const phrase =
        M.movingPiece.type === 'b'
          ? "Eyes the king's diagonal"
          : M.movingPiece.type === 'r'
            ? "Eyes the king's file"
            : "Eyes the king's position"
      add('eyes_king_zone', phrase)
    }
  }

  // ── Tagline composition ─────────────────────────────────────────────────
  const PRIORITY = [
    // Game-defining
    'checkmate',
    'sacrifice',
    'fork',
    'discovered_check',
    'pin',
    'skewer',
    // Captures / trades
    'queen_trade',
    'exchange_sacrifice',
    'piece_trade',
    'capture',
    // Threats
    'creates_threat',
    'threatens',
    'traps_piece',
    'check',
    // King moves / promotions
    'castles_kingside',
    'castles_queenside',
    'promotion',
    'en_passant',
    // Big strategic / structural ideas (2000-level)
    'iqp_them',
    'iqp_self',
    'hanging_pawns_them',
    'hanging_pawns_self',
    'doubled_pawns_them',
    'backward_pawn_them',
    // Rook play
    'doubles_rooks',
    'rook_seventh',
    'open_file',
    'semi_open_file',
    // Piece-specific posting
    'outpost',
    'long_diagonal',
    'fianchetto',
    'battery',
    'attacks_pawn',
    'eyes_king_zone',
    'attacks_king',
    'luft',
    'prepares_castling_kingside',
    'prepares_castling_queenside',
    'centralizes',
    'defends',
    'restricts',
    // Pawn play
    'pawn_break',
    'pawn_lever',
    'passed_pawn',
    'pawn_storm',
    'isolated_pawn',
    // Bad signs (still informative)
    'knight_on_rim',
    'bishop_pair_lost',
    'bad_bishop',
    'hangs',
    // Game-end states
    'stalemate',
    'threefold_repetition',
    'fifty_move',
    'insufficient_material',
    // Internal flags (kept low — only used by combined phrasing)
    'develops',
  ]
  const motifPhrases = motifs
    .map((m, i) => ({ motif: m, phrase: phrases[i] }))
    .filter((x) => x.phrase)
  motifPhrases.sort((a, b) => {
    const ai = PRIORITY.indexOf(a.motif)
    const bi = PRIORITY.indexOf(b.motif)
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })

  // Special combinations that read more naturally.
  // The pattern: when `develops` co-occurs with a more specific motif, we
  // drop the bare "Develops the X" entirely and let the specific motif
  // speak. The SAN already communicates that a knight or bishop moved.
  function combinedPhrase() {
    const set = new Set(motifs)
    if (set.has('castles_kingside') && set.has('connects_rooks'))
      return 'Castles kingside, connecting the rooks'
    if (set.has('castles_queenside') && set.has('connects_rooks'))
      return 'Castles queenside, connecting the rooks'
    if (set.has('capture') && set.has('discovered_check')) {
      const cap = phrases[motifs.indexOf('capture')]
      return `${cap} with discovered check`
    }
    if (set.has('capture') && set.has('check')) {
      const cap = phrases[motifs.indexOf('capture')]
      return `${cap} with check`
    }
    if (set.has('outpost') && set.has('attacks_pawn')) {
      const out = phrases[motifs.indexOf('outpost')]
      const ap = phrases[motifs.indexOf('attacks_pawn')]
      return `${out}, ${ap.toLowerCase()}`
    }
    return null
  }

  // Fallback policy: if we can't say something *non-obvious*, return null
  // and let the UI render no tagline. Better silence than generic filler
  // like "Repositions the rook to b1" (which restates the move notation).
  // Only the most concrete signals make it past this gate.
  function fallbackTagline() {
    const piece = PIECE_NAME[M.movingPiece.type]

    // Strong activity gain — meaningfully more squares attacked.
    if (act.delta >= 4) {
      return `Activates the ${piece} (eyes ${act.after} squares)`
    }
    if (act.delta <= -4) {
      return `Pulls the ${piece} back into a passive role`
    }

    // Pawn pushes that advance to the 7th rank — concretely meaningful.
    if (M.movingPiece.type === 'p') {
      const [tf, tr] = squareToFR(M.to)
      if ((M.moverColor === 'w' && tr === 6) || (M.moverColor === 'b' && tr === 1))
        return 'Pushes to the seventh rank'
      // Pawn that newly attacks an enemy piece.
      const fwd = M.moverColor === 'w' ? 1 : -1
      for (const df of [-1, 1]) {
        const f = tf + df,
          r = tr + fwd
        if (f < 0 || f > 7 || r < 0 || r > 7) continue
        const ap = M.chessAfter.get(frToSquare(f, r))
        if (ap && ap.color === M.opponentColor && ap.type !== 'p') {
          return `Attacks the ${PIECE_NAME[ap.type]}`
        }
      }
      // Otherwise: nothing meaningful to say. Stay silent.
      return null
    }

    // No specific signal. Keep silent rather than emit filler.
    return null
  }

  let tagline
  const combo = combinedPhrase()
  if (combo) {
    tagline = combo
  } else if (motifPhrases.length === 0) {
    tagline = fallbackTagline() // may be null/empty
  } else if (motifPhrases.length === 1) {
    tagline = motifPhrases[0].phrase
  } else {
    tagline = motifPhrases
      .slice(0, 2)
      .map((x) => x.phrase)
      .join(', ')
  }

  return { san: M.san, motifs, tagline: tagline || '', fenAfter: M.fenAfter }
}

// Run quickExplain on the first N plies of a PV.
export function explainPV(startFen, pvUcis, plies = 3) {
  // Fast path: WASM can analyze the whole sequence in one call.
  if (isReady()) {
    const arr = analyzePv(startFen, pvUcis.slice(0, plies), plies)
    if (Array.isArray(arr) && arr.length > 0) {
      return arr.map((r) => {
        const composed = composeTagline(r)
        return { san: composed.san, tagline: composed.tagline }
      })
    }
  }
  // Slow path: per-move JS evaluation.
  let fen = startFen
  const out = []
  for (const uci of pvUcis.slice(0, plies)) {
    const r = quickExplain(fen, uci)
    if (!r || !r.san) break
    out.push({ san: r.san, tagline: r.tagline })
    if (!r.fenAfter) break
    fen = r.fenAfter
  }
  return out
}
