import { computed, ref, type Ref } from 'vue'
import { requestStudyEngineMove } from '../api/coachStudy.api'
import {
  mapPlayerTablebaseToSignal,
  type ChatStreamPayload,
  type StudyChapterRecord,
  type StudyCommentaryLevel,
  type StudyEngineProfile,
  type StudyLanguage,
  type StudyPlayMode,
  type StudySideColor,
} from './coachStudy.types'

const ARBITER_CP_BLUNDER_THRESHOLD = -150

export interface CoachGameMoveEvent {
  moveUci: string
  moveSan: string
  fenBefore: string
  uciPathBefore: string[]
  language: StudyLanguage
}

export interface SparringWakeEvent {
  language: StudyLanguage
  fenBefore: string
  lastMoveUci: string
  playerTablebase?: ChatStreamPayload['player_tablebase']
  arbiterCp: number | null
  arbiterMate: number | null
}

export interface StudyPlayModeHost {
  activeChapter: Ref<StudyChapterRecord | null>
  orientation: Ref<StudySideColor>
  getRawTurn: () => StudySideColor
  getRootFen: () => string
  getCurrentUciPath: () => string[]
  stopAutoPlay: () => void
  applyEngineMoveToTree: (uci: string) => boolean
  onPersistCursor: (includePgn: boolean) => Promise<void>
  onSparringWakeCoach: (ev: SparringWakeEvent) => Promise<void>
  onSparringBriefCommentary: (ev: CoachGameMoveEvent) => Promise<void>
}

/**
 * Manages live interactive play modes (`study` | `coach_game` | `sparring`),
 * `mozero`/`maia` engine replies, `first_move: 'bot'` openings, and Arbiter blunder wake-up.
 */
export function useStudyPlayModes(host: StudyPlayModeHost) {
  const playMode = ref<StudyPlayMode>('study')
  const playerColor = ref<StudySideColor>('white')
  const engineProfile = ref<StudyEngineProfile>('mozero')
  const commentaryLevel = ref<StudyCommentaryLevel>('off')
  const isBotThinking = ref(false)

  const isSparringActive = computed(() => playMode.value === 'sparring')
  const isCoachGameActive = computed(() => playMode.value === 'coach_game')

  function syncModeFromChapter(chapter: StudyChapterRecord): void {
    const meta = chapter.metadata ?? {}
    playMode.value = chapter.play_mode ?? 'study'
    playerColor.value = chapter.user_color ?? chapter.orientation ?? 'white'
    engineProfile.value =
      meta.engine_profile ?? (chapter.chapter_kind === 'drill' ? 'mozero' : 'maia_1700')
    commentaryLevel.value = meta.commentary ?? (playMode.value === 'coach_game' ? 'brief' : 'off')
  }

  function resetPlayMode(): void {
    playMode.value = 'study'
    playerColor.value = 'white'
    engineProfile.value = 'mozero'
    commentaryLevel.value = 'off'
    isBotThinking.value = false
  }

  async function playEngineReply(
    language: StudyLanguage,
    studentFenBefore: string | null,
    studentMoveUci: string | null,
    studentMoveSan: string | null = null,
    uciPathBeforeStudent: string[] = [],
  ): Promise<void> {
    if (playMode.value !== 'sparring' || isBotThinking.value) return
    isBotThinking.value = true
    try {
      const res = await requestStudyEngineMove(
        host.getRootFen(),
        host.getCurrentUciPath(),
        engineProfile.value,
        true,
      )
      if (!res || playMode.value !== 'sparring') return

      if (host.applyEngineMoveToTree(res.bestMove)) {
        await host.onPersistCursor(true)
      }

      const obj = host.activeChapter.value?.objective
      const tb = res.playerTablebase
      const objectiveLost =
        tb !== null &&
        ((obj === 'win' && tb.wdl <= 0) || (obj === 'hold_draw' && tb.wdl < 0 && tb.fideLost))
      const arbiterMateLoss =
        res.arbiterMate !== null && res.arbiterMate !== undefined && res.arbiterMate < 0
      const arbiterCpBlunder =
        res.arbiterCp !== null &&
        res.arbiterCp !== undefined &&
        res.arbiterCp <= ARBITER_CP_BLUNDER_THRESHOLD

      if ((objectiveLost || arbiterMateLoss || arbiterCpBlunder) && studentFenBefore && studentMoveUci) {
        await host.onSparringWakeCoach({
          language,
          fenBefore: studentFenBefore,
          lastMoveUci: studentMoveUci,
          playerTablebase: mapPlayerTablebaseToSignal(tb),
          arbiterCp: res.arbiterCp ?? null,
          arbiterMate: res.arbiterMate ?? null,
        })
      } else if (
        commentaryLevel.value === 'brief' &&
        studentFenBefore &&
        studentMoveUci &&
        studentMoveSan
      ) {
        await host.onSparringBriefCommentary({
          moveUci: studentMoveUci,
          moveSan: studentMoveSan,
          fenBefore: studentFenBefore,
          uciPathBefore: uciPathBeforeStudent,
          language,
        })
      }
    } finally {
      isBotThinking.value = false
    }
  }

  function applyPlayModeSettings(opts: {
    mode: StudyPlayMode
    userColor?: StudySideColor | null
    profile?: StudyEngineProfile | null
    commentary?: StudyCommentaryLevel | null
  }): void {
    host.stopAutoPlay()
    playMode.value = opts.mode
    if (opts.userColor) {
      playerColor.value = opts.userColor
      host.orientation.value = opts.userColor
    }
    if (opts.profile) engineProfile.value = opts.profile
    if (opts.commentary) commentaryLevel.value = opts.commentary

    if (opts.mode === 'sparring' && host.getRawTurn() !== playerColor.value && !isBotThinking.value) {
      void playEngineReply('ru', null, null)
    }
  }

  function maybeAutoStartBotOpening(chapter: StudyChapterRecord, hasRootChildren: boolean): void {
    if (
      playMode.value === 'sparring' &&
      chapter.metadata?.first_move === 'bot' &&
      !hasRootChildren &&
      host.getRawTurn() !== playerColor.value
    ) {
      void playEngineReply('ru', null, null)
    }
  }

  function toggleSparring(language: StudyLanguage = 'ru'): void {
    host.stopAutoPlay()
    if (playMode.value === 'sparring') {
      playMode.value = 'study'
      return
    }
    const ch = host.activeChapter.value
    playerColor.value = ch?.user_color ?? ch?.orientation ?? host.orientation.value
    host.orientation.value = playerColor.value
    playMode.value = 'sparring'
    if (host.getRawTurn() !== playerColor.value) {
      void playEngineReply(language, null, null)
    }
  }

  function toggleCoachGame(): void {
    host.stopAutoPlay()
    if (playMode.value === 'coach_game') {
      playMode.value = 'study'
      return
    }
    const ch = host.activeChapter.value
    playerColor.value = ch?.user_color ?? ch?.orientation ?? host.orientation.value
    host.orientation.value = playerColor.value
    playMode.value = 'coach_game'
  }

  return {
    playMode,
    playerColor,
    engineProfile,
    commentaryLevel,
    isBotThinking,
    isSparringActive,
    isCoachGameActive,
    syncModeFromChapter,
    resetPlayMode,
    playEngineReply,
    applyPlayModeSettings,
    maybeAutoStartBotOpening,
    toggleSparring,
    toggleCoachGame,
  }
}
