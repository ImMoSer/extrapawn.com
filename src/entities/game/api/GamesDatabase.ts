import Dexie, { type Table } from 'dexie'

export interface LichessPlayer {
  user?: {
    id: string
    name: string
  }
  rating: number
  ratingDiff?: number
}

export interface LichessOpening {
  eco: string
  name: string
  ply: number
}

export interface LichessClock {
  initial: number
  increment: number
  totalTime: number
}

export interface LichessGameEntity {
  id: string                  // Lichess Game ID (Primary Key)
  username: string            // Der Lichess-Benutzer (Owner der lokalen DB)
  rated: boolean
  variant: 'standard'
  speed: string
  perf: string
  createdAt: number           // Zeitstempel in ms (für synchronisierten Ladevorgang)
  lastMoveAt: number
  status: string
  winner?: 'white' | 'black'
  userColor: 'white' | 'black' // Hat der importierende User weiß oder schwarz gespielt?
  userResult: 'win' | 'loss' | 'draw'
  rootMove: string            // Z.B. "1. e4" oder "1. d4" (Weiß' erster Zug)
  movesCount: number          // Anzahl der Züge (Plies/Halbzüge)
  openingNameBase: string     // Extrahiert (z.B. "French Defense")
  players: {
    white: LichessPlayer
    black: LichessPlayer
  }
  opening: LichessOpening     // Pflicht-Objekt
  moves: string               // Leerzeichen-separierte Liste von Zügen
  clock?: LichessClock
}

class UserGamesDatabase extends Dexie {
  lichess_games!: Table<LichessGameEntity, string>

  constructor() {
    super('ExtrapawnUserGamesDatabase')
    
    this.version(1).stores({
      lichess_games: 'id, username, createdAt, variant, perf, userColor, userResult, rootMove, openingNameBase, [username+variant], [username+perf+userColor+rootMove]'
    })
  }
}

export const gamesDb = new UserGamesDatabase()
