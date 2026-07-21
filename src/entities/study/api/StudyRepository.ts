import { studyDb, type StudyEntity, type SrsProgressEntity } from './StudyDatabase'
import logger from '@/shared/lib/logger'

export class StudyRepository {
  /**
   * Fetch all studies sorted by importedAt descending.
   */
  async getAllStudies(): Promise<StudyEntity[]> {
    return studyDb.studies.orderBy('importedAt').reverse().toArray()
  }

  /**
   * Save or update a study.
   */
  async saveStudy(study: StudyEntity): Promise<void> {
    await studyDb.studies.put(study)
  }

  /**
   * Delete a study and its associated SRS progress records in a single transaction.
   */
  async deleteStudy(studyId: string): Promise<void> {
    try {
      await studyDb.transaction('rw', studyDb.studies, studyDb.srs_progress, async () => {
        await studyDb.studies.delete(studyId)
        await studyDb.srs_progress.where({ studyId }).delete()
      })
    } catch (err) {
      logger.error('[StudyRepository] Failed to delete study:', err)
      throw err
    }
  }

  /**
   * Fetch SRS progress records for a given study chapter.
   */
  async getSrsProgress(studyId: string, chapterId: string): Promise<SrsProgressEntity[]> {
    return studyDb.srs_progress.where({ studyId, chapterId }).toArray()
  }

  /**
   * Save or update an SRS progress record.
   */
  async saveSrsProgress(record: SrsProgressEntity): Promise<void> {
    await studyDb.srs_progress.put(record)
  }

  /**
   * Delete an SRS progress record by ID.
   */
  async deleteSrsProgress(id: string): Promise<void> {
    await studyDb.srs_progress.delete(id)
  }
}

export const studyRepository = new StudyRepository()
