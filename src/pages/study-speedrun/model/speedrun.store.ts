import { useGameStore, gameplayService, type GameStatusInfo, type IGameplayStrategy } from '@/entities/game'
import { type StudyChapter, useStudyStore } from '@/features/study'
import { soundService } from '@/shared/lib/sound.service'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { Color as ChessgroundColor } from '@lichess-org/chessground/types'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/shared/api/client'
import { useAuthStore } from '@/entities/user'
import { useUiStore } from '@/shared/ui/model/ui.store'
import { useRouter } from 'vue-router'
import type { UserStatsUpdate } from '@/shared/types/api.types'

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
  const currentAttemptMoves = ref<{ san: string; uci: string; fenBefore: string; fenAfter: string }[]>([])

  // Track times for each chapter index
  const chapterTimes = ref<Record<number, number>>({})

  // Timer State
  const startTime = ref(0)
  const currentTimeMs = ref(0)
  let timerInterval: number | null = null

  const currentChapter = computed(() => chaptersToPlay.value[currentChapterIndex.value])
  const totalChapters = computed(() => chaptersToPlay.value.length)

  const totalTimeMs = computed(() => {
    return Object.values(chapterTimes.value).reduce((acc, time) => acc + time, 0)
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

  function _createSpeedrunStrategy(targetResult: string, userColor: ChessgroundColor): IGameplayStrategy {
    return {
      requestBotMove: async (fen: string) => {
        try {
          console.log('[SpeedrunStrategy] Requesting bot move for FEN:', fen)
          const move = await gameplayService.getBestMove(gameStore.botEngineId, fen)
          console.log('[SpeedrunStrategy] Bot move received:', move)
          return move
        } catch (error) {
          console.error('[SpeedrunStrategy] Failed to get bot move.', error)
          return null
        }
      },
      onBotMoveExecuted: () => {
        const lastMove = pgnService.getLastMove()
        if (lastMove) {
          currentAttemptMoves.value.push({
            san: lastMove.san,
            uci: lastMove.uci,
            fenBefore: lastMove.fenBefore,
            fenAfter: lastMove.fenAfter
          })
        }
      },
      onUserMoveExecuted: () => {
        const lastMove = pgnService.getLastMove()
        if (lastMove) {
          currentAttemptMoves.value.push({
            san: lastMove.san,
            uci: lastMove.uci,
            fenBefore: lastMove.fenBefore,
            fenAfter: lastMove.fenAfter
          })
        }
      },
      checkWinCondition: (status: GameStatusInfo) => {
        const isUserWin = status.outcome?.winner === userColor
        const isDraw = status.outcome !== undefined && status.outcome.winner === undefined

        if (targetResult === '1/2-1/2') {
          // Success if Draw OR if user manages to win anyway
          return isDraw || isUserWin
        }
        
        // For 1-0 or 0-1, we assume the chapter orientation matches the result side
        // so we just check if the user won.
        return isUserWin
      },
      onGameOver(status: GameStatusInfo) {
        stopTimer()
        // We use the same logic as checkWinCondition
        const isSuccess = this.checkWinCondition!(status)

        // Save history regardless of success/failure
        const chapter = chaptersToPlay.value[currentChapterIndex.value]
        if (chapter) {
          studyStore.addSpeedrunHistory(chapter.id, [...currentAttemptMoves.value])
        }

        if (isSuccess) {
          handleChapterSuccess(currentTimeMs.value)
        } else {
          handleChapterFailure()
        }
      }
    }
  }

  function playCurrentChapter() {
    const chapter = chaptersToPlay.value[currentChapterIndex.value]
    if (!chapter) return

    // Reset attempt moves
    currentAttemptMoves.value = []

    // Default to white if color is undefined or not standard
    const userColor: ChessgroundColor = (chapter.color === 'black') ? 'black' : 'white'
    const targetResult = chapter.tags.Result || '1-0'

    resetTimer()
    startTimer()

    gameStore.setGamePhase('LOADING')
    
    const initialFen = chapter.tags?.FEN || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    gameStore.startWithStrategy(
      initialFen, 
      _createSpeedrunStrategy(targetResult, userColor), 
      userColor
    )
  }

  function handleChapterFailure() {
    console.log("[Speedrun] Failed! Retrying chapter...")
    // Restart the same chapter
    playCurrentChapter()
  }

  function handleChapterSuccess(timeNeededMs: number) {
    console.log(`[Speedrun] Success! Time needed: ${timeNeededMs}ms`)
    chapterTimes.value[currentChapterIndex.value] = timeNeededMs
    
    // Check if there are any uncompleted chapters left
    const nextIndex = chaptersToPlay.value.findIndex((_, idx) => chapterTimes.value[idx] === undefined)
    
    if (nextIndex === -1) {
      // Speedrun finished! All chapters solved.
      stopTimer()
      isPlaying.value = false
      isFinished.value = true
      soundService.playSound('game_speedrun_finished')
      return
    }

    // Auto-navigate to the next uncompleted chapter
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
      // 1. Charge PawnCoins on Server
      const response = await apiClient<{ userStatsUpdate: UserStatsUpdate }>('/speedrun/start', {
        method: 'POST',
        body: JSON.stringify({ subMode: 'study' })
      })

      // 2. Update user stats in global store
      if (response.userStatsUpdate) {
        authStore.updateUserStats(response.userStatsUpdate)
      }

      // 3. Initialize local state
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
        throw error // Re-throw if not handled by UI (e.g. show generic error)
      }
    }
  }

  function quitSpeedrun() {
    stopTimer()
    isPlaying.value = false
    isFinished.value = false
    chaptersToPlay.value = []
    chapterTimes.value = {}
    gameStore.setGamePhase('IDLE')
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
    jumpToChapter
  }
})
