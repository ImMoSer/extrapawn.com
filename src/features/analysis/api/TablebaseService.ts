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
  private isFetching = false
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

    if (this.isFetching) {
      logger.warn('[TablebaseService] Request ignored: Another fetch is in progress.')
      return null
    }

    const now = Date.now()
    if (now < this.cooldownUntil) {
      const waitSec = Math.ceil((this.cooldownUntil - now) / 1000)
      logger.warn(
        `[TablebaseService] Request ignored: API Cooldown active (${waitSec}s remaining).`,
      )
      return null
    }

    this.isFetching = true
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

      // 2. Save to Cache
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
      this.isFetching = false
    }
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
