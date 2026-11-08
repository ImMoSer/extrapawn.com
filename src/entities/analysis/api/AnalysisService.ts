import { apiClient } from '@/shared/api/client'
import {
  type AnalysisUpdateCallback,
  type EngineLoadingListener,
  type EngineLoadingState,
  type EvaluatedLine,
  localEngineManager,
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
  isTablebase?: boolean
}

interface GaviotaExplainerLineDTO {
  rank: number
  uci: string
  san: string
  cp: number | null
  mate: number | null
  pv: string[]
  win_p?: number | null
  draw_p?: number | null
  loss_p?: number | null
}

interface GaviotaExplainerLinesResponse {
  lines: GaviotaExplainerLineDTO[] | null
}

export function countBoardPieces(fen: string): number {
  const placement = fen.trim().split(/\s+/)[0] ?? ''
  let count = 0
  for (let i = 0; i < placement.length; i++) {
    const ch = placement[i]!
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z')) {
      count++
    }
  }
  return count
}

class AnalysisServiceController {
  private activeEngineManager: typeof localEngineManager | null = null
  private sanCache = new Map<
    string,
    { pvSan: string[]; initialFullMoveNumber: number; initialTurn: ChessopsColor }
  >()

  private initPromise: Promise<void> | null = null

  constructor() {
    logger.info('[AnalysisService] Created.')
  }

  public getLoadingState(): EngineLoadingState {
    return localEngineManager.getLoadingState()
  }

  public onLoadingStateChange(listener: EngineLoadingListener): () => void {
    return localEngineManager.onLoadingStateChange(listener)
  }

  public initialize(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          logger.info('[AnalysisService] Initializing engines...')

          await localEngineManager.ensureReady()

          if (localEngineManager.isEngineSupported()) {
            this.activeEngineManager = localEngineManager
            logger.info(`[AnalysisService] Initialized successfully with Local Engine.`)
          } else {
            this.initPromise = null
            logger.error(`[AnalysisService] Local Engine not supported. Analysis cannot run.`)
          }
        } catch (err: unknown) {
          this.initPromise = null
          throw err
        }
      })()
    }
    return this.initPromise
  }

  public isLocalEngineAvailable(): boolean {
    return this.activeEngineManager === localEngineManager
  }

  public getMaxThreads(): number {
    return this.isLocalEngineAvailable() ? localEngineManager.getMaxThreads() : 1
  }

  public async startAnalysis(
    fen: string,
    callback: (lines: EvaluatedLineWithSan[]) => void,
    options: { multiPv?: number; movetime?: number } = {},
  ) {
    const pieceCount = countBoardPieces(fen)
    if (pieceCount >= 2 && pieceCount <= 5) {
      if (this.activeEngineManager) {
        await this.activeEngineManager.stopAnalysis()
      }
      const maxCandidates = options.multiPv ?? 5
      const tbLines = await this.fetchGaviotaLines(fen, maxCandidates)
      if (tbLines.length > 0) {
        callback(tbLines)
      }
      return
    }

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

    await this.activeEngineManager.startAnalysis(fen, analysisUpdateCallback, options)
  }

  private async fetchGaviotaLines(
    fen: string,
    maxCandidates: number,
  ): Promise<EvaluatedLineWithSan[]> {
    const res = await apiClient<GaviotaExplainerLinesResponse>('/gaviota/explainer-lines', {
      method: 'POST',
      body: JSON.stringify({
        fen,
        max_candidates: maxCandidates,
        include_pv: false,
      }),
    })

    if (!res.lines || res.lines.length === 0) {
      return []
    }

    const rawEvaluated: EvaluatedLine[] = res.lines.map((item) => ({
      id: item.rank,
      depth: 99,
      score:
        item.mate !== null && item.mate !== undefined
          ? { type: 'mate', value: item.mate }
          : { type: 'cp', value: 0 },
      pvUci: [item.uci],
    }))

    const prepared = this.prepareLinesForDisplay(rawEvaluated, fen)
    return prepared.map((line) => ({
      ...line,
      isTablebase: true,
    }))
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
    this.sanCache.clear()
    if (this.activeEngineManager === localEngineManager) {
      await localEngineManager.startNewGame()
    }
  }

  public async stopAnalysis() {
    this.sanCache.clear()
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
      // Check if the engine manager has a setThreads method (LocalEngineManager has it)
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
    if (this.sanCache.size >= 500) {
      const oldestKey = this.sanCache.keys().next().value
      if (oldestKey !== undefined) {
        this.sanCache.delete(oldestKey)
      }
    }
    this.sanCache.set(cacheKey, result)
    return result
  }
}

export const analysisService = new AnalysisServiceController()
