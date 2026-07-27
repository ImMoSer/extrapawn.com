export interface LeelaOnnxNetworkInfo {
  id: string;
  name: string;
  file: string;
  arch: string;
  elo: string;
  size: string;
  description: string;
}

export type WorkerRequest =
  | { type: 'init'; modelUrl: string }
  | { type: 'getBestMove'; fen: string; history: string[]; legalMoves: string[]; temperature?: number }
  | { type: 'evaluatePosition'; fen: string; history: string[] }

export type WorkerResponse =
  | { type: 'ready' }
  | { type: 'initProgress'; progress: number; message: string }
  | { type: 'initError'; error: string }
  | { type: 'bestMove'; move: string; confidence: number; wdl: [number, number, number] }
  | { type: 'evaluation'; wdl: [number, number, number] }
  | { type: 'error'; error: string }

export interface LeelaOnnxState {
  isReady: boolean
  isLoading: boolean
  isThinking: boolean
  loadingProgress: number
  loadingMessage: string
  lastMove: string | null
  lastConfidence: number | null
  wdl: [number, number, number] | null
  error: string | null
  selectedNetwork: LeelaOnnxNetworkInfo | null
}
