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

export interface OpenCheckAnalysis {
  id: string // e.g. `${username}:${color}:${timestamp}`
  username: string
  color: 'white' | 'black'
  timestamp: number
  maxDepth: number
  gamesCount: number
  perfTypes: string[]
  tree: any // Hierarchical opening tree
  rootFen: string
  rootMove: string
}

class UserStudyDatabase extends Dexie {
  studies!: Table<StudyEntity, string>
  srs_progress!: Table<SrsProgressEntity, string>
  open_check_analyses!: Table<OpenCheckAnalysis, string>

  constructor() {
    super('ExtrapawnUserStudyDatabase')
    this.version(1).stores({
      studies: 'id, importedAt',
      srs_progress: 'id, [studyId+chapterId], lastTrained',
    })
    this.version(2).stores({
      studies: 'id, importedAt',
      srs_progress: 'id, [studyId+chapterId], lastTrained',
      open_check_analyses: 'id, username, timestamp',
    })
  }
}

export const studyDb = new UserStudyDatabase()
