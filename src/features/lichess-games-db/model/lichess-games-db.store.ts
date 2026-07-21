import { defineStore } from 'pinia'
import { ref } from 'vue'
import { userGamesRepository, type LichessGameEntity } from '@/entities/game'
import { lichessGamesBackupService } from '../lib/LichessGamesBackupService'
import { lichessGamesStreamSyncService } from '../lib/LichessGamesStreamSyncService'
import logger from '@/shared/lib/logger'

export interface CacheStats {
  total: number
  bullet: number
  blitz: number
  rapid: number
  classical: number
  standard: number
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

export interface LichessPerf {
  games: number
  rating: number
  rd?: number
  prog?: number
  prov?: boolean
}

export interface LichessProfile {
  id: string
  username: string
  perfs: {
    bullet?: LichessPerf
    blitz?: LichessPerf
    rapid?: LichessPerf
    classical?: LichessPerf
    ultraBullet?: LichessPerf
    correspondence?: LichessPerf
    chess960?: LichessPerf
    kingOfTheHill?: LichessPerf
    threeCheck?: LichessPerf
    antichess?: LichessPerf
    atomic?: LichessPerf
    horde?: LichessPerf
    racingPawns?: LichessPerf
    crazyhouse?: LichessPerf
  }
  createdAt: number
  seenAt: number
  playTime?: {
    total: number
    tv: number
  }
  count?: {
    all: number
    rated: number
    ai: number
    draw: number
    drawH: number
    loss: number
    lossH: number
    win: number
    winH: number
    bookmark: number
    playing: number
    import: number
    me: number
  }
  patron?: boolean
  verified?: boolean
  disabled?: boolean
  tosViolation?: boolean
}

export interface LichessUserStats {
  rating: number
  progress: number
  gamesCount: number
}

export interface LichessDashboardStats {
  bullet?: LichessUserStats
  blitz?: LichessUserStats
  rapid?: LichessUserStats
  classical?: LichessUserStats
  overall: {
    totalGames: number
    winRate: number
    drawRate: number
    lossRate: number
  }
}

export interface LichessActivityInterval {
  start: number
  end: number
}

export interface LichessActivityGames {
  [perfKey: string]: {
    nb: number
    win?: number
    loss?: number
    draw?: number
  }
}

export interface LichessActivityItem {
  interval?: LichessActivityInterval
  games?: LichessActivityGames
  [key: string]: unknown
}

export const useLichessGamesDbStore = defineStore('lichess-games-db', () => {
  const isSyncing = ref(false)
  const syncProgress = ref({ current: 0, total: 0 })
  const error = ref<string | null>(null)
  const stats = ref<CacheStats | null>(null)
  const detailedStats = ref<DetailedDashboardStats | null>(null)
  const lichessProfile = ref<LichessProfile | null>(null)
  const lichessActivity = ref<LichessActivityItem[] | null>(null)
  const latestLocalGameTimestamp = ref<number>(0)

  const profileCache = ref<Record<string, { data: LichessProfile; timestamp: number }>>({})
  const activityCache = ref<Record<string, { data: LichessActivityItem[]; timestamp: number }>>({})

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
      latestLocalGameTimestamp.value = 0
      return
    }
    try {
      const cleanUsername = username.trim().toLowerCase()
      const games = await userGamesRepository.getGamesForUser(cleanUsername)

      let latestTimestamp = 0
      for (const g of games) {
        if (g.createdAt > latestTimestamp) {
          latestTimestamp = g.createdAt
        }
      }
      latestLocalGameTimestamp.value = latestTimestamp

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

      const latestTimestamp = await userGamesRepository.getLatestGameTimestamp(cleanUsername)
      const sinceTimestamp = latestTimestamp > 0 ? latestTimestamp + 1 : undefined

      let totalExpectedNew = 0
      if (lichessProfile.value) {
        const totalGames = lichessProfile.value.count?.all || 0
        const currentLocalCount = await userGamesRepository.getGamesCount(cleanUsername)
        totalExpectedNew = Math.min(maxGames, Math.max(0, totalGames - currentLocalCount))
      }

      syncProgress.value = { current: 0, total: totalExpectedNew }

      await lichessGamesStreamSyncService.syncGamesStream(
        username,
        perfTypes,
        sinceTimestamp,
        (count) => {
          syncProgress.value.current = count
        }
      )

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

  async function fetchLichessProfile(username: string): Promise<LichessProfile | null> {
    if (!username) {
      lichessProfile.value = null
      return null
    }

    const cleanUsername = username.trim().toLowerCase()
    const now = Date.now()

    const cached = profileCache.value[cleanUsername]
    if (cached && now - cached.timestamp < 10 * 60 * 1000) {
      lichessProfile.value = cached.data
      return cached.data
    }

    try {
      const response = await fetch(`https://lichess.org/api/user/${username}`)
      if (!response.ok) {
        lichessProfile.value = null
        return null
      }
      const data = (await response.json()) as LichessProfile
      lichessProfile.value = data
      profileCache.value[cleanUsername] = { data, timestamp: now }
      return data
    } catch (err) {
      logger.error('Fehler beim Abrufen des Lichess-Profils:', err)
      lichessProfile.value = null
      return null
    }
  }

  async function fetchLichessActivity(username: string): Promise<LichessActivityItem[] | null> {
    if (!username) {
      lichessActivity.value = null
      return null
    }

    const cleanUsername = username.trim().toLowerCase()
    const now = Date.now()

    const cached = activityCache.value[cleanUsername]
    if (cached && now - cached.timestamp < 15 * 60 * 1000) {
      lichessActivity.value = cached.data
      return cached.data
    }

    try {
      const response = await fetch(`https://lichess.org/api/user/${username}/activity`)
      if (!response.ok) {
        lichessActivity.value = null
        return null
      }
      const data = (await response.json()) as LichessActivityItem[]
      if (Array.isArray(data)) {
        lichessActivity.value = data
        activityCache.value[cleanUsername] = { data, timestamp: now }
        return data
      } else {
        lichessActivity.value = null
        return null
      }
    } catch (err) {
      logger.error('Fehler beim Abrufen der Lichess-Aktivität:', err)
      lichessActivity.value = null
      return null
    }
  }

  async function wipeCache(username: string) {
    if (!username) return
    const cleanUsername = username.trim().toLowerCase()
    delete profileCache.value[cleanUsername]
    delete activityCache.value[cleanUsername]
    await userGamesRepository.clearUserGames(cleanUsername)
    await loadStats(username)
  }

  async function exportBackup(username: string, profileCreatedAt: number) {
    return lichessGamesBackupService.exportBackup(username, profileCreatedAt)
  }

  async function importBackup(username: string, file: File, profileCreatedAt: number) {
    await lichessGamesBackupService.importBackup(username, file, profileCreatedAt)
    await loadStats(username)
  }

  async function getCompressedBackupBuffer(username: string): Promise<ArrayBuffer | null> {
    return lichessGamesBackupService.getCompressedBackupBuffer(username)
  }

  return {
    isSyncing,
    syncProgress,
    error,
    stats,
    detailedStats,
    lichessProfile,
    lichessActivity,
    latestLocalGameTimestamp,
    loadStats,
    syncGames,
    fetchLichessProfile,
    loadLichessProfile: fetchLichessProfile,
    fetchLichessActivity,
    loadLichessActivity: fetchLichessActivity,
    wipeCache,
    exportBackup,
    importBackup,
    getCompressedBackupBuffer,
  }
})
