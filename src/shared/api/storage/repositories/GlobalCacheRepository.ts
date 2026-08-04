import logger from '@/shared/lib/logger'
import { db } from '../IndexedDbClient'

export interface WikiContent {
  slug: string
  content: string
  timestamp: number
}

export class GlobalCacheRepository {

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

