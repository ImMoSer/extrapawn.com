import { loadMultiThreadEngine, type EngineController } from '@/shared/lib/engine.loader'
import logger from '@/shared/lib/logger'

import {
  type AnalysisUpdateCallback,
  type EvaluatedLine,
  MAX_ANALYSIS_DEPTH,
  type WdlStats,
} from './types'

const STORAGE_KEY_THREADS = 'engine-threads-count'

/**
 * Сервис, управляющий экземпляром МНОГОПОТОЧНОГО движка для анализа.
 * Теперь может инстанцироваться несколько раз для разных задач.
 */
export class MultiThreadEngineManager {
  private engine: EngineController | null = null
  private isSupported = false
  private isReady = false
  private isInitializing = false
  private isSearching = false
  private initPromise: Promise<void> | null = null
  private resolveInitPromise!: () => void
  private rejectInitPromise!: (reason?: unknown) => void

  private currentThreads: number = 1
  private preferredAnalysisThreads: number = 1
  private commandQueue: string[] = []
  private infiniteAnalysisCallback: AnalysisUpdateCallback | null = null
  private lastIsReadyTime: number = 0

  // Promises for synchronization
  private readyResolve: (() => void) | null = null
  private stopResolve: (() => void) | null = null

  constructor() {
    logger.info('[MultiThreadEngineManager] Service created. Engine will be loaded on demand.')
    this._loadSavedThreads()
  }

  private _loadSavedThreads() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THREADS)
      if (saved) {
        const count = parseInt(saved, 10)
        if (!isNaN(count) && count >= 1) {
          this.preferredAnalysisThreads = count
          this.currentThreads = count
          logger.info(`[MultiThreadEngineManager] Restored preferred threads: ${count}`)
        }
      }
    } catch (e) {
      logger.warn('[MultiThreadEngineManager] Failed to load saved threads.', e)
    }
  }

  public async ensureReady(): Promise<void> {
    if (this.isReady && !this.isInitializing) return
    if (this.isInitializing && this.initPromise) return this.initPromise

    this.isInitializing = true
    this.initPromise = new Promise<void>((resolve, reject) => {
      this.resolveInitPromise = resolve
      this.rejectInitPromise = reject
      this._initEngine().catch(reject)
    })
    return this.initPromise
  }

  private async _initEngine(): Promise<void> {
    try {
      const loadedEngine = await loadMultiThreadEngine()

      if (!loadedEngine) {
        this.isSupported = false
        logger.warn(`[MultiThreadEngineManager] Multi-threading not supported. Engine not loaded.`)
        this.isInitializing = false
        this.resolveInitPromise()
        return
      }

      this.engine = loadedEngine
      this.isSupported = true
      this.engine.addMessageListener((message: string) => this.handleEngineMessage(message))

      const timeoutId = setTimeout(() => {
        if (!this.isReady) {
          const errorMsg = 'UCI handshake timeout for MultiThreadEngineManager'
          logger.error(`[MultiThreadEngineManager] ${errorMsg}`)
          this.rejectInitPromise(new Error(errorMsg))
        }
      }, 60000)

      this.initPromise?.finally(() => clearTimeout(timeoutId))
      this.sendCommand('uci')
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      logger.error('[MultiThreadEngineManager] Failed to initialize engine:', errorMsg, error)
      this.isInitializing = false
      this.initPromise = null
      if (this.rejectInitPromise) this.rejectInitPromise(error)
    }
  }

  private sendCommand(command: string): void {
    if (!this.engine) return
    if (
      !this.isReady &&
      !['uci', 'isready'].includes(command) &&
      !command.startsWith('setoption')
    ) {
      this.commandQueue.push(command)
      return
    }
    this.engine.postMessage(command)
  }

  private processCommandQueue(): void {
    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()
      if (command) this.sendCommand(command)
    }
  }

  public async waitReady(): Promise<void> {
    await this.ensureReady()
    if (!this.engine) return

    return new Promise((resolve) => {
      this.readyResolve = resolve
      this.lastIsReadyTime = performance.now()
      this.sendCommand('isready')
    })
  }

  private getOptimalHashSize(): number {
    return 64
  }

  private handleEngineMessage(message: string): void {
    const parts = message.split(' ')
    const cmd = parts[0]

    if (message === 'uciok') {
      this.sendCommand(`setoption name Hash value ${this.getOptimalHashSize()}`)
      this.sendCommand('setoption name UCI_ShowWDL value true')

      // Initialize with preferred threads (defaults to 1 if not saved)
      this.sendCommand(`setoption name Threads value ${this.preferredAnalysisThreads}`)
      this.currentThreads = this.preferredAnalysisThreads

      this.sendCommand('isready')
    } else if (message === 'readyok') {
      const waitTime = performance.now() - (this.lastIsReadyTime || 0)
      if (this.isInitializing) {
        this.isReady = true
        this.isInitializing = false
        logger.info(
          `[MultiThreadEngineManager] Engine is ready (init) in ${waitTime.toFixed(1)}ms.`,
        )
        if (this.resolveInitPromise) this.resolveInitPromise()
        this.processCommandQueue()
      } else {
        logger.info(`[MultiThreadEngineManager] readyok received in ${waitTime.toFixed(1)}ms.`)
      }
      if (this.readyResolve) {
        const resolve = this.readyResolve
        this.readyResolve = null
        resolve()
      }
    } else if (cmd === 'info') {
      this.parseInfoLine(message)
    } else if (cmd === 'bestmove') {
      this.isSearching = false
      const bestMoveUci = parts[1] && parts[1] !== '(none)' ? parts[1] : null

      // If we were waiting for stop to complete
      if (this.stopResolve) {
        const resolve = this.stopResolve
        this.stopResolve = null
        resolve()
      }

      if (this.infiniteAnalysisCallback) {
        this.infiniteAnalysisCallback([], bestMoveUci)
      }
    }
  }

  private parseInfoLine(line: string): void {
    if (!this.infiniteAnalysisCallback || !this.isSearching) return
    try {
      let currentLineId = 1,
        depth = 0
      let score: { type: 'cp' | 'mate'; value: number } | null = null
      let wdl: WdlStats | undefined
      let pvUci: string[] = []
      const parts = line.split(' ')
      let i = 0

      while (i < parts.length) {
        const token = parts[i]
        switch (token) {
          case 'depth': {
            const depthStr = parts[++i]
            if (depthStr) depth = parseInt(depthStr, 10)
            break
          }
          case 'multipv': {
            const multipvStr = parts[++i]
            if (multipvStr) currentLineId = parseInt(multipvStr, 10)
            break
          }
          case 'score': {
            const type = parts[++i] as 'cp' | 'mate'
            const valueStr = parts[++i]
            if (type && valueStr) {
              const value = parseInt(valueStr, 10)
              if ((type === 'cp' || type === 'mate') && !isNaN(value)) {
                score = { type, value }
              }
            }
            break
          }
          case 'wdl': {
            const winStr = parts[++i]
            const drawStr = parts[++i]
            const lossStr = parts[++i]

            if (winStr && drawStr && lossStr) {
              const win = parseInt(winStr, 10)
              const draw = parseInt(drawStr, 10)
              const loss = parseInt(lossStr, 10)
              if (!isNaN(win) && !isNaN(draw) && !isNaN(loss)) {
                wdl = { win, draw, loss }
              }
            }
            break
          }
          case 'pv':
            pvUci = parts.slice(i + 1)
            i = parts.length // Завершаем цикл, так как pv всегда идет в конце
            break
        }
        i++
      }

      // Отправляем данные только если есть минимально полезный набор
      if (score && pvUci.length > 0 && !isNaN(depth) && depth > 0) {
        const parsedData: EvaluatedLine = { id: currentLineId, depth, score, wdl, pvUci }
        this.infiniteAnalysisCallback([parsedData], null)
      }
    } catch (error) {
      logger.warn('[MultiThreadEngineManager] Error parsing info line:', line, error)
    }
  }

  public async startAnalysis(fen: string, callback: AnalysisUpdateCallback): Promise<void> {
    await this.ensureReady()
    if (!this.engine) return

    // Critical: stop previous analysis first and wait for bestmove
    if (this.isSearching) {
      await this.stopAnalysis()
    }

    // Always respect the preferred/current setting. No automatic scaling to max.
    if (this.currentThreads !== this.preferredAnalysisThreads) {
      await this.setThreads(this.preferredAnalysisThreads)
    }

    this.infiniteAnalysisCallback = callback
    this.isSearching = true
    this.sendCommand(`position fen ${fen}`)
    this.sendCommand(`go depth ${MAX_ANALYSIS_DEPTH}`)
  }

  public async getBestMoveOnly(
    fen: string,
    options: { depth?: number; movetime?: number } = {},
  ): Promise<string | null> {
    await this.ensureReady()
    if (!this.engine) return null

    if (this.isSearching) {
      await this.stopAnalysis()
    }

    // For simple gameplay moves (depth <= 10 or default), use 1 thread as requested
    const useSingleThread = (options.depth || 10) <= 10
    if (useSingleThread && this.currentThreads !== 1) {
      await this.setThreads(1)
    } else if (!useSingleThread && this.currentThreads !== this.preferredAnalysisThreads) {
      await this.setThreads(this.preferredAnalysisThreads)
    }

    return new Promise((resolve) => {
      const internalCallback = (_lines: EvaluatedLine[], bestMoveUci?: string | null) => {
        if (bestMoveUci !== undefined && bestMoveUci !== null) {
          this.infiniteAnalysisCallback = null
          this.isSearching = false
          resolve(bestMoveUci)
        }
      }

      this.infiniteAnalysisCallback = internalCallback
      this.isSearching = true

      this.sendCommand(`position fen ${fen}`)
      const goCommand = `go ${options.depth ? `depth ${options.depth}` : ''} ${
        options.movetime ? `movetime ${options.movetime}` : ''
      }`.trim()
      this.sendCommand(goCommand || 'go depth 10')
    })
  }

  public async startNewGame(): Promise<void> {
    await this.ensureReady()
    if (!this.engine) return

    if (this.isSearching) {
      await this.stopAnalysis()
    }

    this.sendCommand('ucinewgame')
    await this.waitReady()
  }

  public async calculateFixedDepth(
    fen: string,
    depth: number,
    multiPv: number = 3,
  ): Promise<EvaluatedLine[]> {
    await this.ensureReady()
    if (!this.engine) return []

    if (this.isSearching) {
      await this.stopAnalysis()
    }

    return new Promise((resolve) => {
      const results = new Map<number, EvaluatedLine>()

      const fixedDepthCallback = (lines: EvaluatedLine[], bestMoveUci?: string | null) => {
        lines.forEach((line) => {
          results.set(line.id, line)
        })
        if (bestMoveUci !== undefined && bestMoveUci !== null) {
          this.infiniteAnalysisCallback = null
          this.isSearching = false
          resolve(Array.from(results.values()).sort((a, b) => a.id - b.id))
        }
      }

      this.infiniteAnalysisCallback = fixedDepthCallback
      this.isSearching = true

      this.sendCommand(`setoption name MultiPV value ${multiPv}`)
      this.sendCommand(`position fen ${fen}`)
      this.sendCommand(`go depth ${depth}`)
    })
  }

  public async stopAnalysis(): Promise<void> {
    await this.ensureReady()
    if (!this.engine || !this.isSearching) {
      this.isSearching = false
      return
    }

    return new Promise((resolve) => {
      this.stopResolve = resolve
      this.sendCommand('stop')
      // Removed the dangerous setTimeout.
      // We now strictly rely on the 'bestmove' engine event to resolve this promise and reset the state.
    })
  }

  public async setOption(name: string, value: string | number): Promise<void> {
    await this.ensureReady()
    if (!this.engine) return

    // UCI standard: options should be set while engine is not searching
    const wasSearching = this.isSearching
    if (wasSearching) {
      await this.stopAnalysis()
    }

    this.sendCommand(`setoption name ${name} value ${value}`)
    await this.waitReady()

    if (name === 'Threads') {
      const count = typeof value === 'string' ? parseInt(value, 10) : value
      this.currentThreads = count
      this.preferredAnalysisThreads = count
      try {
        localStorage.setItem(STORAGE_KEY_THREADS, String(count))
      } catch (e) {
        logger.warn('[MultiThreadEngineManager] Failed to save threads preference.', e)
      }
    }
  }

  public async setThreads(count: number): Promise<void> {
    await this.setOption('Threads', count)
  }

  public isMultiThreadingSupported(): boolean {
    return this.isSupported
  }

  public getMaxThreads(): number {
    return Math.max(1, navigator.hardwareConcurrency || 4)
  }
}

// Global instance for backwards compatibility / default analysis engine
export const multiThreadEngineManager = new MultiThreadEngineManager()
