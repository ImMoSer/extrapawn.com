// Web Worker for Rust/WASM motif analyzer (engine_rs)
// Executes WASM computations in a background worker thread to prevent main-thread UI lag.

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

function ensureReady() {
  if (ready) return Promise.resolve(true);
  if (!initPromise) {
    initPromise = init()
      .then(() => {
        ready = true;
        try {
          console.log('[engine-rs worker]', wasmVersion());
        } catch {
          /* ignore */
        }
        return true;
      })
      .catch((err) => {
        console.error('[engine-rs worker] init failed:', err);
        ready = false;
        return false;
      });
  }
  return initPromise;
}

self.onmessage = async (e) => {
  const { id, type, payload } = e.data || {};

  if (type === 'init') {
    const success = await ensureReady();
    self.postMessage({ id, success });
    return;
  }

  if (!ready) {
    await ensureReady();
  }

  try {
    let result = null;
    switch (type) {
      case 'analyzeMove':
        result = wasmAnalyze(payload.fenBefore, payload.moveUci);
        if (!result || result.error) result = null;
        break;
      case 'analyzePv':
        result = wasmAnalyzePv(payload.startFen, payload.ucis, payload.plies);
        if (!Array.isArray(result)) result = null;
        break;
      case 'evaluateFen':
        result = wasmEvaluateFen(payload.fen);
        if (!result || result.error) result = null;
        break;
      case 'pieceContributions':
        result = wasmPieceContributions(payload.fen);
        if (!Array.isArray(result)) result = null;
        break;
      case 'explainPosition':
        result = wasmExplainPosition(payload.fen);
        if (!result || result.error) result = null;
        break;
      case 'pieceValueAt':
        result = wasmPieceValueAt(payload.fen, payload.square);
        if (!result || result.error) result = null;
        break;
      default:
        console.warn('[engine-rs worker] unknown message type:', type);
    }
    self.postMessage({ id, result });
  } catch (err) {
    console.error(`[engine-rs worker] ${type} failed:`, err);
    self.postMessage({ id, result: null, error: err?.message || String(err) });
  }
};
