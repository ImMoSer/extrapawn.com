<script setup lang="ts">
import { computed } from 'vue'
import { NSwitch } from 'naive-ui'

export interface RepertoireNodePosition {
  fen: string
  ply: number
  "games count": number
  root: string
  user_moves: {
    san: string
    uci: string
    countGames: number
    winRate: number
    performance: number
    performens: number
    oppMoves: {
      san: string
      countGames: number
      winRate: number
    }[]
  }[]
  wiki_name?: string
  wiki_root?: string
  coach_check: {
    san: string
    uci: string
    user_count?: number
    winRate?: number
    coachFlow: boolean
  }[]
}

export interface RepertoireNode {
  id: string
  type: 'white' | 'black' | 'root'
  san: string
  uci?: string
  rootPath: string
  active: boolean
  children: RepertoireNode[]
  position?: RepertoireNodePosition
  moveIdx?: number
  x?: number
  y?: number
  angle?: number
  depth?: number
}

const props = defineProps<{
  node: RepertoireNode
  depth: number
  selectedId: string
}>()

const emit = defineEmits<{
  (e: 'select', node: RepertoireNode): void
  (e: 'toggle', payload: { node: RepertoireNode; value: boolean }): void
}>()

// Calculate move number prefix for White
const movePrefix = computed(() => {
  if (props.node.type === 'root') return ''
  
  // Count moves in rootPath
  const parts = props.node.rootPath.split(/\s+/).filter(Boolean)
  const plyCount = parts.length
  
  // If it's a White move, it's starting a new move step
  if (props.node.type === 'white') {
    const moveNum = Math.floor(plyCount / 2) + 1
    return `${moveNum}.`
  }
  
  return ''
})

const isSelected = computed(() => props.node.id === props.selectedId)

function handleSelect() {
  emit('select', props.node)
}

function handleToggle(val: boolean) {
  emit('toggle', { node: props.node, value: val })
}
</script>

<template>
  <div :class="['repertoire-node-wrapper', `depth-${depth}`, { 'is-pruned': !node.active }]">
    <!-- Root node just passes children through -->
    <template v-if="node.type === 'root'">
      <div class="space-y-2">
        <OpenFlowTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
          :selected-id="selectedId"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
        />
      </div>
    </template>

    <template v-else>
      <div class="move-line flex items-center justify-between py-1 px-2 rounded hover:bg-white/5 transition-colors"
           :class="{ 'bg-cyan-500/10 border border-cyan-500/30': isSelected }">
        
        <!-- Move Name / SAN click target -->
        <div class="flex items-center gap-2 cursor-pointer min-w-0 flex-grow" @click="handleSelect">
          <span v-if="movePrefix" class="text-cyan-500/60 font-mono text-xs select-none">{{ movePrefix }}</span>
          
          <span :class="[
            'font-bold font-mono text-xs tracking-wide',
            node.type === 'white' ? 'text-white' : 'text-cyan-400/80',
            { 'line-through text-gray-600': !node.active }
          ]">
            {{ node.san }}
          </span>

          <!-- Indicator tag if recommended or dubios -->
          <span v-if="node.type === 'white' && node.position" class="text-[9px] uppercase tracking-wider text-gray-500">
            {{ node.san.endsWith('!') || node.san.endsWith('!!') ? 'Empfohlen' : 'Nebenvariante' }}
          </span>
        </div>

        <!-- Toggle Switch (only for White moves) -->
        <div v-if="node.type === 'white' && node.position" class="flex items-center gap-2" @click.stop>
          <span class="text-[9px] font-mono text-gray-500">{{ node.active ? 'aktiv' : 'aus' }}</span>
          <NSwitch
            :value="node.active"
            size="small"
            @update:value="handleToggle"
          />
        </div>
      </div>

      <!-- Sibling / Children block -->
      <div v-if="node.children.length > 0" class="children-container pl-4 border-l border-white/5 mt-1 space-y-1">
        <OpenFlowTreeNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
          :selected-id="selectedId"
          @select="emit('select', $event)"
          @toggle="emit('toggle', $event)"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.repertoire-node-wrapper {
  margin-top: 2px;
}
.children-container {
  margin-left: 6px;
}
.is-pruned .move-line {
  opacity: 0.5;
}
</style>
