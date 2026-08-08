import Dexie, { type Table } from 'dexie'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'

export interface WikiContentEntity {
  slug: string
  content: string
  timestamp: number
}

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

export interface LichessGameEntity {
  id: string
  username: string
  userColor: 'white' | 'black'
  userResult: 'win' | 'loss' | 'draw'
  white: string
  black: string
  white_elo: number
  black_elo: number
  result: string
  status: string
  timeControl: string
  createdAt: number
  lastMoveAt: number
  rootMove: string
  movesCount: number
  openingNameBase: string
  eco: string
  opening: string
  ply: number
  pgn: string
}

export class ExtrapawnAppDatabase extends Dexie {
  wiki_cache!: Table<WikiContentEntity, string>
  studies!: Table<StudyEntity, string>
  srs_progress!: Table<SrsProgressEntity, string>
  lichess_games!: Table<LichessGameEntity, string>

  constructor() {
    super('ExtrapawnAppDatabase')

    this.version(1).stores({
      wiki_cache: 'slug, timestamp',
      studies: 'id, importedAt',
      srs_progress: 'id, [studyId+chapterId], lastTrained',
      lichess_games:
        'id, username, createdAt, timeControl, userColor, userResult, rootMove, openingNameBase, [username+timeControl+userColor+rootMove]',
    })
  }
}

export const appDatabase = new ExtrapawnAppDatabase()
