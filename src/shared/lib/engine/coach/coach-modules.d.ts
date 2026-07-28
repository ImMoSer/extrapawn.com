declare module '@/shared/lib/engine/coach/analysis' {
  export function getTopMoves(
    fen: string,
    numMoves?: number,
    options?: { check_book?: boolean }
  ): Promise<{
    moves: import('./coach.types').CoachTopMove[]
    mode?: 'theory' | 'engine'
    opening_info?: import('./coach.types').OpeningInfo | null
    eval_cp?: number | null
    mate?: number | null
    result?: string | null
  }>
  export function explainMoveAt(fen: string, uci: string): Promise<import('./coach.types').CoachLastMoveAnalysis>
}

declare module '@/shared/lib/engine/coach/engine' {
  const engine: {
    ready: boolean
    init(): Promise<void>
    setVersion(v: string): void
    clearCache(): void
    analyzeMultiPV(fen: string, multipv: number, depth: number, startFen: string, movesUci: string, options?: { check_book?: boolean }): Promise<unknown>
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
  export function setEngineDefaults(options: { depth?: number; multipv?: number; version?: string; source?: string; threads?: number }): void
  export function getEngineDefaults(): { depth: number; multipv: number; version: string; source: string; threads: number }
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
  export function analyzeMove(fen: string, uci: string): { san: string; motifs?: Array<{ id: string; phrase?: string }>; fen_after?: string } | null
}

declare module '@/shared/lib/engine/coach/full-explanation' {
  export function buildFullExplanation(fen: string, options?: { depth?: number; multipv?: number; threads?: number }): Promise<import('./coach.types').CoachExplanation | null>
}

declare module '@/shared/lib/engine/coach/connectors' {
  export function topConsequenceLine(
    prevExplanation: import('./coach.types').CoachExplanation,
    currExplanation: import('./coach.types').CoachExplanation,
    options?: { movingSide?: string; motifs?: string[]; evalSwingCp?: number }
  ): string | null
}

declare module '@/shared/lib/engine/coach/visualizer' {
  export function generateVisualCommands(explanation: unknown, fen: string, sideToMove: string, planSteps: Array<{ uci: string; san: string; motifs: string[]; headline: string | null; to: string; from: string }>, keySquares?: string[]): Record<string, string[]>
  export function parseVisualCommands(commandsString: string): Array<{ orig?: string; dest?: string; brush?: string; stepBadge?: string | number; nag?: string }>
}

declare module '@/shared/lib/engine/coach/openings' {
  export function findOpeningFromHistory(sanHistory: string[]): string | null
}

declare module '@/shared/lib/engine/coach/positions' {
  export function getRandomPuzzle(): Promise<{ initialFen: string; tacticalSolution?: string[]; id?: string } | null>
  export function pickRandomPosition(): { fen: string; title?: string }
}

declare module '@/shared/lib/engine/coach/heatmap' {
  export function computePieceValues(fen: string): Record<string, unknown>
}

declare module '@/shared/lib/engine/coach/remote-engine' {
  export function getEngineSource(): 'local' | 'remote'
  export function setEngineSource(source: 'local' | 'remote'): void
  export function getRemoteEngineUrl(): string
  export function setRemoteEngineUrl(url: string): void
  export function analyzeRemotePosition(fen: string, multipv?: number, depth?: number): Promise<unknown>
}


