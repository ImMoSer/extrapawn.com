import { pgnParserService } from '@/shared/lib/pgn/PgnParserService'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import { databaseClient, DbNotOpenError } from '../DatabaseClient'
import { toRaw } from 'vue'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'
import type { Statement } from '../DatabaseClient'
import logger from '@/shared/lib/logger'

export interface Study {
  id: string
  title: string
  chapterIds: string[]
  lichessId?: string
  type?: 'owned' | 'community'
  order_index?: number
}

export interface StudyChapter {
  id: string
  studyId?: string
  name: string
  root: PgnNode
  tags: Record<string, string>
  savedPath: string
  color?: 'white' | 'black'
  lichessChapterId?: string
  start_position?: boolean
  chapter_type?: 'repertoire' | 'speedrun'
}

interface RawChapterRow {
  id: string
  studyId: string | null
  name: string
  tags: string
  savedPath: string
  config: string
  pgn_text: string
}

interface RawStudyRow {
  id: string
  title: string
  chapterIds: string
  lichessId?: string
  type?: 'owned' | 'community'
  order_index?: number
}

interface RawMetadataRow {
  node_path: string
  metadata: string
}

export class StudyRepository {
  private collectMetadata(node: PgnNode, currentPath: string = ''): Map<string, string> {
    const raw = toRaw(node)
    const nodePath = raw.id === '__ROOT__' ? '' : currentPath + raw.id
    const metaMap = new Map<string, string>()

    if (raw.metadata && Object.keys(raw.metadata).length > 0) {
      metaMap.set(nodePath, JSON.stringify(raw.metadata))
    }

    if (raw.children) {
      raw.children.forEach((child) => {
        const nextPath = raw.id === '__ROOT__' ? '' : nodePath
        const childMap = this.collectMetadata(child, nextPath)
        childMap.forEach((v, k) => metaMap.set(k, v))
      })
    }
    return metaMap
  }

  private injectMetadata(
    node: PgnNode,
    metaMap: Map<string, Record<string, unknown>>,
    currentPath: string = '',
  ): void {
    const nodePath = node.id === '__ROOT__' ? '' : currentPath + node.id
    const meta = metaMap.get(nodePath)

    if (meta) {
      node.metadata = { ...node.metadata, ...meta }
    }

    if (node.children) {
      node.children.forEach((child) => {
        const nextPath = node.id === '__ROOT__' ? '' : nodePath
        this.injectMetadata(child, metaMap, nextPath)
      })
    }
  }

  async getAllStudies(): Promise<Study[]> {
    try {
      const rows = await databaseClient.query<RawStudyRow>(
        'user',
        'SELECT * FROM studies ORDER BY order_index ASC',
      )
      return rows.map((r) => ({
        ...r,
        chapterIds: JSON.parse(r.chapterIds) as string[],
      }))
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[StudyRepository] Failed to get all studies', err)
      }
      return []
    }
  }

  async saveStudy(study: Study): Promise<boolean> {
    try {
      const raw = toRaw(study)
      await databaseClient.batch('user', [
        {
          sql: `
          INSERT INTO studies (id, title, chapterIds, lichessId, type, order_index)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            title       = excluded.title,
            chapterIds  = excluded.chapterIds,
            lichessId   = excluded.lichessId,
            type        = excluded.type,
            order_index = excluded.order_index
        `,
          params: [
            raw.id,
            raw.title,
            JSON.stringify(raw.chapterIds),
            raw.lichessId ?? null,
            raw.type ?? null,
            raw.order_index ?? 0,
          ],
        },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[StudyRepository] Failed to save study', err)
      }
      return false
    }
  }

  async getAllChapters(): Promise<StudyChapter[]> {
    try {
      const rows = await databaseClient.query<RawChapterRow>('user', 'SELECT * FROM chapters')

      const chapters: StudyChapter[] = []
      for (const r of rows) {
        const importResult = pgnParserService.parse(r.pgn_text)
        if (!importResult) continue

        let metaRows: RawMetadataRow[] = []
        try {
          metaRows = await databaseClient.query<RawMetadataRow>(
            'user',
            'SELECT node_path, metadata FROM node_metadata WHERE chapter_id = ?',
            [r.id],
          )
        } catch (err) {
          if (!(err instanceof DbNotOpenError)) {
            logger.error(`[StudyRepository] Failed to get node_metadata for chapter ${r.id}`, err)
          }
        }

        const metaMap = new Map<string, Record<string, unknown>>()
        metaRows.forEach((row) => {
          try {
            metaMap.set(row.node_path, JSON.parse(row.metadata) as Record<string, unknown>)
          } catch {
            /* ignore corrupted meta */
          }
        })

        this.injectMetadata(importResult.root, metaMap)

        const config = JSON.parse(r.config ?? '{}') as Partial<StudyChapter>

        chapters.push({
          id: r.id,
          studyId: r.studyId ?? undefined,
          name: r.name,
          root: importResult.root,
          tags: importResult.tags,
          savedPath: r.savedPath,
          color: config.color,
          lichessChapterId: config.lichessChapterId,
          start_position: config.start_position,
          chapter_type: config.chapter_type,
        })
      }
      return chapters
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[StudyRepository] Failed to get all chapters', err)
      }
      return []
    }
  }

  async getChapterById(id: string): Promise<StudyChapter | null> {
    try {
      const rows = await databaseClient.query<RawChapterRow>(
        'user',
        'SELECT * FROM chapters WHERE id = ?',
        [id],
      )

      if (rows.length === 0) return null
      const r = rows[0]!

      const importResult = pgnParserService.parse(r.pgn_text)
      if (!importResult) return null

      let metaRows: RawMetadataRow[] = []
      try {
        metaRows = await databaseClient.query<RawMetadataRow>(
          'user',
          'SELECT node_path, metadata FROM node_metadata WHERE chapter_id = ?',
          [r.id],
        )
      } catch (err) {
        if (!(err instanceof DbNotOpenError)) {
          logger.error(`[StudyRepository] Failed to get node_metadata for chapter ${r.id}`, err)
        }
      }

      const metaMap = new Map<string, Record<string, unknown>>()
      metaRows.forEach((row) => {
        try {
          metaMap.set(row.node_path, JSON.parse(row.metadata) as Record<string, unknown>)
        } catch {
          /* ignore */
        }
      })

      this.injectMetadata(importResult.root, metaMap)

      const config = JSON.parse(r.config ?? '{}') as Partial<StudyChapter>

      return {
        id: r.id,
        studyId: r.studyId ?? undefined,
        name: r.name,
        root: importResult.root,
        tags: importResult.tags,
        savedPath: r.savedPath,
        color: config.color,
        lichessChapterId: config.lichessChapterId,
        start_position: config.start_position,
        chapter_type: config.chapter_type,
      }
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[StudyRepository] Failed to get chapter by id ${id}`, err)
      }
      return null
    }
  }

  async saveChapter(chapter: StudyChapter): Promise<boolean> {
    try {
      const raw = toRaw(chapter)
      const pgnText = pgnService.getFullPgn(raw.tags, raw.root)
      const metaMap = this.collectMetadata(raw.root)

      const config = JSON.stringify({
        color: raw.color,
        lichessChapterId: raw.lichessChapterId,
        start_position: raw.start_position,
        chapter_type: raw.chapter_type,
      })

      const statements: Statement[] = []

      statements.push({
        sql: `
          INSERT INTO chapters (id, studyId, name, tags, savedPath, config, pgn_text)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            studyId   = excluded.studyId,
            name      = excluded.name,
            tags      = excluded.tags,
            savedPath = excluded.savedPath,
            config    = excluded.config,
            pgn_text  = excluded.pgn_text
        `,
        params: [
          raw.id,
          raw.studyId ?? null,
          raw.name,
          JSON.stringify(raw.tags),
          raw.savedPath,
          config,
          pgnText,
        ],
      })

      statements.push({
        sql: 'DELETE FROM node_metadata WHERE chapter_id = ?',
        params: [raw.id],
      })

      for (const [nodePath, metadata] of metaMap.entries()) {
        statements.push({
          sql: `
            INSERT INTO node_metadata (chapter_id, node_path, metadata)
            VALUES (?, ?, ?)
          `,
          params: [raw.id, nodePath, metadata],
        })
      }

      await databaseClient.batch('user', statements)
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[StudyRepository] Failed to save chapter', err)
      }
      return false
    }
  }

  async updateNodeMetadata(
    chapterId: string,
    nodePath: string,
    metadata: Record<string, unknown> | null,
  ): Promise<boolean> {
    try {
      const statements: Statement[] = []
      if (!metadata || Object.keys(metadata).length === 0) {
        statements.push({
          sql: 'DELETE FROM node_metadata WHERE chapter_id = ? AND node_path = ?',
          params: [chapterId, nodePath],
        })
      } else {
        statements.push({
          sql: `
            INSERT INTO node_metadata (chapter_id, node_path, metadata)
            VALUES (?, ?, ?)
            ON CONFLICT(chapter_id, node_path) DO UPDATE SET
              metadata = excluded.metadata
          `,
          params: [chapterId, nodePath, JSON.stringify(metadata)],
        })
      }
      await databaseClient.batch('user', statements)
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error('[StudyRepository] Failed to update node metadata', err)
      }
      return false
    }
  }

  async deleteChapter(id: string): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        { sql: 'DELETE FROM chapters WHERE id = ?', params: [id] },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[StudyRepository] Failed to delete chapter ${id}`, err)
      }
      return false
    }
  }

  async deleteStudy(id: string): Promise<boolean> {
    try {
      await databaseClient.batch('user', [
        { sql: 'DELETE FROM studies WHERE id = ?', params: [id] },
      ])
      return true
    } catch (err) {
      if (!(err instanceof DbNotOpenError)) {
        logger.error(`[StudyRepository] Failed to delete study ${id}`, err)
      }
      return false
    }
  }
}

export const studyRepository = new StudyRepository()
