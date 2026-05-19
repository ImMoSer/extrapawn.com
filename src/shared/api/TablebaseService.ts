import logger from '@/shared/lib/logger'

export interface TablebaseMove {
  uci: string
  san: string
  dtz?: number
  dtm?: number
  category: string
}

export interface TablebaseResponse {
  dtz?: number
  dtm?: number
  category?: 'win' | 'loss' | 'draw' | 'maybe_win' | 'maybe_loss' | 'cursed_win' | 'blessed_loss'
  winner?: 'w' | 'b' | 'd'
  checkmate?: boolean
  stalemate?: boolean
  insufficient_material?: boolean
  moves?: TablebaseMove[]
}

interface CacheEntry {
  data: TablebaseResponse
  timestamp: number
}

class TablebaseServiceController {
  private activeFetches = new Map<string, Promise<TablebaseResponse | null>>()
  private cooldownUntil = 0
  private cache = new Map<string, CacheEntry>()
  private readonly CACHE_TTL = 3600000 // 1 hour in ms
  private readonly MAX_CACHE_SIZE = 200

  public async fetchStandard(fen: string): Promise<TablebaseResponse | null> {
    // 1. Check Cache
    const cached = this.cache.get(fen)
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL
      if (!isExpired) {
        logger.debug(`[TablebaseService] Cache hit for FEN: ${fen.substring(0, 20)}...`)
        return cached.data
      }
      this.cache.delete(fen)
    }

    // 2. Check Cooldown
    const now = Date.now()
    if (now < this.cooldownUntil) {
      const waitSec = Math.ceil((this.cooldownUntil - now) / 1000)
      logger.warn(
        `[TablebaseService] Request ignored: API Cooldown active (${waitSec}s remaining).`,
      )
      return null
    }

    // 3. Check if there is already an active fetch for this exact FEN
    const activePromise = this.activeFetches.get(fen)
    if (activePromise) {
      logger.debug(`[TablebaseService] Reusing active promise for FEN: ${fen.substring(0, 20)}...`)
      return activePromise
    }

    // 4. Start new fetch
    const fetchPromise = (async () => {
      try {
        const encodedFen = fen.replace(/ /g, '_')
        const url = `https://tablebase.lichess.org/standard?fen=${encodedFen}`

        const response = await fetch(url)

        if (response.status === 429) {
          logger.error(
            '[TablebaseService] HTTP 429: Too many requests. Activating 1-minute cooldown.',
          )
          this.cooldownUntil = Date.now() + 60000
          return null
        }

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`)
        }

        const data = await response.json()

        // Save to Cache
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
          const oldestKey = this.cache.keys().next().value
          if (oldestKey) this.cache.delete(oldestKey)
        }
        this.cache.set(fen, { data, timestamp: Date.now() })

        return data as TablebaseResponse
      } catch (error) {
        logger.error('[TablebaseService] Fetch error:', error)
        return null
      } finally {
        this.activeFetches.delete(fen)
      }
    })()

    this.activeFetches.set(fen, fetchPromise)
    return fetchPromise
  }

  public isCooldownActive(): boolean {
    return Date.now() < this.cooldownUntil
  }

  public getCooldownRemaining(): number {
    return Math.max(0, Math.ceil((this.cooldownUntil - Date.now()) / 1000))
  }

  public getCachedData(fen: string): TablebaseResponse | null {
    const cached = this.cache.get(fen)
    if (cached) {
      const isExpired = Date.now() - cached.timestamp > this.CACHE_TTL
      if (!isExpired) return cached.data
      this.cache.delete(fen)
    }
    return null
  }
}

export const tablebaseService = new TablebaseServiceController()
