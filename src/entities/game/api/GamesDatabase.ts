import Dexie, { type Table } from 'dexie'

export interface LichessGameEntity {
  id: string                  // Lichess Game ID (Primary Key)
  username: string            // Der Lichess-Benutzer (Owner der lokalen DB)
  userColor: 'white' | 'black' // Hat der importierende User weiß oder schwarz gespielt?
  userResult: 'win' | 'loss' | 'draw'
  
  white: string
  black: string
  white_elo: number
  black_elo: number
  result: string
  status: string
  
  timeControl: string         // "bullet", "blitz", "rapid", "classical" (ehemals speed/perf)
  createdAt: number           // Zeitstempel in ms (für synchronisierten Ladevorgang)
  lastMoveAt: number
  
  rootMove: string            // Z.B. "1. e4" oder "1. d4" (Weiß' erster Zug)
  movesCount: number          // Anzahl der Züge (Plies/Halbzüge)
  openingNameBase: string     // Extrahiert (z.B. "French Defense")
  eco: string
  opening: string
  ply: number
  pgn: string                 // Züge im standardisierten PGN-Format
}

class UserGamesDatabase extends Dexie {
  lichess_games!: Table<LichessGameEntity, string>

  constructor() {
    super('ExtrapawnUserGamesDatabase')
    
    this.version(1).stores({
      lichess_games: 'id, username, createdAt, variant, perf, userColor, userResult, rootMove, openingNameBase, [username+variant], [username+perf+userColor+rootMove]'
    })

    this.version(2).stores({
      lichess_games: 'id, username, createdAt, timeControl, userColor, userResult, rootMove, openingNameBase, [username+timeControl+userColor+rootMove]'
    }).upgrade(async tx => {
      // Clear the table so we don't have malformed legacy data in version 2
      await tx.table('lichess_games').clear()
    })
  }
}

export const gamesDb = new UserGamesDatabase()
