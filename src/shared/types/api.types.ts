// src/shared/types/api.types.ts

// --- Engine and Gameplay Types ---
export type EngineId =
  | 'maia-1500'
  | 'maia-2200'
  | 'mozero'
  | 'stockfish'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'maia-1500': 'Maia 1500',
  'maia-2200': 'Maia 2200',
  mozero: 'MOZERO',
  stockfish: 'Stockfish',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1500',
  'maia-2200',
  'mozero',
  'stockfish',
]

// --- Developer Crashtest Engines ---
export type CrashtestEngineId =
  | 'stockfish'
  | 'maia-2200'
  | 'mozero'

export const CRASHTEST_ENGINES: CrashtestEngineId[] = [
  'stockfish',
  'maia-2200',
  'mozero',
]

export const CRASHTEST_ENGINE_NAMES: Record<CrashtestEngineId, string> = {
  stockfish: 'Stockfish',
  'maia-2200': 'Maia 2200 (maia-2200.pb.gz)',
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
  base_puzzle_rating: number
  telegram?: boolean
  telegramId?: number | null
  language?: string | null
  validatedAt?: number
  endgame_skill?: number
}

export interface AuthState {
  isAuthenticated: boolean
  userProfile: UserSessionProfile | null
  isProcessing: boolean
  error: string | null
}
