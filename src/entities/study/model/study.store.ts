import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { pgnService, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { studyRepository, type StudyChapter, type StudyEntity } from '../index'
import { lichessStudyService } from '../api/LichessStudyService'
import logger from '@/shared/lib/logger'

export const useStudyStore = defineStore('study', () => {
  const library = ref<StudyEntity[]>([])
  const activeStudy = ref<StudyEntity | null>(null)
  const activeChapter = shallowRef<StudyChapter | null>(null)
  const isLoading = ref(false)

  /**
   * Loads all saved studies from IndexedDB database.
   */
  async function loadLibrary() {
    try {
      const list = await studyRepository.getAllStudies()
      library.value = list
    } catch (error) {
      logger.error('[StudyStore] Failed to load library:', error)
      library.value = []
    }
  }

  /**
   * Imports a Lichess study from URL and saves it locally.
   */
  async function importStudy(url: string): Promise<StudyEntity> {
    isLoading.value = true
    try {
      const { studyId, chapterId } = lichessStudyService.parseUrl(url)
      
      // Fetch public study PGN
      const study = await lichessStudyService.fetchStudy(studyId, chapterId)
      
      // Save in local database
      await studyRepository.saveStudy(study)
      await loadLibrary()
      
      logger.info(`[StudyStore] Study ${study.name} (ID: ${study.id}) imported successfully.`)
      return study
    } catch (error) {
      logger.error('[StudyStore] Study import failed:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Deletes a study and all associated training progress.
   */
  async function deleteStudy(studyId: string) {
    try {
      await studyRepository.deleteStudy(studyId)
      
      if (activeStudy.value?.id === studyId) {
        activeStudy.value = null
        activeChapter.value = null
      }
      
      await loadLibrary()
      logger.info(`[StudyStore] Study (ID: ${studyId}) deleted from library.`)
    } catch (error) {
      logger.error('[StudyStore] Failed to delete study:', error)
      throw error
    }
  }

  /**
   * Selects active study and chapter, parsing PGN and injecting SRS progress history.
   */
  async function selectChapter(studyId: string, chapterId: string) {
    const study = library.value.find((s) => s.id === studyId)
    if (!study) {
      throw new Error(`Study (ID: ${studyId}) not found in local library.`)
    }

    const chapter = study.chapters.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new Error(`Chapter (ID: ${chapterId}) not found in study ${study.name}.`)
    }

    activeStudy.value = study

    // Ensure we parse chapter PGN if it's stored raw
    if (!chapter.root) {
      // Lazy parsing
      const { pgnParserService } = await import('@/shared/lib/pgn/PgnParserService')
      const importRes = pgnParserService.parse(chapter.pgn)
      if (!importRes) {
        throw new Error(`Failed to parse chapter PGN for chapter ${chapter.name}`)
      }
      chapter.root = importRes.root
    }

    // Enrich tree with SRS metadata from database
    const srsList = await studyRepository.getSrsProgress(studyId, chapterId)
    const srsMap = new Map(srsList.map((s) => [s.nodePath, s]))

    const mergeSrsMetadata = (node: PgnNode, path = '') => {
      const currentPath = node.parent ? path + node.id : ''
      const saved = srsMap.get(currentPath)
      
      if (saved) {
        node.metadata = {
          ...node.metadata,
          training: {
            successes: saved.successes,
            attempts: saved.attempts,
            lastTrained: saved.lastTrained,
            mastery: saved.mastery,
          },
        }
      }
      
      if (node.children) {
        for (const child of node.children) {
          mergeSrsMetadata(child, currentPath)
        }
      }
    }

    mergeSrsMetadata(chapter.root)
    activeChapter.value = chapter

    // Update pgnService root
    pgnService.setRoot(chapter.root)
    
    logger.info(`[StudyStore] Selected chapter "${chapter.name}" (Type: ${chapter.chapter_type}).`)
  }

  /**
   * Persists SRS training statistics for a specific PGN node.
   */
  async function persistNodeMetadata(
    nodePath: string,
    metadata: { successes: number; attempts: number; lastTrained: number; mastery: number } | null
  ) {
    if (!activeStudy.value || !activeChapter.value) {
      logger.warn('[StudyStore] No active study/chapter. Cannot persist node progress.')
      return
    }

    const studyId = activeStudy.value.id
    const chapterId = activeChapter.value.id
    const id = `${studyId}:${chapterId}:${nodePath}`

    if (!metadata) {
      await studyRepository.deleteSrsProgress(id)
      return
    }

    await studyRepository.saveSrsProgress({
      id,
      studyId,
      chapterId,
      nodePath,
      successes: metadata.successes,
      attempts: metadata.attempts,
      lastTrained: metadata.lastTrained,
      mastery: metadata.mastery,
    })
  }

  return {
    library,
    activeStudy,
    activeChapter,
    isLoading,
    loadLibrary,
    importStudy,
    deleteStudy,
    selectChapter,
    persistNodeMetadata,
  }
})
