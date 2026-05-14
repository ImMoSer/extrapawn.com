// Type declarations for legacy JavaScript modules from the chess explainer

declare module '@/shared/lib/engine/coach/analysis' {
  export function getTopMoves(fen: string, numMoves: number): Promise<Record<string, unknown>>
  export function explainMoveAt(fen: string, uci: string): Promise<Record<string, unknown>>
}

declare module '@/shared/lib/engine/coach/engine' {
  const engine: any
  export default engine
  export function setEngineDefaults(options: { depth?: number; multipv?: number }): void
  export function getEngineDefaults(): { depth: number; multipv: number }
}

declare module '@/shared/lib/engine/coach/analyzer-rs' {
  export function ensureReady(): Promise<boolean>
  export function isReady(): boolean
  export function explainPosition(fen: string): Record<string, unknown>
}

declare module '@/shared/lib/engine/coach/full-explanation' {
  export function buildFullExplanation(fen: string, options?: { depth?: number; multipv?: number }): Promise<Record<string, unknown>>
}
