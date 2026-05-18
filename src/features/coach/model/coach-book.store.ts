import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useBoardStore } from '@/entities/game'
import { wikiBooksApiService, WikiUrlBuilder } from '@/shared/api/WikiBooksService'
import { Chess } from 'chess.js'

export interface WikiNode {
  n: number // Name index (-1 if unnamed)
  e: number // ECO index (-1 if no ECO)
  c: Record<string, number> // Children: moveUci -> childNodeId
  p: [number, string] | null // Parent: [parentNodeId, moveUci]
}

export interface WikiGraphJson {
  names: string[]
  ecos: string[]
  root_id: number
  fen_map: Record<string, number>
  nodes: Record<string, WikiNode>
}

export interface ForwardMove {
  uci: string
  san: string
  name: string | null
  eco: string | null
  childId: number
  isNearestDescendant?: boolean
}

export interface WikiInfo {
  nodeId: number
  name: string
  eco: string
  canonicalUciPath: string[]
  canonicalSanPath: string[]
  canonicalSlug: string
  wikibooksUrl: string
  forwardMoves: ForwardMove[]
  wikibooksContent: string | null
}

export const useCoachBookStore = defineStore('coachBook', () => {
  const boardStore = useBoardStore()
  
  const graphLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentWikiInfo = ref<WikiInfo | null>(null)
  const isOutOfBook = ref(false)

  let graphData: WikiGraphJson | null = null
  const JSON_URL = '/openings_full_graph/08_opening_wiki.json'

  // Converts a full FEN into clean 4-part FEN
  function toCleanFen(fen: string): string {
    return fen.split(' ').slice(0, 4).join(' ')
  }

  // Converts a full UCI path of moves to beautiful SAN path using chess.js
  function getSanMovesFromUci(uciMoves: string[]): string[] {
    const chess = new Chess()
    const sanMoves: string[] = []
    for (const uci of uciMoves) {
      try {
        const move = chess.move(uci)
        sanMoves.push(move.san)
      } catch {
        sanMoves.push(uci)
      }
    }
    return sanMoves
  }

  // Translates a single UCI continuation move to SAN
  function getSingleSanFromUci(fen: string, uci: string): string {
    try {
      const chess = new Chess(fen)
      const move = chess.move(uci)
      return move.san
    } catch {
      return uci
    }
  }

  // BFS search to find the nearest downstream named opening variation
  function findNearestDescendantName(startNodeId: number): string | null {
    if (!graphData) return null
    
    const queue: { nodeId: number; depth: number }[] = [{ nodeId: startNodeId, depth: 0 }]
    const maxDepth = 15 // safety limit

    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) continue
      const { nodeId, depth } = item

      if (depth > maxDepth) continue

      const node = graphData.nodes[String(nodeId)]
      if (!node) continue

      // If this is a descendant node and has a valid name, return it!
      if (nodeId !== startNodeId && node.n !== -1) {
        const name = graphData.names[node.n]
        if (name) return name
      }

      // Add children to queue
      if (node.c) {
        for (const childId of Object.values(node.c)) {
          queue.push({ nodeId: childId, depth: depth + 1 })
        }
      }
    }

    return null
  }

  // Load the graph database
  async function loadBook(): Promise<void> {
    if (graphData) return
    const res = await fetch(JSON_URL)
    if (!res.ok) {
      throw new Error(`Failed to load opening wiki graph: ${res.statusText}`)
    }
    graphData = await res.json()
  }

  // Initialize graph
  async function init() {
    if (graphLoaded.value) return
    isLoading.value = true
    try {
      await loadBook()
      graphLoaded.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isLoading.value = false
    }
  }

  // Sync state with board FEN
  async function updateForFen(fen: string) {
    if (!graphLoaded.value) {
      await init()
    }
    if (!graphData) return

    const cleanFen = toCleanFen(fen)
    const nodeId = graphData.fen_map[cleanFen]

    if (nodeId === undefined) {
      // Keep last known currentWikiInfo, but flag as out of book!
      isOutOfBook.value = true
      return
    }

    isOutOfBook.value = false
    isLoading.value = true
    error.value = null

    try {
      const node = graphData.nodes[String(nodeId)]
      if (!node) {
        currentWikiInfo.value = null
        return
      }

      // Resolve name: if node has no name, walk backward to find nearest parent name
      let name = 'Theoretical Variation'
      if (node.n !== -1) {
        name = graphData.names[node.n] ?? 'Theoretical Variation'
      } else {
        let currentId = nodeId
        while (currentId !== 0) {
          const currNode = graphData.nodes[String(currentId)]
          if (!currNode) break
          if (currNode.n !== -1) {
            name = graphData.names[currNode.n] ?? 'Theoretical Variation'
            break
          }
          if (!currNode.p) break
          currentId = currNode.p[0]
        }
      }

      // Resolve ECO: if node has no ECO, walk backward to find nearest parent ECO
      let eco = '-'
      if (node.e !== -1) {
        eco = graphData.ecos[node.e] ?? '-'
      } else {
        let currentId = nodeId
        while (currentId !== 0) {
          const currNode = graphData.nodes[String(currentId)]
          if (!currNode) break
          if (currNode.e !== -1) {
            eco = graphData.ecos[currNode.e] ?? '-'
            break
          }
          if (!currNode.p) break
          currentId = currNode.p[0]
        }
      }

      // 1. Walk backward to construct the canonical path (no transpositions!)
      const pathMoves: string[] = []
      let currentIdPath = nodeId
      while (currentIdPath !== 0) {
        const currNode = graphData.nodes[String(currentIdPath)]
        if (!currNode || !currNode.p) break
        const [parentId, moveUci] = currNode.p
        pathMoves.push(moveUci)
        currentIdPath = parentId
      }
      const canonicalUciPath = pathMoves.reverse()
      const canonicalSanPath = getSanMovesFromUci(canonicalUciPath)
      const canonicalSlug = WikiUrlBuilder.buildSlug(canonicalSanPath)
      const wikibooksUrl = WikiUrlBuilder.getPublicUrl(canonicalSlug)

      // 2. Construct forward moves (theoretical children)
      const forwardMoves: ForwardMove[] = []
      if (node.c) {
        for (const [moveUci, childId] of Object.entries(node.c)) {
          const childNode = graphData.nodes[String(childId)]
          if (childNode) {
            let childName = (childNode.n !== -1 ? graphData.names[childNode.n] : null) ?? null
            const childEco = (childNode.e !== -1 ? graphData.ecos[childNode.e] : null) ?? null
            let isNearestDescendant = false

            // If the node itself has no name, search BFS downstream
            if (!childName) {
              const nearestName = findNearestDescendantName(childId)
              if (nearestName) {
                childName = nearestName
                isNearestDescendant = true
              }
            }

            const childSan = getSingleSanFromUci(fen, moveUci)
            forwardMoves.push({
              uci: moveUci,
              san: childSan,
              name: childName,
              eco: childEco,
              childId,
              isNearestDescendant
            })
          }
        }
      }

      // 3. Fetch Wikibooks summary with fallback resolution
      const extract = await wikiBooksApiService.fetchWithFallback(canonicalSanPath)

      currentWikiInfo.value = {
        nodeId,
        name,
        eco,
        canonicalUciPath,
        canonicalSanPath,
        canonicalSlug,
        wikibooksUrl,
        forwardMoves,
        wikibooksContent: extract ? extract.extract : null
      }
    } catch (err) {
      console.error('[CoachBookStore] Update error:', err)
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      isLoading.value = false
    }
  }

  // Auto-sync when board position updates
  watch(
    () => boardStore.fen,
    async (newFen) => {
      await updateForFen(newFen)
    },
    { immediate: true }
  )

  return {
    graphLoaded,
    isLoading,
    error,
    currentWikiInfo,
    isOutOfBook,
    init,
    updateForFen
  }
})
