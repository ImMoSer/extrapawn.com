import logger from '@/shared/lib/logger'
import { databaseClient, DbNotOpenError } from '../DatabaseClient'

export interface Diamond {
  id?: number
  hash: string
  fen: string
  pgn: string
  collected_at: number
}

export interface Brilliant {
  id?: number
  hash: string
  fen: string
  pgn: string
  collected_at: number
}

interface CountRow {
  count: number
}

export class DiamondRepository {
  async addDiamond(diamond: Diamond): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: `
          INSERT INTO diamonds (hash, fen, pgn, collected_at)
          VALUES (?, ?, ?, ?)
        `,
          params: [diamond.hash, diamond.fen, diamond.pgn, diamond.collected_at],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to add diamond', err)
      }
      return false
    }
  }

  async getDiamondCountForHashToday(hash: string): Promise<number> {
    try {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const rows = await databaseClient.query<CountRow>(
        'user',
        `
        SELECT COUNT(*) as count FROM diamonds
        WHERE hash = ? AND collected_at > ?
      `,
        [hash, startOfDay.getTime()],
      )

      return rows[0]?.count ?? 0
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[DiamondRepository] Failed to get diamond count for hash ${hash}`, err)
      }
      return 0
    }
  }

  async getAllDiamonds(): Promise<Diamond[]> {
    try {
      return await databaseClient.query<Diamond>(
        'user',
        'SELECT * FROM diamonds ORDER BY collected_at DESC',
      )
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to get all diamonds', err)
      }
      return []
    }
  }

  async getDiamondCount(): Promise<number> {
    try {
      const rows = await databaseClient.query<CountRow>(
        'user',
        'SELECT COUNT(*) as count FROM diamonds',
      )
      return rows[0]?.count ?? 0
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to get diamond count', err)
      }
      return 0
    }
  }

  async getBrilliantCount(): Promise<number> {
    try {
      const rows = await databaseClient.query<CountRow>(
        'user',
        'SELECT COUNT(*) as count FROM brilliants',
      )
      return rows[0]?.count ?? 0
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to get brilliant count', err)
      }
      return 0
    }
  }

  async deleteDiamond(id: number): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: 'DELETE FROM diamonds WHERE id = ?',
          params: [id],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[DiamondRepository] Failed to delete diamond ${id}`, err)
      }
      return false
    }
  }

  async addBrilliant(brilliant: Brilliant): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: `
          INSERT INTO brilliants (hash, fen, pgn, collected_at)
          VALUES (?, ?, ?, ?)
        `,
          params: [brilliant.hash, brilliant.fen, brilliant.pgn, brilliant.collected_at],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to add brilliant', err)
      }
      return false
    }
  }

  async removeLastBrilliant(): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: `
          DELETE FROM brilliants
          WHERE id = (SELECT id FROM brilliants ORDER BY collected_at DESC LIMIT 1)
        `,
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[DiamondRepository] Failed to remove last brilliant', err)
      }
      return false
    }
  }
}

export const diamondRepository = new DiamondRepository()
