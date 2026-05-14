// src/services/WikiBooksService.ts
import logger from '@/shared/lib/logger'
import type { WikiApiResponse, WikiPageExtract } from '@/shared/types/wikibooks.types'
import { globalCacheRepository } from '@/shared/api/storage/repositories/GlobalCacheRepository'

// --- Slug Builder ---
export class WikiUrlBuilder {
  private static readonly ROOT_SLUG = 'Chess_Opening_Theory'

  /**
   * Generates a Wikibooks slug from a history of moves.
   * @param moves Array of SAN moves (e.g., ["e4", "e5", "Nf3"])
   * @returns The formatted slug string
   */
  public static buildSlug(moves: string[]): string {
    if (moves.length === 0) {
      return this.ROOT_SLUG
    }

    const path = moves.reduce((acc, move, index) => {
      const moveNumber = Math.floor(index / 2) + 1
      const isWhite = index % 2 === 0
      const segment = isWhite ? `${moveNumber}._${move}` : `${moveNumber}...${move}`
      return `${acc}/${segment}`
    }, this.ROOT_SLUG)

    return path
  }

  public static getParentSlug(slug: string): string | null {
    if (slug === this.ROOT_SLUG) return null
    const parts = slug.split('/')
    if (parts.length <= 1) return null
    parts.pop()
    return parts.join('/')
  }

  public static getPublicUrl(slug: string): string {
    return `https://en.wikibooks.org/wiki/${slug}`
  }
}

// --- API Service ---
class WikiBooksApiService {
  private readonly BASE_URL = 'https://en.wikibooks.org/w/api.php'
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  public async fetchTheory(slug: string): Promise<WikiPageExtract | null> {
    // 1. Check Cache
    try {
      const cached = await globalCacheRepository.getWikiContent(slug)
      if (
        cached &&
        Date.now() - cached.timestamp < this.CACHE_TTL &&
        cached.content &&
        cached.content.trim() !== ''
      ) {
        return {
          pageid: 0, // Not stored in SQLite, but we don't really use it
          ns: 0,
          title: slug,
          extract: cached.content,
          timestamp: cached.timestamp,
        }
      }
    } catch (err) {
      logger.error('[WikiBooksApiService] Cache read error:', err)
    }

    // 2. Fetch from API
    try {
      const url = new URL(this.BASE_URL)
      const params: Record<string, string> = {
        action: 'query',
        format: 'json',
        prop: 'extracts',
        titles: slug,
        redirects: '1',
        origin: '*',
        formatversion: '2',
      }
      Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value))

      const response = await fetch(url.toString())
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

      const data: WikiApiResponse = await response.json()
      const pages = data.query.pages

      if (!pages || (Array.isArray(pages) && pages.length === 0)) return null

      const pageData = Array.isArray(pages) ? pages[0] : Object.values(pages)[0]
      if (!pageData) return null

      if ('missing' in pageData && pageData.missing) {
        return null
      }

      const result: WikiPageExtract = {
        pageid: pageData.pageid as number,
        ns: pageData.ns as number,
        title: pageData.title as string,
        extract: pageData.extract as string,
        timestamp: Date.now(),
      }

      // Treat empty content as null to trigger fallback/retry
      if (!result.extract || result.extract.trim() === '') {
        return null
      }

      // 3. Update Cache
      await globalCacheRepository.saveWikiContent({
        slug,
        content: result.extract,
        timestamp: result.timestamp,
      })

      return result
    } catch (err) {
      logger.error('[WikiBooksApiService] Fetch error:', err)
      throw err
    }
  }

  /**
   * Recursive fetch with parent fallback
   */
  public async fetchWithFallback(moves: string[]): Promise<WikiPageExtract | null> {
    const currentMoves = [...moves]
    while (true) {
      const slug = WikiUrlBuilder.buildSlug(currentMoves)
      try {
        const data = await this.fetchTheory(slug)
        if (data) return data
      } catch {
        // Fallback to parent
      }

      if (currentMoves.length === 0) break
      currentMoves.pop()
    }
    return null
  }
}

export const wikiBooksApiService = new WikiBooksApiService()
