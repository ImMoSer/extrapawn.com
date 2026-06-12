<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue'
import { useOpenCheckStore, getFenAfterMove } from '@/features/open-check'
import { useBoardStore, useGameStore } from '@/entities/game'
import { useAuthStore } from '@/entities/user'
import { GameLayout } from '@/widgets/game-layout'
import OpenCheckTreeNode from './OpenCheckTreeNode.vue'
import OpenCheckHistoryList from './OpenCheckHistoryList.vue'
import OpenCheckImportWizard from './OpenCheckImportWizard.vue'
import {
  NCard,
  NButton,
  NText,
  useMessage,
} from 'naive-ui'
import {
  PlayBackOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
  PlayForwardOutline,
  SwapVerticalOutline,
} from '@vicons/ionicons5'

const openCheckStore = useOpenCheckStore()
const boardStore = useBoardStore()
const gameStore = useGameStore()
const authStore = useAuthStore()
const message = useMessage()

// Side panel view state: 'history' or 'import'
const currentSidebarView = ref<'history' | 'import'>('history')

// Keyboard arrow keys traversal for Open Check history
function handleArrowKeys(event: KeyboardEvent) {
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    if (['INPUT', 'TEXTAREA'].includes((event.target as HTMLElement).tagName)) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'ArrowLeft') {
      openCheckStore.navigateHistory('back')
    } else {
      openCheckStore.navigateHistory('forward')
    }
  }
}

// Load history and setup board when component mounts
onMounted(async () => {
  // Clear any active game strategy context to prevent interference
  gameStore.stop()

  await openCheckStore.loadHistory()

  // Allow free play and board moves
  gameStore.isFreePlay = true
  gameStore.setGamePhase('PLAYING')

  // Initialize input fields with profile lichess username if present
  if (authStore.userProfile?.id) {
    openCheckStore.targetUsername = authStore.userProfile.id
  }

  // Load initial position on the board
  if (openCheckStore.currentBoardFen) {
    boardStore.setupPosition(openCheckStore.currentBoardFen, openCheckStore.userColor)
  } else {
    boardStore.setupPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', openCheckStore.userColor)
  }

  window.addEventListener('keydown', handleArrowKeys, true)
})

onUnmounted(() => {
  gameStore.stop()
  window.removeEventListener('keydown', handleArrowKeys, true)
})

// Watch active board FEN from store and load it
watch(() => openCheckStore.currentBoardFen, (newFen) => {
  if (newFen) {
    boardStore.loadPosition(newFen)
  }
})

// Active color orientation synchronization
watch(() => openCheckStore.userColor, (newColor) => {
  boardStore.orientation = newColor
})

// Watch FEN changes on board Store to detect user played moves
watch(() => boardStore.fen, (newFen) => {
  if (!newFen) return
  const norm = (f: string) => f.split(' ').slice(0, 4).join(' ')
  
  // If FEN is already what we expect from Open Check store, do nothing
  const expectedFen = openCheckStore.currentBoardFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  if (norm(newFen) === norm(expectedFen)) {
    return
  }

  // Find matching child node in active node
  const nextNode = findChildNodeByFen(openCheckStore.activeNode, newFen, expectedFen)
  if (nextNode) {
    openCheckStore.setBoardPosition(nextNode.fen || newFen, nextNode)
  } else {
    // Repertoire path broken, show off-repertoire position
    openCheckStore.setBoardPosition(newFen, {
      fen: newFen,
      opening_name: 'Off Repertoire / Pruned Branch',
      eco: '---',
      games_count: 0,
      user_moves: [],
      recommendations: {}
    })
    message.info('You have left the analyzed repertoire tree.')
  }
})

// Helper to look up children by FEN
function findChildNodeByFen(node: any, targetFen: string, parentFen: string): any | null {
  if (!node) return null
  const norm = (f: string) => f.split(' ').slice(0, 4).join(' ')
  const targetNorm = norm(targetFen)

  // 1. User moves
  if (node.user_moves && Array.isArray(node.user_moves)) {
    for (const m of node.user_moves) {
      if (m.move_uci) {
        const childFen = getFenAfterMove(parentFen, m.move_uci)
        if (norm(childFen) === targetNorm) {
          return m
        }
      }
    }
  }

  // 2. Opponent moves
  if (node.opponent_moves) {
    for (const key in node.opponent_moves) {
      const child = node.opponent_moves[key]
      if (child.fen && norm(child.fen) === targetNorm) {
        return child
      }
    }
  }

  return null
}

// Click recommendation: plays the recommended move on the board
function handlePlayRecommendation(moveSan: string) {
  if (!openCheckStore.activeNode) return
  
  // Find move in user_moves or opponent_moves
  let nextNode: any = null
  
  if (openCheckStore.activeNode.user_moves) {
    nextNode = openCheckStore.activeNode.user_moves.find((m: any) => m.move_san === moveSan)
  }
  
  if (!nextNode && openCheckStore.activeNode.opponent_moves) {
    // Search opponent moves keys
    for (const key in openCheckStore.activeNode.opponent_moves) {
      if (key.includes(moveSan)) {
        nextNode = openCheckStore.activeNode.opponent_moves[key]
        break
      }
    }
  }

  if (nextNode) {
    openCheckStore.setBoardPosition(nextNode.fen || boardStore.fen, nextNode)
  } else {
    message.warning(`Move ${moveSan} is not in the loaded analysis path.`)
  }
}
</script>

<template>
  <GameLayout :board-locked="false">
    <!-- Center Column Header / Tag -->
    <template #top-info>
      <div class="active-mode-tag">
        <span class="active-mode-indicator"></span>
        <NText strong class="mode-label">
          Open Check — Repertoire Analysis
        </NText>
      </div>
    </template>

    <!-- LEFT PANEL: History / Import Wizard -->
    <template #left-panel>
      <OpenCheckHistoryList
        v-if="currentSidebarView === 'history'"
        @new-analysis="currentSidebarView = 'import'"
      />
      <OpenCheckImportWizard
        v-else-if="currentSidebarView === 'import'"
        @cancel="currentSidebarView = 'history'"
        @success="currentSidebarView = 'history'"
      />
    </template>

    <!-- RIGHT PANEL: Position intelligence & Opening tree -->
    <template #right-panel>
      <div class="right-panel-content">
        <!-- Position Stats & Quick Navigation Toolbar -->
        <div class="position-navigation-card">
          <div class="position-stats-container">
            <div class="stat-box">
              <span class="stat-lbl">ECO</span>
              <span class="stat-val text-teal">{{ openCheckStore.activeNode?.eco || '---' }}</span>
            </div>
            <div class="stat-box flex-3">
              <span class="stat-lbl">Opening Name</span>
              <span class="stat-val scrollable-name">{{ openCheckStore.activeNode?.opening_name || 'Start Position' }}</span>
            </div>
            <div class="stat-box">
              <span class="stat-lbl">Games</span>
              <span class="stat-val text-blue">{{ openCheckStore.activeNode?.games_count || 0 }}</span>
            </div>
          </div>
          
          <div class="sidebar-nav-toolbar">
            <NButton quaternary size="medium" @click="openCheckStore.navigateHistory('start')" title="Go to start">
              <template #icon><PlayBackOutline /></template>
            </NButton>
            <NButton quaternary size="medium" @click="openCheckStore.navigateHistory('back')" title="Previous move">
              <template #icon><ChevronBackOutline /></template>
            </NButton>
            <NButton quaternary size="medium" @click="boardStore.flipBoard()" title="Flip board">
              <template #icon><SwapVerticalOutline /></template>
            </NButton>
            <NButton quaternary size="medium" @click="openCheckStore.navigateHistory('forward')" title="Next move">
              <template #icon><ChevronForwardOutline /></template>
            </NButton>
            <NButton quaternary size="medium" @click="openCheckStore.navigateHistory('end')" title="Go to end">
              <template #icon><PlayForwardOutline /></template>
            </NButton>
          </div>
        </div>

        <!-- Detailed Node Info Card -->
        <NCard class="panel-card details-card" title="Position Intelligence" size="small">
          <div v-if="!openCheckStore.activeNode" class="empty-details">
            Select or play a move to show statistics and Grandmaster recommendations.
          </div>
          <div v-else class="details-body">
            <!-- Basic stats row -->
            <div class="stats-row">
              <div class="mini-stat">
                <div class="mini-label">User Games</div>
                <div class="mini-value">{{ openCheckStore.activeNode.games_count || 0 }}</div>
              </div>
              <div class="mini-stat">
                <div class="mini-label">Variability</div>
                <div class="mini-value">{{ openCheckStore.activeNode.variability || 0 }}</div>
              </div>
            </div>

            <!-- GM Recommendations -->
            <div class="recs-section">
              <h3 class="recs-title">Grandmaster Personalities</h3>
              
              <div 
                v-if="!openCheckStore.activeNode.recommendations || Object.keys(openCheckStore.activeNode.recommendations).length === 0" 
                class="empty-recs"
              >
                No GM recommendations for this position.
              </div>
              <div v-else class="recs-grid">
                <!-- Classic -->
                <div 
                  v-if="openCheckStore.activeNode.recommendations['GM Classic']"
                  class="rec-card classic"
                >
                  <div class="rec-header">
                    <span class="rec-avatar font-piece">♔</span>
                    <span class="rec-name">Classic</span>
                    <NButton 
                      size="tiny" 
                      type="primary" 
                      secondary
                      class="rec-play-btn"
                      @click="handlePlayRecommendation(openCheckStore.activeNode.recommendations['GM Classic'].move_san)"
                    >
                      {{ openCheckStore.activeNode.recommendations['GM Classic'].move_san }}
                    </NButton>
                  </div>
                  <p class="rec-text">{{ openCheckStore.activeNode.recommendations['GM Classic'].llm_says }}</p>
                </div>

                <!-- Performer -->
                <div 
                  v-if="openCheckStore.activeNode.recommendations['GM Performer']"
                  class="rec-card performer"
                >
                  <div class="rec-header">
                    <span class="rec-avatar font-piece">♕</span>
                    <span class="rec-name">Performer</span>
                    <NButton 
                      size="tiny" 
                      type="primary" 
                      secondary
                      class="rec-play-btn"
                      @click="handlePlayRecommendation(openCheckStore.activeNode.recommendations['GM Performer'].move_san)"
                    >
                      {{ openCheckStore.activeNode.recommendations['GM Performer'].move_san }}
                    </NButton>
                  </div>
                  <p class="rec-text">{{ openCheckStore.activeNode.recommendations['GM Performer'].llm_says }}</p>
                </div>

                <!-- Tricky -->
                <div 
                  v-if="openCheckStore.activeNode.recommendations['GM Tricky']"
                  class="rec-card tricky"
                >
                  <div class="rec-header">
                    <span class="rec-avatar font-piece">♘</span>
                    <span class="rec-name">Tricky</span>
                    <NButton 
                      size="tiny" 
                      type="primary" 
                      secondary
                      class="rec-play-btn"
                      @click="handlePlayRecommendation(openCheckStore.activeNode.recommendations['GM Tricky'].move_san)"
                    >
                      {{ openCheckStore.activeNode.recommendations['GM Tricky'].move_san }}
                    </NButton>
                  </div>
                  <p class="rec-text">{{ openCheckStore.activeNode.recommendations['GM Tricky'].llm_says }}</p>
                </div>

                <!-- Concrete -->
                <div 
                  v-if="openCheckStore.activeNode.recommendations['GM Concrete']"
                  class="rec-card concrete"
                >
                  <div class="rec-header">
                    <span class="rec-avatar font-piece">♖</span>
                    <span class="rec-name">Concrete</span>
                    <NButton 
                      size="tiny" 
                      type="primary" 
                      secondary
                      class="rec-play-btn"
                      @click="handlePlayRecommendation(openCheckStore.activeNode.recommendations['GM Concrete'].move_san)"
                    >
                      {{ openCheckStore.activeNode.recommendations['GM Concrete'].move_san }}
                    </NButton>
                  </div>
                  <p class="rec-text">{{ openCheckStore.activeNode.recommendations['GM Concrete'].llm_says }}</p>
                </div>
              </div>
            </div>
          </div>
        </NCard>

        <!-- Opening tree explorer -->
        <NCard class="panel-card tree-explorer-card" title="Opening Repertoire Tree" size="small">
          <div v-if="!openCheckStore.currentAnalysis" class="empty-tree">
            No analysis loaded. Select an analysis from history or run a new one.
          </div>
          <div v-else class="tree-wrapper scrollable-container">
            <OpenCheckTreeNode
              :node="openCheckStore.currentAnalysis.tree"
              :is-user-move="openCheckStore.currentAnalysis.tree.user_moves ? true : false"
              :move-label="openCheckStore.currentAnalysis.rootMove"
              :parent-fen="openCheckStore.currentAnalysis.rootFen"
              :depth="0"
            />
          </div>
        </NCard>
      </div>
    </template>
  </GameLayout>
</template>

<style scoped>
.open-check-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16px;
  background: radial-gradient(circle at center, #111116 0%, #07070a 100%);
  color: #ffffff;
  overflow: hidden;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 12px;
}

.header-title-section {
  display: flex;
  flex-direction: column;
}

.glow-text {
  font-family: 'Outfit', sans-serif;
  font-size: 2.2rem;
  font-weight: 900;
  margin: 0;
  background: linear-gradient(135deg, #00f5d4 0%, #00bbf9 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 10px rgba(0, 245, 212, 0.3));
}

.header-subtitle {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 2px;
}

.workspace {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.left-panel-content,
.right-panel-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.active-mode-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 245, 212, 0.05);
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: 100px;
  padding: 4px 12px;
}

.active-mode-indicator {
  width: 6px;
  height: 6px;
  background-color: #00f5d4;
  border-radius: 50%;
  box-shadow: 0 0 8px #00f5d4;
}

.mode-label {
  font-family: 'Outfit', sans-serif;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #00f5d4;
}

.panel-card {
  background: rgba(25, 25, 35, 0.6) !important;
  border: 1px solid rgba(255, 255, 255, 0.08) !important;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  border-radius: 12px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

:deep(.n-card-header) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  padding: 12px 16px !important;
}

:deep(.n-card-header__title) {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  color: #00f5d4 !important;
  font-size: 1.1rem;
}

:deep(.n-card__content) {
  padding: 16px !important;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.form-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.2px;
  color: rgba(255, 255, 255, 0.6);
}

.label-with-badge {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-lock-hint {
  font-size: 0.75rem;
  color: var(--neon-orange, #ff5500);
  margin-top: 2px;
}

.checkbox-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

/* Run Analysis glowing button */
.glow-btn-teal {
  background-color: transparent !important;
  border: 1px solid #00f5d4 !important;
  color: #00f5d4 !important;
  transition: all 0.3s ease;
  font-weight: 700;
}

.glow-btn-teal:hover {
  background-color: rgba(0, 245, 212, 0.1) !important;
  box-shadow: 0 0 15px rgba(0, 245, 212, 0.4);
}

/* History Card */
.history-card {
  max-height: 250px;
}

.empty-history, .empty-details, .empty-tree {
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.85rem;
  padding: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding-right: 4px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.history-item.is-selected {
  border-color: #00f5d4;
  background: rgba(0, 245, 212, 0.05);
}

.item-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.item-user {
  font-weight: bold;
  font-size: 0.9rem;
  color: #ffffff;
}

.item-specs {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.item-date {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.3);
}

.delete-btn {
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.history-item:hover .delete-btn {
  opacity: 1;
}

/* Position Navigation Card (Right sidebar top) */
.position-navigation-card {
  background: rgba(25, 25, 35, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex-shrink: 0;
}

.position-stats-container {
  display: flex;
  gap: 12px;
  width: 100%;
}

.stat-box {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  text-align: center;
}

.stat-lbl {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.8px;
}

.stat-val {
  font-family: 'Outfit', sans-serif;
  font-size: 0.85rem;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ffffff;
}

.scrollable-name {
  color: #00f5d4;
}

.text-teal {
  color: #00f5d4;
}

.text-blue {
  color: #00bbf9;
}

.sidebar-nav-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.sidebar-nav-toolbar :deep(.n-button) {
  flex: 1;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
}

.sidebar-nav-toolbar :deep(.n-button:hover) {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.05);
}

/* COLUMN 3: Right Panel Details & Tree */
.details-card {
  max-height: 350px;
}

.details-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
}

.stats-row {
  display: flex;
  gap: 16px;
}

.mini-stat {
  flex: 1;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  text-align: center;
}

.mini-label {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.mini-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #ffffff;
}

.recs-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recs-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 1px;
  margin: 0 0 4px 0;
}

.empty-recs {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.01);
  border: 1px dashed rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.recs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.rec-card {
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  border-left: 3px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.rec-card.classic { border-left-color: var(--neon-yellow); }
.rec-card.performer { border-left-color: var(--neon-pink); }
.rec-card.tricky { border-left-color: var(--neon-cyan); }
.rec-card.concrete { border-left-color: var(--neon-purple); }

.rec-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rec-avatar {
  font-size: 1.1rem;
  line-height: 1;
}

.rec-name {
  font-size: 0.8rem;
  font-weight: bold;
  color: #ffffff;
}

.rec-play-btn {
  margin-left: auto;
  font-weight: bold;
}

.rec-text {
  font-size: 0.75rem;
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}

/* Tree Explorer */
.tree-explorer-card {
  flex: 2;
}

.tree-wrapper {
  overflow-y: auto;
  flex: 1;
  padding-right: 4px;
}

.scrollable-container::-webkit-scrollbar,
.history-list::-webkit-scrollbar,
.details-body::-webkit-scrollbar,
.form-container::-webkit-scrollbar {
  width: 4px;
}

.scrollable-container::-webkit-scrollbar-thumb,
.history-list::-webkit-scrollbar-thumb,
.details-body::-webkit-scrollbar-thumb,
.form-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

/* Font styles */
.font-piece {
  font-family: Arial, sans-serif;
}
</style>
