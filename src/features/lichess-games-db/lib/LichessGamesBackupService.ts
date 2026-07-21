import { userGamesRepository, type LichessGameEntity } from '@/entities/game'

export interface LegacyLichessGame {
  id: string
  username: string
  userColor: 'white' | 'black'
  userResult: 'win' | 'loss' | 'draw'
  rootMove: string
  movesCount: number
  openingNameBase: string
  winner?: 'white' | 'black'
  status?: string
  speed?: string
  perf?: string
  createdAt: number
  lastMoveAt: number
  moves: string
  players: {
    white: { user?: { id: string; name: string }; rating: number; ratingDiff?: number }
    black: { user?: { id: string; name: string }; rating: number; ratingDiff?: number }
  }
  opening: {
    eco: string
    name: string
    ply: number
  }
}

export function formatMovesStringToPgn(movesStr: string, result: string): string {
  const movesList = movesStr.trim().split(/\s+/).filter(Boolean)
  const pairs: string[] = []
  for (let i = 0; i < movesList.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const whiteMove = movesList[i]
    const blackMove = movesList[i + 1] ? ` ${movesList[i + 1]}` : ''
    pairs.push(`${moveNum}. ${whiteMove}${blackMove}`)
  }
  const formatted = pairs.join(' ')
  return result ? `${formatted} ${result}` : formatted
}

export function transformBytes(data: Uint8Array, keyStr: string): Uint8Array {
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

export class LichessGamesBackupService {
  /**
   * Export user games as an obfuscated GZIP compressed .epb backup file.
   */
  async exportBackup(username: string, profileCreatedAt: number): Promise<void> {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()
    const games = await userGamesRepository.getGamesForUser(cleanUsername)

    const jsonString = JSON.stringify(games, null, 2)
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
    a.download = `extrapawn_games_backup_${cleanUsername}_${Date.now()}.epb`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  /**
   * Import user games from an obfuscated .epb backup file.
   */
  async importBackup(username: string, file: File, profileCreatedAt: number): Promise<void> {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()

    const arrayBuffer = await file.arrayBuffer()
    const obfuscatedBytes = new Uint8Array(arrayBuffer)

    const decompressedBytes = transformBytes(obfuscatedBytes, String(profileCreatedAt))

    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    writer.write(decompressedBytes.buffer as ArrayBuffer)
    writer.close()

    const decompressedBuffer = await new Response(ds.readable).arrayBuffer()
    const text = new TextDecoder().decode(decompressedBuffer)

    const games = JSON.parse(text)

    if (!Array.isArray(games)) {
      throw new Error('Ungültiges Backup-Format. Muss ein JSON-Array sein.')
    }

    const batchToSave: LichessGameEntity[] = []

    for (const g of games) {
      if (!g.id || !g.username || g.username.toLowerCase() !== cleanUsername) {
        throw new Error(`Backup enthält ungültige Daten oder Daten eines anderen Spielers (ID: ${g.id || 'unknown'}).`)
      }
      
      // Migrate legacy backup format to version 2 on the fly if needed
      if ('players' in g && g.players) {
        const legacy = g as unknown as LegacyLichessGame
        if (legacy.opening?.ply === undefined) {
          throw new Error(`Legacy game ${legacy.id} is missing required 'ply' parameter in opening.`)
        }
        const whiteName = legacy.players?.white?.user?.name || legacy.players?.white?.user?.id || 'White'
        const blackName = legacy.players?.black?.user?.name || legacy.players?.black?.user?.id || 'Black'
        const resultVal = legacy.winner ? (legacy.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'
        
        // Build moves-only PGN from legacy moves
        const cleanPgn = formatMovesStringToPgn(legacy.moves || '', resultVal)

        const migratedGame: LichessGameEntity = {
          id: legacy.id,
          username: legacy.username.toLowerCase(),
          userColor: legacy.userColor,
          userResult: legacy.userResult,
          white: whiteName,
          black: blackName,
          white_elo: legacy.players?.white?.rating || 1500,
          black_elo: legacy.players?.black?.rating || 1500,
          result: resultVal,
          status: legacy.status || '',
          timeControl: (legacy.speed || legacy.perf || 'other').toLowerCase(),
          createdAt: legacy.createdAt || Date.now(),
          lastMoveAt: legacy.lastMoveAt || Date.now(),
          rootMove: legacy.rootMove,
          movesCount: legacy.movesCount,
          openingNameBase: legacy.openingNameBase,
          eco: legacy.opening.eco || '',
          opening: legacy.opening.name || '',
          ply: legacy.opening.ply,
          pgn: cleanPgn
        }
        batchToSave.push(migratedGame)
      } else {
        const entity = g as LichessGameEntity
        if (entity.ply === undefined) {
          throw new Error(`Imported game ${entity.id} is missing required 'ply' parameter.`)
        }
        batchToSave.push(entity)
      }
    }

    if (batchToSave.length > 0) {
      await userGamesRepository.saveGamesBatch(batchToSave)
    }
  }

  /**
   * Get raw GZIP compressed ArrayBuffer of user games.
   */
  async getCompressedBackupBuffer(username: string): Promise<ArrayBuffer | null> {
    if (!username) return null
    const cleanUsername = username.trim().toLowerCase()
    const games = await userGamesRepository.getGamesForUser(cleanUsername)

    if (games.length === 0) return null

    const jsonString = JSON.stringify(games, null, 2)
    const originalBlob = new Blob([jsonString], { type: 'application/json' })
    const stream = originalBlob.stream().pipeThrough(new CompressionStream('gzip'))
    const compressedBlob = await new Response(stream).blob()
    return compressedBlob.arrayBuffer()
  }
}

export const lichessGamesBackupService = new LichessGamesBackupService()
