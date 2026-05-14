// src/services/TheoryGraphService.ts
import logger from '@/shared/lib/logger'
import { slugify } from '@/shared/lib/slugify'

// Internal types for the optimized JSON structure
type CompressedMove = [number, number, string] // [nameIdx, ecoIdx, nextFen]

interface OptimizedGraphJson {
  names: string[]
  ecos: string[]
  graph: Record<string, Record<string, CompressedMove>>
}

export interface GraphMove {
  uci: string
  name: string | null
  eco: string | null
  nextFen: string
}

export interface MajorOpening {
  name: string
  eco?: string
  moves: string[]
  slug: string
}

class TheoryGraphService {
  private data: OptimizedGraphJson | null = null
  private isLoading = false
  private loadingPromise: Promise<void> | null = null
  private readonly JSON_URL = '/openings_full_graph/openings_optimized.json'

  async loadBook(): Promise<void> {
    if (this.data) return
    if (this.isLoading && this.loadingPromise) return this.loadingPromise

    this.isLoading = true
    this.loadingPromise = (async () => {
      try {
        const res = await fetch(this.JSON_URL)
        if (!res.ok) throw new Error(`Failed to load opening graph: ${res.statusText}`)
        this.data = await res.json()
        logger.info('[TheoryGraphService] Optimized book loaded successfully.')
      } catch (err) {
        logger.error('[TheoryGraphService] Error loading book:', err)
        this.data = null
      } finally {
        this.isLoading = false
        this.loadingPromise = null
      }
    })()

    return this.loadingPromise
  }

  isBookLoaded(): boolean {
    return !!this.data
  }

  /**
   * Converts a standard FEN to the "Clean FEN" format used as keys in the graph.
   * Removes halfmove and fullmove counters.
   * Example: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1"
   *       -> "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -"
   */
  toCleanFen(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ')
  }

  getMoves(fen: string): GraphMove[] {
    if (!this.data || !this.data.graph) return []

    const cleanFen = this.toCleanFen(fen)
    const node = this.data.graph[cleanFen]

    if (!node) return []

    return Object.entries(node).map(([uci, [nameIdx, ecoIdx, nextFen]]) => ({
      uci,
      name: nameIdx !== -1 ? this.data!.names[nameIdx] || null : null,
      eco: ecoIdx !== -1 ? this.data!.ecos[ecoIdx] || null : null,
      nextFen,
    }))
  }

  /**
   * Looks up opening name and ECO for a specific move in a position.
   */
  getOpeningByMove(
    parentFen: string,
    uci: string,
  ): { name: string | null; eco: string | null } | null {
    if (!this.data || !this.data.graph) return null

    const cleanFen = this.toCleanFen(parentFen)
    const node = this.data.graph[cleanFen]
    if (!node) return null

    const moveData = node[uci]
    if (!moveData) return null

    const [nameIdx, ecoIdx] = moveData
    return {
      name: nameIdx !== -1 ? this.data.names[nameIdx] || null : null,
      eco: ecoIdx !== -1 ? this.data.ecos[ecoIdx] || null : null,
    }
  }

  private simplifyName(name: string): string {
    return name.split(':')[0]!.trim()
  }

  getMajorOpenings(): MajorOpening[] {
    if (!this.data || !this.data.graph) return []

    const openingsMap = new Map<string, MajorOpening>()
    const rootFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'

    // Helper to process a move
    const processMove = (name: string | null, eco: string | null, moves: string[]) => {
      if (!name) return
      const simpleName = this.simplifyName(name)

      // If we haven't seen this opening group yet, add it.
      if (!openingsMap.has(simpleName)) {
        openingsMap.set(simpleName, {
          name: simpleName,
          eco: eco || undefined,
          moves,
          slug: slugify(simpleName),
        })
      }
    }

    // Traverse Depth 1 and 2 to build the catalog
    // Depth 1 (White's first move)
    const rootNode = this.data.graph[rootFen]
    if (rootNode) {
      for (const [move1, [nameIdx1, ecoIdx1, nextFen1]] of Object.entries(rootNode)) {
        const name1 = nameIdx1 !== -1 ? this.data.names[nameIdx1] || null : null
        const eco1 = ecoIdx1 !== -1 ? this.data.ecos[ecoIdx1] || null : null

        processMove(name1, eco1, [move1])

        // Depth 2 (Black's response)
        const node2 = this.data.graph[nextFen1]
        if (node2) {
          for (const [move2, [nameIdx2, ecoIdx2]] of Object.entries(node2)) {
            const name2 = nameIdx2 !== -1 ? this.data.names[nameIdx2] || null : null
            const eco2 = ecoIdx2 !== -1 ? this.data.ecos[ecoIdx2] || null : null
            processMove(name2, eco2, [move1, move2])
          }
        }
      }
    }

    // Sort alphabetically by name
    return Array.from(openingsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  findOpeningBySlug(slug: string): MajorOpening | undefined {
    return this.getMajorOpenings().find((op) => op.slug === slug)
  }
}

export const theoryGraphService = new TheoryGraphService()
