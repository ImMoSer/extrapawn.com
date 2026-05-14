import type { StudyChapter, Study } from '../model/study.store'
import { studyRepository } from '@/shared/api/storage/repositories/StudyRepository'
import type {
  StudyChapter as RepoChapter,
  Study as RepoStudy,
} from '@/shared/api/storage/repositories/StudyRepository'

/**
 * StudyPersistenceService
 *
 * Thin adapter between the study.store and the SQLite-backed StudyRepository.
 * Debounces chapter saves to avoid hammering the DB on every PGN tree change.
 */
class StudyPersistenceService {
  private saveTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

  /** Debounced chapter save (1 s delay). */
  saveChapter(chapter: StudyChapter): void {
    const existing = this.saveTimeouts.get(chapter.id)
    if (existing) clearTimeout(existing)

    const timeout = setTimeout(() => {
      this.saveTimeouts.delete(chapter.id)
      studyRepository.saveChapter(chapter as RepoChapter).catch((err) => {
        console.error('[StudyPersistenceService] Error saving chapter:', err)
      })
    }, 1000)

    this.saveTimeouts.set(chapter.id, timeout)
  }

  async updateNodeMetadata(
    chapterId: string,
    nodePath: string,
    metadata: Record<string, unknown> | null,
  ): Promise<void> {
    await studyRepository.updateNodeMetadata(chapterId, nodePath, metadata).catch((err) => {
      console.error('[StudyPersistenceService] Error updating node metadata:', err)
    })
  }

  async saveChaptersBulk(chapters: StudyChapter[]): Promise<void> {
    for (const chapter of chapters) {
      await studyRepository.saveChapter(chapter as RepoChapter).catch((err) => {
        console.error('[StudyPersistenceService] Error saving chapter in bulk:', err)
      })
    }
  }

  async saveStudy(study: Study): Promise<void> {
    await studyRepository.saveStudy(study as RepoStudy).catch((err) => {
      console.error('[StudyPersistenceService] Error saving study:', err)
    })
  }

  async getAllChapters(): Promise<StudyChapter[]> {
    try {
      return (await studyRepository.getAllChapters()) as unknown as StudyChapter[]
    } catch (err) {
      console.error('[StudyPersistenceService] Error loading chapters:', err)
      return []
    }
  }

  async getChapterById(id: string): Promise<StudyChapter | null> {
    try {
      return (await studyRepository.getChapterById(id)) as unknown as StudyChapter | null
    } catch (err) {
      console.error('[StudyPersistenceService] Error loading single chapter:', err)
      return null
    }
  }

  async getAllStudies(): Promise<Study[]> {
    try {
      return (await studyRepository.getAllStudies()) as unknown as Study[]
    } catch (err) {
      console.error('[StudyPersistenceService] Error loading studies:', err)
      return []
    }
  }

  async deleteChapter(id: string): Promise<void> {
    await studyRepository.deleteChapter(id).catch((err) => {
      console.error('[StudyPersistenceService] Error deleting chapter:', err)
    })
  }

  async deleteStudy(id: string): Promise<void> {
    await studyRepository.deleteStudy(id).catch((err) => {
      console.error('[StudyPersistenceService] Error deleting study:', err)
    })
  }

  async deleteChaptersByStudyId(studyId: string): Promise<void> {
    // deleteStudy already cascades to chapters in StudyRepository
    await this.deleteStudy(studyId)
  }

  async clearAll(): Promise<void> {
    const studies = await studyRepository.getAllStudies()
    for (const s of studies) {
      await studyRepository.deleteStudy(s.id)
    }
  }
}

export const studyPersistenceService = new StudyPersistenceService()
