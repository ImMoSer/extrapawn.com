// High-level analysis API consumed by the UI.
// Shapes match the (deprecated) server endpoints so Board.jsx stays close
// to its original form: getTopMoves / explainMoveAt.

import { Chess } from 'chess.js'
import engine, { getEngineDefaults } from './engine'
import { uciToSan, makeMove, getSideToMove } from './chess'
import { explainMove } from './explainer'
import { quickExplain, explainPV } from './taglines'
import { pgnService } from '@/shared/lib/pgn/PgnService'

// Classifier needs a critical mass of candidate alternatives to reason
// about "only move" / "second best" / "in top-3". 5 is the historical
// floor — if the user has the MultiPV slider lower than that, top-moves
// reflects their preference but explain quietly bumps to 5 internally.
const EXPLAIN_MIN_MULTIPV = 5

function normalizeToWhite(score, turn) {
  return turn === 'w' ? score : -score
}

function mateToWhite(mate, turn) {
  if (mate === null || mate === undefined) return null
  return turn === 'w' ? mate : -mate
}

async function ensureReady() {
  await engine.init()
}

export async function getTopMoves(fen, count = 10, options = {}) {
  // Terminal positions: skip the engine. It has no `bestmove` to give and
  // returns score=0, which would render as "0.00" instead of the real
  // result (1-0 / 0-1 / ½-½).
  try {
    const c = new Chess(fen)
    if (c.isCheckmate()) {
      // Side-to-move is mated → the OTHER side won.
      const winnerWhite = c.turn() === 'b'
      return {
        fen,
        eval_cp: winnerWhite ? 10_000 : -10_000,
        mate: 0,
        moves: [],
        gameOver: 'checkmate',
        result: winnerWhite ? '1-0' : '0-1',
      }
    }
    if (c.isStalemate()) {
      return { fen, eval_cp: 0, mate: null, moves: [], gameOver: 'stalemate', result: '½-½' }
    }
    if (c.isDraw()) {
      return { fen, eval_cp: 0, mate: null, moves: [], gameOver: 'draw', result: '½-½' }
    }
  } catch {
    /* fall through to engine */
  }

  await ensureReady()
  const turn = getSideToMove(fen)
  const { depth, multipv } = getEngineDefaults()
  const numLines = Math.min(count, multipv)
  
  const startFen = pgnService.getRootNode().fenAfter
  const movesUci = pgnService.getCurrentUciPath()
  
  const result = await engine.analyzeMultiPV(fen, numLines, depth, startFen, movesUci, options)
  const moves = await Promise.all(
    result.moves.map(async (m) => {
      const evalCp = normalizeToWhite(m.score, turn)
      // Local, engine-free tagline for the move and the next couple of plies
      // of its PV. quickExplain is pure chess.js + geometry — fast enough to
      // run for every top move on every position change.
      const top = await quickExplain(fen, m.move)
      const pvLine = await explainPV(fen, m.pv, 3) // [{san, tagline}, …]
      return {
        rank: m.rank,
        move: m.move,
        san: (m.san && m.san !== m.move) ? m.san : uciToSan(fen, m.move),
        name: m.name || null,
        eco: m.eco || null,
        theoretical_fen: m.theoretical_fen || null,
        theoretical_string: m.theoretical_string ?? null,
        win_p: m.win_p ?? null,
        draw_p: m.draw_p ?? null,
        loss_p: m.loss_p ?? null,
        total: m.total ?? null,
        eval_cp: evalCp,
        eval_pawns: parseFloat((evalCp / 100).toFixed(2)),
        pv: m.pv
          .map((uci) => uciToSan(fen, uci))
          .slice(0, 3)
          .join(' '),
        isMate: m.mate !== null && m.mate !== undefined,
        mateIn: mateToWhite(m.mate, turn),
        tagline: top.tagline,
        motifs: top.motifs,
        pvLine,
        wdl: m.wdl,
      }
    })
  )
  return {
    fen,
    mode: result.mode || 'engine',
    opening_info: result.opening_info || null,
    eval_cp: normalizeToWhite(result.score ?? 0, turn),
    mate: mateToWhite(result.mate, turn),
    moves,
    gameOver: null,
    result: null,
  }
}

export async function explainMoveAt(fen, moveUCI) {
  await ensureReady()
  const turn = getSideToMove(fen)
  const { depth, multipv } = getEngineDefaults()

  // The classifier needs at least EXPLAIN_MIN_MULTIPV alternatives to
  // reason about "only move" / "second best" / "in top-3". If the user
  // dialled MultiPV lower than that for the panel, bump it just for
  // explanation calls.
  const explainMultiPV = Math.max(multipv, EXPLAIN_MIN_MULTIPV)
  
  const startFen = pgnService.getRootNode().fenAfter
  const fullMoves = pgnService.getCurrentUciPath()
  const prevMoves = fullMoves.length > 0 && fullMoves[fullMoves.length - 1] === moveUCI 
    ? fullMoves.slice(0, -1) 
    : fullMoves
    
  const topRes = await engine.analyzeMultiPV(fen, explainMultiPV, depth, startFen, prevMoves, { skipTablebase: true })

  // Win-rate-before is approximated by the best move's score (the position's
  // value assuming optimal play). This is what Lichess-style classifiers use
  // and avoids a separate single-PV eval call.
  const evalBeforeWhite = normalizeToWhite(topRes.score ?? 0, turn)

  const from = moveUCI.slice(0, 2)
  const to = moveUCI.slice(2, 4)
  const promotion = moveUCI[4] || 'q'
  const newFen = makeMove(fen, from, to, promotion)
  if (!newFen) throw new Error('Invalid move for this position')
  const newTurn = getSideToMove(newFen)

  // Did the player play one of the top moves? If so, reuse its score.
  // The MultiPV `score` is in mover's POV — i.e., the score of the position
  // *after* that move, expressed as how good it is for the original mover.
  // That's exactly the post-move eval we need for `evalAfter`.
  const playedTopEntry = topRes.moves.find((m) => m.move === moveUCI)

  let evalAfterWhite
  let mateAfter = null
  let wdlAfter = null
  if (playedTopEntry) {
    // Convert mover-POV → white POV.
    evalAfterWhite = moverScoreToWhite(playedTopEntry.score, turn)
    mateAfter = mateToWhite(playedTopEntry.mate, turn)
    wdlAfter = playedTopEntry.wdl ? { ...playedTopEntry.wdl } : null
  } else {
    // Player played outside the top set — fall back to analyzing the new position.
    // We pre-emptively start a MultiPV search on the new position. This will be cached
    // under 'm|newFen|server' and immediately reused when the board updates and the UI requests the top moves.
    const evalMoves = prevMoves.concat([moveUCI])
    const evalAfterRes = await engine.analyzeMultiPV(newFen, explainMultiPV, depth, startFen, evalMoves, { skipTablebase: true })
    evalAfterWhite = normalizeToWhite(evalAfterRes.score ?? 0, newTurn)
    mateAfter = mateToWhite(evalAfterRes.mate, newTurn)
    if (evalAfterRes.wdl) {
      wdlAfter = {
        win: evalAfterRes.wdl.loss,
        draw: evalAfterRes.wdl.draw,
        loss: evalAfterRes.wdl.win,
      }
    }
  }

  const wdlBefore = topRes.moves && topRes.moves[0] ? topRes.moves[0].wdl : null

  const explanation = await explainMove(fen, newFen, moveUCI, evalBeforeWhite, evalAfterWhite, {
    topMoves: topRes.moves,
    mateAfter,
    wdlBefore,
    wdlAfter,
  })

  return { fen, newFen, move: moveUCI, ...explanation }
}

function moverScoreToWhite(scoreMoverPOV, moverColor) {
  return moverColor === 'w' ? scoreMoverPOV : -scoreMoverPOV
}
