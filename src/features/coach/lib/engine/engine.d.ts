// Type declarations for legacy JavaScript modules from the chess explainer

declare module '@/features/coach/lib/engine/analysis' {
  export function getTopMoves(fen: string, numMoves: number): Promise<any>
  export function explainMoveAt(fen: string, uci: string): Promise<any>
}

declare module '@/features/coach/lib/engine/engine' {
  const engine: any
  export default engine
  export function setEngineDefaults(options: { depth?: number; multipv?: number }): void
  export function getEngineDefaults(): { depth: number; multipv: number }
}

declare module '@/features/coach/lib/engine/analyzer-rs' {
  export function ensureReady(): Promise<boolean>
  export function isReady(): boolean
  export function explainPosition(fen: string): any
}

declare module '@/features/coach/lib/engine/full-explanation' {
  export function buildFullExplanation(fen: string, options?: { depth?: number; multipv?: number }): Promise<any>
}
