
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

  public async fetchStandard(_fen: string): Promise<TablebaseResponse | null> {
    // External Lichess Tablebase requests disabled. We use local Gaviota Tablebases in the backend.
    void _fen
    return null
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
