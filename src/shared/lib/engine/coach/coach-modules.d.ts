declare module '@/shared/lib/engine/coach/analysis' {
  export function getTopMoves(fen: string, numMoves: number): Promise<{ moves: import('./coach.types').CoachTopMove[] }>
  export function explainMoveAt(fen: string, uci: string): Promise<import('./coach.types').CoachLastMoveAnalysis>
}

declare module '@/shared/lib/engine/coach/engine' {
  const engine: {
    init(): Promise<void>
    analyzeMultiPV(fen: string, multipv: number, depth: number, startFen: string, movesUci: string): Promise<unknown>
    getBestMove(fen: string, depth?: number): Promise<{ bestMove: string } | null>
    _send(cmd: string): void
    shutdown(): void
  }
  export default engine
  export interface EngineConfigProvider {
    getEnginePrefs(): { useServerCoach: boolean; depth: number; multipv: number }
    setUseServerCoach(val: boolean): void
    setEngineDefaults(options: { depth?: number; multipv?: number }): void
  }
  export function registerEngineConfigProvider(provider: EngineConfigProvider): void
  export function setEngineDefaults(options: { depth?: number; multipv?: number; threads?: number }): void
  export function getEngineDefaults(): { depth: number; multipv: number; threads: number }
  export let USE_SERVER_ENGINE: boolean
  export function setUseServerEngine(val: boolean): void
  export function getPieceCount(fen: string): number
  export interface TablebaseMove {
    san: string
    uci: string
    checkmate?: boolean
    dtm?: number | null
    category?: string
  }
  export function fetchTablebaseMoves(fen: string): Promise<TablebaseMove[] | null>
}

declare module '@/shared/lib/engine/coach/analyzer-rs' {
  export function ensureReady(): Promise<boolean>
  export function isReady(): boolean
  export function explainPosition(fen: string): Promise<import('./coach.types').CoachExplanation | null>
}

declare module '@/shared/lib/engine/coach/full-explanation' {
  export function buildFullExplanation(fen: string, options?: { depth?: number; multipv?: number; threads?: number }): Promise<import('./coach.types').CoachExplanation | null>
}

declare module '@/shared/lib/engine/coach/connectors' {
  export function topConsequenceLine(
    prevExplanation: import('./coach.types').CoachExplanation,
    currExplanation: import('./coach.types').CoachExplanation,
    options: { movingSide: string; motifs: string[]; evalSwingCp: number }
  ): string | null
}
