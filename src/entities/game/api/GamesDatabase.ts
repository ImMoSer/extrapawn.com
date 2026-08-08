import {
  appDatabase,
  type LichessGameEntity,
} from '@/shared/api/storage/AppDatabase'

export type { LichessGameEntity }

export const gamesDb = appDatabase
