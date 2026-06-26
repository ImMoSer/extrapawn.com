<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import {
  NCard,
  NTag,
  NGrid,
  NGi,
  NStatistic,
  NSwitch
} from 'naive-ui'
import rawPositions from '../../../../tests/open_flow/open_flow_test.json'
import { WebChessBoard, PgnTree, useBoardStore } from '@/entities/game'
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { pgnParserService } from '@/shared/lib/pgn/PgnParserService'
import type { Key } from '@lichess-org/chessground/types'
import type { DrawShape } from '@lichess-org/chessground/draw'

interface CoachMove {
  san: string
  uci: string
  coachFlow: boolean
}

interface CriticalPosition {
  fen: string
  root: string
  wiki_name?: string
  "games count": number
  coach_check: CoachMove[]
}

const positions = ref<CriticalPosition[]>(rawPositions as unknown as CriticalPosition[])
const boardStore = useBoardStore()

// Clean annotations from SAN
function cleanSan(san: string): string {
  return san.replace(/[!?#□\s+]/g, '')
}

// Helper to construct child roots for prefix searching
function getChildPrefix(root: string, whiteSan: string): string {
  const cleanWhite = cleanSan(whiteSan)
  if (!root) {
    return `1. ${cleanWhite} `
  }
  const moveCount = (root.match(/\./g) || []).length
  const nextMoveNum = moveCount + 1
  return `${root} ${nextMoveNum}. ${cleanWhite} `
}

function getMoveNumber(root: string): number {
  const parts = root.split(/\s+/).filter(Boolean)
  const moveTokens = parts.filter(p => !p.endsWith('.'))
  return Math.floor(moveTokens.length / 2) + 1
}

// Get current SAN path of a node in PgnTree
function getSanPath(node: PgnNode): string {
  const pathParts: string[] = []
  let curr = node
  while (curr && curr.id !== '__ROOT__') {
    pathParts.unshift(curr.san)
    curr = curr.parent!
  }
  let formatted = ''
  for (let i = 0; i < pathParts.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const white = pathParts[i]
    const black = pathParts[i + 1]
    formatted += `${moveNum}. ${white}`
    if (black) {
      formatted += ` ${black}`
    }
    if (i + 2 < pathParts.length) {
      formatted += ' '
    }
  }
  return formatted
}

// Recursive PGN String Builder based on active coachFlow choices
function generatePgnString(root: string): string {
  const pos = positions.value.find(p => p.root === root)
  if (!pos) return ''
  
  const activeMoves = pos.coach_check.filter(m => m.coachFlow)
  if (activeMoves.length === 0) return ''
  
  const pgnParts: string[] = []
  
  activeMoves.forEach((move, idx) => {
    const prefix = getChildPrefix(root, move.san)
    const childPositions = positions.value.filter(p => p.root.startsWith(prefix))
    const moveNum = getMoveNumber(root)
    
    let moveStr = `${moveNum}. ${move.san}`
    
    if (childPositions.length > 0) {
      const blackRepliesParts: string[] = []
      
      childPositions.forEach((childPos, childIdx) => {
        const blackMove = childPos.root.slice(prefix.length).trim()
        const whiteFollowUps = generatePgnString(childPos.root)
        
        let blackBranchStr = ''
        if (childIdx > 0) {
          blackBranchStr = `${moveNum}... ${blackMove}`
        } else {
          blackBranchStr = `${blackMove}`
        }
        
        if (whiteFollowUps) {
          blackBranchStr += ` ${whiteFollowUps}`
        }
        blackRepliesParts.push(blackBranchStr)
      })
      
      if (blackRepliesParts.length === 1) {
        moveStr += ` ${blackRepliesParts[0]}`
      } else {
        const mainLine = blackRepliesParts[0]
        const variations = blackRepliesParts.slice(1).map(v => `(${v})`).join(' ')
        moveStr += ` ${mainLine} ${variations}`
      }
    }
    
    if (idx === 0) {
      pgnParts.push(moveStr)
    } else {
      pgnParts.push(`(${moveStr})`)
    }
  })
  
  return pgnParts.join(' ')
}

// Selected Node in PGN Tree (reactive via pgnTreeVersion)
const selectedPgnNode = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getCurrentNode()
})

// Watch selected node and update FEN
watch(selectedPgnNode, (node) => {
  if (!node) return
  boardStore.loadPosition(node.fenAfter)
})

// Active & Inactive moves shown as arrows on board
const drawableShapes = computed<DrawShape[]>(() => {
  const node = selectedPgnNode.value
  if (!node) return []
  
  const isWhiteMove = node.ply % 2 !== 0 && node.id !== '__ROOT__'
  
  let pos: CriticalPosition | undefined
  let selectedSan = ''
  
  if (isWhiteMove) {
    const parentPath = node.parent ? getSanPath(node.parent) : ''
    pos = positions.value.find(p => p.root === parentPath)
    selectedSan = node.san
  } else {
    const path = getSanPath(node)
    pos = positions.value.find(p => p.root === path)
  }
  
  if (!pos) return []
  
  return pos.coach_check.map(m => {
    const orig = m.uci.slice(0, 2) as Key
    const dest = m.uci.slice(2, 4) as Key
    
    const isThisSelected = isWhiteMove && cleanSan(selectedSan) === cleanSan(m.san)
    const brush = isThisSelected ? 'blue' : (m.coachFlow ? 'green' : 'red')
    return { orig, dest, brush }
  })
})

// Selected Position / Move data for HUD Details
const hudData = computed(() => {
  const node = selectedPgnNode.value
  if (!node) return null
  
  const isWhiteMove = node.ply % 2 !== 0 && node.id !== '__ROOT__'
  
  if (isWhiteMove) {
    // Find parent position to get context
    const parentPath = node.parent ? getSanPath(node.parent) : ''
    const pos = positions.value.find(p => p.root === parentPath)
    const move = pos?.coach_check.find(m => cleanSan(m.san) === cleanSan(node.san))
    return {
      type: 'white-choice' as const,
      san: node.san,
      root: parentPath,
      wiki_name: pos?.wiki_name,
      games_count: pos?.['games count'],
      move: move,
      pos: pos
    }
  } else {
    // Position where it is White's turn (after Black's move)
    const path = getSanPath(node)
    const pos = positions.value.find(p => p.root === path)
    return {
      type: 'black-reply' as const,
      san: node.san,
      root: path,
      wiki_name: pos?.wiki_name,
      games_count: pos?.['games count'],
      pos: pos
    }
  }
})

// Total active positions count
const activePositionsCount = computed(() => {
  return positions.value.filter(pos => pos.coach_check.some(m => m.coachFlow)).length
})

// Total recommendations count
const totalRecommendationsCount = computed(() => {
  let count = 0
  positions.value.forEach(pos => {
    count += pos.coach_check.filter(m => m.coachFlow).length
  })
  return count
})

// Re-generate and load PGN tree
function reloadTree() {
  const currentPath = selectedPgnNode.value ? getSanPath(selectedPgnNode.value) : ''
  const pgnStr = generatePgnString("")
  const parsed = pgnParserService.parse(pgnStr)
  if (parsed) {
    pgnService.setRoot(parsed.root)
    if (currentPath) {
      // Try to navigate back to the same node
      let curr = pgnService.getRootNode()
      const moves = currentPath.replace(/\d+\./g, '').split(/\s+/).filter(Boolean)
      for (const move of moves) {
        const child = curr.children.find(c => cleanSan(c.san) === cleanSan(move))
        if (child) {
          curr = child
        } else {
          break
        }
      }
      pgnService.navigateToNode(curr)
    }
  }
}

// Toggle single White move coachFlow
function toggleMoveFlow(pos: CriticalPosition, move: CoachMove, value: boolean) {
  move.coachFlow = value
  reloadTree()
}

function toggleHudMoveFlow(value: boolean) {
  const data = hudData.value
  if (data && data.type === 'white-choice' && data.pos && data.move) {
    toggleMoveFlow(data.pos, data.move, value)
  }
}

function toggleHudSubMoveFlow(move: CoachMove, value: boolean) {
  const data = hudData.value
  if (data && data.type === 'black-reply' && data.pos) {
    toggleMoveFlow(data.pos, move, value)
  }
}

// Reset toggles to recommendation defaults
function resetToggles() {
  positions.value.forEach(pos => {
    pos.coach_check.forEach(move => {
      const isRecommended = move.san.endsWith('!') || move.san.endsWith('!!')
      move.coachFlow = isRecommended
    })
  })
  reloadTree()
}

onMounted(() => {
  reloadTree()
})
</script>

<template>
  <div class="open-flow-container p-6 bg-[#030307] min-h-screen text-[#e2e8f0]">
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- Page Header -->
      <div class="flex justify-between items-center border-b border-cyan-500/20 pb-4">
        <div>
          <h1 class="text-2xl font-bold tracking-wider font-orbitron text-white glow-text uppercase">
            Repertoire Komprimierungs-Labor
          </h1>
          <p class="text-xs text-cyan-400 font-mono mt-1">
            Schneide unliebsame Abspiele ab und verringere deine kritischen Stellungen
          </p>
        </div>
        <button 
          @click="resetToggles"
          class="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-400/50 text-rose-300 font-mono text-xs rounded transition-all duration-300 uppercase tracking-wider"
        >
          Reset auf Empfehlungen
        </button>
      </div>

      <!-- Stats Grid -->
      <NGrid :cols="4" :x-gap="16" class="stats-grid">
        <NGi>
          <NCard size="small">
            <NStatistic label="Kritische Stellungen gesamt" :value="positions.length" />
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="Aktive Stellungen im Baum" :value="activePositionsCount" />
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="Empfohlene Züge gesamt" :value="totalRecommendationsCount" />
          </NCard>
        </NGi>
        <NGi>
          <NCard size="small">
            <NStatistic label="Pruning Kompressions-Rate" :value="`${Math.round((1 - activePositionsCount / positions.length) * 100)}%`" />
          </NCard>
        </NGi>
      </NGrid>

      <!-- Main Workspace -->
      <NGrid :cols="12" :x-gap="24" class="workspace-grid">
        
        <!-- Left Stage: Chessboard & HUD under the board -->
        <NGi :span="5" class="flex flex-col space-y-4">
          <NCard size="medium" class="left-stage-card flex-grow">
            <template #header>
              <div class="flex justify-between items-center w-full">
                <span class="text-sm font-bold font-orbitron tracking-wider text-white">INTERAKTIVES REPERTOIRE BRETT</span>
              </div>
            </template>
            
            <!-- Perfectly Square Chessboard -->
            <div class="flex justify-center items-center w-full py-2">
              <div style="width: 450px; height: 450px; max-width: 100%; aspect-ratio: 1/1; position: relative;">
                <WebChessBoard
                  :fen="boardStore.fen"
                  :orientation="boardStore.orientation"
                  :turn-color="boardStore.turn"
                  :dests="new Map()"
                  :last-move="boardStore.lastMove"
                  :check="boardStore.isCheck"
                  :promotion-state="boardStore.promotionState"
                  :drawable-shapes="drawableShapes"
                  :can-edit="false"
                />
              </div>
            </div>

            <!-- HUD / Move control below the board -->
            <div class="mt-4 p-4 bg-black/40 rounded-xl border border-cyan-500/10">
              <h3 class="text-xs font-bold font-orbitron tracking-wider text-cyan-400 uppercase mb-3 border-b border-cyan-500/10 pb-1">
                Zug-Steuerung &amp; Status
              </h3>

              <!-- If White Choice is Selected -->
              <div v-if="hudData?.type === 'white-choice'" class="space-y-4">
                <div class="flex justify-between items-center">
                  <div>
                    <div class="text-sm font-bold text-white flex items-center gap-2">
                      <span>Gewählter Zug: {{ hudData.san }}</span>
                      <NTag size="small" type="success" v-if="hudData.move?.coachFlow">Aktiv</NTag>
                      <NTag size="small" type="error" v-else>Ausgefiltert</NTag>
                    </div>
                    <div class="text-[10px] text-gray-500 font-mono mt-0.5">
                      Root: {{ hudData.root || 'Startstellung' }}
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-gray-400">CoachFlow:</span>
                    <NSwitch
                      :value="hudData.move?.coachFlow"
                      @update:value="toggleHudMoveFlow"
                      size="medium"
                    />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-4 text-xs font-mono border-t border-white/5 pt-3">
                  <div class="flex justify-between">
                    <span class="text-gray-500">Wiki Name:</span>
                    <span class="text-cyan-400 font-bold">{{ hudData.wiki_name || 'N/A' }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-500">Stellungen-Partien:</span>
                    <span class="text-white">{{ hudData.games_count }}</span>
                  </div>
                </div>
              </div>

              <!-- If Black Reply (or Root) is Selected -->
              <div v-else-if="hudData?.type === 'black-reply'" class="space-y-3">
                <div class="mb-2">
                  <div class="text-xs text-gray-400 font-mono">
                    Stellung nach: <span class="text-white">{{ hudData.san || 'Startstellung' }}</span>
                  </div>
                  <div class="text-[10px] text-cyan-500 font-mono mt-0.5" v-if="hudData.wiki_name">
                    Wiki: {{ hudData.wiki_name }} ({{ hudData.games_count }} Partien)
                  </div>
                </div>

                <div v-if="hudData.pos?.coach_check && hudData.pos.coach_check.length > 0" class="space-y-2 border-t border-white/5 pt-2">
                  <div class="text-[11px] text-gray-500 font-mono uppercase mb-2">Deine Repertoire-Optionen hier:</div>
                  
                  <div 
                    v-for="move in hudData.pos.coach_check" 
                    :key="move.uci"
                    class="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold font-mono text-white">{{ move.san }}</span>
                      <NTag size="small" :type="move.coachFlow ? 'success' : 'error'">
                        {{ move.coachFlow ? 'Aktiv' : 'Inaktiv' }}
                      </NTag>
                    </div>

                    <NSwitch
                      :value="move.coachFlow"
                      @update:value="(val) => toggleHudSubMoveFlow(move, val)"
                      size="small"
                    />
                  </div>
                </div>
                <div v-else class="text-xs text-gray-500 italic py-2">
                  Keine weiteren Repertoire-Verzweigungen von Weiß an dieser Stelle vorhanden.
                </div>
              </div>

              <!-- If nothing selected -->
              <div v-else class="text-xs text-gray-500 text-center py-4 italic">
                Wähle einen Zug im Repertoire-Variantenbaum aus.
              </div>
            </div>
          </NCard>
        </NGi>

        <!-- Right Stage: Repertoire Tree -->
        <NGi :span="7">
          <NCard size="medium" class="right-stage-card">
            <template #header>
              <div class="flex justify-between items-center w-full">
                <span class="text-sm font-bold font-orbitron tracking-wider text-white">REPERTOIRE VARIANTENBAUM</span>
              </div>
            </template>

            <!-- Standard tree representation using the app's native PgnTree -->
            <div class="tree-container max-h-[600px] overflow-y-auto pr-1">
              <PgnTree />
            </div>
          </NCard>
        </NGi>

      </NGrid>

    </div>
  </div>
</template>

<style scoped>
.font-orbitron {
  font-family: 'Orbitron', sans-serif;
}
.glow-text {
  text-shadow: 0 0 10px rgba(0, 242, 255, 0.4);
}
.stats-grid :deep(.n-card) {
  background: rgba(11, 13, 23, 0.6);
  border: 1px solid rgba(0, 242, 255, 0.1);
}
.left-stage-card, .right-stage-card {
  background: rgba(11, 13, 23, 0.8) !important;
  border: 1px solid rgba(0, 242, 255, 0.15) !important;
}
.left-stage-card :deep(.n-card-header),
.right-stage-card :deep(.n-card-header) {
  border-bottom: 1px solid rgba(0, 242, 255, 0.1);
  margin-bottom: 12px;
}
</style>
