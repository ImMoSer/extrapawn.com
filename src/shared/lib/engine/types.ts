export interface ScoreInfo {
  type: 'cp' | 'mate'
  value: number
}

export interface WdlStats {
  win: number
  draw: number
  loss: number
}

export interface EvaluatedLine {
  id: number
  depth: number
  score: ScoreInfo
  wdl?: WdlStats
  pvUci: string[]
}

export type AnalysisUpdateCallback = (lines: EvaluatedLine[], bestMoveUci?: string | null) => void

export const MAX_ANALYSIS_DEPTH = 35
