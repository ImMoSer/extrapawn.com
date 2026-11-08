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

export interface EngineDownloadProgress {
  percent: number
  loaded: number
  total: number
  speedBytesPerSec: number
  speedText: string
  eta: number
  etaText: string
}

export type EngineInitPhase = 'idle' | 'downloading' | 'initializing' | 'ready' | 'error'

export interface EngineLoadingState {
  phase: EngineInitPhase
  progress: EngineDownloadProgress | null
  errorMessage: string | null
}

export type EngineLoadingListener = (state: EngineLoadingState) => void

export type AnalysisUpdateCallback = (lines: EvaluatedLine[], bestMoveUci?: string | null) => void

export const MAX_ANALYSIS_DEPTH = 35
