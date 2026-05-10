import { useAnalysisEngineStore } from '@/entities/analysis'
import { useBoardStore, useGameStore, type IGameplayStrategy } from '@/entities/game'
import { type TopInfoDisplay, type TopInfoStat } from '@/entities/puzzle'
import i18n from '@/shared/config/i18n'
import logger from '@/shared/lib/logger'
import { pgnService } from '@/shared/lib/pgn/PgnService'
import type { SoundEvent } from '@/shared/lib/sound.service'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/shared/ui/model/ui.store'
import {
    diamondApiService,
    type GravityMove,
} from '../api/DiamondApiService'
import { useDiamondHunterQueries } from '../api/diamondHunter.queries'

export type HunterState = 'IDLE' | 'HUNTING' | 'SOLVING' | 'REWARD' | 'FAILED' | 'SAVING'

export interface HunterHint {
  orig: string
  dest?: string
  type: 'arrow' | 'blunder' | 'victory' | 'correct' | 'expected'
  dist?: number
}

export const useDiamondHunterStore = defineStore('diamondHunter', () => {
  const boardStore = useBoardStore()
  const gameStore = useGameStore()
  const analysisStore = useAnalysisEngineStore()
  const uiStore = useUiStore()
  const router = useRouter()

  const state = ref<HunterState>('IDLE')
  const isActive = computed(() => state.value !== 'IDLE')
  const isSolving = computed(() => state.value === 'SOLVING')

  const currentDiamondHash = ref<string | null>(null)
  const currentBlunderMove = ref<GravityMove | null>(null)
  const message = ref<string>('')
  const isProcessing = ref(false)
  const showTheoryEndModal = ref(false)

  // UI Hints state
  const hints = ref<HunterHint[]>([])
  const soundTrigger = ref<SoundEvent | null>(null)

  // Saving Mode State
  const savingPgn = ref<string | null>(null)
  const savingMoves = ref<string[]>([])
  const savingMoveIndex = ref(0)

  const isReplayActive = ref(false)

  const {
    diamondsCountQuery,
    brilliantsCountQuery,
    recordBrilliantMutation,
    recordDiamondMutation,
    removeBrilliantMutation,
    checkDiamondLimit,
    fetchGravityForFen: fetchGravityQuery,
  } = useDiamondHunterQueries()

  // Current Gravity Stats (To validate moves)
  const currentGravityStats = ref<{ moves: GravityMove[] } | null>(null)

  // Tracks the FEN of the position the user is currently trying to SOLVE.
  const puzzleFen = ref<string>('')

  // Stats
  const totalDiamonds = computed(() => diamondsCountQuery.data?.value ?? 0)
  const totalBrilliants = computed(() => brilliantsCountQuery.data?.value ?? 0)

  async function fetchGravityForFen(fen: string) {
    const playerColor = analysisStore.playerColor
    if (!playerColor) return null

    const response = await fetchGravityQuery(playerColor, fen)
    currentGravityStats.value = response
    return response
  }

  async function startHunt(): Promise<boolean> {
    logger.info('DiamondHunter: Starting hunt')
    reset()

    try {
      await diamondApiService.startSession()
    } catch (e: unknown) {
      const handled = await uiStore.handlePawnCoinsError(
        e,
        () => router.push('/pricing'),
        () => router.push('/'),
      )
      if (!handled) {
        message.value = 'Failed to start Diamond Hunter session.'
      }
      return false
    }

    state.value = 'HUNTING'
    message.value = 'Hunt started! Follow the arrows...'
    return true
  }

  // --- Reactive UI Sync ---
  watch([() => boardStore.fen, state], async ([, newState], [, oldState]) => {
    if (newState === 'HUNTING') {
      await updateArrows()
    } else if (newState === 'IDLE' && oldState !== 'IDLE') {
      boardStore.setDrawableShapes([])
      hints.value = []
    }
  })

  function reset() {
    state.value = 'IDLE'
    hints.value = []
    soundTrigger.value = null
    message.value = ''
    currentGravityStats.value = null
    showTheoryEndModal.value = false
    currentDiamondHash.value = null
    currentBlunderMove.value = null
    isProcessing.value = false
    savingPgn.value = null
    savingMoves.value = []
    savingMoveIndex.value = 0
    isReplayActive.value = false
  }

  function stopHunt() {
    logger.info('DiamondHunter: Stopping hunt')
    reset()
  }

  // --- Arrow Logic (User Turn) ---
  async function updateArrows() {
    if (state.value === 'SOLVING' || state.value === 'SAVING') return

    const playerColor = analysisStore.playerColor || 'white'
    const fen = boardStore.fen

    const response = await fetchGravityForFen(fen)

    if (state.value !== 'HUNTING' || boardStore.turn !== playerColor) {
      boardStore.setDrawableShapes([])
      return
    }

    if (!response || !response.moves || response.moves.length === 0) {
      if (state.value === 'HUNTING') {
        logger.info('DiamondHunter: Theory ended (User turn)')
        showTheoryEndModal.value = true
        state.value = 'IDLE'
      }
      return
    }

    const sortedMoves = [...response.moves].sort((a, b) => b.weight - a.weight)
    const topMoves = sortedMoves.slice(0, 3)

    hints.value = topMoves.map((move) => ({
      orig: move.uci.substring(0, 2),
      dest: move.uci.substring(2, 4),
      type: 'arrow',
      dist: move.dist,
    }))
  }

  // --- Solving Logic ---
  async function handleUserSolvingMove(uci: string) {
    if (state.value !== 'SOLVING') return

    const lastNode = pgnService.getLastMove()
    if (!lastNode) return

    const response = await fetchGravityForFen(lastNode.fenBefore)
    const moveStats = response?.moves.find((m: GravityMove) => m.uci === uci)

    if (moveStats?.nag === 3) {
      logger.info('DiamondHunter: Brilliant recorded')
      if (currentDiamondHash.value) {
        recordBrilliantMutation.mutate({
          hash: currentDiamondHash.value,
          fen: boardStore.fen,
          pgn: pgnService.getCurrentPgnString(),
        })
      }

      const orig = uci.substring(0, 2)
      const dest = uci.substring(2, 4)
      hints.value = [{ orig, dest, type: 'correct' }]
      puzzleFen.value = boardStore.fen
      message.value = 'Brilliant! Keep punishing!'

    } else if (moveStats?.nag === 255) {
      logger.info('DiamondHunter: Punishment successful (Diamond Found)')
      const orig = uci.substring(0, 2)
      const dest = uci.substring(2, 4)

      hints.value = [{ orig, dest, type: 'victory' }]
      message.value = 'VICTORY !!!'

      setTimeout(() => {
        completeDiamond()
      }, 1000)
    }
  }

  function createStrategy(): IGameplayStrategy {
    return {
      config: {
        botDelayMs: 20,
        initialBotDelayMs: 300,
      },

      async validateUserMove(uci: string): Promise<boolean> {
        if (state.value === 'HUNTING') {
          const stats = currentGravityStats.value
          const isValid = stats?.moves.some((m) => m.uci === uci)

          if (!isValid) {
            logger.warn('DiamondHunter: User left theory during hunt. Move blocked.', { uci })
            soundTrigger.value = 'game_tacktics_error'
            message.value = 'Stay in theory! Follow the arrows.'
            // Small delay to ensure GameStore.handleUserMove -> boardStore.syncBoardWithPgn()
            // has finished its cleanup before we redraw arrows.
            setTimeout(() => {
              updateArrows()
            }, 50)
            return false
          }
          return true
        }

        if (state.value === 'SOLVING') {
          const validationFen = boardStore.fen
          const response = await fetchGravityForFen(validationFen)
          const moveStats = response?.moves.find((m: GravityMove) => m.uci === uci)
          const isCorrect = moveStats?.nag === 255 || moveStats?.nag === 3

          if (!isCorrect) {
            logger.warn('DiamondHunter: Incorrect refutation attempt blocked.', { uci })
            soundTrigger.value = 'game_tacktics_error'
            message.value = 'Incorrect! That is not the punishment.'
            return false
          }
          return true
        }

        if (state.value === 'SAVING') {
          const expectedMove = savingMoves.value[savingMoveIndex.value]
          if (!expectedMove) return false

          if (uci !== expectedMove) {
            logger.warn('DiamondHunter: Memory error during saving.', { uci, expected: expectedMove })
            soundTrigger.value = 'game_tacktics_error'
            message.value = 'Memory error! Observe the path.'
            const orig = expectedMove.substring(0, 2)
            const dest = expectedMove.substring(2, 4)

            // Penalty: remove one brilliant if available
            if (totalBrilliants.value > 0) {
              logger.info('DiamondHunter: Applying penalty for memory error (-1 Brilliant)')
              removeBrilliantMutation.mutate()
            }

            // Small delay to show hint AFTER boardStore.syncBoardWithPgn()
            setTimeout(() => {
              hints.value = [{ orig, dest, type: 'expected' }]
            }, 50)

            // Auto-clear helper arrow after bit of time
            setTimeout(() => {
              if (state.value === 'SAVING') hints.value = []
            }, 2000)
            return false
          }
          return true
        }
        return true
      },

      async onUserMoveExecuted(uciMove: string) {
        if (state.value === 'SOLVING') {
          await handleUserSolvingMove(uciMove)
        } else if (state.value === 'SAVING') {
          savingMoveIndex.value++
          const orig = uciMove.substring(0, 2)
          const dest = uciMove.substring(2, 4)
          hints.value = [{ orig, dest, type: 'correct' }]
          if (savingMoveIndex.value >= savingMoves.value.length) {
            await transitionToSolving()
          }
        }
      },

      async requestBotMove(fen: string): Promise<string | null> {
        if (state.value === 'SAVING') {
          if (savingMoveIndex.value >= savingMoves.value.length) return null
          return savingMoves.value[savingMoveIndex.value] || null
        }

        if (state.value === 'SOLVING') {
          const response = await fetchGravityForFen(fen)
          if (!response || !response.moves || response.moves.length === 0) return null
          const forced = response.moves.find((m) => m.nag === 7 || m.nag === 4) || response.moves[0]
          return forced?.uci || null
        }

        if (state.value !== 'HUNTING') return null

        const playerColor = analysisStore.playerColor || 'white'
        if (boardStore.turn === playerColor) return null

        const response = await fetchGravityForFen(fen)
        if (!response || !response.moves || response.moves.length === 0) {
          logger.info('DiamondHunter: Theory ended (Bot turn)')
          showTheoryEndModal.value = true
          state.value = 'IDLE'
          return null
        }

        const candidates = [...response.moves].sort((a, b) => b.weight - a.weight).slice(0, 5)
        let selectedMove: GravityMove | undefined = candidates[0]
        if (candidates.length > 0) {
          const totalWeight = candidates.reduce((sum, m) => sum + m.weight, 0)
          let randomValue = Math.random() * totalWeight
          for (const move of candidates) {
            randomValue -= move.weight
            if (randomValue <= 0) {
              selectedMove = move
              break
            }
          }
        }
        return selectedMove?.uci || null
      },

      async onBotMoveExecuted(uci: string) {
        if (state.value === 'SAVING') {
          savingMoveIndex.value++
          if (savingMoveIndex.value >= savingMoves.value.length) {
            await transitionToSolving()
          }
          return
        }

        if (state.value === 'HUNTING') {
          const stats = currentGravityStats.value
          const moveData = stats?.moves.find((m) => m.uci === uci)
          if (moveData?.nag === 4) {
            await playBlunder(moveData)
          }
        }
      },

      checkWinCondition: () => false,
    }
  }

  async function playBlunder(move: GravityMove) {
    currentDiamondHash.value = boardStore.fen
    currentBlunderMove.value = move
    const blunderNode = pgnService.getCurrentNode()
    if (blunderNode) {
      pgnService.updateNode(blunderNode, { nag: 4 })
    }
    puzzleFen.value = boardStore.fen
    
    // Pre-fetch gravity moves to make the first user move validation instant
    fetchGravityForFen(boardStore.fen)

    state.value = 'SOLVING'
    message.value = 'Tactics available! Punishment time!'
    const dest = move.uci.substring(2, 4)
    hints.value = [{ orig: dest, type: 'blunder' }]
    soundTrigger.value = 'blunder'
    setTimeout(() => {
      if (state.value === 'SOLVING') {
        hints.value = []
      }
    }, 2000)
  }

  async function completeDiamond() {
    if (!currentDiamondHash.value) return
    if (isReplayActive.value) {
      const allowed = await checkDiamondLimit(currentDiamondHash.value)
      if (allowed) {
        message.value = 'Diamond Secured! 💎'
        soundTrigger.value = 'game_user_won'
        const finalPgn = pgnService.getCurrentPgnString()
        await recordDiamondMutation.mutateAsync({
          hash: currentDiamondHash.value,
          fen: boardStore.fen,
          pgn: finalPgn,
        })
      } else {
        message.value = 'Limit reached, but great memory!'
      }
      state.value = 'REWARD'
      isReplayActive.value = false
      savingMoves.value = []
      return
    }

    const node = pgnService.getCurrentNode()
    let blunderNodeFound = false
    let curr = node
    while (curr && curr.parent) {
      if (curr.nag === 4) {
        blunderNodeFound = true
        break
      }
      curr = curr.parent
    }

    if (blunderNodeFound && curr) {
      let tracer = curr
      const pathFromRoot: string[] = []
      while (tracer && tracer.parent) {
        pathFromRoot.unshift(tracer.uci)
        tracer = tracer.parent
      }
      savingMoves.value = pathFromRoot
    } else {
      const fullPath: string[] = []
      let n = pgnService.getCurrentNode()
      while (n && n.parent) {
        fullPath.unshift(n.uci)
        n = n.parent
      }
      savingMoves.value = fullPath
    }
    savingPgn.value = pgnService.getCurrentPgnString()
    state.value = 'REWARD'
    message.value = 'Diamond Found! 💎'
    soundTrigger.value = 'game_user_won'
  }

  async function startSaveRun() {
    logger.info('DiamondHunter: Starting Save Run')
    state.value = 'SAVING'
    isReplayActive.value = true
    savingMoveIndex.value = 0
    const color = analysisStore.playerColor || 'white'

    const strategy = createStrategy()
    const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

    gameStore.startWithStrategy(STARTING_FEN, strategy, color, false)
    hints.value = []
  }

  async function transitionToSolving() {
    state.value = 'SOLVING'
    message.value = 'Punish the blunder again!'
    puzzleFen.value = boardStore.fen
    const lastNode = pgnService.getCurrentNode()
    if (lastNode && lastNode.parent) {
      currentDiamondHash.value = lastNode.fenBefore
      currentBlunderMove.value = {
        uci: lastNode.uci,
        san: lastNode.san,
        nag: 4,
        weight: 0,
        dist: 0,
        rating: 0,
        nag_str: 'Blunder',
      }
    }
    const lastMove = boardStore.lastMove
    if (lastMove) {
      hints.value = [{ orig: lastMove[0], dest: lastMove[1], type: 'blunder' }]
    }
    soundTrigger.value = 'blunder'
  }

  function closeTheoryModal() {
    showTheoryEndModal.value = false
  }

  function clearSoundTrigger() {
    soundTrigger.value = null
  }

  const t = i18n.global.t

  return {
    state,
    topInfoDisplay: computed<TopInfoDisplay>(() => {
      const stats: TopInfoStat[] = [
        { icon: 'diamond', value: totalDiamonds.value, color: '#9C27B0', label: 'Diamonds' },
        { icon: 'flash', value: totalBrilliants.value, color: '#00C853', label: 'Brilliants' },
      ]

      let title = t('features.diamondHunter.status.idle')
      if (state.value === 'HUNTING') title = t('features.diamondHunter.status.hunting')
      else if (state.value === 'SOLVING') title = t('features.diamondHunter.status.punish')
      else if (state.value === 'SAVING') title = t('features.diamondHunter.status.secure')
      else if (state.value === 'REWARD') title = t('features.diamondHunter.status.found')

      return {
        title,
        badges: [],
        stats,
        isPulsating: gameStore.gamePhase === 'PLAYING' || gameStore.gamePhase === 'LOADING',
        customType: 'diamond-hunter',
      }
    }),
    isActive,
    isSolving,
    message,
    totalDiamonds,
    totalBrilliants,
    currentGravityStats,
    hints,
    soundTrigger,
    clearSoundTrigger,
    savingPgn,
    savingMoves,
    createStrategy,
    startHunt,
    stopHunt,
    updateArrows,
    completeDiamond,
    handleUserSolvingMove,
    startSaveRun,
    fetchGravityForFen,
    showTheoryEndModal,
    closeTheoryModal,
    reset,
  }
})
