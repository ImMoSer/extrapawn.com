import { computed, ref, type Ref } from 'vue'
import { requestStudyEngineMove } from '../api/coachStudy.api'
import type {
  StudyChapterRecord,
  StudyEngineProfile,
  StudyPlayMode,
  StudySideColor,
} from './coachStudy.types'

export interface StudyPlayModeHost {
  activeChapter: Ref<StudyChapterRecord | null>
  orientation: Ref<StudySideColor>
  getRawTurn: () => StudySideColor
  getRootFen: () => string
  getCurrentUciPath: () => string[]
  stopAutoPlay: () => void
  applyEngineMoveToTree: (uci: string) => boolean
  onPersistCursor: (includePgn: boolean) => Promise<void>
}

/**
 * Manages AI Study 3.0 silent `$0` Bot Auto-Reply (`mozero` / `maia_1700` / `maia_2200`)
 * and `first_move: 'bot'` drill openings with zero automatic LLM wake-ups.
 */
export function useStudyPlayModes(host: StudyPlayModeHost) {
  const playMode = ref<StudyPlayMode>('study')
  const playerColor = ref<StudySideColor>('white')
  const engineProfile = ref<StudyEngineProfile>('maia_1700')
  const isBotThinking = ref(false)

  const isBotAutoReplyActive = computed(() => playMode.value === 'sparring')

  function syncModeFromChapter(chapter: StudyChapterRecord): void {
    const meta = chapter.metadata ?? {}
    playMode.value = chapter.play_mode === 'sparring' ? 'sparring' : 'study'
    playerColor.value = chapter.user_color ?? chapter.orientation ?? 'white'
    engineProfile.value =
      meta.engine_profile ?? (chapter.chapter_kind === 'drill' ? 'mozero' : 'maia_1700')
  }

  function resetPlayMode(): void {
    playMode.value = 'study'
    playerColor.value = 'white'
    engineProfile.value = 'maia_1700'
    isBotThinking.value = false
  }

  function setEngineProfile(profile: StudyEngineProfile): void {
    engineProfile.value = profile
  }

  async function playEngineReply(): Promise<void> {
    if (playMode.value !== 'sparring' || isBotThinking.value) return
    isBotThinking.value = true
    try {
      const res = await requestStudyEngineMove(
        host.getRootFen(),
        host.getCurrentUciPath(),
        engineProfile.value,
        false,
      )
      if (!res || playMode.value !== 'sparring') return

      if (host.applyEngineMoveToTree(res.bestMove)) {
        await host.onPersistCursor(true)
      }
    } finally {
      isBotThinking.value = false
    }
  }

  function applyPlayModeSettings(opts: {
    mode: StudyPlayMode
    userColor?: StudySideColor | null
    profile?: StudyEngineProfile | null
  }): void {
    host.stopAutoPlay()
    playMode.value = opts.mode === 'sparring' ? 'sparring' : 'study'
    if (opts.userColor) {
      playerColor.value = opts.userColor
      host.orientation.value = opts.userColor
    }
    if (opts.profile) {
      engineProfile.value = opts.profile
    }

    if (
      playMode.value === 'sparring' &&
      host.getRawTurn() !== playerColor.value &&
      !isBotThinking.value
    ) {
      void playEngineReply()
    }
  }

  function maybeAutoStartBotOpening(chapter: StudyChapterRecord, hasRootChildren: boolean): void {
    if (
      playMode.value === 'sparring' &&
      chapter.metadata?.first_move === 'bot' &&
      !hasRootChildren &&
      host.getRawTurn() !== playerColor.value
    ) {
      void playEngineReply()
    }
  }

  function toggleBotAutoReply(): void {
    host.stopAutoPlay()
    if (playMode.value === 'sparring') {
      playMode.value = 'study'
      return
    }
    playerColor.value = host.orientation.value
    playMode.value = 'sparring'
    if (host.getRawTurn() !== playerColor.value) {
      void playEngineReply()
    }
  }

  return {
    playMode,
    playerColor,
    engineProfile,
    isBotThinking,
    isBotAutoReplyActive,
    syncModeFromChapter,
    resetPlayMode,
    setEngineProfile,
    playEngineReply,
    applyPlayModeSettings,
    maybeAutoStartBotOpening,
    toggleBotAutoReply,
  }
}
