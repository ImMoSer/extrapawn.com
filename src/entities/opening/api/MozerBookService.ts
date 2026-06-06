// src/services/MozerBookService.ts
import logger from '@/shared/lib/logger'

export interface MozerBookTheoryItem {
  san: string
  uci: string
  name: string | null
  eco: string | null
}

export interface MozerBookMove extends MozerBookTheoryItem {
  total: number
  win_p: number
  draw_p: number
  loss_p: number
  perf: number
  nag: number
  wt?: number
  bt?: number
  children?: MozerBookTheoryItem[]
}

export interface MozerStyleMove {
  san: string
  uci: string
}

export interface WikiForwardMove {
  uci: string
  san: string
  name: string | null
  eco: string | null
  child_id: number
  is_nearest_descendant?: boolean
}

export interface WikiInfoResponse {
  node_id: number
  name: string
  eco: string
  canonical_uci_path: string[]
  canonical_san_path: string[]
  canonical_slug: string
  wikibooks_url: string
  forward_moves: WikiForwardMove[]
}

export interface MozerBookResponse {
  summary: {
    total: number
    win_p: number
    draw_p: number
    loss_p: number
    perf?: number
  } | null
  moves: MozerBookMove[]
  styles?: {
    grossmaster: MozerStyleMove
    hustler: MozerStyleMove
    schuler: MozerStyleMove
  }
  wiki?: WikiInfoResponse | null
}

class MozerBookService {
  private readonly BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || 'http://localhost:3000/api'

  async fetchStats(cleanFen: string): Promise<MozerBookResponse | null> {
    try {
      const params = new URLSearchParams({ fen: cleanFen })
      const response = await fetch(`${this.BACKEND_URL}/opening/mozer_book?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      })

      if (!response.ok) throw new Error(`MozerBook API Error: ${response.statusText}`)
      return await response.json()
    } catch (error) {
      logger.error(`[MozerBookService] Error:`, error)
      return null
    }
  }
}

export const mozerBookService = new MozerBookService()
