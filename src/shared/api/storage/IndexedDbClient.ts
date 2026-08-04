import Dexie, { type Table } from 'dexie'

export interface WikiContentEntity {
  slug: string
  content: string
  timestamp: number
}

class IndexedDbDatabase extends Dexie {
  wiki_cache!: Table<WikiContentEntity, string>

  constructor() {
    super('ExtrapawnCacheDatabase')
    this.version(1).stores({
      theory_cache: '[fen_key+source], expires',
      wiki_cache: 'slug, timestamp',
    })
    this.version(2).stores({
      theory_cache: null,
      wiki_cache: 'slug, timestamp',
    })
  }
}

export const db = new IndexedDbDatabase()
