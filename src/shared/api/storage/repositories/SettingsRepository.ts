import logger from '@/shared/lib/logger'
import { databaseClient, DbNotOpenError } from '../DatabaseClient'

export class SettingsRepository {
  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const rows = await databaseClient.query<{ value: string }>(
        'user',
        'SELECT value FROM settings WHERE key = ?',
        [key],
      )
      if (rows.length === 0 || !rows[0]) return defaultValue
      try {
        return JSON.parse(rows[0].value) as T
      } catch {
        return rows[0].value as unknown as T
      }
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[SettingsRepository] Failed to get setting ${key}`, err)
      }
      return defaultValue
    }
  }

  async saveSetting(key: string, value: unknown): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: `
          INSERT INTO settings (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
          params: [key, JSON.stringify(value)],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[SettingsRepository] Failed to save setting ${key}`, err)
      }
      return false
    }
  }

  async deleteSetting(key: string): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        {
          sql: 'DELETE FROM settings WHERE key = ?',
          params: [key],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[SettingsRepository] Failed to delete setting ${key}`, err)
      }
      return false
    }
  }
}

export const settingsRepository = new SettingsRepository()
