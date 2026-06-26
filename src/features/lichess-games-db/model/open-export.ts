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
    ply: number
    pgn: string
  }>
}

function transformBytes(data: Uint8Array, keyStr: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(keyStr)
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    const dataByte = data[i]
    const keyByte = keyBytes[i % keyBytes.length]
    if (dataByte !== undefined && keyByte !== undefined) {
      result[i] = dataByte ^ keyByte
    }
  }
  return result
}

export async function exportGamesAsBackup(
  username: string,
  userColor: 'white' | 'black',
  openingNameBase: string,
  games: LichessGameEntity[],
  profileCreatedAt: number
): Promise<void> {
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
      ply: g.ply,
      pgn: g.pgn
    }))
  }

  const jsonString = JSON.stringify(exportData, null, 2)
  const originalBlob = new Blob([jsonString], { type: 'application/json' })
  const stream = originalBlob.stream().pipeThrough(new CompressionStream('gzip'))
  const compressedBlob = await new Response(stream).blob()
  const compressedBuffer = await compressedBlob.arrayBuffer()
  const compressedBytes = new Uint8Array(compressedBuffer)

  const obfuscatedBytes = transformBytes(compressedBytes, String(profileCreatedAt))

  const finalBlob = new Blob([obfuscatedBytes.buffer as ArrayBuffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(finalBlob)
  const a = document.createElement('a')
  a.href = url
  
  const cleanUsername = username.trim().toLowerCase()
  const cleanOpeningName = openingNameBase.replace(/[^a-zA-Z0-9-_]/g, '_')
  a.download = `extrapawn_games_${cleanUsername}_${userColor}_${cleanOpeningName}_${Date.now()}.epb`
  
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
