// Manager for the Rust/WASM motif analyzer running inside a Web Worker.
//
// All WASM calculations are dispatched asynchronously to `engine-rs.worker.js`
// so that heavy position analyses never block the main UI thread.

let worker = null;
let ready = false;
let initPromise = null;
let reqId = 0;
const pendingMap = new Map();

function getWorker() {
  if (!worker && typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./engine-rs.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => {
        const { id, result, error, success } = e.data || {};
        if (id === 'init') {
          ready = !!success;
          return;
        }
        const pending = pendingMap.get(id);
        if (pending) {
          pendingMap.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      };
      worker.onerror = (err) => {
        console.error('[engine-rs manager] worker error:', err);
        ready = false;
      };
    } catch (err) {
      console.error('[engine-rs manager] failed to spawn worker:', err);
    }
  }
  return worker;
}

function sendRequest(type, payload) {
  const w = getWorker();
  if (!w) return Promise.resolve(null);
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pendingMap.set(id, { resolve, reject });
    w.postMessage({ id, type, payload });
  });
}

export function ensureReady() {
  if (ready) return Promise.resolve(true);
  if (!initPromise) {
    const w = getWorker();
    if (!w) return Promise.resolve(false);
    initPromise = new Promise((resolve) => {
      const id = 'init';
      const timeout = setTimeout(() => {
        console.warn('[engine-rs manager] init timed out');
        resolve(false);
      }, 5000);

      w.postMessage({ id, type: 'init' });

      const origOnMessage = w.onmessage;
      w.onmessage = (e) => {
        if (e.data?.id === 'init') {
          clearTimeout(timeout);
          ready = !!e.data.success;
          w.onmessage = origOnMessage;
          resolve(ready);
          return;
        }
        if (origOnMessage) origOnMessage(e);
      };
    });
  }
  return initPromise;
}

export function isReady() {
  return ready;
}

/** Analyze a single move via Web Worker. */
export async function analyzeMove(fenBefore, moveUci) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('analyzeMove', { fenBefore, moveUci });
}

/** Analyze a sequence of UCI moves via Web Worker. */
export async function analyzePv(startFen, ucis, plies = 3) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('analyzePv', { startFen, ucis, plies });
}

// Compose a tagline from a Rust analysis result (pure JS composition).
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

const KEY_TOKENS = [
  'queen', 'rook', 'bishop', 'knight', 'pawn',
  'king',
];
function phrasesOverlap(a, b) {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  for (const tok of KEY_TOKENS) {
    if (la.includes(tok) && lb.includes(tok)) return true;
  }
  for (let f = 0; f < 8; f++) {
    const file = String.fromCharCode(97 + f);
    const tag = `${file}-pawn`;
    if (la.includes(tag) && lb.includes(tag)) return true;
  }
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

/** Static evaluation of a FEN via Web Worker. */
export async function evaluateFen(fen) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('evaluateFen', { fen });
}

/** All non-king pieces' contribution via Web Worker. */
export async function pieceContributionsForFen(fen) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('pieceContributions', { fen });
}

/** Structured position explanation via Web Worker. */
export async function explainPosition(fen) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('explainPosition', { fen });
}

/** Single-piece contribution via Web Worker. */
export async function pieceValueAt(fen, square) {
  if (!ready) {
    const ok = await ensureReady();
    if (!ok) return null;
  }
  return sendRequest('pieceValueAt', { fen, square });
}

if (typeof window !== 'undefined') {
  ensureReady();
}
