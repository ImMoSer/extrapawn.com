// src/shared/types/api.types.ts

// --- Engine and Gameplay Types ---
export type EngineId =
  | 'mozero'
  | 'stockfish'
  | 'stockfish_d12'

export const ENGINE_NAMES: Record<EngineId, string> = {
  mozero: 'MOZERO',
  stockfish: 'Stockfish',
  stockfish_d12: 'Stockfish D12',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'mozero',
  'stockfish',
]

// --- Developer Crashtest Engines ---
export type CrashtestEngineId =
  | 'stockfish'
  | 'stockfish_d12'
  | 'mozero'

export const CRASHTEST_ENGINES: CrashtestEngineId[] = [
  'stockfish',
  'stockfish_d12',
  'mozero',
]

export const CRASHTEST_ENGINE_NAMES: Record<CrashtestEngineId, string> = {
  stockfish: 'Stockfish (SF_SmartControl V2.0)',
  stockfish_d12: 'Stockfish D12 (1 Core + Syzygy/Gaviota)',
  mozero: 'MOZERO (Elite-Leela-v2 + Syzygy/Gaviota)',
}

export type Color = 'white' | 'black'

export interface UserMeta {
  id: string
  username: string
}

interface LichessUserProfile {
  id: string
  username: string
  email?: string
  perfs?: Record<string, { rating: number; prog: number; games: number }>
  createdAt?: number
  profile?: {
    firstName?: string
    lastName?: string
    bio?: string
    country?: string
    location?: string
  }
}

export interface UserSessionProfile extends LichessUserProfile {
  language?: string | null
  termsAcceptedAt?: string | null
  validatedAt?: number
}

export interface AuthState {
  isAuthenticated: boolean
  userProfile: UserSessionProfile | null
  isProcessing: boolean
  error: string | null
}
