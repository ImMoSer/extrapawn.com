<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOpenCheckStore, getFenAfterMove, type OpenCheckTreeNode } from '@/features/open-check'
import { ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'

const props = defineProps<{
  node: OpenCheckTreeNode
  isUserMove: boolean
  moveLabel: string
  parentFen: string
  depth: number
}>()

const openCheckStore = useOpenCheckStore()
const isExpanded = ref(true)

// Calculate node FEN
const nodeFen = computed(() => {
  if (props.node.fen) return props.node.fen
  if (props.isUserMove && props.node.move_uci) {
    return getFenAfterMove(props.parentFen, props.node.move_uci)
  }
  return props.parentFen
})

// Active check
const isActive = computed(() => {
  if (!openCheckStore.activeNode) return false
  
  // Compare FENs
  const norm = (f: string) => f.split(' ').slice(0, 4).join(' ')
  
  if (props.node.fen && openCheckStore.activeNode.fen) {
    return norm(props.node.fen) === norm(openCheckStore.activeNode.fen)
  }
  
  // If it's a user move node, compare move_uci and parentFen
  if (props.isUserMove && props.node.move_uci && openCheckStore.activeNode.move_uci) {
    return props.node.move_uci === openCheckStore.activeNode.move_uci && 
           norm(props.parentFen) === norm(openCheckStore.historyFen[openCheckStore.currentFenIndex - 1] || '')
  }
  
  return false
})

const hasChildren = computed(() => {
  if (props.node.user_moves && props.node.user_moves.length > 0) return true
  if (props.node.opponent_moves && Object.keys(props.node.opponent_moves).length > 0) return true
  return false
})

const gamesCount = computed(() => {
  return props.node.games_count || 0
})

const popularity = computed(() => {
  return props.node.popularity_pct
})

const userScore = computed(() => {
  return props.node.user_score_pct
})

const theoreticalLabel = computed(() => {
  return props.node.theoretical?.label || props.node.theory_data?.label || null
})

const winRateStyle = computed(() => {
  if (userScore.value === undefined) return {}
  // green-red gradient depending on score (0-100)
  const score = userScore.value
  if (score >= 55) return { color: 'var(--neon-lime)' }
  if (score <= 45) return { color: 'var(--neon-red)' }
  return { color: 'var(--neon-yellow)' }
})

function toggleExpand(e: Event) {
  e.stopPropagation()
  isExpanded.value = !isExpanded.value
}

function selectNode() {
  openCheckStore.setBoardPosition(nodeFen.value, props.node)
}
</script>

<template>
  <div class="tree-node" :style="{ marginLeft: depth > 0 ? '16px' : '0' }">
    <div 
      class="node-row" 
      :class="{ 'is-active': isActive, 'is-user-move': isUserMove }" 
      @click="selectNode"
    >
      <!-- Expand/Collapse toggle -->
      <span class="expand-icon" @click="toggleExpand">
        <NIcon v-if="hasChildren">
          <ChevronDownOutline v-if="isExpanded" />
          <ChevronForwardOutline v-else />
        </NIcon>
        <span v-else class="empty-icon"></span>
      </span>
      <!-- Move text -->
      <span class="move-name" :class="isUserMove ? 'user-move-text' : 'opp-move-text'">
        {{ moveLabel }}
      </span>

      <!-- Stat Badges -->
      <div class="stats-group">
        <!-- Theory Badge -->
        <span v-if="theoreticalLabel" class="theory-badge">
          {{ theoreticalLabel }}
        </span>
        
        <!-- Win Rate for User Moves -->
        <span v-if="isUserMove && userScore !== undefined" class="stat-badge win-rate" :style="winRateStyle">
          {{ Math.round(userScore) }}%
        </span>

        <!-- Popularity % for Opponent Responses -->
        <span v-if="!isUserMove && popularity !== undefined" class="stat-badge popularity">
          {{ Math.round(popularity) }}%
        </span>
        
        <!-- Games count -->
        <span class="games-count">
          {{ gamesCount }}
        </span>
      </div>
    </div>

    <!-- Recursive Children -->
    <div v-if="hasChildren && isExpanded" class="children-container">
      <!-- Position Node: has user_moves list -->
      <template v-if="node.user_moves">
        <OpenCheckTreeNode
          v-for="child in node.user_moves"
          :key="child.move_uci"
          :node="child"
          :is-user-move="true"
          :move-label="child.move_san || child.move_uci || ''"
          :parent-fen="nodeFen"
          :depth="depth + 1"
        />
      </template>

      <!-- Move Node: has opponent_moves dict -->
      <template v-else-if="node.opponent_moves">
        <OpenCheckTreeNode
          v-for="(child, san) in node.opponent_moves"
          :key="san"
          :node="child"
          :is-user-move="false"
          :move-label="String(san)"
          :parent-fen="nodeFen"
          :depth="depth + 1"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.tree-node {
  display: flex;
  flex-direction: column;
  position: relative;
}

.node-row {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin: 2px 0;
  border-radius: 4px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s ease;
  user-select: none;
}

.node-row:hover {
  background: rgba(255, 255, 255, 0.06);
}

.node-row.is-active {
  background: rgba(0, 245, 212, 0.15); /* neon-teal glow */
  border-left: 3px solid #00f5d4;
  box-shadow: inset 5px 0 10px rgba(0, 245, 212, 0.05);
}

.expand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 6px;
  color: var(--color-text-secondary, #999);
}

.expand-icon:hover {
  color: #fff;
}

.empty-icon {
  width: 20px;
}

.move-name {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  font-size: 0.95rem;
}

.user-move-text {
  color: var(--neon-cyan, #00e5ff);
}

.opp-move-text {
  color: #ffffff;
}

.stats-group {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-badge {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: bold;
}

.win-rate {
  background: rgba(255, 255, 255, 0.05);
}

.popularity {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-secondary, #cccccc);
}

.games-count {
  font-size: 0.75rem;
  color: var(--color-text-secondary, #888);
  font-weight: 500;
  min-width: 24px;
  text-align: right;
}

.theory-badge {
  font-size: 0.7rem;
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(176, 0, 255, 0.2);
  color: var(--neon-purple);
  border: 1px solid rgba(176, 0, 255, 0.4);
  font-weight: 700;
}

.children-container {
  border-left: 1px dashed rgba(255, 255, 255, 0.08);
  margin-left: 9px;
  padding-left: 4px;
}
</style>
