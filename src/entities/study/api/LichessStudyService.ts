import { pgnParserService } from '@/shared/lib/pgn/PgnParserService'
import type { StudyChapter, StudyEntity } from './StudyDatabase'

class LichessStudyService {
  /**
   * Parses Lichess study URL to extract studyId and optionally chapterId.
   * Format: https://lichess.org/study/{studyId} or https://lichess.org/study/{studyId}/{chapterId}
   */
  public parseUrl(url: string): { studyId: string; chapterId?: string } {
    const trimmed = url.trim()
    try {
      const parsedUrl = new URL(trimmed)
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
      
      const studyIndex = pathParts.indexOf('study')
      if (studyIndex !== -1 && pathParts[studyIndex + 1]) {
        const studyId = pathParts[studyIndex + 1]!
        const chapterId = pathParts[studyIndex + 2]
        return { studyId, chapterId }
      }
    } catch {
      // Not a valid URL, check if it is just a raw 8-character ID
    }

    // Try regex for raw IDs
    const idMatch = trimmed.match(/^([a-zA-Z0-9]{8})$/)
    if (idMatch && idMatch[1]) {
      return { studyId: idMatch[1] }
    }

    throw new Error(`Invalid Lichess Study URL or ID: ${url}`)
  }

  /**
   * Fetches study PGN data from Lichess public API.
   * Uses orientation=true to request orientation tags.
   */
  public async fetchStudy(studyId: string, chapterId?: string): Promise<StudyEntity> {
    const url = chapterId
      ? `https://lichess.org/api/study/${studyId}/${chapterId}.pgn?orientation=true`
      : `https://lichess.org/api/study/${studyId}.pgn?orientation=true`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch Lichess study: HTTP ${response.status} ${response.statusText}`)
    }

    const pgnText = await response.text()
    if (!pgnText.trim()) {
      throw new Error('Received empty PGN text from Lichess API')
    }

    const importResults = pgnParserService.parseMultiple(pgnText)
    if (importResults.length === 0) {
      throw new Error('No valid chapters parsed from the study PGN')
    }

    const studyName = importResults[0]!.tags['StudyName'] || importResults[0]!.tags['Event'] || 'Lichess Study'

    const chapters: StudyChapter[] = importResults.map((res, index) => {
      const tags = res.tags
      const root = res.root

      // 1. Strict orientation check (Rule 6 - fail-fast)
      const orientationTag = tags['Orientation'] || tags['orientation']
      if (!orientationTag) {
        throw new Error(
          `Chapter "${tags['ChapterName'] || tags['Event'] || index}" is missing the required [Orientation] tag.`
        )
      }
      
      const normOrientation = orientationTag.toLowerCase()
      if (normOrientation !== 'white' && normOrientation !== 'black') {
        throw new Error(
          `Invalid orientation "${orientationTag}" in chapter "${tags['ChapterName'] || tags['Event'] || index}".`
        )
      }
      
      const color = normOrientation as 'white' | 'black'

      // 2. Extract chapterId
      const siteUrl = tags['ChapterURL'] || tags['Site'] || tags['site'] || ''
      const urlParts = siteUrl.split('/').filter(Boolean)
      const studyKeyIndex = urlParts.indexOf('study')
      let parsedChapterId = ''
      
      if (studyKeyIndex !== -1 && urlParts[studyKeyIndex + 2]) {
        parsedChapterId = urlParts[studyKeyIndex + 2]!
      } else {
        // Fallback to index if url doesn't match, but throw error if index isn't unique
        parsedChapterId = `chapter_${index}`
      }

      // 3. Classify chapter type: repertoire vs custom
      const fenTag = tags['FEN'] || tags['fen']
      const setUpTag = tags['SetUp'] || tags['setup']
      const isCustomSetup =
        setUpTag === '1' ||
        (fenTag && fenTag !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')

      const chapter_type = isCustomSetup ? 'custom' : 'repertoire'

      return {
        id: parsedChapterId,
        studyId,
        name: tags['ChapterName'] || tags['Event'] || `Chapter ${index + 1}`,
        pgn: pgnText, // Save full text or the single parsed text? We store parsed chapter details in root
        color,
        chapter_type,
        tags,
        root,
      }
    })

    return {
      id: studyId,
      name: studyName,
      chapters,
      importedAt: Date.now(),
    }
  }
}

export const lichessStudyService = new LichessStudyService()
