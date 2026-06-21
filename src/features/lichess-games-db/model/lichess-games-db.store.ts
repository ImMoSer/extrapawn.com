import { defineStore } from 'pinia'
import { ref } from 'vue'
import { gamesDb } from '@/entities/game'
import type { LichessGameEntity } from '@/entities/game'
import logger from '@/shared/lib/logger'

export interface CacheStats {
  total: number
  bullet: number
  blitz: number
  rapid: number
  classical: number
  standard: number
}

interface LichessGameResponse {
  id?: string
  variant?: string
  speed?: string
  perf?: string
  createdAt?: number
  lastMoveAt?: number
  status?: string
  winner?: 'white' | 'black'
  players?: {
    white?: { user?: { id?: string; name?: string }; rating?: number; ratingDiff?: number }
    black?: { user?: { id?: string; name?: string }; rating?: number; ratingDiff?: number }
  }
  opening?: { eco?: string; name?: string; ply: number }
  moves?: string
  pgn?: string
  clock?: { initial?: number; increment?: number; totalTime?: number }
}

export interface TabStats {
  gamesCount: number
  wins: number
  draws: number
  losses: number
  perfStats: Array<{
    speed: string
    gamesCount: number
    avgRating: number
    wins: number
    draws: number
    losses: number
    winRate: number
    drawRate: number
    lossRate: number
  }>
  topOpenings: Array<{
    openingNameBase: string
    gamesCount: number
    wins: number
    draws: number
    losses: number
    avgUserRating: number
    avgOpponentRating: number
    primarySpeed: string
  }>
}

export interface DetailedDashboardStats {
  all: TabStats
  white: TabStats
  black: TabStats
}

function formatMovesStringToPgn(movesStr: string, result: string): string {
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

export const useLichessGamesDbStore = defineStore('lichess-games-db', () => {
  const isSyncing = ref(false)
  const syncProgress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)
  const stats = ref<CacheStats | null>(null)
  const detailedStats = ref<DetailedDashboardStats | null>(null)

  function computeTabStats(games: LichessGameEntity[]): TabStats {
    const gamesCount = games.length
    let wins = 0
    let draws = 0
    let losses = 0

    const speedGroups: Record<'bullet' | 'blitz' | 'rapid' | 'classical', { games: LichessGameEntity[]; wins: number; draws: number; losses: number; totalRating: number }> = {
      bullet: { games: [], wins: 0, draws: 0, losses: 0, totalRating: 0 },
      blitz: { games: [], wins: 0, draws: 0, losses: 0, totalRating: 0 },
      rapid: { games: [], wins: 0, draws: 0, losses: 0, totalRating: 0 },
      classical: { games: [], wins: 0, draws: 0, losses: 0, totalRating: 0 }
    }

    const openingGroups: Record<string, { games: LichessGameEntity[]; wins: number; draws: number; losses: number; totalUserRating: number; totalOpponentRating: number; speedCounts: Record<string, number> }> = {}

    for (const g of games) {
      const result = g.userResult
      if (result === 'win') wins++
      else if (result === 'draw') draws++
      else if (result === 'loss') losses++

      const speedKey = (g.timeControl || 'other').toLowerCase()
      if (speedKey === 'bullet' || speedKey === 'blitz' || speedKey === 'rapid' || speedKey === 'classical') {
        const grp = speedGroups[speedKey as 'bullet' | 'blitz' | 'rapid' | 'classical']
        grp.games.push(g)
        if (result === 'win') grp.wins++
        else if (result === 'draw') grp.draws++
        else if (result === 'loss') grp.losses++
        
        const rating = g.userColor === 'white' ? g.white_elo : g.black_elo
        grp.totalRating += rating
      }

      const opBase = g.openingNameBase || 'Unknown Opening'
      if (!openingGroups[opBase]) {
        openingGroups[opBase] = {
          games: [],
          wins: 0,
          draws: 0,
          losses: 0,
          totalUserRating: 0,
          totalOpponentRating: 0,
          speedCounts: {}
        }
      }
      const opGrp = openingGroups[opBase]
      opGrp.games.push(g)
      if (result === 'win') opGrp.wins++
      else if (result === 'draw') opGrp.draws++
      else if (result === 'loss') opGrp.losses++

      const userRating = g.userColor === 'white' ? g.white_elo : g.black_elo
      const oppRating = g.userColor === 'white' ? g.black_elo : g.white_elo
      opGrp.totalUserRating += userRating
      opGrp.totalOpponentRating += oppRating

      const speed = g.timeControl || 'other'
      opGrp.speedCounts[speed] = (opGrp.speedCounts[speed] || 0) + 1
    }

    const perfStats = (['bullet', 'blitz', 'rapid', 'classical'] as const).map(speed => {
      const grp = speedGroups[speed]
      const count = grp.games.length
      const avgRating = count > 0 ? Math.round(grp.totalRating / count) : 0
      const winRate = count > 0 ? (grp.wins / count) * 100 : 0
      const drawRate = count > 0 ? (grp.draws / count) * 100 : 0
      const lossRate = count > 0 ? (grp.losses / count) * 100 : 0
      return {
        speed: speed.charAt(0).toUpperCase() + speed.slice(1),
        gamesCount: count,
        avgRating,
        wins: grp.wins,
        draws: grp.draws,
        losses: grp.losses,
        winRate,
        drawRate,
        lossRate
      }
    })

    const sortedOpenings = Object.entries(openingGroups)
      .map(([name, grp]) => {
        const count = grp.games.length
        const avgUserRating = count > 0 ? Math.round(grp.totalUserRating / count) : 0
        const avgOpponentRating = count > 0 ? Math.round(grp.totalOpponentRating / count) : 0
        
        // Find primary speed
        let primarySpeed = 'other'
        let maxSpeedCount = -1
        for (const [sp, cnt] of Object.entries(grp.speedCounts)) {
           if (cnt > maxSpeedCount) {
             maxSpeedCount = cnt
             primarySpeed = sp
           }
        }
        
        return {
          openingNameBase: name,
          gamesCount: count,
          wins: grp.wins,
          draws: grp.draws,
          losses: grp.losses,
          avgUserRating,
          avgOpponentRating,
          primarySpeed: primarySpeed.charAt(0).toUpperCase() + primarySpeed.slice(1)
        }
      })
      .sort((a, b) => b.gamesCount - a.gamesCount)

    const topOpenings: typeof sortedOpenings = []
    let accumulatedGames = 0
    const targetGamesCount = gamesCount * 0.9

    for (const op of sortedOpenings) {
      topOpenings.push(op)
      accumulatedGames += op.gamesCount
      if (accumulatedGames >= targetGamesCount || topOpenings.length >= 12) {
        break
      }
    }

    return {
      gamesCount,
      wins,
      draws,
      losses,
      perfStats,
      topOpenings
    }
  }

  async function loadStats(username: string) {
    if (!username) {
      stats.value = null
      detailedStats.value = null
      return
    }
    try {
      const cleanUsername = username.trim().toLowerCase()
      const games = await gamesDb.lichess_games
        .where('username')
        .equals(cleanUsername)
        .toArray()

      const countBySpeed = {
        bullet: 0,
        blitz: 0,
        rapid: 0,
        classical: 0,
        standard: 0
      }

      for (const g of games) {
        const s = (g.timeControl || 'other').toLowerCase()
        if (s in countBySpeed) {
          countBySpeed[s as keyof typeof countBySpeed]++
        } else {
          countBySpeed.standard++
        }
      }

      stats.value = {
        total: games.length,
        bullet: countBySpeed.bullet,
        blitz: countBySpeed.blitz,
        rapid: countBySpeed.rapid,
        classical: countBySpeed.classical,
        standard: countBySpeed.standard
      }

      // Compute detailed stats for tabs
      const whiteGames = games.filter(g => g.userColor === 'white')
      const blackGames = games.filter(g => g.userColor === 'black')

      detailedStats.value = {
        all: computeTabStats(games),
        white: computeTabStats(whiteGames),
        black: computeTabStats(blackGames)
      }
    } catch {
      logger.error('Fehler beim Laden der Spieldatenbank-Statistiken')
      stats.value = null
      detailedStats.value = null
    }
  }


  async function syncGames(username: string, perfTypes: string[]) {
    if (!username.trim()) {
      throw new Error('Lichess-Benutzername ist erforderlich.')
    }

    const maxGames = 10000
    isSyncing.value = true
    syncProgress.value = { current: 0, total: 0 }
    error.value = null

    try {
      const cleanUsername = username.trim().toLowerCase()

      // 1. Letztes Spiel ermitteln für inkrementellen Abruf (since)
      const latestGame = await gamesDb.lichess_games
        .where('username')
        .equals(cleanUsername)
        .sortBy('createdAt')
        .then(games => games[games.length - 1])

      const sinceTimestamp = latestGame ? latestGame.createdAt + 1 : undefined

      // 2. Lichess-Profil abrufen, um Fortschritts-Nenner zu ermitteln
      let totalExpectedNew = 0
      try {
        const profileRes = await fetch(`https://lichess.org/api/user/${username}`)
        if (profileRes.ok) {
          const profile = await profileRes.json()
          const totalGames = profile.count?.all || 0
          const currentLocalCount = await gamesDb.lichess_games
            .where('username')
            .equals(cleanUsername)
            .count()
          totalExpectedNew = Math.min(maxGames, Math.max(0, totalGames - currentLocalCount))
        }
      } catch {
        logger.warn('Konnte Lichess-Profil nicht abfragen für Fortschrittsanzeige')
      }

      syncProgress.value = { current: 0, total: totalExpectedNew }

      // 3. API-Url aufbauen
      const perfTypeParam = perfTypes.join(',')
      let url = `https://lichess.org/api/games/user/${username}?tags=false&clocks=false&evals=false&opening=true&literate=false&max=${maxGames}&perfType=${perfTypeParam}&pgnInJson=true`
      if (sinceTimestamp) {
        url += `&since=${sinceTimestamp}`
      }

      const response = await fetch(url, {
        headers: {
          Accept: 'application/x-ndjson'
        }
      })

      if (!response.ok) {
        throw new Error(`Lichess API lieferte HTTP Fehler ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Lichess-Stream konnte nicht gelesen werden.')
      }

      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let count = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.trim()) continue

          let game: LichessGameResponse
          try {
            game = JSON.parse(line) as LichessGameResponse
          } catch {
            continue
          }

          // Fail-Fast Validierung & Filterung
          if (game.variant !== 'standard') {
            continue
          }

          // Unknown Opening aussortieren
          if (!game.opening || !game.opening.name || game.opening.name === 'Unknown Opening') {
            continue
          }

          if (game.opening.ply === undefined) {
            throw new Error(`Game ${game.id || 'unknown'} is missing required 'ply' parameter in opening.`)
          }

          if (!game.players?.white?.user?.id || !game.players?.black?.user?.id) {
            continue
          }

          const whiteId = game.players.white.user.id.toLowerCase()
          const blackId = game.players.black.user.id.toLowerCase()

          const isWhite = whiteId === cleanUsername
          const isBlack = blackId === cleanUsername

          if (!isWhite && !isBlack) {
            continue
          }

          const userColor = isWhite ? 'white' : 'black'
          let userResult: 'win' | 'loss' | 'draw' = 'draw'
          if (game.winner) {
            const winnerIsUser = (game.winner === 'white' && isWhite) || (game.winner === 'black' && isBlack)
            userResult = winnerIsUser ? 'win' : 'loss'
          }

          const movesList = game.moves ? game.moves.trim().split(/\s+/).filter(Boolean) : []
          if (movesList.length === 0) {
            continue
          }

          const movesCount = movesList.length
          const firstMove = movesList[0] || ''
          const rootMove = firstMove ? `1. ${firstMove}` : ''
          const openingNameBase = ((game.opening?.name || '').split(':')[0] || '').trim()

          const whitePlayerName = game.players.white.user.name || game.players.white.user.id
          const blackPlayerName = game.players.black.user.name || game.players.black.user.id
          const resultVal = game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'

          // Clean PGN from Lichess (just append result)
          const cleanPgn = game.pgn ? `${game.pgn.trim()} ${resultVal}` : ''

          const gameEntity: LichessGameEntity = {
            id: game.id || '',
            username: cleanUsername,
            userColor,
            userResult,
            white: whitePlayerName,
            black: blackPlayerName,
            white_elo: game.players.white.rating || 1500,
            black_elo: game.players.black.rating || 1500,
            result: resultVal,
            status: game.status || '',
            timeControl: (game.speed || 'other').toLowerCase(),
            createdAt: game.createdAt || Date.now(),
            lastMoveAt: game.lastMoveAt || Date.now(),
            rootMove,
            movesCount,
            openingNameBase,
            eco: game.opening.eco || '',
            opening: game.opening.name || '',
            ply: game.opening.ply,
            pgn: cleanPgn
          }

          await gamesDb.lichess_games.put(gameEntity)
          count++
          syncProgress.value.current = count
        }
      }

      // Verarbeite verbleibenden Puffer
      if (buffer.trim()) {
        try {
          const game = JSON.parse(buffer) as LichessGameResponse
          if (
            game.variant === 'standard' &&
            game.opening &&
            game.opening.name &&
            game.opening.name !== 'Unknown Opening' &&
            game.players?.white?.user?.id &&
            game.players?.black?.user?.id
          ) {
            if (game.opening.ply === undefined) {
              throw new Error(`Game ${game.id || 'unknown'} is missing required 'ply' parameter in opening.`)
            }
            const whiteId = game.players.white.user.id.toLowerCase()
            const blackId = game.players.black.user.id.toLowerCase()
            const isWhite = whiteId === cleanUsername
            const isBlack = blackId === cleanUsername

            if (isWhite || isBlack) {
              const userColor = isWhite ? 'white' : 'black'
              let userResult: 'win' | 'loss' | 'draw' = 'draw'
              if (game.winner) {
                const winnerIsUser = (game.winner === 'white' && isWhite) || (game.winner === 'black' && isBlack)
                userResult = winnerIsUser ? 'win' : 'loss'
              }

              const movesList = game.moves ? game.moves.trim().split(/\s+/).filter(Boolean) : []
              if (movesList.length > 0) {
                const movesCount = movesList.length
                const firstMove = movesList[0] || ''
                const rootMove = firstMove ? `1. ${firstMove}` : ''
                const openingNameBase = ((game.opening?.name || '').split(':')[0] || '').trim()

                const whitePlayerName = game.players.white.user.name || game.players.white.user.id
                const blackPlayerName = game.players.black.user.name || game.players.black.user.id
                const resultVal = game.winner ? (game.winner === 'white' ? '1-0' : '0-1') : '1/2-1/2'

                // Clean PGN from Lichess (just append result)
                const cleanPgn = game.pgn ? `${game.pgn.trim()} ${resultVal}` : ''

                const gameEntity: LichessGameEntity = {
                  id: game.id || '',
                  username: cleanUsername,
                  userColor,
                  userResult,
                  white: whitePlayerName,
                  black: blackPlayerName,
                  white_elo: game.players.white.rating || 1500,
                  black_elo: game.players.black.rating || 1500,
                  result: resultVal,
                  status: game.status || '',
                  timeControl: (game.speed || 'other').toLowerCase(),
                  createdAt: game.createdAt || Date.now(),
                  lastMoveAt: game.lastMoveAt || Date.now(),
                  rootMove,
                  movesCount,
                  openingNameBase,
                  eco: game.opening.eco || '',
                  opening: game.opening.name || '',
                  ply: game.opening.ply,
                  pgn: cleanPgn
                }
                await gamesDb.lichess_games.put(gameEntity)
                count++
                syncProgress.value.current = count
              }
            }
          }
        } catch {
          logger.warn('Fehler beim Parsen des trailing buffers')
        }
      }

      await loadStats(username)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Synchronisation fehlgeschlagen.'
      error.value = errMsg
      logger.error('Sync Fehler:', err)
      throw err
    } finally {
      isSyncing.value = false
    }
  }

  async function wipeCache(username: string) {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()
    await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .delete()
    await loadStats(username)
  }

  async function exportBackup(username: string) {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()
    const games = await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .toArray()

    const jsonString = JSON.stringify(games, null, 2)
    const originalBlob = new Blob([jsonString], { type: 'application/json' })
    const stream = originalBlob.stream().pipeThrough(new CompressionStream('gzip'))
    const compressedBlob = await new Response(stream).blob()

    const url = URL.createObjectURL(compressedBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extrapawn_games_backup_${cleanUsername}_${Date.now()}.json.gz`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

interface LegacyLichessGame {
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

  async function importBackup(username: string, file: File) {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()
    
    let text: string
    if (file.name.endsWith('.gz') || file.name.endsWith('.gzip')) {
      const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
      const decompressedBlob = await new Response(stream).blob()
      text = await decompressedBlob.text()
    } else {
      text = await file.text()
    }

    const games = JSON.parse(text)

    if (!Array.isArray(games)) {
      throw new Error('Ungültiges Backup-Format. Muss ein JSON-Array sein.')
    }

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
        await gamesDb.lichess_games.put(migratedGame)
      } else {
        const entity = g as LichessGameEntity
        if (entity.ply === undefined) {
          throw new Error(`Imported game ${entity.id} is missing required 'ply' parameter.`)
        }
        await gamesDb.lichess_games.put(entity)
      }
    }

    await loadStats(username)
  }

  async function getCompressedBackupBuffer(username: string): Promise<ArrayBuffer | null> {
    if (!username) return null
    const cleanUsername = username.trim().toLowerCase()
    const games = await gamesDb.lichess_games
      .where('username')
      .equals(cleanUsername)
      .toArray()

    if (games.length === 0) return null

    const jsonString = JSON.stringify(games, null, 2)
    const originalBlob = new Blob([jsonString], { type: 'application/json' })
    const stream = originalBlob.stream().pipeThrough(new CompressionStream('gzip'))
    const compressedBlob = await new Response(stream).blob()
    return await compressedBlob.arrayBuffer()
  }

  return {
    isSyncing,
    syncProgress,
    error,
    stats,
    detailedStats,
    loadStats,
    syncGames,
    wipeCache,
    exportBackup,
    importBackup,
    getCompressedBackupBuffer
  }
})
