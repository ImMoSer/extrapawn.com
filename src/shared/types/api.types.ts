// src/shared/types/api.types.ts

// --- Engine and Gameplay Types ---
export type EngineId =
  | 'maia-1500'
  | 'maia-1700'
  | 'maia-1900'
  | 'maia-2200'
  | 'badgyal'
  | 't1000'

export const ENGINE_NAMES: Record<EngineId, string> = {
  'maia-1500': 'Maia 1500',
  'maia-1700': 'Maia 1700',
  'maia-1900': 'Maia 1900',
  'maia-2200': 'Maia 2200',
  badgyal: 'Bad Gyal',
  t1000: 'T1000',
}

export const AVAILABLE_ENGINES: EngineId[] = [
  'maia-1500',
  'maia-1700',
  'maia-1900',
  'maia-2200',
  'badgyal',
  't1000',
]

// --- Developer Crashtest Engines ---
export type CrashtestEngineId =
  | 'stockfish'
  | 'maia-1500'
  | 'maia-1900'
  | 'maia-2200'
  | 't1000'
  | 'badgyal'

export const CRASHTEST_ENGINES: CrashtestEngineId[] = [
  'stockfish',
  'maia-1500',
  'maia-1900',
  'maia-2200',
  't1000',
  'badgyal',
]

export const CRASHTEST_ENGINE_NAMES: Record<CrashtestEngineId, string> = {
  stockfish: 'Stockfish Server (Coach)',
  'maia-1500': 'Maia 1500 (maia-1500.pb.gz)',
  'maia-1900': 'Maia 1900 (maia-1900.pb.gz)',
  'maia-2200': 'Maia 2200 (maia-2200.pb.gz)',
  t1000: 'T1 256x10 (t1-256x10-distilled-swa-2432500.pb.gz)',
  badgyal: 'Bad Gyal 128x10 (Bad_Gyal_128x10.pb.gz)',
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
