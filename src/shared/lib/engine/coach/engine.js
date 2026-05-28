// Browser-side Stockfish (WASM) wrapper & Server analysis orchestrator.
// Delegates job execution to WasmEngineStrategy or ServerEngineStrategy.


import { Chess } from 'chess.js'
import { LRU } from './engine-cache'
import { WasmEngineStrategy, ServerEngineStrategy } from './engine-providers'

function checkTerminalPosition(fen) {
  try {
    const c = new Chess(fen)
    if (c.isGameOver()) {
      if (c.isCheckmate()) {
        return {
          isTerminal: true,
          type: 'checkmate',
          score: -100000,
          mate: 0,
          moves: [],
          bestMove: null,
          ponderMove: null,
          pv: [],
        }
      }
      if (c.isStalemate() || c.isDraw() || c.isThreefoldRepetition() || c.isInsufficientMaterial()) {
        return {
          isTerminal: true,
          type: 'draw',
          score: 0,
          mate: null,
          moves: [],
          bestMove: null,
          ponderMove: null,
          pv: [],
        }
      }
    }
  } catch {
    // ignore
  }
  return null
}

const WORKER_URL = '/npm_stockfish/sf_1807_multi_lite/stockfish-18-lite.js'

export let USE_SERVER_ENGINE = localStorage.getItem('positional_chess.use_server_coach') !== 'false' // default true

export function setUseServerEngine(val) {
  USE_SERVER_ENGINE = val
  localStorage.setItem('positional_chess.use_server_coach', String(val))
}

// Configurable defaults backed by localStorage.
function readPref(key, fallback, min, max) {
  try {
    const raw = localStorage.getItem(`positional_chess.${key}`)
    if (!raw) return fallback
    const v = parseInt(raw, 10)
    if (Number.isFinite(v) && v >= min && v <= max) return v
  } catch {
    /* localStorage unavailable */
  }
  return fallback
}
let DEFAULT_DEPTH = readPref('depth', 12, 6, 22)
let DEFAULT_MULTIPV = readPref('multipv', 5, 1, 10)
let DEFAULT_THREADS = readPref('threads', 1, 1, 32)

export function setEngineDefaults({ depth, multipv, threads } = {}) {
  if (Number.isFinite(depth)) {
    DEFAULT_DEPTH = Math.max(6, Math.min(22, depth))
    try {
      localStorage.setItem('positional_chess.depth', String(DEFAULT_DEPTH))
    } catch {
      /* ignore */
    }
  }
  if (Number.isFinite(multipv)) {
    DEFAULT_MULTIPV = Math.max(1, Math.min(10, multipv))
    try {
      localStorage.setItem('positional_chess.multipv', String(DEFAULT_MULTIPV))
    } catch {
      /* ignore */
    }
  }
  if (Number.isFinite(threads)) {
    DEFAULT_THREADS = Math.max(1, Math.min(32, threads))
    try {
      localStorage.setItem('positional_chess.threads', String(DEFAULT_THREADS))
    } catch {
      /* ignore */
    }
  }
}
export function getEngineDefaults() {
  return { depth: DEFAULT_DEPTH, multipv: DEFAULT_MULTIPV, threads: DEFAULT_THREADS }
}

const DEFAULT_JOB_TIMEOUT_MS = 30_000
const DEFAULT_INIT_TIMEOUT_MS = 15_000
const DEFAULT_CACHE_SIZE = 500

function parseScore(line) {
  const m = line.match(/score (cp|mate) (-?\d+)/)
  if (!m) return null
  const value = parseInt(m[2], 10)
  if (m[1] === 'mate') {
    const cp = value > 0 ? 100_000 - value : -100_000 - value
    return { type: 'mate', value, cp }
  }
  return { type: 'cp', value, cp: value }
}

function parsePV(line) {
  const idx = line.indexOf(' pv ')
  if (idx === -1) return []
  return line
    .substring(idx + 4)
    .trim()
    .split(/\s+/)
}

function parseMultiPV(line) {
  const m = line.match(/multipv (\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

export function getPieceCount(fen) {
  if (!fen) return 32
  const boardPart = fen.split(' ')[0]
  return (boardPart.match(/[a-zA-Z]/g) || []).length
}

class StockfishEngine {
  constructor(opts = {}) {
    this.workerUrl = opts.workerUrl ?? WORKER_URL
    this.jobTimeoutMs = opts.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS
    this.initTimeoutMs = opts.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS
    this.cache = new LRU(opts.cacheSize ?? DEFAULT_CACHE_SIZE)

    this.ready = false
    this.queue = []
    this.currentJob = null
    this.working = false

    this._wasmStrategy = null
    this._serverStrategy = null
    this._lastInitWasServer = null

    this._initResolve = null
    this._initReject = null
    this._initTimer = null
    this._initPromise = null
  }

  get activeStrategy() {
    if (USE_SERVER_ENGINE) {
      if (!this._serverStrategy) {
        this._serverStrategy = new ServerEngineStrategy()
      }
      return this._serverStrategy
    } else {
      if (!this._wasmStrategy) {
        this._wasmStrategy = new WasmEngineStrategy(this.workerUrl)
      }
      return this._wasmStrategy
    }
  }

  init() {
    if (this._initPromise && this._lastInitWasServer === USE_SERVER_ENGINE) {
      return this._initPromise
    }

    this._lastInitWasServer = USE_SERVER_ENGINE
    this._initPromise = new Promise((resolve, reject) => {
      this._initResolve = resolve
      this._initReject = reject
      this.ready = false

      this._initTimer = setTimeout(() => {
        if (this._initReject) {
          this._initReject(
            new Error(`Stockfish init timed out after ${this.initTimeoutMs}ms (no readyok)`),
          )
          this._clearInit()
        }
      }, this.initTimeoutMs)

      this.activeStrategy.init({
        onLine: (line) => this._onLine(line),
        onError: (err) => {
          if (this._initReject) {
            this._initReject(err)
            this._clearInit()
          } else {
            this._abortCurrentJob(err)
          }
        },
        onReady: () => {
          if (this._initResolve) {
            this.ready = true
            this._initResolve()
            this._clearInit()
            setTimeout(() => this._processQueue(), 0)
          }
        },
      }).catch((err) => {
        if (this._initReject) {
          this._initReject(err)
          this._clearInit()
        } else {
          reject(err)
        }
      })
    })

    return this._initPromise
  }

  _clearInit() {
    if (this._initTimer) clearTimeout(this._initTimer)
    this._initTimer = null
    this._initResolve = null
    this._initReject = null
  }

  shutdown() {
    if (this._wasmStrategy) {
      this._wasmStrategy.shutdown()
    }
    if (this._serverStrategy) {
      this._serverStrategy.shutdown()
    }
    this.ready = false
    this._initPromise = null
  }

  _send(cmd) {
    if (this.activeStrategy && typeof this.activeStrategy.send === 'function') {
      this.activeStrategy.send(cmd)
    }
  }

  _onLine(line) {
    if (!line) return

    if (line.startsWith('bestmove')) {
      this._finishJob(line)
      return
    }

    if (this.currentJob && this.currentJob.onLine) {
      this.currentJob.onLine(line)
    }
  }

  evaluate(fen, depth = DEFAULT_DEPTH, startFen = null, moves = null, options = {}) {
    const key = `e|${fen}|${depth}`
    const hit = this.cache.get(key)
    if (hit) return hit // Promise cached

    const terminal = checkTerminalPosition(fen)
    if (terminal) {
      const p = Promise.resolve({ cp: terminal.score, mate: terminal.mate, score: terminal.score })
      this.cache.set(key, p)
      return p
    }

    // Optimization: if we already have a MultiPV search for this fen, we can just use its score!
    const mpvKey = USE_SERVER_ENGINE ? `m|${fen}|server` : `m|${fen}|${DEFAULT_MULTIPV}|${depth}`
    const hitMpv = this.cache.get(mpvKey)
    if (hitMpv) {
      const p = hitMpv.then(r => ({ cp: r.cp, mate: r.mate, score: r.score }))
      this.cache.set(key, p)
      return p
    }

    const p = this._enqueue({ type: 'eval', fen, depth, startFen, moves, skipTablebase: options.skipTablebase })
    p.catch(() => this.cache.delete(key))
    this.cache.set(key, p)
    return p
  }

  analyzeMultiPV(fen, numLines = DEFAULT_MULTIPV, depth = DEFAULT_DEPTH, startFen = null, moves = null, options = {}) {
    const key = USE_SERVER_ENGINE ? `m|${fen}|server` : `m|${fen}|${Math.max(1, Math.min(numLines, 10))}|${depth}`
    const n = USE_SERVER_ENGINE ? 3 : Math.max(1, Math.min(numLines, 10))
    const hit = this.cache.get(key)
    if (hit) return hit // Promise cached

    const terminal = checkTerminalPosition(fen)
    if (terminal) {
      const p = Promise.resolve({
        moves: [],
        bestMove: null,
        score: terminal.score,
        cp: terminal.score,
        mate: terminal.mate,
      })
      this.cache.set(key, p)
      return p
    }

    const p = this._enqueue({ type: 'multipv', fen, depth, numLines: n, startFen, moves, skipTablebase: options.skipTablebase })
    p.catch(() => this.cache.delete(key))
    this.cache.set(key, p)
    return p
  }

  getBestMove(fen, depth = DEFAULT_DEPTH, startFen = null, moves = null) {
    const key = `b|${fen}|${depth}`
    const hit = this.cache.get(key)
    if (hit) return hit // Promise cached

    const terminal = checkTerminalPosition(fen)
    if (terminal) {
      const p = Promise.resolve({
        bestMove: null,
        ponderMove: null,
        score: terminal.score,
        cp: terminal.score,
        mate: terminal.mate,
        pv: [],
      })
      this.cache.set(key, p)
      return p
    }

    const p = this._enqueue({ type: 'bestmove', fen, depth, startFen, moves })
    p.catch(() => this.cache.delete(key))
    this.cache.set(key, p)
    return p
  }

  _enqueue(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ ...job, resolve, reject })
      this._processQueue()
    })
  }

  _processQueue() {
    if (this.working || !this.ready || this.queue.length === 0) return

    this.working = true
    const job = this.queue.shift()
    this.currentJob = job
    job.scoreObj = null
    job.bestPV = []
    job.lines = {}

    if (job.type === 'multipv') {
      job.onLine = (line) => {
        if (line.startsWith('info') && line.includes(' score ') && line.includes(' pv ')) {
          const mpv = parseMultiPV(line)
          const score = parseScore(line)
          const pv = parsePV(line)
          if (score && pv.length > 0) {
            job.lines[mpv] = {
              rank: mpv,
              move: pv[0],
              pv: pv.slice(0, 5),
              score: score.cp,
              cp: score.type === 'cp' ? score.value : null,
              mate: score.type === 'mate' ? score.value : null,
              isMate: score.type === 'mate',
            }
          }
        }
      }
    } else {
      job.onLine = (line) => {
        if (line.startsWith('info') && line.includes(' score ')) {
          const score = parseScore(line)
          if (score) job.scoreObj = score
          if (job.type === 'bestmove') {
            const pv = parsePV(line)
            if (pv.length > 0) job.bestPV = pv
          }
        }
      }
    }

    job._timer = setTimeout(() => {
      job._timedOut = true
      this.activeStrategy.stop()
      job._guardTimer = setTimeout(() => {
        this._abortCurrentJob(new Error(`Stockfish job timed out after ${this.jobTimeoutMs}ms`))
      }, 2000)
    }, this.jobTimeoutMs)

    const multipv = job.type === 'multipv' ? job.numLines : 1
    this.activeStrategy.executeJob(job, {
      multipv,
      threads: DEFAULT_THREADS,
      onLine: (line) => {
        if (job._timedOut) return
        this._onLine(line)
      },
      onError: (err) => {
        if (job._timedOut) return
        this._abortCurrentJob(err)
      },
    })
  }

  _abortCurrentJob(err) {
    const job = this.currentJob
    if (!job) return
    if (job._timer) clearTimeout(job._timer)
    if (job._guardTimer) clearTimeout(job._guardTimer)
    try {
      job.reject(err)
    } catch {
      /* ignore */
    }
    this.currentJob = null
    this.working = false
    setTimeout(() => this._processQueue(), 0)
  }

  _finishJob(line) {
    const job = this.currentJob
    if (!job) return
    if (job._timer) clearTimeout(job._timer)
    if (job._guardTimer) clearTimeout(job._guardTimer)

    if (job._timedOut) {
      try {
        job.reject(new Error('Stockfish search aborted (timeout)'))
      } catch {
        /* ignore */
      }
      this.currentJob = null
      this.working = false
      setTimeout(() => this._processQueue(), 0)
      return
    }

    const parts = line.split(/\s+/)
    const bestMove = parts[1]
    const ponderMove = parts[3] || null
    const so = job.scoreObj
    const cp = so ? so.cp : 0
    const mate = so && so.type === 'mate' ? so.value : null

    if (job.type === 'multipv') {
      const results = Object.values(job.lines)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, job.numLines)
      const top = results[0] || {}
      job.resolve({
        moves: results,
        bestMove,
        score: top.score ?? 0,
        cp: top.cp ?? null,
        mate: top.mate ?? null,
      })
    } else if (job.type === 'bestmove') {
      job.resolve({
        bestMove,
        ponderMove,
        score: cp,
        cp: so && so.type === 'cp' ? so.value : null,
        mate,
        pv: job.bestPV.length > 0 ? job.bestPV : [bestMove],
      })
    } else {
      job.resolve({ cp, mate, score: cp })
    }

    this.currentJob = null
    this.working = false
    setTimeout(() => this._processQueue(), 0)
  }
}

// Module-level singleton — one engine per page.
const engine = new StockfishEngine()

export default engine
