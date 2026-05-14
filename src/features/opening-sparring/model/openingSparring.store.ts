import { analysisService } from '@/entities/analysis'
import { useBoardStore, useGameStore, type IGameplayStrategy } from '@/entities/game'
import { theoryGraphService, useTheoryStore } from '@/entities/opening'
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { type SessionMove } from '@/shared/types/openingSparring.types'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { type TopInfoDisplay, type TopInfoStat } from '@/entities/puzzle'
import i18n from '@/shared/config/i18n'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/shared/ui/model/ui.store'

const t = i18n.global.t

export const useOpeningSparringStore = defineStore('openingSparring', () => {
  const boardStore = useBoardStore()
  const theoryStore = useTheoryStore()
  const uiStore = useUiStore()
  const router = useRouter()

  // -- sessionHistory ref with computed from PGN --
  const sessionHistory = computed<SessionMove[]>(() => {
    // Reactivity dependency
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _v = pgnTreeVersion.value

    const moves: SessionMove[] = []
    let node = pgnService.getRootNode().children[0]

    // Traverse the Main Line (assuming sparring session is linear)
    while (node) {
      const meta = node.metadata || {}

      // Calculate derived fields
      const fenParts = node.fenBefore.split(' ')
      const turn = fenParts[1] as 'w' | 'b'
      const moveNumber = parseInt(fenParts[5] || '1', 10)

      moves.push({
        fen: node.fenAfter,
        moveUci: node.uci,
        san: node.san,
        phase: meta.phase || 'theory',
        stats: meta.stats,
        ply: node.ply,
        turn,
        moveNumber,
        quality: meta.quality,
        nag: meta.nag,
        evaluation: meta.evaluation,
        popularity: meta.popularity,
        winRate: meta.winRate,
      })

      node = node.children[0]
    }
    return moves
  })

  const isTheoryOver = ref(false)
  const isDeviation = ref(false)
  const variability = ref(5)
  const playerColor = ref<'white' | 'black'>('white')
  const openingName = ref('')
  const currentEco = ref('')
  const isLoading = ref(false)
  const isProcessingMove = ref(false)
  const isPlayoutMode = ref(false)
  const isReviewMode = ref(false)
  const reviewMoveIndex = ref(-1)
  const error = ref<string | null>(null)
  const moveQueue = ref<string[]>([])

  const savedSource = localStorage.getItem('openingSparring.opponentSource') as
    | 'master'
    | 'lichess'
    | null
  const opponentSource = ref<'master' | 'lichess'>(savedSource || 'master')

  const savedRatingRange = localStorage.getItem('openingSparring.opponentRatingRange')
  const validRanges = ['1000-1499', '1500-1799', '1800-2200']
  const opponentRatingRange = ref<'1000-1499' | '1500-1799' | '1800-2200'>(
    savedRatingRange && validRanges.includes(savedRatingRange)
      ? (savedRatingRange as '1000-1499' | '1500-1799' | '1800-2200')
      : '1000-1499',
  )

  const savedCharacter = localStorage.getItem('openingSparring.opponentCharacter') as
    | 'none'
    | 'grossmaster'
    | 'hustler'
    | 'schuler'
    | null
  const opponentCharacter = ref<'none' | 'grossmaster' | 'hustler' | 'schuler'>(
    savedCharacter || 'none',
  )

  const savedShowMozerBook = localStorage.getItem('openingSparring.showMozerBook')
  const showMozerBook = ref<boolean>(savedShowMozerBook !== 'false')

  // Persist settings
  watch(
    [opponentSource, opponentRatingRange, opponentCharacter, showMozerBook],
    () => {
      localStorage.setItem('openingSparring.opponentSource', opponentSource.value)
      localStorage.setItem('openingSparring.opponentRatingRange', opponentRatingRange.value)
      localStorage.setItem('openingSparring.opponentCharacter', opponentCharacter.value)
      localStorage.setItem('openingSparring.showMozerBook', String(showMozerBook.value))
      theoryStore.setLichessParams({ ratingRange: opponentRatingRange.value })
    },
    { deep: true, immediate: true },
  )

  // Link UI state to the unified Theory Store
  const currentStats = computed(() => theoryStore.currentMozerStats)
  const currentLichessStats = computed(() => theoryStore.currentLichessStats)
  const isStatsLoading = computed(() => theoryStore.isMozerLoading || theoryStore.isLichessLoading)

  // Final Evaluation state
  const finalEval = ref<{ type: 'cp' | 'mate'; value: number } | null>(null)
  const isFinalEvaluating = ref(false)
  const finalEvalDepth = ref(0)

  const movesCount = computed(() => sessionHistory.value.length)

  const averagePopularity = computed(() => {
    const playerMoves = sessionHistory.value.filter(
      (m) =>
        (m.turn === 'w' && playerColor.value === 'white') ||
        (m.turn === 'b' && playerColor.value === 'black'),
    )
    if (playerMoves.length === 0) return 0
    const sum = playerMoves.reduce((acc, m) => acc + (m.popularity ?? 0), 0)
    return Math.round(sum / playerMoves.length)
  })

  const averageWinRate = computed(() => {
    const playerMoves = sessionHistory.value.filter(
      (m) =>
        (m.turn === 'w' && playerColor.value === 'white') ||
        (m.turn === 'b' && playerColor.value === 'black'),
    )
    if (playerMoves.length === 0) return 0
    const sum = playerMoves.reduce((acc, m) => acc + (m.winRate ?? 0), 0)
    return Math.round(sum / playerMoves.length)
  })

  const isInitializing = ref(false)

  async function startSparringMutation() {
    return apiClient<{ status: string }>('/opening/sparring/start', {
      method: 'POST',
    })
  }

  async function initializeSession(
    color: 'white' | 'black',
    startMoves: string[] = [],
    strategy: IGameplayStrategy,
  ) {
    if (isInitializing.value) {
      console.log('[OpeningSparring] Initialization already in progress, skipping')
      return
    }

    isInitializing.value = true
    try {
      console.log('[OpeningSparring] Initializing session', { color, startMoves })

      try {
        await startSparringMutation()
      } catch (err) {
        const handled = await uiStore.handlePawnCoinsError(
          err,
          () => router.push('/pricing'),
          () => router.push('/'),
        )
        if (handled) return

        logger.error('[OpeningSparring] Failed to start session on backend', err)
        throw err
      }

      reset()
      playerColor.value = color
      isProcessingMove.value = true

      // 1. Manually setup board and history with startMoves BEFORE passing to GameStore
      boardStore.setupPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', color)
      for (const move of startMoves) {
        boardStore.applyUciMove(move)
        const node = pgnService.getLastMove()
        if (node) pgnService.updateNode(node, { metadata: { phase: 'theory' } })
      }

      const sessionStartFen = boardStore.fen

      // Load initial theory stats for the starting position via stable repository call
      await theoryStore.fetchMozerStats(sessionStartFen)

      // 2. Pass control to GameStore Dual-Boot logic
      const gameStore = useGameStore()
      gameStore.startWithStrategy(
        sessionStartFen,
        strategy,
        color,
        true, // keepPgn: true (we just built it)
      )

      await theoryGraphService.loadBook()
    } catch (error) {
      logger.error('[OpeningSparring] Initializing session failed', error)
    } finally {
      isProcessingMove.value = false
      isInitializing.value = false
    }
  }

  function reset() {
    console.log('[OpeningSparring] Resetting session')
    isTheoryOver.value = false
    isDeviation.value = false
    openingName.value = ''
    currentEco.value = ''
    isProcessingMove.value = false
    isPlayoutMode.value = false
    isReviewMode.value = false
    reviewMoveIndex.value = -1
    moveQueue.value = []
    finalEval.value = null
    isFinalEvaluating.value = false
    finalEvalDepth.value = 0
    theoryStore.reset()
  }

  function enterReviewMode() {
    isReviewMode.value = true
    isPlayoutMode.value = false
    reviewMoveIndex.value = sessionHistory.value.length - 1
    const gameStore = useGameStore()
    gameStore.setGamePhase('IDLE')
  }

  function exitReviewMode() {
    isReviewMode.value = false
    reviewMoveIndex.value = -1
  }

  function setReviewMove(index: number) {
    if (index < -1 || index >= sessionHistory.value.length) return

    reviewMoveIndex.value = index

    if (index === -1) {
      pgnService.navigateToStart()
      boardStore.syncBoardWithPgn()
    } else {
      const move = sessionHistory.value[index]
      if (move && move.ply) {
        pgnService.navigateToPly(move.ply)
        boardStore.syncBoardWithPgn()
      }
    }
  }

  function nextReviewMove() {
    if (reviewMoveIndex.value < sessionHistory.value.length - 1) {
      setReviewMove(reviewMoveIndex.value + 1)
    }
  }

  function prevReviewMove() {
    if (reviewMoveIndex.value > -1) {
      setReviewMove(reviewMoveIndex.value - 1)
    }
  }

  // Reactive Name & ECO from Local Graph
  watch(
    () => theoryStore.currentFen,
    (fen) => {
      if (fen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
        openingName.value = t('features.diamondHunter.settings.startPosition')
        currentEco.value = ''
        return
      }

      const node = pgnService.getCurrentNode()
      if (!node || node.ply === 0) return

      const result = theoryGraphService.getOpeningByMove(node.fenBefore, node.uci)
      if (result) {
        if (result.name) openingName.value = result.name
        if (result.eco) currentEco.value = result.eco
      }
    },
    { immediate: true },
  )

  async function runFinalEvaluation() {
    if (isFinalEvaluating.value) return

    const targetDepth = 20
    isFinalEvaluating.value = true
    finalEvalDepth.value = 0
    finalEval.value = null

    await analysisService.initialize()

    const cores = navigator.hardwareConcurrency || 1
    const threads = Math.max(1, Math.min(16, Math.floor(cores / 2)))
    await analysisService.setThreads(threads)

    return new Promise<void>((resolve) => {
      analysisService.startAnalysis(
        boardStore.fen,
        (lines) => {
          if (lines.length > 0) {
            const bestLine = lines[0]!
            finalEvalDepth.value = bestLine.depth

            if (bestLine.depth >= targetDepth || bestLine.score.type === 'mate') {
              finalEval.value = bestLine.score
              analysisService.stopAnalysis()
              isFinalEvaluating.value = false
              resolve()
            }
          }
        },
        1,
      )
    })
  }

  const playerAccuracy = computed(() => {
    const playerMoves = sessionHistory.value.filter(
      (m) =>
        m.phase === 'playout' &&
        ((m.turn === 'w' && playerColor.value === 'white') ||
          (m.turn === 'b' && playerColor.value === 'black')) &&
        m.evaluation?.delta_wp !== undefined,
    )

    if (playerMoves.length === 0) return 0

    let totalWeightedAccuracy = 0
    let totalWeight = 0

    playerMoves.forEach((m) => {
      const wpLoss = Math.abs(m.evaluation!.delta_wp || 0)
      const moveAccuracy = 100 * Math.exp(-0.025 * wpLoss)

      const chaos = m.chaos_index || 0
      const moveWeight = 1.0 + Math.min(chaos, 150) / 100

      totalWeightedAccuracy += moveAccuracy * moveWeight
      totalWeight += moveWeight
    })

    if (totalWeight === 0) return 100

    return Math.round(totalWeightedAccuracy / totalWeight)
  })

  const topInfoDisplay = computed<TopInfoDisplay>(() => {
    const gameStore = useGameStore()
    const phase = isPlayoutMode.value ? 'PLAYOUT' : 'THEORY'

    let opponent = ''
    if (!isPlayoutMode.value) {
      opponent =
        opponentSource.value === 'master' ? 'Masters 2200' : `Lichess ${opponentRatingRange.value}`
    } else {
      opponent = gameStore.botEngineId || 'MAIA-2117'
    }

    const badges = [{ text: 'SPARRING' }, { text: phase }, { text: opponent.toUpperCase() }]

    const stats: TopInfoStat[] = []
    if (!isPlayoutMode.value) {
      stats.push(
        { value: `POPULARITY (${averagePopularity.value}%)`, label: 'POPULARITY' },
        { value: `WIN-RATE (${averageWinRate.value}%)`, label: 'WIN-RATE' },
      )
    } else {
      // Get latest eval
      let evalMove = sessionHistory.value[sessionHistory.value.length - 1]
      if (!evalMove || !evalMove.evaluation) {
        for (let i = sessionHistory.value.length - 2; i >= 0; i--) {
          if (sessionHistory.value[i]?.evaluation) {
            evalMove = sessionHistory.value[i]
            break
          }
        }
      }
      const evaluationValue =
        evalMove && evalMove.evaluation ? (evalMove.evaluation.score_cp / 100).toFixed(1) : '0.0'
      const formattedEval =
        parseFloat(evaluationValue) >= 0 ? `+${evaluationValue}` : evaluationValue

      stats.push(
        { value: `ACCURACY (${playerAccuracy.value}%)`, label: 'ACCURACY' },
        { value: `EVAL (${formattedEval})`, label: 'EVAL' },
      )
    }

    return {
      title: '',
      badges,
      stats,
      customType: 'opening-sparring',
    }
  })

  return {
    currentStats,
    sessionHistory,
    averagePopularity,
    averageWinRate,
    movesCount,
    isTheoryOver,
    isDeviation,
    variability,
    playerColor,
    openingName,
    currentEco,
    isLoading,
    isInitializing,
    isProcessingMove,
    isPlayoutMode,
    error,
    moveQueue,
    finalEval,
    isFinalEvaluating,
    finalEvalDepth,
    opponentSource,
    opponentRatingRange,
    opponentCharacter,
    showMozerBook,
    currentLichessStats,
    isStatsLoading,
    initializeSession,
    runFinalEvaluation,
    topInfoDisplay,
    reset,
    isReviewMode,
    reviewMoveIndex,
    enterReviewMode,
    exitReviewMode,
    setReviewMove,
    nextReviewMove,
    prevReviewMove,
  }
})
