import logger from '@/shared/lib/logger'
import { db } from '../IndexedDbClient'

export interface TheoryStat {
  fen_key: string
  source: string
  data: unknown
  expires: number
}

export interface WikiContent {
  slug: string
  content: string
  timestamp: number
}

export class GlobalCacheRepository {
  async getTheoryStat(fen: string, source: string): Promise<TheoryStat | null> {
    try {
      const row = await db.theory_cache.get([fen, source])
      if (!row) return null

      if (Date.now() > row.expires) {
        await this.deleteTheoryStat(fen, source)
        return null
      }

      return {
        fen_key: row.fen_key,
        source: row.source,
        expires: row.expires,
        data: JSON.parse(row.data),
      }
    } catch (err) {
      logger.error(
        `[GlobalCacheRepository] Failed to get theory stat for fen ${fen} and source ${source}`,
        err,
      )
      return null
    }
  }

  async saveTheoryStat(stat: TheoryStat): Promise<boolean> {
    try {
      await db.theory_cache.put({
        fen_key: stat.fen_key,
        source: stat.source,
        data: JSON.stringify(stat.data),
        expires: stat.expires,
      })
      return true
    } catch (err) {
      logger.error('[GlobalCacheRepository] Failed to save theory stat', err)
      return false
    }
  }

  async deleteTheoryStat(fen: string, source: string): Promise<boolean> {
    try {
      await db.theory_cache.delete([fen, source])
      return true
    } catch (err) {
      logger.error(
        `[GlobalCacheRepository] Failed to delete theory stat for fen ${fen} and source ${source}`,
        err,
      )
      return false
    }
  }

  async cleanupExpiredStats(): Promise<number> {
    try {
      const now = Date.now()
      const count = await db.theory_cache.where('expires').below(now).delete()
      return count
    } catch (err) {
      logger.error('[GlobalCacheRepository] Failed to cleanup expired stats', err)
      return 0
    }
  }

  async getWikiContent(slug: string): Promise<WikiContent | null> {
    try {
      const row = await db.wiki_cache.get(slug)
      return row ?? null
    } catch (err) {
      logger.error(`[GlobalCacheRepository] Failed to get wiki content for slug ${slug}`, err)
      return null
    }
  }

  async saveWikiContent(content: WikiContent): Promise<boolean> {
    try {
      await db.wiki_cache.put({
        slug: content.slug,
        content: content.content,
        timestamp: content.timestamp,
      })
      return true
    } catch (err) {
      logger.error(
        `[GlobalCacheRepository] Failed to save wiki content for slug ${content.slug}`,
        err,
      )
      return false
    }
  }
}

export const globalCacheRepository = new GlobalCacheRepository()

