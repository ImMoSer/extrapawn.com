// Browser-side Stockfish (WASM) wrapper.
// Runs Stockfish 18-lite (multi-threaded) in a Web Worker, talks UCI over postMessage.
// Same public API as the (now-deprecated) server engine: evaluate / analyzeMultiPV / getBestMove.

const WORKER_URL = '/npm_stockfish/sf_1807_multi_lite/stockfish-18-lite.js'

// Configurable defaults backed by localStorage. The UI's settings
// panel writes to these so the engine layer reflects user preference
// without each call-site having to thread depth through.
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

class LRU {
  constructor(maxSize) {
    this.maxSize = maxSize
    this.map = new Map()
  }
  get(key) {
    if (!this.map.has(key)) return undefined
    const v = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, v)
    return v
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxSize) {
      this.map.delete(this.map.keys().next().value)
    }
  }
  clear() {
    this.map.clear()
  }
}

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

class StockfishEngine {
  constructor(opts = {}) {
    this.workerUrl = opts.workerUrl ?? WORKER_URL
    this.jobTimeoutMs = opts.jobTimeoutMs ?? DEFAULT_JOB_TIMEOUT_MS
    this.initTimeoutMs = opts.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS
    this.cache = new LRU(opts.cacheSize ?? DEFAULT_CACHE_SIZE)

    this.worker = null
    this.ready = false
    this.queue = []
    this.currentJob = null
    this.working = false
    this.lastMultiPV = 1
    this.lastThreads = 1

    this._initResolve = null
    this._initReject = null
    this._initTimer = null
    this._initPromise = null
  }

  init() {
    if (this._initPromise) return this._initPromise
    this._initPromise = new Promise((resolve, reject) => {
      this._initResolve = resolve
      this._initReject = reject
      try {
        this.worker = new Worker(this.workerUrl)
      } catch (err) {
        return reject(new Error(`Failed to spawn Stockfish worker: ${err.message}`))
      }
      this.worker.onmessage = (e) => {
        if (typeof e.data === 'string') this._onLine(e.data.trim())
      }
      this.worker.onerror = (err) => {
        const msg = err.message || 'Worker error'
        if (this._initReject) {
          this._initReject(new Error(`Stockfish worker error: ${msg}`))
          this._clearInit()
        } else {
          this._abortCurrentJob(new Error(`Stockfish worker error: ${msg}`))
        }
      }
      this._initTimer = setTimeout(() => {
        if (this._initReject) {
          this._initReject(
            new Error(`Stockfish init timed out after ${this.initTimeoutMs}ms (no readyok)`),
          )
          this._clearInit()
        }
      }, this.initTimeoutMs)

      this._send('uci')
      this._send('isready')
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
    if (this.worker) {
      try {
        this._send('quit')
      } catch {
        /* ignore */
      }
      try {
        this.worker.terminate()
      } catch {
        /* ignore */
      }
      this.worker = null
    }
    this.ready = false
  }

  _send(cmd) {
    if (this.worker) this.worker.postMessage(cmd)
  }

  _onLine(line) {
    if (!line) return

    if (line === 'readyok') {
      if (this._initResolve) {
        this.ready = true
        this._initResolve()
        this._clearInit()
        setTimeout(() => this._processQueue(), 0)
      }
      return
    }

    if (line.startsWith('bestmove')) {
      this._finishJob(line)
      return
    }

    if (this.currentJob && this.currentJob.onLine) {
      this.currentJob.onLine(line)
    }
  }

  evaluate(fen, depth = DEFAULT_DEPTH) {
    const key = `e|${fen}|${depth}`
    const hit = this.cache.get(key)
    if (hit) return Promise.resolve(hit)
    return this._enqueue({ type: 'eval', fen, depth }).then((r) => {
      this.cache.set(key, r)
      return r
    })
  }

  analyzeMultiPV(fen, numLines = DEFAULT_MULTIPV, depth = DEFAULT_DEPTH) {
    const n = Math.max(1, Math.min(numLines, 10))
    const key = `m|${fen}|${n}|${depth}`
    const hit = this.cache.get(key)
    if (hit) return Promise.resolve(hit)
    return this._enqueue({ type: 'multipv', fen, depth, numLines: n }).then((r) => {
      this.cache.set(key, r)
      return r
    })
  }

  getBestMove(fen, depth = DEFAULT_DEPTH) {
    const key = `b|${fen}|${depth}`
    const hit = this.cache.get(key)
    if (hit) return Promise.resolve(hit)
    return this._enqueue({ type: 'bestmove', fen, depth }).then((r) => {
      this.cache.set(key, r)
      return r
    })
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
      if (this.lastThreads !== DEFAULT_THREADS) {
        this._send(`setoption name Threads value ${DEFAULT_THREADS}`)
        this.lastThreads = DEFAULT_THREADS
      }
      this._send(`setoption name MultiPV value ${job.numLines}`)
      this.lastMultiPV = job.numLines

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
      if (this.lastThreads !== DEFAULT_THREADS) {
        this._send(`setoption name Threads value ${DEFAULT_THREADS}`)
        this.lastThreads = DEFAULT_THREADS
      }
      if (this.lastMultiPV !== 1) {
        this._send('setoption name MultiPV value 1')
        this.lastMultiPV = 1
      }
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
      this._send('stop')
      job._guardTimer = setTimeout(() => {
        this._abortCurrentJob(new Error(`Stockfish job timed out after ${this.jobTimeoutMs}ms`))
      }, 2000)
    }, this.jobTimeoutMs)

    this._send(`position fen ${job.fen}`)
    this._send(`go depth ${job.depth}`)
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
