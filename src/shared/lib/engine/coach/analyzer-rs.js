// Thin JS wrapper around the Rust/WASM motif analyzer.
//
// The WASM module is initialised lazily — `ensureReady()` triggers a fetch
// + instantiate. Until that promise resolves, `analyzeMove()` returns null
// so callers can fall back to the legacy JS detectors.
//
// The Rust analyzer returns a JSON-ish object:
//   { san, fen_after, motifs: [{id, phrase, priority}], terminal? }
// Phrases are pre-rendered ("Pins the knight to the queen", etc.) and
// motifs are NOT pre-sorted. Composition (priority sort + combined phrases
// like "Captures with check") happens in `composeTagline()`.

import init, {
  analyze as wasmAnalyze,
  analyze_pv as wasmAnalyzePv,
  evaluate_fen as wasmEvaluateFen,
  explain_position as wasmExplainPosition,
  piece_contributions as wasmPieceContributions,
  piece_value_at as wasmPieceValueAt,
  version as wasmVersion,
} from './wasm-rs/engine_rs.js';

let ready = false;
let initPromise = null;

export function ensureReady() {
  if (ready) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = init()
      .then(() => {
        ready = true;
        try { console.log('[engine-rs]', wasmVersion()); } catch { /* ignore */ }
        return true;
      })
      .catch((err) => {
        console.error('[engine-rs] init failed:', err);
        ready = false;
        return false;
      });
  }
  return initPromise;
}

export function isReady() {
  return ready;
}

/** Analyze a single move. Returns the raw Rust object, or null if WASM
 *  isn't ready yet (caller should fall back to JS detectors). */
export function analyzeMove(fenBefore, moveUci) {
  if (!ready) return null;
  try {
    const result = wasmAnalyze(fenBefore, moveUci);
    if (!result || result.error) return null;
    return result;
  } catch (e) {
    console.warn('[engine-rs] analyze failed:', e);
    return null;
  }
}

/** Analyze a sequence of UCI moves. Returns array or null. */
export function analyzePv(startFen, ucis, plies = 3) {
  if (!ready) return null;
  try {
    const arr = wasmAnalyzePv(startFen, ucis, plies);
    if (!Array.isArray(arr)) return null;
    return arr;
  } catch (e) {
    console.warn('[engine-rs] analyze_pv failed:', e);
    return null;
  }
}

// Compose a tagline from a Rust analysis result.
//
// Strategy (in order):
//   1. **Named patterns** that subsume other motifs. If `greek_gift`
//      fires, that's the headline — drop the bare `sacrifice`+`check`
//      mechanics underneath. Same for `decisive_combination`,
//      `back_rank_mate_threat`, `smothered_hint`.
//   2. **Combos** that read more naturally as one phrase:
//      `Captures the X with check`, `Forks knight and rook with check`,
//      etc.
//   3. **Pair join** for two complementary motifs.
//   4. **Single phrase** for the highest-priority motif.
//   5. **Empty** when nothing meaningful fired (better silence than filler).
export function composeTagline(rustResult) {
  if (!rustResult || !rustResult.motifs) {
    return { san: rustResult?.san || '', motifs: [], tagline: '', fenAfter: rustResult?.fen_after || '' };
  }

  const motifs = rustResult.motifs.slice().sort((a, b) => a.priority - b.priority);
  const motifIds = motifs.map(m => m.id);
  const has = (id) => motifIds.includes(id);
  const phraseFor = (id) => {
    const m = motifs.find(x => x.id === id);
    return m && m.phrase ? m.phrase : null;
  };

  // ── 1. Named patterns subsume their components ────────────────────
  // These are the headline events — when one fires, supporting motifs
  // become redundant. (E.g., `greek_gift` already implies sacrifice +
  // check + king attack — saying any of them again is noise.)
  if (has('checkmate'))            return out(rustResult, motifIds, 'Delivers checkmate');
  if (has('greek_gift')) {
    return out(rustResult, motifIds,
      has('check') ? 'Greek gift sacrifice — Bxh7+!' : 'Greek gift sacrifice');
  }
  if (has('decisive_combination')) return out(rustResult, motifIds, phraseFor('decisive_combination'));
  if (has('smothered_hint'))       return out(rustResult, motifIds, 'Threatens smothered mate');
  if (has('back_rank_mate_threat')) return out(rustResult, motifIds, 'Threatens back-rank mate');
  if (has('anastasia_mate_threat')) return out(rustResult, motifIds, "Anastasia's mate threat (knight cut-off + rook on the rim)");
  if (has('bodens_mate_threat'))   return out(rustResult, motifIds, "Boden's mate threat (two bishops crossfire)");
  if (has('arabian_mate_threat')) return out(rustResult, motifIds, "Arabian-style mate threat (rook + knight on the cornered king)");
  if (has('double_check'))         return out(rustResult, motifIds, 'Double check — only the king can move');

  // ── 2. Forced/forcing combos ──────────────────────────────────────
  // Captures with check, fork with check, etc. read better as one line.
  if (has('fork') && has('check')) {
    return out(rustResult, motifIds, `${phraseFor('fork')} with check`);
  }
  if (has('fork') && has('discovered_check')) {
    return out(rustResult, motifIds, `${phraseFor('fork')} with discovered check`);
  }
  if (has('capture') && has('discovered_check')) {
    return out(rustResult, motifIds, `${phraseFor('capture')} with discovered check`);
  }
  if (has('capture') && has('check')) {
    return out(rustResult, motifIds, `${phraseFor('capture')} with check`);
  }
  if (has('removes_defender') && has('threatens')) {
    return out(rustResult, motifIds,
      `${phraseFor('removes_defender')}, leaving it undefended`);
  }
  if (has('castles_kingside') && has('connects_rooks')) {
    return out(rustResult, motifIds, 'Castles kingside, connecting the rooks');
  }
  if (has('castles_queenside') && has('connects_rooks')) {
    return out(rustResult, motifIds, 'Castles queenside, connecting the rooks');
  }
  if (has('outpost') && has('attacks_pawn')) {
    return out(rustResult, motifIds,
      `${phraseFor('outpost')}, ${phraseFor('attacks_pawn').toLowerCase()}`);
  }
  if (has('knight_invasion') && has('attacks_pawn')) {
    return out(rustResult, motifIds,
      `${phraseFor('knight_invasion')} and ${phraseFor('attacks_pawn').toLowerCase()}`);
  }
  if (has('pin') && has('threatens')) {
    return out(rustResult, motifIds,
      `${phraseFor('pin')}, threatening to win it`);
  }
  if (has('rook_lift') && has('eyes_king_zone')) {
    return out(rustResult, motifIds,
      `${phraseFor('rook_lift')} — joining the king attack`);
  }
  if (has('opens_file_for') && has('battery')) {
    return out(rustResult, motifIds, phraseFor('battery'));
  }
  if (has('simplifies') && has('check')) {
    return out(rustResult, motifIds,
      `${phraseFor('simplifies')} with check`);
  }
  if (has('promotion') && has('check')) {
    return out(rustResult, motifIds,
      `${phraseFor('promotion')} with check`);
  }
  if (has('promotion') && has('checkmate')) {
    return out(rustResult, motifIds,
      `${phraseFor('promotion')} — mate`);
  }

  // ── 3. Drop empty / utility-only motifs ───────────────────────────
  const visible = motifs.filter(m => m.phrase && m.phrase.length > 0);

  // ── 4. Single or pair fallback ────────────────────────────────────
  // Before joining two phrases, we dedupe by *target keyword*. If both
  // phrases mention the same role / file / square, the second one is
  // re-stating what the first already said — drop it. This catches:
  //   "Creates a threat on the pawn, attacks the h-pawn"
  //   "Pins the knight to the queen, threatens the knight"
  //   "Trades knights into the endgame, trades pieces" (etc.)
  let tagline;
  if (visible.length === 0) {
    tagline = '';
  } else if (visible.length === 1) {
    tagline = visible[0].phrase;
  } else {
    const a = visible[0].phrase;
    const b = visible[1] ? visible[1].phrase : '';
    if (!b || phrasesOverlap(a, b)) {
      tagline = a;
    } else {
      tagline = `${a}, ${b.charAt(0).toLowerCase()}${b.slice(1)}`;
    }
  }

  return out(rustResult, motifIds, tagline);
}

// Two phrases "overlap" if they mention the same key noun — role, file,
// square, or piece. Used to suppress redundant secondary motifs in the
// pair-join fallback.
const KEY_TOKENS = [
  'queen', 'rook', 'bishop', 'knight', 'pawn',
  'king',
  // file-pawns: "h-pawn", "a-pawn" etc — handled by simple substring match
];
function phrasesOverlap(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  // Same role keyword in both?
  for (const tok of KEY_TOKENS) {
    if (la.includes(tok) && lb.includes(tok)) return true;
  }
  // Same file-pawn keyword? "h-pawn" / "a-pawn" / etc.
  for (let f = 0; f < 8; f++) {
    const file = String.fromCharCode(97 + f);
    const tag = `${file}-pawn`;
    if (la.includes(tag) && lb.includes(tag)) return true;
  }
  // Same exact two-char square? Look for any aN-hN substring shared.
  const sqA = la.match(/[a-h][1-8]/g) || [];
  const sqB = lb.match(/[a-h][1-8]/g) || [];
  for (const s of sqA) if (sqB.includes(s)) return true;
  return false;
}

function out(rustResult, motifIds, tagline) {
  return {
    san: rustResult.san,
    motifs: motifIds,
    tagline: tagline || '',
    fenAfter: rustResult.fen_after,
  };
}

// Static evaluation of a FEN. Returns `{ phase, white, black, final_cp }`
// where each side has a per-head breakdown (material/psqt/mobility/pawns/
// king_safety/threats/imbalance), each tapered to mg+eg.
export function evaluateFen(fen) {
  if (!ready) return null;
  try {
    const r = wasmEvaluateFen(fen);
    if (!r || r.error) return null;
    return r;
  } catch (e) {
    console.warn('[engine-rs] evaluate_fen failed:', e);
    return null;
  }
}

// All non-king pieces' contribution to the static evaluation. Each entry:
//   { square, color, role, value_cp, material, psqt, mobility, pawns,
//     king_safety, threats, imbalance }
// `value_cp` is side-relative (positive = good for piece's owner).
export function pieceContributionsForFen(fen) {
  if (!ready) return null;
  try {
    const r = wasmPieceContributions(fen);
    if (!Array.isArray(r)) return null;
    return r;
  } catch (e) {
    console.warn('[engine-rs] piece_contributions failed:', e);
    return null;
  }
}

// Comprehensive structured explanation of a position. Returns the full
// `Explanation` blob: material, pawn structure, king safety, activity,
// line control, immediate tactics, and high-level themes. Designed for
// downstream LLM consumption.
export function explainPosition(fen) {
  if (!ready) return null;
  try {
    const r = wasmExplainPosition(fen);
    if (!r || r.error) return null;
    return r;
  } catch (e) {
    console.warn('[engine-rs] explain_position failed:', e);
    return null;
  }
}

// Single-piece contribution. Same shape as one entry from pieceContributionsForFen.
export function pieceValueAt(fen, square) {
  if (!ready) return null;
  try {
    const r = wasmPieceValueAt(fen, square);
    if (!r || r.error) return null;
    return r;
  } catch (e) {
    console.warn('[engine-rs] piece_value_at failed:', e);
    return null;
  }
}

// Kick off init eagerly so the first call has a good chance of being warm.
// Skipped under Node-without-DOM (e.g. vitest unit tests) — `init()` from
// wasm-bindgen relies on browser fetch + URL semantics that don't apply
// there. Test code that needs WASM behaviour is expected to mock this
// module at the test boundary.
if (typeof window !== 'undefined') {
  ensureReady();
}
