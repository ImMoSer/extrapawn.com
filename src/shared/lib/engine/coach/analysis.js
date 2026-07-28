// High-level analysis API consumed by the UI.
// Shapes match the (deprecated) server endpoints so Board.jsx stays close
// to its original form: getTopMoves / explainMoveAt.

import engine, { getEngineDefaults } from './engine';
import { Chess, uciToSan, makeMove, getSideToMove } from './chess';
import { explainMove } from './explainer';
import { quickExplain, explainPV } from './taglines';

// Classifier needs a critical mass of candidate alternatives to reason
// about "only move" / "second best" / "in top-3". 5 is the historical
// floor — if the user has the MultiPV slider lower than that, top-moves
// reflects their preference but explain quietly bumps to 5 internally.
const EXPLAIN_MIN_MULTIPV = 5;

function normalizeToWhite(score, turn) {
  return turn === 'w' ? score : -score;
}

function mateToWhite(mate, turn) {
  if (mate === null || mate === undefined) return null;
  return turn === 'w' ? mate : -mate;
}

async function ensureReady() {
  await engine.init();
}

export async function getTopMoves(fen, count = 10) {
  // Terminal positions: skip the engine. It has no `bestmove` to give and
  // returns score=0, which would render as "0.00" instead of the real
  // result (1-0 / 0-1 / ½-½).
  try {
    const c = new Chess(fen);
    if (c.isCheckmate()) {
      // Side-to-move is mated → the OTHER side won.
      const winnerWhite = c.turn() === 'b';
      return {
        fen,
        eval_cp: winnerWhite ? 10_000 : -10_000,
        mate: 0,
        moves: [],
        gameOver: 'checkmate',
        result: winnerWhite ? '1-0' : '0-1',
      };
    }
    if (c.isStalemate()) {
      return { fen, eval_cp: 0, mate: null, moves: [], gameOver: 'stalemate', result: '½-½' };
    }
    if (c.isDraw()) {
      return { fen, eval_cp: 0, mate: null, moves: [], gameOver: 'draw', result: '½-½' };
    }
  } catch { /* fall through to engine */ }

  await ensureReady();
  const turn = getSideToMove(fen);
  const { depth, multipv } = getEngineDefaults();
  const numLines = Math.min(count, multipv);
  const result = await engine.analyzeMultiPV(fen, numLines, depth);
  const evalBeforeWhite = normalizeToWhite(result.score ?? 0, turn);

  const moves = result.moves.map(m => {
    const evalCp = normalizeToWhite(m.score, turn);
    const top = quickExplain(fen, m.move);
    const pvLine = explainPV(fen, m.pv, 6); // [{san, tagline}, …]

    let quality = null;
    try {
      const from = m.move.slice(0, 2);
      const to = m.move.slice(2, 4);
      const promotion = m.move[4] || 'q';
      const newFen = makeMove(fen, from, to, promotion);
      if (newFen) {
        const evalAfterWhite = moverScoreToWhite(m.score, turn);
        const mateAfter = mateToWhite(m.mate, turn);
        const exp = explainMove(fen, newFen, m.move, evalBeforeWhite, evalAfterWhite, {
          topMoves: result.moves,
          mateAfter,
        });
        quality = exp?.quality || null;
      }
    } catch { /* ignore */ }

    return {
      rank: m.rank,
      move: m.move,
      quality,
      san: uciToSan(fen, m.move),
      eval_cp: evalCp,

      eval_pawns: parseFloat((evalCp / 100).toFixed(2)),
      pv: m.pv.map(uci => uciToSan(fen, uci)).slice(0, 6).join(' '),
      rawPv: m.pv,
      isMate: m.mate !== null && m.mate !== undefined,
      mateIn: mateToWhite(m.mate, turn),
      tagline: top.tagline,
      motifs: top.motifs,
      pvLine,
      eco: m.eco || null,
      name: m.name || null,
      ecoName: m.ecoName || null,
      winP: m.winP ?? m.win_p ?? null,
      drawP: m.drawP ?? m.draw_p ?? null,
      lossP: m.lossP ?? m.loss_p ?? null,
      totalGames: m.totalGames ?? m.total ?? null,
      popularity: m.popularity ?? null,
      theoreticalContinuations: m.theoreticalContinuations ?? m.theoretical_continuations ?? null,
    };
  });
  return {
    fen,
    eval_cp: normalizeToWhite(result.score ?? 0, turn),
    mate: mateToWhite(result.mate, turn),
    mode: result.mode || 'engine',
    opening_info: result.opening_info || null,
    moves,
    gameOver: null,
    result: null,
  };
}

export async function explainMoveAt(fen, moveUCI) {
  await ensureReady();
  const turn = getSideToMove(fen);
  const { depth, multipv } = getEngineDefaults();

  // The classifier needs at least EXPLAIN_MIN_MULTIPV alternatives to
  // reason about "only move" / "second best" / "in top-3". If the user
  // dialled MultiPV lower than that for the panel, bump it just for
  // explanation calls.
  const explainMultiPV = Math.max(multipv, EXPLAIN_MIN_MULTIPV);
  const topRes = await engine.analyzeMultiPV(fen, explainMultiPV, depth);

  // Win-rate-before is approximated by the best move's score (the position's
  // value assuming optimal play). This is what Lichess-style classifiers use
  // and avoids a separate single-PV eval call.
  const evalBeforeWhite = normalizeToWhite(topRes.score ?? 0, turn);

  const from = moveUCI.slice(0, 2);
  const to = moveUCI.slice(2, 4);
  const promotion = moveUCI[4] || 'q';
  const newFen = makeMove(fen, from, to, promotion);
  if (!newFen) throw new Error('Invalid move for this position');
  const newTurn = getSideToMove(newFen);

  // Did the player play one of the top moves? If so, reuse its score.
  // The MultiPV `score` is in mover's POV — i.e., the score of the position
  // *after* that move, expressed as how good it is for the original mover.
  // That's exactly the post-move eval we need for `evalAfter`.
  const playedTopEntry = topRes.moves.find(m => m.move === moveUCI);

  let evalAfterWhite;
  let mateAfter = null;
  if (playedTopEntry) {
    // Convert mover-POV → white POV.
    evalAfterWhite = moverScoreToWhite(playedTopEntry.score, turn);
    mateAfter = mateToWhite(playedTopEntry.mate, turn);
  } else {
    // Player played outside the top set — fall back to a separate eval.
    const evalAfterRes = await engine.evaluate(newFen, depth);
    evalAfterWhite = normalizeToWhite(evalAfterRes.cp, newTurn);
    mateAfter = mateToWhite(evalAfterRes.mate, newTurn);
  }

  const explanation = explainMove(
    fen, newFen, moveUCI, evalBeforeWhite, evalAfterWhite,
    {
      topMoves: topRes.moves,
      mateAfter,
    },
  );

  return { fen, newFen, move: moveUCI, ...explanation };
}

function moverScoreToWhite(scoreMoverPOV, moverColor) {
  return moverColor === 'w' ? scoreMoverPOV : -scoreMoverPOV;
}
