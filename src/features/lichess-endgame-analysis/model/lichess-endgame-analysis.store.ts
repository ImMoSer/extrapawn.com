import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { useGameStore, useBoardStore, gamesDb } from '@/entities/game'
import { soundService } from '@/shared/lib/sound.service'
import { EndgameTrainingStrategy } from './EndgameTrainingStrategy'
import type { EndgameAnalysisResponse, EndgamePuzzle } from './lichess-endgame-analysis.types'

export const useLichessEndgameAnalysisStore = defineStore('lichessEndgameAnalysis', () => {
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const analysisResult = ref<EndgameAnalysisResponse | null>(null)

  // Trainings-State
  const isPlaying = ref(false)
  const activePuzzle = ref<EndgamePuzzle | null>(null)
  const activeCategory = ref<string | null>(null)
  const puzzlesQueue = ref<EndgamePuzzle[]>([])
  const solvedPuzzles = ref<Set<string>>(new Set())
  const failedPuzzles = ref<Set<string>>(new Set())
  const feedbackMessage = ref('')
  const isWaitingForBotBlunder = ref(false)

  const analyzeBackupBuffer = async (fileBuffer: ArrayBuffer): Promise<void> => {
    isLoading.value = true
    error.value = null
    analysisResult.value = null

    try {
      logger.info(`[EndgameAnalysisStore] Starte Analyse fuer Buffer (${fileBuffer.byteLength} Bytes)`)
      
      const response = await apiClient<EndgameAnalysisResponse>(
        '/engine-eval/endgame/analyze',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
          },
          body: fileBuffer,
        }
      )

      if (!response || !response.stats || !response.puzzles) {
        throw new Error('Ungueltige Antwortstruktur vom Analyse-Service erhalten.')
      }

      // Asynchrones Anreichern mit lokalen Spieldaten
      for (const puzzle of response.puzzles) {
        try {
          const dbGame = await gamesDb.lichess_games.get(puzzle.game_id)
          if (dbGame) {
            puzzle.white_player = dbGame.white
            puzzle.black_player = dbGame.black
            puzzle.speed = dbGame.timeControl
          }
        } catch (e) {
          logger.warn(`[EndgameAnalysisStore] Konnte Spieldaten fuer ${puzzle.game_id} nicht aus der DB laden:`, e)
        }
      }

      analysisResult.value = response
      logger.info('[EndgameAnalysisStore] Analyse erfolgreich abgeschlossen.')
    } catch (err) {
      const errorObject = err as Error
      const errMsg = errorObject.message || 'Ein unerwarteter Fehler ist bei der Analyse aufgetreten.'
      error.value = errMsg
      logger.error('[EndgameAnalysisStore] Fehler bei der Analyse:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const selectCategory = (category: string) => {
    activeCategory.value = category
    if (analysisResult.value?.puzzles) {
      puzzlesQueue.value = analysisResult.value.puzzles.filter(p => p.category === category)
    } else {
      puzzlesQueue.value = []
    }
  }

  const startTraining = (category: string) => {
    selectCategory(category)
    solvedPuzzles.value.clear()
    failedPuzzles.value.clear()
    if (puzzlesQueue.value.length > 0) {
      const firstPuzzle = puzzlesQueue.value[0]
      if (firstPuzzle) {
        loadPuzzle(firstPuzzle)
      }
    }
  }

  const determinePlayerColor = (puzzle: EndgamePuzzle): 'white' | 'black' => {
    if (puzzle.first_move === 'user') {
      const fen = puzzle.dropped_fen || ''
      return fen.split(' ')[1] === 'w' ? 'white' : 'black'
    } else {
      const fen = puzzle.opp_blunder_fen || ''
      return fen.split(' ')[1] === 'w' ? 'black' : 'white'
    }
  }

  const loadPuzzle = (puzzle: EndgamePuzzle) => {
    isPlaying.value = true
    activePuzzle.value = puzzle
    isWaitingForBotBlunder.value = false
    feedbackMessage.value = ''

    const gameStore = useGameStore()
    const boardStore = useBoardStore()
    const userColor = determinePlayerColor(puzzle)

    gameStore.setBotEngineId('maia-2200')
    gameStore.setGamePhase('LOADING')

    const initialFen = puzzle.puzzle_type === 'opp_blunders'
      ? puzzle.opp_blunder_fen!
      : puzzle.dropped_fen!

    gameStore.startWithStrategy(
      initialFen,
      new EndgameTrainingStrategy(puzzle, userColor),
      userColor,
      false
    )

    if (puzzle.puzzle_type === 'opp_blunders') {
      isWaitingForBotBlunder.value = true
      feedbackMessage.value = 'features.lichessEndgameAnalysis.feedback.waitingForOpponent'
      
      setTimeout(() => {
        if (activePuzzle.value?.puzzle_id !== puzzle.puzzle_id) return

        const uci = puzzle.opp_blunder_move_uci
        if (uci) {
          boardStore.applyUciMove(uci)
          soundService.playSound('board_move')
        }
        isWaitingForBotBlunder.value = false
        feedbackMessage.value = 'features.lichessEndgameAnalysis.feedback.opponentBlundered'
      }, 1000)
    } else {
      feedbackMessage.value = 'features.lichessEndgameAnalysis.feedback.findCorrectMove'
    }
  }

  const handlePuzzleSuccess = (puzzleId: string) => {
    solvedPuzzles.value.add(puzzleId)
    feedbackMessage.value = 'features.lichessEndgameAnalysis.feedback.success'
  }

  const handlePuzzleFailure = (puzzleId: string) => {
    failedPuzzles.value.add(puzzleId)
    feedbackMessage.value = 'features.lichessEndgameAnalysis.feedback.failure'
  }

  const handleRestart = () => {
    if (activePuzzle.value) {
      loadPuzzle(activePuzzle.value)
    }
  }

  const handleNextPuzzle = () => {
    if (puzzlesQueue.value.length === 0) return
    const currentIdx = puzzlesQueue.value.findIndex(p => p.puzzle_id === activePuzzle.value?.puzzle_id)
    if (currentIdx !== -1 && currentIdx + 1 < puzzlesQueue.value.length) {
      const nextPuzzle = puzzlesQueue.value[currentIdx + 1]
      if (nextPuzzle) {
        loadPuzzle(nextPuzzle)
      }
    }
  }

  const handlePrevPuzzle = () => {
    if (puzzlesQueue.value.length === 0) return
    const currentIdx = puzzlesQueue.value.findIndex(p => p.puzzle_id === activePuzzle.value?.puzzle_id)
    if (currentIdx !== -1 && currentIdx - 1 >= 0) {
      const prevPuzzle = puzzlesQueue.value[currentIdx - 1]
      if (prevPuzzle) {
        loadPuzzle(prevPuzzle)
      }
    }
  }

  const quitTraining = () => {
    isPlaying.value = false
    activePuzzle.value = null
    feedbackMessage.value = ''
    isWaitingForBotBlunder.value = false
    const gameStore = useGameStore()
    gameStore.stop()
  }

  const resetResult = () => {
    analysisResult.value = null
    error.value = null
    isPlaying.value = false
    activePuzzle.value = null
    activeCategory.value = null
    puzzlesQueue.value = []
  }

  return {
    isLoading,
    error,
    analysisResult,
    isPlaying,
    activePuzzle,
    activeCategory,
    puzzlesQueue,
    solvedPuzzles,
    failedPuzzles,
    feedbackMessage,
    isWaitingForBotBlunder,
    analyzeBackupBuffer,
    selectCategory,
    startTraining,
    loadPuzzle,
    handlePuzzleSuccess,
    handlePuzzleFailure,
    handleRestart,
    handleNextPuzzle,
    handlePrevPuzzle,
    quitTraining,
    resetResult,
  }
})

