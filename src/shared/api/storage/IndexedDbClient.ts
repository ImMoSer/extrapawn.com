import Dexie, { type Table } from 'dexie'

export interface TheoryStatEntity {
  fen_key: string
  source: string
  data: string // JSON string
  expires: number
}

export interface WikiContentEntity {
  slug: string
  content: string
  timestamp: number
}

class IndexedDbDatabase extends Dexie {
  theory_cache!: Table<TheoryStatEntity, [string, string]>
  wiki_cache!: Table<WikiContentEntity, string>

  constructor() {
    super('ExtrapawnCacheDatabase')
    this.version(1).stores({
      theory_cache: '[fen_key+source], expires',
      wiki_cache: 'slug, timestamp',
    })
  }
}

export const db = new IndexedDbDatabase()
