import { settingsRepository } from '@/shared/api/storage/repositories/SettingsRepository'
import { pgnParserService } from '@/shared/lib/pgn/PgnParserService'
import { pgnService, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { makeFen, parseFen } from 'chessops/fen'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { lichessSyncService } from '../api/LichessSyncService'
import { studyPersistenceService } from '../api/StudyPersistenceService'

export interface Study {
  id: string // Lichess ID 'bUmjtT4G'
  title: string
  description?: string
  chapterIds: string[] // List of chapter IDs in order
  lichessId?: string
  ownerId?: string
  type?: 'owned' | 'community'
}

export interface StudyChapter {
  id: string
  name: string
  root: PgnNode // The reference to the tree
  tags: Record<string, string>
  savedPath: string // To restore cursor location
  color?: 'white' | 'black'
  studyId?: string // Reference to parent Study
  lichessChapterId?: string // Lichess internal chapter ID (e.g. BHEJGiPB)
  start_position?: boolean
  chapter_type?: 'repertoire' | 'speedrun'
}

export const useStudyStore = defineStore('study', () => {
  const studies = ref<Study[]>([])
  const chapters = ref<StudyChapter[]>([])
  const activeChapterId = ref<string | null>(null)
  const isInitialized = ref(false)
  const cloudLoading = ref(false)
  const isAuthModalVisible = ref(false)
  const isActiveMode = ref(false)

  const activeChapter = computed(() => chapters.value.find((c) => c.id === activeChapterId.value))

  const activeStudy = computed(() => {
    if (!activeChapter.value?.studyId) return null
    return studies.value.find((s) => s.id === activeChapter.value?.studyId) || null
  })

  /**
   * Permissions:
   * Only the owner of the study can modify its PGN structure (moves, comments, arrows).
   * 'community' studies are read-only for the structure, but can still track local metadata (mastery).
   */
  const canEditActiveChapter = computed(() => {
    if (!activeStudy.value) return false
    return activeStudy.value.type === 'owned'
  })

  const _currentOwnerId = ref<string | null>(null)
  const _currentUsername = ref<string | null>(null)

  const currentOwnerId = computed(() => _currentOwnerId.value)
  const currentUsername = computed(() => _currentUsername.value)

  function setOwner(id: string | null, username: string | null) {
    if (_currentOwnerId.value !== id) {
      _currentOwnerId.value = id
      _currentUsername.value = username
      // Watcher below will trigger initialize()
    }
  }

  async function requireLichessAccess(): Promise<boolean> {
    const hasToken = await lichessSyncService.ensureToken()
    if (!hasToken) {
      isAuthModalVisible.value = true
      return false
    }
    return true
  }

  function generateId(): string {
    return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
  }

  async function initialize() {
    // Reset state first to avoid showing old data
    chapters.value = []
    studies.value = []
    activeChapterId.value = null
    isInitialized.value = false

    const ownerId = currentOwnerId.value
    if (!ownerId) {
      isInitialized.value = true
      return
    }

    const loadedChapters = await studyPersistenceService.getAllChapters()
    if (loadedChapters.length > 0) {
      chapters.value = loadedChapters
    }

    const loadedStudies = await studyPersistenceService.getAllStudies()
    if (loadedStudies.length > 0) {
      studies.value = loadedStudies
    }

    if (chapters.value.length > 0) {
      const lastId = await settingsRepository.getSetting<string | null>(
        `lastActiveChapterId_${ownerId}`,
        null,
      )
      if (lastId && chapters.value.some((c) => c.id === lastId)) {
        await setActiveChapter(lastId)
      } else {
        await setActiveChapter(chapters.value[0]!.id)
      }
    }

    isInitialized.value = true
  }

  // Watch for user changes to reload studies
  watch(
    () => currentOwnerId.value,
    (newId, oldId) => {
      if (newId !== oldId) {
        initialize()
      }
    },
  )

  async function createChapter(
    name: string = 'New Chapter',
    startFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    color?: 'white' | 'black',
    studyId?: string,
  ) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return null

    if (!studyId && activeStudy.value) {
      studyId = activeStudy.value.id
    }

    if (!studyId) {
      throw new Error('You must import a Lichess Study first to create chapters.')
    }

    const study = studies.value.find((s) => s.id === studyId)
    if (!study) throw new Error('Study not found')

    if (study.chapterIds.length >= 64) {
      throw new Error('A study cannot have more than 64 chapters.')
    }

    let normalizedFen = startFen
    let start_position = true
    try {
      if (startFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        start_position = false
      }
      const setup = parseFen(startFen).unwrap()
      normalizedFen = makeFen(setup)
    } catch (e) {
      console.error('Invalid FEN for new chapter', e)
    }

    const root: PgnNode = {
      id: '__ROOT__',
      ply: 0,
      fenBefore: '',
      fenAfter: normalizedFen,
      san: '',
      uci: '',
      children: [],
    }

    const now = new Date()
    const utcDate = now.toISOString().split('T')[0]?.replace(/-/g, '.') || ''
    const utcTime = now.toISOString().split('T')[1]?.split('.')[0] || ''

    const id = generateId()
    const newChapter: StudyChapter = {
      id,
      name,
      root,
      tags: {
        Event: name,
        Site: 'LOCAL',
        Result: '*',
        UTCDate: utcDate,
        UTCTime: utcTime,
        Variant: 'Standard',
        ECO: 'NULL',
        Opening: 'NULL',
        Annotator: `https://lichess.org/@/${ownerId}`,
      },
      savedPath: '',
      color,
      studyId,
      start_position,
      chapter_type: start_position ? 'repertoire' : 'speedrun',
    }

    chapters.value.push(newChapter)
    study.chapterIds.push(id)

    // Save immediately
    await studyPersistenceService.saveChapter(newChapter)
    await studyPersistenceService.saveStudy(study)

    return id
  }

  async function createChapterFromPgn(
    pgn: string,
    nameOverride?: string,
    colorOverride?: 'white' | 'black',
    studyId?: string,
  ) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return null

    if (!studyId && activeStudy.value) {
      studyId = activeStudy.value.id
    }

    if (!studyId) {
      throw new Error('You must import a Lichess Study first to add a chapter from PGN.')
    }

    try {
      const parsed = pgnParserService.parse(pgn)
      if (!parsed) {
        throw new Error('Invalid or illegal chapter data.')
      }

      const { tags, root } = parsed

      const color =
        colorOverride ||
        (tags['White'] === 'Player' ? 'white' : tags['Black'] === 'Player' ? 'black' : undefined)

      let name = nameOverride || tags['Event'] || 'Imported Chapter'
      if (!nameOverride && tags['White'] && tags['Black']) {
        name = `${tags['White']} - ${tags['Black']}`
      }

      const study = studies.value.find((s) => s.id === studyId)
      if (!study) throw new Error('Study not found')

      const id = generateId()

      const now = new Date()
      const utcDate = now.toISOString().split('T')[0]?.replace(/-/g, '.') || ''
      const utcTime = now.toISOString().split('T')[1]?.split('.')[0] || ''

      const start_position =
        !tags['FEN'] || tags['FEN'] === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

      const newChapter: StudyChapter = {
        id,
        name,
        root,
        tags: {
          Event: name,
          Site: 'LOCAL',
          Result: tags['Result'] || '*',
          UTCDate: tags['UTCDate'] || utcDate,
          UTCTime: tags['UTCTime'] || utcTime,
          Variant: tags['Variant'] || 'Standard',
          ECO: tags['ECO'] || 'NULL',
          Opening: tags['Opening'] || 'NULL',
          Annotator: tags['Annotator'] || `https://lichess.org/@/${ownerId}`,
          ...tags, // Keep other original tags
        },
        savedPath: '',
        color,
        studyId,
        start_position,
        chapter_type: start_position ? 'repertoire' : 'speedrun',
      }

      chapters.value.push(newChapter)
      study.chapterIds.push(id)

      await studyPersistenceService.saveChapter(newChapter)
      await studyPersistenceService.saveStudy(study)

      setActiveChapter(id)
      return id
    } catch (e) {
      console.error('Failed to create chapter from PGN', e)
      throw e
    }
  }

  async function deleteChapter(id: string, removeFromLichess: boolean = false) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    const index = chapters.value.findIndex((c) => c.id === id)
    if (index !== -1) {
      const chapterToDelete = chapters.value[index]
      if (!chapterToDelete) return

      if (removeFromLichess && chapterToDelete.lichessChapterId) {
        const study = studies.value.find((s) => s.id === chapterToDelete.studyId)
        if (study && study.lichessId) {
          cloudLoading.value = true
          try {
            await lichessSyncService.deleteChapter(
              study.lichessId,
              chapterToDelete.lichessChapterId,
            )
          } catch (error) {
            console.error('Failed to delete chapter on Lichess', error)
            throw error
          } finally {
            cloudLoading.value = false
          }
        }
      }

      // Remove from study if it belongs to one
      let parentStudy: Study | undefined
      if (chapterToDelete?.studyId) {
        parentStudy = studies.value.find((s) => s.id === chapterToDelete.studyId)
        if (parentStudy) {
          parentStudy.chapterIds = parentStudy.chapterIds.filter((cid) => cid !== id)
          await studyPersistenceService.saveStudy(parentStudy)
        }
      }

      chapters.value.splice(index, 1)
      await studyPersistenceService.deleteChapter(id)

      if (chapters.value.length === 0) {
        activeChapterId.value = null
        return
      }

      // If the active chapter was the one we just deleted, we need to pick a new one
      if (activeChapterId.value === id) {
        let nextChapterId: string | undefined

        // Try to pick another chapter from the same study first
        if (parentStudy && parentStudy.chapterIds.length > 0) {
          nextChapterId = parentStudy.chapterIds[0]
        }
        // If the study is empty or we didn't have a parent study, fallback to the first available chapter globally
        else if (chapters.value.length > 0 && chapters.value[0]) {
          nextChapterId = chapters.value[0].id
        }

        if (nextChapterId) {
          setActiveChapter(nextChapterId)
        } else {
          activeChapterId.value = null
        }
      }
    }
  }

  async function deleteStudy(id: string) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    const index = studies.value.findIndex((s) => s.id === id)
    if (index !== -1) {
      studies.value.splice(index, 1)
      // Delete associated chapters from both memory and DB
      chapters.value = chapters.value.filter((c) => c.studyId !== id)
      await studyPersistenceService.deleteChaptersByStudyId(id)

      await studyPersistenceService.deleteStudy(id)

      if (activeChapterId.value && !chapters.value.some((c) => c.id === activeChapterId.value)) {
        await setActiveChapter(chapters.value.length > 0 ? chapters.value[0]!.id : null)
      }
    }
  }

  const lastSavedPgn = ref<string>('')

  const isDirty = computed(() => {
    if (!activeChapter.value) return false
    // Use the full PGN (including comments/shapes) as a structural comparison
    const currentPgn = pgnService.getFullPgn(activeChapter.value.tags, activeChapter.value.root)
    return currentPgn !== lastSavedPgn.value
  })

  async function setActiveChapter(id: string | null) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    // 1. Save state of current chapter (cursor position)
    if (activeChapterId.value) {
      const prev = chapters.value.find((c) => c.id === activeChapterId.value)
      if (prev) {
        prev.savedPath = pgnService.getCurrentPath()
        // We only auto-save the chapter record itself (meta/path) if not dirty?
        // No, let's keep it simple: switching chapters saves NOTHING automatically anymore.
        // If the user wants to save their path, they click SAVE.
      }
    }

    if (!id) {
      activeChapterId.value = null
      await settingsRepository.deleteSetting(`lastActiveChapterId_${ownerId}`)
      return
    }

    // 2. Switch
    // PRODUCTION-GRADE: Always fetch fresh state from DB to discard any unsaved RAM changes
    const freshChapter = await studyPersistenceService.getChapterById(id)
    if (freshChapter) {
      // Sync the RAM array with the DB version
      const idx = chapters.value.findIndex((c) => c.id === id || c.lichessChapterId === id)
      if (idx !== -1) {
        chapters.value[idx] = freshChapter
      }

      activeChapterId.value = freshChapter.id
      await settingsRepository.saveSetting(`lastActiveChapterId_${ownerId}`, freshChapter.id)
      pgnService.setRoot(freshChapter.root, freshChapter.savedPath)
      // Set the baseline for change detection (isDirty will be false now)
      lastSavedPgn.value = pgnService.getFullPgn(freshChapter.tags, freshChapter.root)
    } else {
      // Fallback if DB fetch fails (e.g. newly created unsaved chapter)
      const next = chapters.value.find((c) => c.id === id || c.lichessChapterId === id)
      if (next) {
        activeChapterId.value = next.id
        await settingsRepository.saveSetting(`lastActiveChapterId_${ownerId}`, next.id)
        pgnService.setRoot(next.root, next.savedPath)
        lastSavedPgn.value = pgnService.getFullPgn(next.tags, next.root)
      }
    }
  }

  async function persistActiveChapter() {
    if (!activeChapter.value || !canEditActiveChapter.value) return
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    // Update savedPath to current before saving
    activeChapter.value.savedPath = pgnService.getCurrentPath()

    // Save to DB
    await studyPersistenceService.saveChapter(activeChapter.value)

    // Update baseline
    lastSavedPgn.value = pgnService.getFullPgn(activeChapter.value.tags, activeChapter.value.root)
  }

  async function persistNodeMetadata(nodePath: string, metadata: Record<string, unknown> | null) {
    if (!activeChapterId.value) return
    // Metadata is always allowed (local progress)
    await studyPersistenceService.updateNodeMetadata(activeChapterId.value, nodePath, metadata)
  }

  async function revertActiveChapter() {
    if (!activeChapterId.value) return

    // Reload all chapters from DB to get the original state
    const allChapters = await studyPersistenceService.getAllChapters()
    const original = allChapters.find((c) => c.id === activeChapterId.value)

    if (original) {
      // Update local state in the array
      const idx = chapters.value.findIndex((c) => c.id === original.id)
      if (idx !== -1) {
        chapters.value[idx] = original

        // Update PGN service to show original tree
        pgnService.setRoot(original.root, original.savedPath)
        lastSavedPgn.value = pgnService.getFullPgn(original.tags, original.root)
      }
    }
  }

  function updateChapterMetadata(
    id: string,
    metadata: Partial<Omit<StudyChapter, 'id' | 'root' | 'savedPath'>>,
  ) {
    if (!canEditActiveChapter.value) return
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    const chapter = chapters.value.find((c) => c.id === id)
    if (chapter) {
      if (metadata.name) chapter.name = metadata.name
      if (metadata.tags) chapter.tags = { ...chapter.tags, ...metadata.tags }
      // Metadata updates still auto-save for now as they are "Meta", not "Content"
      studyPersistenceService.saveChapter(chapter)
    }
  }

  // --- LICHESS IMPORT ---
  async function importFromLichess(
    studyId: string,
    type: 'owned' | 'community' = 'owned',
    tokenOverride?: string,
  ): Promise<string | null> {
    const ownerId = currentOwnerId.value
    const username = currentUsername.value
    if (!ownerId || !username) return null

    if (type === 'community' && !tokenOverride) {
      try {
        const info = await lichessSyncService.fetchCommunityStudyInfo()
        tokenOverride = info.token
      } catch (e) {
        console.error('Failed to fetch community token', e)
      }
    }

    if (!tokenOverride && !(await requireLichessAccess())) return null

    cloudLoading.value = true
    try {
      // 2. Download PGN (Rate limiter in service handles delays automatically)
      const pgnData = await lichessSyncService.fetchStudyPgn(studyId, tokenOverride)
      const importResults = pgnParserService.parseMultiple(pgnData)

      if (importResults.length === 0) {
        throw new Error('No chapters found in the study.')
      }

      // Extract study title
      const firstTags = importResults[0]?.tags || {}
      let studyTitle = firstTags['StudyName']

      // Fallback: If no StudyName tag, try to split Event "Study: Chapter"
      if (!studyTitle && firstTags['Event']) {
        if (firstTags['Event'].includes(': ')) {
          studyTitle = firstTags['Event'].split(': ')[0]
        } else {
          studyTitle = firstTags['Event']
        }
      }

      if (!studyTitle) {
        studyTitle = `Lichess Study ${studyId}`
      }

      const study: Study = {
        id: studyId, // Use lichess ID as our local study ID
        title: studyTitle,
        lichessId: studyId,
        chapterIds: [],
        ownerId,
        type,
      }

      // Check if study already exists to avoid duplicate chapters
      const existingStudyIndex = studies.value.findIndex((s) => s.id === studyId)

      // Before importing, we must purge old chapters linked to this study ID from DB for THIS user
      await studyPersistenceService.deleteChaptersByStudyId(studyId)

      if (existingStudyIndex !== -1) {
        // Study exists - we update state
        studies.value[existingStudyIndex] = study
        // State cleanup: remove from chapters array
        chapters.value = chapters.value.filter((c) => c.studyId !== studyId)
      } else {
        studies.value.push(study)
      }

      let firstChapterId: string | null = null
      const parsedChapters: StudyChapter[] = []

      for (let i = 0; i < importResults.length; i++) {
        const { tags, root } = importResults[i]!

        // Extract Lichess Chapter ID from URL: https://lichess.org/study/studyId/chapterId
        let lichessChapterId: string | undefined = undefined
        if (tags['ChapterURL']) {
          const urlParts = tags['ChapterURL'].split('/')
          lichessChapterId = urlParts[urlParts.length - 1]
        }

        const chapterId: string = lichessChapterId || generateId()

        // Extract chapter name
        let chapterName = tags['ChapterName']

        // Fallback: If no ChapterName tag, try to get it from Event
        if (!chapterName && tags['Event']) {
          if (tags['Event'].includes(': ')) {
            // "Study: Chapter" -> take only "Chapter"
            chapterName = tags['Event'].split(': ').slice(1).join(': ')
          } else {
            chapterName = tags['Event']
          }
        }

        if (!chapterName) {
          chapterName = `Chapter ${i + 1}`
        }

        // Map Orientation to color
        const color = tags['Orientation'] === 'black' ? 'black' : 'white'

        const start_position =
          !tags['FEN'] || tags['FEN'] === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

        const newChapter: StudyChapter = {
          id: chapterId,
          name: chapterName,
          root,
          tags,
          savedPath: '',
          color,
          studyId: study.id,
          lichessChapterId,
          start_position,
          chapter_type: start_position ? 'repertoire' : 'speedrun',
        }

        chapters.value.push(newChapter)
        study.chapterIds.push(chapterId)
        parsedChapters.push(newChapter)

        if (i === 0) firstChapterId = chapterId
      }

      await studyPersistenceService.saveChaptersBulk(parsedChapters)
      await studyPersistenceService.saveStudy(study)

      if (firstChapterId) {
        setActiveChapter(firstChapterId)
      }

      return study.id
    } catch (e) {
      console.error('Failed to import Lichess study', e)
      throw e
    } finally {
      cloudLoading.value = false
    }
  }

  // --- SYNC ACTIONS ---

  async function publishChapterToLichess(chapterId: string) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    if (!(await requireLichessAccess())) return

    if (!activeStudy.value || !activeStudy.value.lichessId) {
      throw new Error('This study is not linked to Lichess.')
    }

    const chapter = chapters.value.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new Error('Chapter not found.')
    }

    if (chapter.lichessChapterId) {
      throw new Error('Chapter is already linked to Lichess.')
    }

    cloudLoading.value = true
    try {
      const pgn = pgnService.getFullPgn(chapter.tags, chapter.root)
      const newLichessChapterId = await lichessSyncService.importPgnIntoStudy(
        activeStudy.value.lichessId,
        {
          pgn,
          name: chapter.name,
          orientation: chapter.color,
          variant: 'standard',
        },
      )

      chapter.lichessChapterId = newLichessChapterId
      await studyPersistenceService.saveChapter(chapter)
      return newLichessChapterId
    } catch (e) {
      console.error('Failed to publish chapter to Lichess', e)
      throw e
    } finally {
      cloudLoading.value = false
    }
  }

  async function syncLichessToApp(studyId: string) {
    const study = studies.value.find((s) => s.id === studyId)
    const type = study?.type || 'owned'
    // Just re-import, it will overwrite the study and its chapters
    return await importFromLichess(studyId, type)
  }

  async function pushChapterToLichess(chapterId: string) {
    const ownerId = currentOwnerId.value
    if (!ownerId) return

    if (!(await requireLichessAccess())) return

    if (!activeStudy.value || !activeStudy.value.lichessId) {
      throw new Error('This study is not linked to Lichess.')
    }

    const chapter = chapters.value.find((c) => c.id === chapterId)
    if (!chapter) {
      throw new Error('Chapter not found.')
    }

    if (!chapter.lichessChapterId) {
      throw new Error('Chapter is not linked to Lichess.')
    }

    cloudLoading.value = true
    try {
      // Use new Lichess moves endpoint which preserves the chapter ID
      const pgn = pgnService.getFullPgn(chapter.tags, chapter.root)
      await lichessSyncService.updateChapterMoves(
        activeStudy.value.lichessId,
        chapter.lichessChapterId,
        pgn,
      )
    } catch (e) {
      console.error('Failed to push chapter to Lichess', e)
      throw e
    } finally {
      cloudLoading.value = false
    }
  }

  return {
    studies,
    chapters,
    activeChapterId,
    activeChapter,
    activeStudy,
    canEditActiveChapter,
    isInitialized,
    cloudLoading,
    isDirty,
    isAuthModalVisible,
    isActiveMode,
    requireLichessAccess,
    initialize,
    createChapter,
    createChapterFromPgn,
    deleteChapter,
    deleteStudy,
    saveStudy: (study: Study) => {
      const ownerId = currentOwnerId.value
      if (ownerId) return studyPersistenceService.saveStudy(study)
    },
    setActiveChapter,
    persistActiveChapter,
    persistNodeMetadata,
    revertActiveChapter,
    updateChapterMetadata,
    importFromLichess,
    syncLichessToApp,
    pushChapterToLichess,
    publishChapterToLichess,
    syncChapterTagsToLichess: async (chapterId: string) => {
      const ownerId = currentOwnerId.value
      if (!ownerId) return

      if (!(await requireLichessAccess())) return

      const chapter = chapters.value.find((c) => c.id === chapterId)
      if (!chapter || !chapter.lichessChapterId || !activeStudy.value?.lichessId) {
        return
      }

      cloudLoading.value = true
      try {
        const result = chapter.tags['Result'] || '*'
        const pgn = `[Result "${result}"]\n\n*`
        await lichessSyncService.updateChapterTags(
          activeStudy.value.lichessId,
          chapter.lichessChapterId,
          pgn,
        )
      } catch (e) {
        console.error('Failed to sync chapter tags to Lichess', e)
        throw e
      } finally {
        cloudLoading.value = false
      }
    },
    addSpeedrunHistory: (
      chapterId: string,
      moves: { san: string; uci: string; fenBefore: string; fenAfter: string }[],
    ) => {
      const ownerId = currentOwnerId.value
      if (!ownerId) return

      const chapter = chapters.value.find((c) => c.id === chapterId)
      if (!chapter) return

      // 1. Remove previous speedrun variation if it exists
      const removeSpeedrunNodes = (node: PgnNode) => {
        node.children = node.children.filter((child) => child.metadata?.isSpeedrun !== true)
        node.children.forEach(removeSpeedrunNodes)
      }
      removeSpeedrunNodes(chapter.root)

      // 2. Add new speedrun variation
      if (moves.length > 0) {
        pgnService.addVariation(chapter.root, moves, { isSpeedrun: true })
      }

      // 3. Save (only if owner)
      if (canEditActiveChapter.value) {
        studyPersistenceService.saveChapter(chapter)
      }

      // If this is the active chapter, we need to refresh the pgnService to show the new nodes
      if (activeChapterId.value === chapterId) {
        // Trigger a fake tree update if pgnService is currently using this root
        pgnService.navigateToNode(pgnService.getCurrentNode())
      }
    },
    setOwner,
  }
})
