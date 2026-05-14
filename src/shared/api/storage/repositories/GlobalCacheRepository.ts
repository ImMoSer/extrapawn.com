import logger from '@/shared/lib/logger'
import { databaseClient, DbNotOpenError } from '../DatabaseClient'

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

interface RawTheoryStatRow {
  fen_key: string
  source: string
  data: string
  expires: number
}

export class GlobalCacheRepository {
  async getTheoryStat(fen: string, source: string): Promise<TheoryStat | null> {
    try {
      const rows = await databaseClient.query<RawTheoryStatRow>(
        'global',
        `
        SELECT * FROM theory_stats WHERE fen_key = ? AND source = ?
      `,
        [fen, source],
      )

      if (rows.length === 0) return null

      const row = rows[0]!
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
      if (!(err instanceof DbNotOpenError)) {
        logger.error(
          `[GlobalCacheRepository] Failed to get theory stat for fen ${fen} and source ${source}`,
          err,
        )
      }
      return null
    }
  }

  async saveTheoryStat(stat: TheoryStat): Promise<boolean> {
    try {
      await databaseClient.batch('global', [
        {
          sql: `
          INSERT INTO theory_stats (fen_key, source, data, expires)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(fen_key, source) DO UPDATE SET
            data    = excluded.data,
            expires = excluded.expires
        `,
          params: [stat.fen_key, stat.source, JSON.stringify(stat.data), stat.expires],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[GlobalCacheRepository] Failed to save theory stat', err)
      }
      return false
    }
  }

  async deleteTheoryStat(fen: string, source: string): Promise<boolean> {
    try {
      await databaseClient.batch('global', [
        {
          sql: 'DELETE FROM theory_stats WHERE fen_key = ? AND source = ?',
          params: [fen, source],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(
          `[GlobalCacheRepository] Failed to delete theory stat for fen ${fen} and source ${source}`,
          err,
        )
      }
      return false
    }
  }

  async cleanupExpiredStats(): Promise<number> {
    try {
      const now = Date.now()
      await databaseClient.batch('global', [
        {
          sql: 'DELETE FROM theory_stats WHERE expires < ?',
          params: [now],
        },
      ])
      return 0
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[GlobalCacheRepository] Failed to cleanup expired stats', err)
      }
      return 0
    }
  }

  async getWikiContent(slug: string): Promise<WikiContent | null> {
    try {
      const rows = await databaseClient.query<WikiContent>(
        'global',
        'SELECT * FROM wiki_content WHERE slug = ?',
        [slug],
      )
      return rows.length > 0 ? rows[0]! : null
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[GlobalCacheRepository] Failed to get wiki content for slug ${slug}`, err)
      }
      return null
    }
  }

  async saveWikiContent(content: WikiContent): Promise<boolean> {
    try {
      await databaseClient.batch('global', [
        {
          sql: `
          INSERT INTO wiki_content (slug, content, timestamp)
          VALUES (?, ?, ?)
          ON CONFLICT(slug) DO UPDATE SET
            content   = excluded.content,
            timestamp = excluded.timestamp
        `,
          params: [content.slug, content.content, content.timestamp],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(
          `[GlobalCacheRepository] Failed to save wiki content for slug ${content.slug}`,
          err,
        )
      }
      return false
    }
  }
}

export const globalCacheRepository = new GlobalCacheRepository()
