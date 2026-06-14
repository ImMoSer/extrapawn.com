import type { LichessGameEntity } from '@/entities/game'

export interface ExportedOpeningGames {
  username: string
  userColor: 'white' | 'black'
  openingNameBase: string
  games: Array<{
    id: string
    white: string
    black: string
    white_elo: number
    black_elo: number
    result: string
    status: string
    timeControl: string
    rootMove: string
    eco: string
    opening: string
    pgn: string
  }>
}

export function exportGamesAsJSON(
  username: string,
  userColor: 'white' | 'black',
  openingNameBase: string,
  games: LichessGameEntity[]
): void {
  const exportData: ExportedOpeningGames = {
    username,
    userColor,
    openingNameBase,
    games: games.map(g => ({
      id: g.id,
      white: g.white,
      black: g.black,
      white_elo: g.white_elo,
      black_elo: g.black_elo,
      result: g.result,
      status: g.status,
      timeControl: g.timeControl,
      rootMove: g.rootMove,
      eco: g.eco,
      opening: g.opening,
      pgn: g.pgn
    }))
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  
  const cleanUsername = username.trim().toLowerCase()
  const cleanOpeningName = openingNameBase.replace(/[^a-zA-Z0-9-_]/g, '_')
  a.download = `extrapawn_games_${cleanUsername}_${userColor}_${cleanOpeningName}_${Date.now()}.json`
  
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
