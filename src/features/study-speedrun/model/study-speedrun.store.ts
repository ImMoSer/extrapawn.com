// src/pages/study-speedrun/model/speedrun.store.ts
import { useGameStore } from '@/entities/game'
import { type StudyChapter, useStudyStore } from '@/features/study'
import { soundService } from '@/shared/lib/sound.service'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/shared/api/client'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useRouter } from 'vue-router'
import type { UserStatsUpdate } from '@/shared/types/api.types'
import { StudySpeedrunStrategy } from './StudySpeedrunStrategy'

export const useSpeedrunStore = defineStore('speedrun', () => {
  const gameStore = useGameStore()
  const studyStore = useStudyStore()
  const authStore = useAuthStore()
  const uiStore = useUiStore()
  const router = useRouter()

  const chaptersToPlay = ref<StudyChapter[]>([])
  const currentChapterIndex = ref(0)
  const isPlaying = ref(false)
  const isFinished = ref(false)

  // Track moves for the current chapter attempt
  const currentAttemptMoves = ref<
    { san: string; uci: string; fenBefore: string; fenAfter: string }[]
  >([])

  // Track times for each chapter index
  const chapterTimes = ref<Record<number, number>>({})

  // Timer State
  const startTime = ref(0)
  const currentTimeMs = ref(0)
  let timerInterval: number | null = null

  const currentChapter = computed(() => chaptersToPlay.value[currentChapterIndex.value])
  const totalChapters = computed(() => chaptersToPlay.value.length)

  const totalTimeMs = computed(() => {
    return Object.values(chapterTimes.value)
      .filter((time) => time > 0)
      .reduce((acc, time) => acc + time, 0)
  })

  function startTimer() {
    startTime.value = Date.now()
    if (timerInterval) clearInterval(timerInterval)
    timerInterval = window.setInterval(() => {
      currentTimeMs.value = Date.now() - startTime.value
    }, 100)
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
  }

  function resetTimer() {
    stopTimer()
    currentTimeMs.value = 0
  }

  function playCurrentChapter() {
    const chapter = chaptersToPlay.value[currentChapterIndex.value]
    if (!chapter) return

    // Reset attempt moves
    currentAttemptMoves.value = []

    const userColor: ChessgroundColor = chapter.color === 'black' ? 'black' : 'white'

    resetTimer()
    gameStore.setGamePhase('LOADING')

    const initialFen =
      chapter.tags?.FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    gameStore.startWithStrategy(
      initialFen,
      new StudySpeedrunStrategy(userColor),
      userColor,
    )
  }

  function handleChapterFailure() {
    console.log('[Speedrun] Failed! Restarting chapter...')
    soundService.playSound('game_training_error')

    const chapter = chaptersToPlay.value[currentChapterIndex.value]
    if (chapter) {
      studyStore.addSpeedrunHistory(chapter.id, [...currentAttemptMoves.value])
    }

    // Instead of marking failure and moving on, we just restart the current chapter
    playCurrentChapter()
  }

  function handleChapterSuccess(timeNeededMs: number) {
    console.log(`[Speedrun] Success! Time needed: ${timeNeededMs}ms`)
    chapterTimes.value[currentChapterIndex.value] = timeNeededMs

    // Save history
    const chapter = chaptersToPlay.value[currentChapterIndex.value]
    if (chapter) {
      studyStore.addSpeedrunHistory(chapter.id, [...currentAttemptMoves.value])
    }

    const nextIndex = chaptersToPlay.value.findIndex(
      (_, idx) => chapterTimes.value[idx] === undefined,
    )

    if (nextIndex === -1) {
      stopTimer()
      isPlaying.value = false
      isFinished.value = true
      soundService.playSound('game_speedrun_finished')
      return
    }

    currentChapterIndex.value = nextIndex
    playCurrentChapter()
  }

  function restartCurrentChapter() {
    if (!isPlaying.value) return
    playCurrentChapter()
  }

  function jumpToChapter(index: number) {
    if (!isPlaying.value) return
    if (index >= 0 && index < totalChapters.value) {
      currentChapterIndex.value = index
      playCurrentChapter()
    }
  }

  async function startSpeedrun(chapters: StudyChapter[]) {
    try {
      gameStore.setBotEngineId('maia-2200')

      const response = await apiClient<{ userStatsUpdate: UserStatsUpdate }>('/speedrun/start', {
        method: 'POST',
        body: JSON.stringify({ subMode: 'study' }),
      })

      if (response.userStatsUpdate) {
        authStore.updateUserStats(response.userStatsUpdate)
      }

      chaptersToPlay.value = chapters
      currentChapterIndex.value = 0
      isPlaying.value = true
      isFinished.value = false
      chapterTimes.value = {}
      playCurrentChapter()
    } catch (error) {
      console.error('[SpeedrunStore] Failed to start speedrun:', error)
      const handled = await uiStore.handlePawnCoinsError(error, () => router.push('/pricing'))
      if (!handled) {
        throw error
      }
    }
  }

  function quitSpeedrun() {
    stopTimer()
    isPlaying.value = false
    isFinished.value = false
    chaptersToPlay.value = []
    chapterTimes.value = {}
    gameStore.stop()
  }

  function formatMs(ms: number | undefined): string {
    if (ms === undefined) return '--:--.--'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    const tenths = Math.floor((ms % 1000) / 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${tenths}`
  }

  return {
    chaptersToPlay,
    currentChapterIndex,
    currentChapter,
    totalChapters,
    currentTimeMs,
    totalTimeMs,
    isPlaying,
    isFinished,
    chapterTimes,
    formatMs,
    startSpeedrun,
    quitSpeedrun,
    restartCurrentChapter,
    jumpToChapter,
    startTimer,
    stopTimer,
    currentAttemptMoves,
    handleChapterSuccess,
    handleChapterFailure,
  }
})
