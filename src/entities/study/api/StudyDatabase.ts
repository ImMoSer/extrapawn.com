import Dexie, { type Table } from 'dexie'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'

export interface StudyChapter {
  id: string
  studyId: string
  name: string
  pgn: string
  color: 'white' | 'black'
  chapter_type: 'repertoire' | 'custom'
  tags: Record<string, string>
  root?: PgnNode
}

export interface StudyEntity {
  id: string
  name: string
  chapters: StudyChapter[]
  importedAt: number
}

export interface SrsProgressEntity {
  id: string // `${studyId}:${chapterId}:${nodePath}`
  studyId: string
  chapterId: string
  nodePath: string
  successes: number
  attempts: number
  lastTrained: number
  mastery: number
}

class UserStudyDatabase extends Dexie {
  studies!: Table<StudyEntity, string>
  srs_progress!: Table<SrsProgressEntity, string>

  constructor() {
    super('ExtrapawnUserStudyDatabase')
    this.version(1).stores({
      studies: 'id, importedAt',
      srs_progress: 'id, [studyId+chapterId], lastTrained',
    })
    this.version(2).stores({
      studies: 'id, importedAt',
      srs_progress: 'id, [studyId+chapterId], lastTrained',
    })
  }
}

export const studyDb = new UserStudyDatabase()
