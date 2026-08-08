import {
  appDatabase,
  type StudyChapter,
  type StudyEntity,
  type SrsProgressEntity,
} from '@/shared/api/storage/AppDatabase'

export type { StudyChapter, StudyEntity, SrsProgressEntity }

export const studyDb = appDatabase
