import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useAuthStore } from '@/entities/user'
import { studyDb, type OpenCheckAnalysis } from '@/entities/study'
import { apiClient } from '@/shared/api/client'
import logger from '@/shared/lib/logger'
import { formatToPgn } from '../lib/chess-utils'
import type { OpenCheckTreeNode } from './types'

export interface DownloadedGame {
  id: string
  white: string
  black: string
  result: string
  white_elo: number
  black_elo: number
  moves: string
  firstMoveSan: string
  validatedMoves: string[]
}

export const useOpenCheckStore = defineStore('open-check', () => {
  const authStore = useAuthStore()

  // --- STATE ---
  const isLoading = ref(false)
  const isAnalyzing = ref(false)
  const error = ref<string | null>(null)

  // Options form state
  const targetUsername = ref('')
  const userColor = ref<'white' | 'black'>('white')
  const maxDepth = ref(10) // default setting (ply depth 10)
  const gamesCount = ref(100) // default number of games to analyze
  const perfTypes = ref<string[]>(['bullet', 'blitz', 'rapid', 'classical'])

  // Temporary list of games mapped from local cache for active analysis
  const downloadedGames = ref<DownloadedGame[]>([])

  // Active analysis results
  const currentAnalysis = ref<OpenCheckAnalysis | null>(null)
  const analysesHistory = ref<OpenCheckAnalysis[]>([])

  // Selected node info in the tree
  const activeNode = ref<OpenCheckTreeNode | null>(null)
  
  // Board / Move history navigation stack
  const historyFen = ref<string[]>([])
  const currentFenIndex = ref<number>(-1)

  // --- GETTERS ---
  const isPremium = computed(() => {
    const tier = authStore.userProfile?.subscriptionTier?.toLowerCase() || 'pawn'
    return ['rook', 'queen', 'king', 'administrator'].includes(tier)
  })

  // Enforced limits for form defaults
  const allowedColors = computed(() => {
    return isPremium.value ? ['white', 'black'] : ['white']
  })

  const allowedDepthRange = computed(() => {
    return isPremium.value ? { min: 10, max: 30, step: 5 } : { min: 10, max: 10, step: 5 }
  })

  const allowedGamesCountRange = computed(() => {
    return isPremium.value ? { min: 100, max: 1000, step: 100 } : { min: 100, max: 100, step: 100 }
  })

  const currentBoardFen = computed(() => {
    if (historyFen.value.length === 0 || currentFenIndex.value < 0) {
      return 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    }
    return historyFen.value[currentFenIndex.value]
  })

  // Computed root moves statistics from downloaded games
  const rootMoveStats = computed(() => {
    const counts: Record<string, number> = {}
    for (const g of downloadedGames.value) {
      if (g.firstMoveSan) {
        counts[g.firstMoveSan] = (counts[g.firstMoveSan] || 0) + 1
      }
    }
    
    return Object.entries(counts)
      .map(([move, count]) => {
        const displayLabel = move.startsWith('1.') ? move : `1. ${move}`
        return {
          label: `${displayLabel} - ${count} game${count > 1 ? 's' : ''}`,
          value: move,
          count,
        }
      })
      .sort((a, b) => b.count - a.count)
  })

  // --- ACTIONS ---

  async function loadHistory() {
    isLoading.value = true
    try {
      const records = await studyDb.open_check_analyses.toArray()
      // sort by timestamp desc
      analysesHistory.value = records.sort((a, b) => b.timestamp - a.timestamp)
    } catch (err: unknown) {
      logger.error('[OpenCheckStore] Failed to load analyses history:', err)
      error.value = 'Failed to load analysis history.'
    } finally {
      isLoading.value = false
    }
  }

  async function deleteAnalysis(id: string) {
    try {
      await studyDb.open_check_analyses.delete(id)
      if (currentAnalysis.value?.id === id) {
        currentAnalysis.value = null
        activeNode.value = null
        historyFen.value = []
        currentFenIndex.value = -1
      }
      await loadHistory()
    } catch (err: unknown) {
      logger.error('[OpenCheckStore] Failed to delete analysis:', err)
      error.value = 'Failed to delete analysis.'
    }
  }

  async function selectAnalysis(analysis: OpenCheckAnalysis) {
    currentAnalysis.value = analysis
    const tree = analysis.tree as OpenCheckTreeNode
    activeNode.value = tree
    historyFen.value = [tree.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
    currentFenIndex.value = 0
  }

  function setBoardPosition(fen: string, node: OpenCheckTreeNode) {
    activeNode.value = node
    
    const index = historyFen.value.indexOf(fen)
    if (index !== -1) {
      currentFenIndex.value = index
    } else {
      historyFen.value = historyFen.value.slice(0, currentFenIndex.value + 1)
      historyFen.value.push(fen)
      currentFenIndex.value = historyFen.value.length - 1
    }
  }

  function navigateHistory(direction: 'back' | 'forward' | 'start' | 'end') {
    if (historyFen.value.length === 0) return

    if (direction === 'start') {
      currentFenIndex.value = 0
    } else if (direction === 'end') {
      currentFenIndex.value = historyFen.value.length - 1
    } else if (direction === 'back' && currentFenIndex.value > 0) {
      currentFenIndex.value--
    } else if (direction === 'forward' && currentFenIndex.value < historyFen.value.length - 1) {
      currentFenIndex.value++
    }

    const targetFen = historyFen.value[currentFenIndex.value]
    if (targetFen && currentAnalysis.value?.tree) {
      const found = findNodeByFen(currentAnalysis.value.tree as OpenCheckTreeNode, targetFen)
      if (found) {
        activeNode.value = found
      }
    }
  }

  function findNodeByFen(root: OpenCheckTreeNode, fen: string): OpenCheckTreeNode | null {
    const norm = (f: string) => f.split(' ').slice(0, 4).join(' ')
    if (root.fen && norm(root.fen) === norm(fen)) {
      return root
    }
    // Check user_moves
    if (root.user_moves) {
      for (const child of root.user_moves) {
        const found = findNodeByFen(child, fen)
        if (found) return found
      }
    }
    // Check opponent_moves
    if (root.opponent_moves) {
      for (const child of Object.values(root.opponent_moves)) {
        const found = findNodeByFen(child, fen)
        if (found) return found
      }
    }
    return null
  }

  // Filter, slice, clean, and send games to backend for analysis
  async function runAnalysis(selectedRootMove: string) {
    isAnalyzing.value = true
    error.value = null

    const finalColor = isPremium.value ? userColor.value : 'white'
    const finalDepth = isPremium.value ? maxDepth.value : 10
    const finalGamesCount = isPremium.value ? gamesCount.value : 100

    if (downloadedGames.value.length === 0) {
      error.value = 'No games selected for analysis.'
      isAnalyzing.value = false
      return
    }

    try {
      // 1. Filter games matching selected root move
      const matchingGames = downloadedGames.value
        .filter((g) => g.firstMoveSan.toLowerCase() === selectedRootMove.toLowerCase())
        .slice(0, finalGamesCount)

      logger.info(`[OpenCheckStore] Selected ${matchingGames.length} games for root move "${selectedRootMove}"`)

      if (matchingGames.length === 0) {
        throw new Error(`No games matching starting move "${selectedRootMove}" were found.`)
      }

      // 2. Clean and truncate UCI moves to SAN string to max ply
      const finalMaxPly = finalColor === 'white' ? finalDepth - 1 : finalDepth

      const cleanGames = matchingGames.map((g) => {
        const truncatedMoves = g.validatedMoves.slice(0, finalMaxPly)
        return {
          id: g.id,
          white: g.white,
          black: g.black,
          result: g.result,
          white_elo: g.white_elo,
          black_elo: g.black_elo,
          pgn: formatToPgn(truncatedMoves),
        }
      })

      // 3. Call backend /opening/open-check
      logger.info(`[OpenCheckStore] Sending clean payload to Chess Theory backend for repertoire analysis...`)

      const payload = {
        user: targetUsername.value.trim(),
        user_color: finalColor,
        root_move: selectedRootMove,
        max_ply: finalMaxPly,
        games: cleanGames,
      }

      const treeResult = await apiClient<OpenCheckTreeNode>('/opening/open-check', {
        method: 'POST',
        body: JSON.stringify(payload),
      })

      logger.info(`[OpenCheckStore] Backend analysis completed successfully.`)

      // 4. Construct and save the analysis entity in local IndexedDB
      const displayRootMove = selectedRootMove.startsWith('1.') ? selectedRootMove : `1. ${selectedRootMove}`
      const analysis: OpenCheckAnalysis = {
        id: `${targetUsername.value.trim()}:${finalColor}:${Date.now()}`,
        username: targetUsername.value.trim(),
        color: finalColor,
        timestamp: Date.now(),
        maxDepth: finalDepth,
        gamesCount: finalGamesCount,
        perfTypes: isPremium.value ? perfTypes.value : ['blitz', 'rapid', 'classical'],
        tree: treeResult,
        rootFen: treeResult.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        rootMove: displayRootMove,
      }

      await studyDb.open_check_analyses.put(JSON.parse(JSON.stringify(analysis)))
      await loadHistory()

      // Set active
      currentAnalysis.value = analysis
      const tree = treeResult
      activeNode.value = tree
      historyFen.value = [tree.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1']
      currentFenIndex.value = 0

    } catch (err: unknown) {
      logger.error('[OpenCheckStore] Analysis failed:', err)
      const errMsg = err instanceof Error ? err.message : 'An error occurred during analysis.'
      error.value = errMsg
    } finally {
      isAnalyzing.value = false
    }
  }

  return {
    // State
    isLoading,
    isAnalyzing,
    error,
    targetUsername,
    userColor,
    maxDepth,
    gamesCount,
    perfTypes,
    downloadedGames,
    currentAnalysis,
    analysesHistory,
    activeNode,
    historyFen,
    currentFenIndex,
    
    // Getters
    isPremium,
    allowedColors,
    allowedDepthRange,
    allowedGamesCountRange,
    currentBoardFen,
    rootMoveStats,

    // Actions
    loadHistory,
    deleteAnalysis,
    selectAnalysis,
    setBoardPosition,
    navigateHistory,
    runAnalysis,
  }
})
