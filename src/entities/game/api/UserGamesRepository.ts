import { gamesDb, type LichessGameEntity } from './GamesDatabase'
import logger from '@/shared/lib/logger'

export class UserGamesRepository {
  /**
   * Bulk save games to IndexedDB using a single transaction.
   * Significantly faster than row-by-row put operations.
   */
  async saveGamesBatch(games: LichessGameEntity[]): Promise<void> {
    if (!games || games.length === 0) return
    try {
      await gamesDb.lichess_games.bulkPut(games)
    } catch (err) {
      logger.error('[UserGamesRepository] Failed to bulk save games batch:', err)
      throw err
    }
  }

  /**
   * Save a single game entity.
   */
  async saveGame(game: LichessGameEntity): Promise<void> {
    return this.saveGamesBatch([game])
  }

  /**
   * Fetch a single game by its Lichess Game ID.
   */
  async getGameById(id: string): Promise<LichessGameEntity | undefined> {
    return gamesDb.lichess_games.get(id)
  }

  /**
   * Get all games for a specific user from IndexedDB.
   */
  async getGamesForUser(username: string): Promise<LichessGameEntity[]> {
    const cleanUsername = username.trim().toLowerCase()
    return gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .toArray()
  }

  /**
   * Get games filtered by opening compound index.
   */
  async getGamesByOpeningIndex(
    username: string,
    timeControl: string,
    userColor: string,
    rootMove: string
  ): Promise<LichessGameEntity[]> {
    const cleanUsername = username.trim().toLowerCase()
    return gamesDb.lichess_games
      .where('[username+timeControl+userColor+rootMove]')
      .equals([cleanUsername, timeControl, userColor, rootMove])
      .toArray()
  }

  /**
   * Get total count of games stored locally for a user.
   */
  async getGamesCount(username: string): Promise<number> {
    const cleanUsername = username.trim().toLowerCase()
    return gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .count()
  }

  /**
   * Get the timestamp of the latest local game for incremental sync ('since').
   */
  async getLatestGameTimestamp(username: string): Promise<number> {
    const cleanUsername = username.trim().toLowerCase()
    const latest = await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .sortBy('createdAt')
      .then(games => games[games.length - 1])
    return latest ? latest.createdAt : 0
  }

  /**
   * Delete all games for a specific user.
   */
  async clearUserGames(username: string): Promise<void> {
    const cleanUsername = username.trim().toLowerCase()
    await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .delete()
  }
}

export const userGamesRepository = new UserGamesRepository()
