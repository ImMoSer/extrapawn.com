import {
  type AnalysisUpdateCallback,
  type EvaluatedLine,
  multiThreadEngineManager,
  type WdlStats,
} from '@/shared/lib/engine'
import logger from '@/shared/lib/logger'
import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'
import { makeSan } from 'chessops/san'
import type { Color as ChessopsColor } from 'chessops/types'
import { parseUci } from 'chessops/util'

export interface EvaluatedLineWithSan extends EvaluatedLine {
  pvSan: string[]
  startingFen: string
  initialFullMoveNumber: number
  initialTurn: ChessopsColor
  wdl?: WdlStats
}

class AnalysisServiceController {
  private activeEngineManager: typeof multiThreadEngineManager | null = null
  private sanCache = new Map<
    string,
    { pvSan: string[]; initialFullMoveNumber: number; initialTurn: ChessopsColor }
  >()

  private initPromise: Promise<void> | null = null

  constructor() {
    logger.info('[AnalysisService] Created.')
  }

  public initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        logger.info('[AnalysisService] Initializing engines...')

        // 1. Versuch: Multi-Thread laden
        await multiThreadEngineManager.ensureReady()

        // 2. Prüfen, ob der Multi-Thread Manager wirklich eine Engine geladen hat
        if (multiThreadEngineManager.isMultiThreadingSupported()) {
          this.activeEngineManager = multiThreadEngineManager
          logger.info(`[AnalysisService] Initialized successfully with Multi-Threaded Engine.`)
        } else {
          logger.error(`[AnalysisService] Multi-threading not supported. Analysis cannot run.`)
        }
      })()
    }
    return this.initPromise
  }

  public isMultiThreadAvailable(): boolean {
    return this.activeEngineManager === multiThreadEngineManager
  }

  public getMaxThreads(): number {
    return this.isMultiThreadAvailable() ? multiThreadEngineManager.getMaxThreads() : 1
  }

  public async startAnalysis(
    fen: string,
    callback: (lines: EvaluatedLineWithSan[]) => void,
    multiPV = 3,
  ) {
    if (!this.activeEngineManager) {
      logger.info('[AnalysisService] Engine manager not active. Waiting for initialization...')
      await this.initialize()
    }

    if (!this.activeEngineManager) {
      logger.error('[AnalysisService] Cannot start analysis, no engine manager is active.')
      return
    }

    const analysisUpdateCallback: AnalysisUpdateCallback = (updatedLines) => {
      //logger.debug('[AnalysisService_CALLBACK]', { updatedLines })
      if (updatedLines.length > 0) {
        const linesWithSan = this.prepareLinesForDisplay(updatedLines, fen)
        callback(linesWithSan)
      }
    }

    await this.activeEngineManager.setOption('MultiPV', multiPV)
    await this.activeEngineManager.startAnalysis(fen, analysisUpdateCallback)
  }

  public async calculateFixedDepth(
    fen: string,
    depth: number,
    multiPV = 3,
  ): Promise<EvaluatedLineWithSan[]> {
    if (!this.activeEngineManager) {
      logger.info('[AnalysisService] Engine manager not active. Initializing...')
      await this.initialize()
    }

    if (!this.activeEngineManager) {
      logger.error(
        '[AnalysisService] Cannot start fixed depth calculation, no engine manager is active.',
      )
      return []
    }

    const lines = await this.activeEngineManager.calculateFixedDepth(fen, depth, multiPV)

    // Restore default MultiPV just in case (optional, but good practice)
    await this.activeEngineManager.setOption('MultiPV', 1)

    return this.prepareLinesForDisplay(lines, fen)
  }

  public async startNewGame() {
    if (!this.activeEngineManager) {
      await this.initialize()
    }
    if (this.activeEngineManager === multiThreadEngineManager) {
      await multiThreadEngineManager.startNewGame()
    }
  }

  public async stopAnalysis() {
    if (!this.activeEngineManager) {
      return
    }
    await this.activeEngineManager.stopAnalysis()
  }

  public async setThreads(count: number) {
    if (!this.activeEngineManager) {
      await this.initialize()
    }
    if (this.activeEngineManager) {
      // Check if the engine manager has a setThreads method (MultiThreadEngineManager has it)
      if ('setThreads' in this.activeEngineManager) {
        await this.activeEngineManager.setThreads(count)
        logger.info(`[AnalysisService] Threads set to ${count}`)
      } else {
        logger.warn(
          `[AnalysisService] activeEngineManager does not support setThreads. Ignoring request for ${count} threads.`,
        )
      }
    }
  }

  private prepareLinesForDisplay(lines: EvaluatedLine[], fen: string): EvaluatedLineWithSan[] {
    const setup = parseFen(fen).unwrap()
    const turn = setup.turn
    return lines.map((line) => {
      const conversionResult = this.convertUciToSanForLine(fen, line.pvUci)
      const correctedScore =
        turn === 'black' ? { ...line.score, value: -line.score.value } : line.score
      return {
        ...line,
        startingFen: fen,
        score: correctedScore,
        ...conversionResult,
      }
    })
  }

  private convertUciToSanForLine(
    fen: string,
    pvUci: string[],
  ): { pvSan: string[]; initialFullMoveNumber: number; initialTurn: ChessopsColor } {
    const cacheKey = `${fen}|${pvUci.join(' ')}`
    if (this.sanCache.has(cacheKey)) {
      return this.sanCache.get(cacheKey)!
    }

    const sanMoves: string[] = []
    let initialFullMoveNumber = 1
    let initialTurn: ChessopsColor = 'white'

    try {
      const setup = parseFen(fen).unwrap()
      const pos = Chess.fromSetup(setup).unwrap()
      initialFullMoveNumber = pos.fullmoves
      initialTurn = pos.turn

      for (const uciMove of pvUci) {
        const move = parseUci(uciMove)
        if (move && pos.isLegal(move)) {
          sanMoves.push(makeSan(pos, move))
          pos.play(move)
        } else {
          break
        }
      }
    } catch (e: unknown) {
      logger.error(
        '[AnalysisService] Error converting UCI to SAN:',
        e instanceof Error ? e.message : String(e),
      )
      return { pvSan: [], initialFullMoveNumber: 1, initialTurn: 'white' }
    }

    const result = { pvSan: sanMoves, initialFullMoveNumber, initialTurn }
    this.sanCache.set(cacheKey, result)
    return result
  }
}

export const analysisService = new AnalysisServiceController()
