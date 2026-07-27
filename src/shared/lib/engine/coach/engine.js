// Browser-side Stockfish (WASM) wrapper.
// Runs Stockfish 18-lite-single in a Web Worker, talks UCI over postMessage.
// Same public API as the (now-deprecated) server engine: evaluate / analyzeMultiPV / getBestMove.

const ENGINE_VERSIONS = {
  lite: '/stockfish/stockfish-18-lite-single.js',
  full: '/stockfish/stockfish-18-single.js',
};

// Configurable defaults backed by localStorage. The UI's settings
// panel writes to these so the engine layer reflects user preference
// without each call-site having to thread depth through.
function readPref(key, fallback, min, max) {
  try {
    const raw = localStorage.getItem(`positional_chess.${key}`);
    if (!raw) return fallback;
    const v = parseInt(raw, 10);
    if (Number.isFinite(v) && v >= min && v <= max) return v;
  } catch { /* localStorage unavailable */ }
  return fallback;
}

function readPrefString(key, fallback, validValues) {
  try {
    const raw = localStorage.getItem(`positional_chess.${key}`);
    if (raw && validValues.includes(raw)) return raw;
  } catch { /* localStorage unavailable */ }
  return fallback;
}

import {
  analyzeRemotePosition,
  getEngineSource,
  setEngineSource,
  getRemoteEngineUrl,
  setRemoteEngineUrl
} from './remote-engine';

export { getEngineSource, setEngineSource, getRemoteEngineUrl, setRemoteEngineUrl };

let DEFAULT_DEPTH = readPref('depth', 12, 6, 22);
let DEFAULT_MULTIPV = readPref('multipv', 5, 1, 10);
let DEFAULT_VERSION = readPrefString('version', 'lite', ['lite', 'full']);
let DEFAULT_ENGINE_SOURCE = getEngineSource();

export function setEngineDefaults({ depth, multipv, version, source } = {}) {
  if (Number.isFinite(depth)) {
    DEFAULT_DEPTH = Math.max(6, Math.min(22, depth));
    try { localStorage.setItem('positional_chess.depth', String(DEFAULT_DEPTH)); } catch { /* ignore */ }
  }
  if (Number.isFinite(multipv)) {
    DEFAULT_MULTIPV = Math.max(1, Math.min(10, multipv));
    try { localStorage.setItem('positional_chess.multipv', String(DEFAULT_MULTIPV)); } catch { /* ignore */ }
  }
  if (version && (version === 'lite' || version === 'full')) {
    DEFAULT_VERSION = version;
    try { localStorage.setItem('positional_chess.version', DEFAULT_VERSION); } catch { /* ignore */ }
    engine.setVersion(version);
  }
  if (source && (source === 'remote' || source === 'local')) {
    DEFAULT_ENGINE_SOURCE = source;
    setEngineSource(source);
    engine.clearCache();
  }
}

export function getEngineDefaults() {
  return { depth: DEFAULT_DEPTH, multipv: DEFAULT_MULTIPV, version: DEFAULT_VERSION, source: DEFAULT_ENGINE_SOURCE };
}

let engineConfigProvider = null;

export function getEngineConfigProvider() {
  return engineConfigProvider;
}

export function registerEngineConfigProvider(provider) {
  engineConfigProvider = provider;
  if (provider) {
    const depth = typeof provider.getDepth === 'function' ? provider.getDepth() : undefined;
    const multipv = typeof provider.getMultiPv === 'function' ? provider.getMultiPv() : undefined;
    const version = typeof provider.getEngineVersion === 'function' ? provider.getEngineVersion() : undefined;
    const useServer = typeof provider.useServerCoach === 'function' ? provider.useServerCoach() : undefined;
    const source = useServer !== undefined ? (useServer ? 'remote' : 'local') : undefined;
    setEngineDefaults({ depth, multipv, version, source });
  }
}


export function getPieceCount(fen) {
  if (!fen) return 0;
  const boardPart = fen.split(' ')[0];
  let count = 0;
  for (const ch of boardPart) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      count++;
    }
  }
  return count;
}


const DEFAULT_JOB_TIMEOUT_MS = 30_000;
const DEFAULT_INIT_TIMEOUT_MS = 120_000;
const DEFAULT_CACHE_SIZE = 500;

class LRU {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.map = new Map();
  }
  get(key) {
    if (!this.map.has(key)) return undefined;
    const v = this.map.get(key);
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      this.map.delete(this.map.keys().next().value);
    }
  }
  clear() {
    this.map.clear();
  }
}

function parseScore(line) {
  const m = line.match(/score (cp|mate) (-?\d+)/);
  if (!m) return null;
  const value = parseInt(m[2], 10);
  if (m[1] === 'mate') {
    const cp = value > 0 ? 100_000 - value : -100_000 - value;
    return { type: 'mate', value, cp };
  }
  return { type: 'cp', value, cp: value };
}

function parsePV(line) {
  const idx = line.indexOf(' pv ');
  if (idx === -1) return [];
  return line.substring(idx + 4).trim().split(/\s+/);
}

function parseMultiPV(line) {
  const m = line.match(/multipv (\d+)/);
  return m ? parseInt(m[1], 10) : 1;
}

class StockfishEngine {
  constructor(opts = {}) {
    this.version = opts.version ?? DEFAULT_VERSION;
    this.workerUrl = opts.workerUrl ?? ENGINE_VERSIONS[this.version] ?? ENGINE_VERSIONS.lite;
    this.jobTimeoutMs = opts.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS;
    this.initTimeoutMs = opts.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
    this.cache = new LRU(opts.cacheSize ?? DEFAULT_CACHE_SIZE);

    this.worker = null;
    this.ready = false;
    this.queue = [];
    this.currentJob = null;
    this.working = false;
    this.lastMultiPV = 1;

    this._initResolve = null;
    this._initReject = null;
    this._initTimer = null;
    this._initPromise = null;
  }

  setVersion(newVersion) {
    if (!ENGINE_VERSIONS[newVersion]) return;
    const targetUrl = ENGINE_VERSIONS[newVersion];
    if (this.version === newVersion && this.workerUrl === targetUrl) return;

    console.log(`[Stockfish] Switching engine version from '${this.version}' to '${newVersion}' (${targetUrl})`);
    this.shutdown();
    this.version = newVersion;
    this.workerUrl = targetUrl;
    this.cache.clear();
  }

  init() {
    if (this._initPromise) return this._initPromise;
    console.log(`[Stockfish] Spawning engine worker: ${this.workerUrl} (version: ${this.version})`);
    this._initPromise = new Promise((resolve, reject) => {
      this._initResolve = resolve;
      this._initReject = reject;
      try {
        this.worker = new Worker(this.workerUrl);
      } catch (err) {
        console.error(`[Stockfish] Failed to spawn worker:`, err);
        return reject(new Error(`Failed to spawn Stockfish worker: ${err.message}`));
      }
      this.worker.onmessage = (e) => {
        if (typeof e.data === 'string') this._onLine(e.data.trim());
      };
      this.worker.onerror = (err) => {
        const msg = err.message || 'Worker error';
        console.error(`[Stockfish] Worker error: ${msg}`, err);
        if (this._initReject) {
          this._initReject(new Error(`Stockfish worker error: ${msg}`));
          this._clearInit();
        } else {
          this._abortCurrentJob(new Error(`Stockfish worker error: ${msg}`));
        }
      };
      this._initTimer = setTimeout(() => {
        if (this._initReject) {
          console.error(`[Stockfish] Init timed out after ${this.initTimeoutMs}ms`);
          this._initReject(new Error(
            `Stockfish init timed out after ${this.initTimeoutMs}ms (no readyok)`
          ));
          this._clearInit();
        }
      }, this.initTimeoutMs);

      this._send('uci');
      this._send('isready');
    });
    return this._initPromise;
  }

  _clearInit() {
    if (this._initTimer) clearTimeout(this._initTimer);
    this._initTimer = null;
    this._initResolve = null;
    this._initReject = null;
  }

  clearCache() {
    if (this.cache) this.cache.clear();
  }

  shutdown() {
    this._clearInit();
    this._initPromise = null;
    if (this.currentJob) {
      this._abortCurrentJob(new Error('Engine shutdown'));
    }
    while (this.queue.length > 0) {
      const j = this.queue.shift();
      try { j.reject(new Error('Engine shutdown')); } catch { /* ignore */ }
    }
    if (this.worker) {
      try { this._send('quit'); } catch { /* ignore */ }
      try { this.worker.terminate(); } catch { /* ignore */ }
      this.worker = null;
    }
    this.ready = false;
  }

  _send(cmd) {
    if (this.worker) this.worker.postMessage(cmd);
  }

  _onLine(line) {
    if (!line) return;

    if (line.startsWith('id name')) {
      console.log(`[Stockfish] Engine identity: ${line.substring(8)} (version: ${this.version})`);
    }

    if (line === 'readyok') {
      if (this._initResolve) {
        this.ready = true;
        console.log(`[Stockfish] Engine readyok received! Active engine: ${this.version} (${this.workerUrl})`);
        this._initResolve();
        this._clearInit();
        setTimeout(() => this._processQueue(), 0);
      }
      return;
    }

    if (line.startsWith('bestmove')) {
      this._finishJob(line);
      return;
    }

    if (this.currentJob && this.currentJob.onLine) {
      this.currentJob.onLine(line);
    }
  }

  evaluate(fen, depth = DEFAULT_DEPTH) {
    const key = `e|${fen}|${depth}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    return this._enqueue({ type: 'eval', fen, depth }).then(r => {
      this.cache.set(key, r);
      return r;
    });
  }

  async analyzeMultiPV(fen, numLines = DEFAULT_MULTIPV, depth = DEFAULT_DEPTH, opts = {}) {
    const n = Math.max(1, Math.min(numLines, 10));
    const src = getEngineSource();
    const key = `${src}|m|${fen}|${n}|${depth}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);

    if (src === 'remote') {
      try {
        const remoteRes = await analyzeRemotePosition(fen, { ...opts, depth, multipv: n });
        this.cache.set(key, remoteRes);
        return remoteRes;
      } catch (err) {
        console.warn('[StockfishEngine] Remote server failed, falling back to local engine:', err);
      }
    }

    return this._enqueue({ type: 'multipv', fen, depth, numLines: n }).then(r => {
      this.cache.set(key, r);
      return r;
    });
  }

  getBestMove(fen, depth = DEFAULT_DEPTH) {
    const key = `b|${fen}|${depth}`;
    const hit = this.cache.get(key);
    if (hit) return Promise.resolve(hit);
    return this._enqueue({ type: 'bestmove', fen, depth }).then(r => {
      this.cache.set(key, r);
      return r;
    });
  }

  _enqueue(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this.working || !this.ready || this.queue.length === 0) return;

    this.working = true;
    const job = this.queue.shift();
    this.currentJob = job;
    job.scoreObj = null;
    job.bestPV = [];
    job.lines = {};

    if (job.type === 'multipv') {
      this._send(`setoption name MultiPV value ${job.numLines}`);
      this.lastMultiPV = job.numLines;

      job.onLine = (line) => {
        if (line.startsWith('info') && line.includes(' score ') && line.includes(' pv ')) {
          const mpv = parseMultiPV(line);
          const score = parseScore(line);
          const pv = parsePV(line);
          if (score && pv.length > 0) {
            job.lines[mpv] = {
              rank: mpv,
              move: pv[0],
              pv: pv.slice(0, 5),
              score: score.cp,
              cp: score.type === 'cp' ? score.value : null,
              mate: score.type === 'mate' ? score.value : null,
              isMate: score.type === 'mate',
            };
          }
        }
      };
    } else {
      if (this.lastMultiPV !== 1) {
        this._send('setoption name MultiPV value 1');
        this.lastMultiPV = 1;
      }
      job.onLine = (line) => {
        if (line.startsWith('info') && line.includes(' score ')) {
          const score = parseScore(line);
          if (score) job.scoreObj = score;
          if (job.type === 'bestmove') {
            const pv = parsePV(line);
            if (pv.length > 0) job.bestPV = pv;
          }
        }
      };
    }

    job._timer = setTimeout(() => {
      job._timedOut = true;
      this._send('stop');
      job._guardTimer = setTimeout(() => {
        this._abortCurrentJob(new Error(
          `Stockfish job timed out after ${this.jobTimeoutMs}ms`
        ));
      }, 2000);
    }, this.jobTimeoutMs);

    this._send(`position fen ${job.fen}`);
    this._send(`go depth ${job.depth}`);
  }

  _abortCurrentJob(err) {
    const job = this.currentJob;
    if (!job) return;
    if (job._timer) clearTimeout(job._timer);
    if (job._guardTimer) clearTimeout(job._guardTimer);
    try { job.reject(err); } catch { /* ignore */ }
    this.currentJob = null;
    this.working = false;
    setTimeout(() => this._processQueue(), 0);
  }

  _finishJob(line) {
    const job = this.currentJob;
    if (!job) return;
    if (job._timer) clearTimeout(job._timer);
    if (job._guardTimer) clearTimeout(job._guardTimer);

    if (job._timedOut) {
      try { job.reject(new Error('Stockfish search aborted (timeout)')); } catch { /* ignore */ }
      this.currentJob = null;
      this.working = false;
      setTimeout(() => this._processQueue(), 0);
      return;
    }

    const parts = line.split(/\s+/);
    const bestMove = parts[1];
    const ponderMove = parts[3] || null;
    const so = job.scoreObj;
    const cp = so ? so.cp : 0;
    const mate = so && so.type === 'mate' ? so.value : null;

    if (job.type === 'multipv') {
      const results = Object.values(job.lines)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, job.numLines);
      const top = results[0] || {};
      job.resolve({
        moves: results,
        bestMove,
        score: top.score ?? 0,
        cp: top.cp ?? null,
        mate: top.mate ?? null,
      });
    } else if (job.type === 'bestmove') {
      job.resolve({
        bestMove,
        ponderMove,
        score: cp,
        cp: so && so.type === 'cp' ? so.value : null,
        mate,
        pv: job.bestPV.length > 0 ? job.bestPV : [bestMove],
      });
    } else {
      job.resolve({ cp, mate, score: cp });
    }

    this.currentJob = null;
    this.working = false;
    setTimeout(() => this._processQueue(), 0);
  }
}

// Module-level singleton — one engine per page.
const engine = new StockfishEngine();

export default engine;
