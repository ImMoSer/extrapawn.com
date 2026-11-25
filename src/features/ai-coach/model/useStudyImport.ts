import { ref, shallowRef, type Ref } from 'vue'
import {
  importFenPosition,
  importLichessGameStream,
  importPgnGameStream,
} from '../api/coachStudy.api'
import type {
  ImportChapterResponse,
  StudyChapterRecord,
  StudyLanguage,
  StudySessionRecord,
  StudySideColor,
  SuggestedChapterCard,
} from './coachStudy.types'
import type { SendCoachMessageOptions } from './useStudyStreamHandler'

export interface StudyImportHost {
  activeStudy: Ref<StudySessionRecord | null>
  activeChapterId: Ref<string | null>
  suggestedChapter: Ref<SuggestedChapterCard | null>
  upsertChapter: (ch: StudyChapterRecord) => void
  loadChapterIntoTree: (
    chapter: StudyChapterRecord,
    preservePath: boolean,
    autoStartBotOpening: boolean,
  ) => void
  cancelCursorDebounce: () => void
  sendCoachMessage: (opts: SendCoachMessageOptions) => Promise<void>
}

export interface ImportCommonOptions {
  language: StudyLanguage
  autoReview: boolean
  customQuestion?: string
  defaultReviewPrompt: string
}

/**
 * Manages Unified Game/Position Import (Lichess URL, PGN, FEN) with live SSE status
 * streaming, clean cancellation, atomic chapter activation, and optional auto-review hand-off.
 */
export function useStudyImport(host: StudyImportHost) {
  const isImporting = ref(false)
  const importStatusLabel = ref<string | null>(null)
  const importError = ref<string | null>(null)
  const abortCtrl = shallowRef<AbortController | null>(null)

  function clearImportError(): void {
    importError.value = null
  }

  function abortImport(): void {
    if (abortCtrl.value) {
      abortCtrl.value.abort()
      abortCtrl.value = null
    }
    isImporting.value = false
    importStatusLabel.value = null
  }

  function activateImportedChapter(resp: ImportChapterResponse): void {
    host.cancelCursorDebounce()
    if (resp.study_title && host.activeStudy.value) {
      host.activeStudy.value = { ...host.activeStudy.value, title: resp.study_title }
    }
    host.upsertChapter(resp.chapter)
    host.activeChapterId.value = resp.chapter.id
    host.suggestedChapter.value = null
    host.loadChapterIntoTree(resp.chapter, false, false)
  }

  function triggerAutoReviewIfNeeded(opts: ImportCommonOptions): void {
    if (!opts.autoReview) return
    const prompt = opts.customQuestion?.trim() || opts.defaultReviewPrompt
    if (!prompt) return
    void host.sendCoachMessage({
      text: prompt,
      language: opts.language,
    })
  }

  async function runSseImport(
    runner: (
      handlers: {
        onStatus: (label: string) => void
        onDone: (resp: ImportChapterResponse) => void
        onError: (msg: string) => void
      },
      signal: AbortSignal,
    ) => Promise<void>,
    opts: ImportCommonOptions,
  ): Promise<ImportChapterResponse | null> {
    if (!host.activeStudy.value) return null
    abortImport()
    importError.value = null
    importStatusLabel.value = null
    isImporting.value = true

    const ctrl = new AbortController()
    abortCtrl.value = ctrl
    let completed: ImportChapterResponse | null = null

    try {
      await runner(
        {
          onStatus: (label) => {
            importStatusLabel.value = label
          },
          onDone: (resp) => {
            completed = resp
            activateImportedChapter(resp)
          },
          onError: (msg) => {
            importError.value = msg
          },
        },
        ctrl.signal,
      )
    } catch (err: unknown) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        importError.value = err instanceof Error ? err.message : 'Import failed'
      }
    } finally {
      if (abortCtrl.value === ctrl) {
        abortCtrl.value = null
      }
      isImporting.value = false
      importStatusLabel.value = null
    }

    if (completed) {
      triggerAutoReviewIfNeeded(opts)
    }
    return completed
  }

  async function importFromLichess(
    opts: ImportCommonOptions & {
      url: string
      userColor?: StudySideColor | null
    },
  ): Promise<ImportChapterResponse | null> {
    const studyId = host.activeStudy.value?.id
    if (!studyId) return null
    return runSseImport(
      (handlers, signal) =>
        importLichessGameStream(
          studyId,
          {
            url: opts.url.trim(),
            user_color: opts.userColor ?? null,
            language: opts.language,
          },
          {
            onStatus: (ev) => handlers.onStatus(ev.label),
            onDone: (resp) => handlers.onDone(resp),
            onError: (ev) => handlers.onError(ev.message),
          },
          signal,
        ),
      opts,
    )
  }

  async function importFromPgn(
    opts: ImportCommonOptions & {
      pgn: string
      title?: string | null
      userColor?: StudySideColor | null
    },
  ): Promise<ImportChapterResponse | null> {
    const studyId = host.activeStudy.value?.id
    if (!studyId) return null
    return runSseImport(
      (handlers, signal) =>
        importPgnGameStream(
          studyId,
          {
            pgn: opts.pgn.trim(),
            title: opts.title?.trim() || null,
            user_color: opts.userColor ?? null,
            language: opts.language,
          },
          {
            onStatus: (ev) => handlers.onStatus(ev.label),
            onDone: (resp) => handlers.onDone(resp),
            onError: (ev) => handlers.onError(ev.message),
          },
          signal,
        ),
      opts,
    )
  }

  async function importFromFen(
    opts: ImportCommonOptions & {
      fen: string
      title?: string | null
      orientation?: StudySideColor | null
    },
  ): Promise<ImportChapterResponse | null> {
    const studyId = host.activeStudy.value?.id
    if (!studyId) return null
    abortImport()
    importError.value = null
    isImporting.value = true

    try {
      const resp = await importFenPosition(studyId, {
        fen: opts.fen.trim(),
        title: opts.title?.trim() || null,
        orientation: opts.orientation ?? null,
        language: opts.language,
      })
      activateImportedChapter(resp)
      triggerAutoReviewIfNeeded(opts)
      return resp
    } catch (err: unknown) {
      importError.value = err instanceof Error ? err.message : 'FEN import failed'
      return null
    } finally {
      isImporting.value = false
    }
  }

  return {
    isImporting,
    importStatusLabel,
    importError,
    clearImportError,
    abortImport,
    importFromLichess,
    importFromPgn,
    importFromFen,
  }
}
