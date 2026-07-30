declare module '@/shared/lib/engine/coach/visualizer' {
  export interface DrawShape {
    orig: string
    dest?: string
    brush?: string
    nag?: string
    stepBadge?: string
    modifiers?: { lineWidth?: number }
  }
  export function parseVisualCommands(commandsString: string | null | undefined): DrawShape[]
}

declare module '@/shared/lib/engine/coach/positions' {
  export function getRandomPuzzle(): Promise<{ initialFen: string; tacticalSolution?: string[]; id?: string } | null>
  export function pickRandomPosition(): { fen: string; title?: string }
}

declare module '@/shared/lib/engine/coach/openings' {
  export function findOpeningFromHistory(sanHistory: string[]): string | null
}

declare module '@/shared/lib/engine/coach/heatmap' {
  export function computePieceValues(fen: string): Record<string, unknown>
}
