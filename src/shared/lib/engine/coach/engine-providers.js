/**
 * WasmEngineStrategy
 * Strategy for running Stockfish locally using a Web Worker.
 */
export class WasmEngineStrategy {
  constructor(workerUrl) {
    this.workerUrl = workerUrl
    this.worker = null
    this.lastThreads = 1
    this.lastMultiPV = 1
  }

  init({ onLine, onError, onReady }) {
    if (this.worker) {
      onReady()
      return Promise.resolve()
    }

    try {
      this.worker = new Worker(this.workerUrl)
    } catch (err) {
      return Promise.reject(new Error(`Failed to spawn Stockfish worker: ${err.message}`))
    }

    this.worker.onmessage = (e) => {
      if (typeof e.data === 'string') {
        const line = e.data.trim()
        if (line === 'readyok') {
          onReady()
        } else {
          onLine(line)
        }
      }
    }

    this.worker.onerror = (err) => {
      const msg = err.message || 'Worker error'
      onError(new Error(`Stockfish worker error: ${msg}`))
    }

    this.send('uci')
    this.send('isready')
    return Promise.resolve()
  }

  executeJob(job, { multipv, threads }) {
    if (!this.worker) return

    if (this.lastThreads !== threads) {
      this.send(`setoption name Threads value ${threads}`)
      this.lastThreads = threads
    }
    if (this.lastMultiPV !== multipv) {
      this.send(`setoption name MultiPV value ${multipv}`)
      this.lastMultiPV = multipv
    }

    if (job.startFen && job.moves) {
      const sf = job.startFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' ? 'startpos' : `fen ${job.startFen}`
      this.send(`position ${sf} moves ${job.moves.join(' ')}`)
    } else {
      this.send(`position fen ${job.fen}`)
    }
    this.send(`go depth ${job.depth}`)
  }

  stop() {
    this.send('stop')
  }

  send(cmd) {
    if (this.worker) this.worker.postMessage(cmd)
  }

  shutdown() {
    if (this.worker) {
      try {
        this.send('quit')
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
  }
}

/**
 * ServerEngineStrategy
 * Strategy for running Stockfish analyses on the Python backend server.
 * Handles Lichess Tablebase fetching for endgames with 5 or fewer pieces.
 */
export class ServerEngineStrategy {
  constructor({ getPieceCount, fetchTablebaseMoves }) {
    this.getPieceCount = getPieceCount
    this.fetchTablebaseMoves = fetchTablebaseMoves
  }

  init({ onReady }) {
    onReady()
    return Promise.resolve()
  }

  async executeJob(job, { onLine, onError }) {
    const doBackendFetch = (lichess_moves = null) => {
      fetch('/api/coach-engine/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: job.fen,
          start_fen: job.startFen,
          moves: job.moves,
          lichess_moves,
        }),
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`)
          }
          return res.json()
        })
        .then((data) => {
          if (data.lines) {
            data.lines.forEach((line) => onLine(line))
          }
        })
        .catch((err) => {
          onError(err)
        })
    }

    if (!job.skipTablebase && this.getPieceCount(job.fen) <= 5) {
      try {
        const moves = await this.fetchTablebaseMoves(job.fen)
        doBackendFetch(moves)
      } catch {
        doBackendFetch(null)
      }
    } else {
      doBackendFetch(null)
    }
  }

  stop() {
    // HTTP API is stateless, no stop command is sent to the server.
  }

  shutdown() {
    // No worker resources to release.
  }
}
