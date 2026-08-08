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

/**
 * Trims Wikibooks extract HTML to cut off unwanted sections like
 * "Theory table", "Statistics", "References", "See also", etc.
 */
export function trimWikiExtract(html: string): string {
  if (!html) return ''

  const cutoffTitles = ['theory table', 'statistics', 'references', 'see also', 'external links']

  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')
      const elements = Array.from(doc.body.children)

      for (const el of elements) {
        const text = (el.textContent || '').trim().toLowerCase()
        const tagName = el.tagName.toLowerCase()

        const isHeading =
          /^h[1-6]$/.test(tagName) ||
          el.querySelector('h1, h2, h3, h4, h5, h6') !== null ||
          ((tagName === 'p' || tagName === 'div') && el.querySelector('b, strong') !== null && text.length < 40)

        const matchesCutoff = cutoffTitles.some((title) => text.includes(title))

        if (isHeading && matchesCutoff) {
          let sibling: Element | null = el
          while (sibling) {
            const next: Element | null = sibling.nextElementSibling
            sibling.remove()
            sibling = next
          }
          break
        }
      }

      const trimmed = doc.body.innerHTML.trim()
      if (trimmed) return trimmed
    }
  } catch {
    // Ignore DOMParser errors and fallback to regex
  }

  // Regex Fallback
  const regex = /(?:<h[1-6][^>]*>|<p>\s*<b[^>]*>|<p>\s*<strong[^>]*>)[\s\S]*?(?:Theory table|Statistics|References|See also|External links)[\s\S]*?(?:<\/h[1-6]>|<\/b>|<\/strong>)/i
  const match = regex.exec(html)
  if (match) {
    return html.substring(0, match.index).trim()
  }

  return html
}

// --- API Service ---
class WikiBooksApiService {
  private readonly BASE_URL = 'https://en.wikibooks.org/w/api.php'
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  public async fetchTheory(slug: string): Promise<WikiPageExtract | null> {
    // 1. Check Cache
    try {
      const cached = await globalCacheRepository.getWikiContent(slug)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        if (!cached.content || cached.content.trim() === '') {
          // Negative cache hit: entry does not exist on Wikibooks
          return null
        }
        return {
          pageid: 0,
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

      if (!pages || (Array.isArray(pages) && pages.length === 0)) {
        await globalCacheRepository.saveWikiContent({
          slug,
          content: '',
          timestamp: Date.now(),
        })
        return null
      }

      const pageData = Array.isArray(pages) ? pages[0] : Object.values(pages)[0]
      if (!pageData || ('missing' in pageData && pageData.missing)) {
        await globalCacheRepository.saveWikiContent({
          slug,
          content: '',
          timestamp: Date.now(),
        })
        return null
      }

      const extractContent = (pageData.extract as string) || ''
      if (!extractContent || extractContent.trim() === '') {
        await globalCacheRepository.saveWikiContent({
          slug,
          content: '',
          timestamp: Date.now(),
        })
        return null
      }

      const result: WikiPageExtract = {
        pageid: pageData.pageid as number,
        ns: pageData.ns as number,
        title: pageData.title as string,
        extract: extractContent,
        timestamp: Date.now(),
      }

      // 3. Update Cache with positive hit
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
   * Directly fetches theory for the current moves without falling back to parent moves.
   */
  public async fetchWithFallback(moves: string[]): Promise<WikiPageExtract | null> {
    const slug = WikiUrlBuilder.buildSlug(moves)
    return this.fetchTheory(slug)
  }
}

export const wikiBooksApiService = new WikiBooksApiService()
