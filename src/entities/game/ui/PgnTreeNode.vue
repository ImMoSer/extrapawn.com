<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/entities/game'
import { pgnService, pgnTreeVersion, NAG_MAPPING, type PgnNode } from '@/shared/lib/pgn/PgnService'

const props = withDefaults(
  defineProps<{
    node: PgnNode
    isMainline?: boolean
    depth?: number
    readOnly?: boolean
  }>(),
  {
    isMainline: false,
    depth: 0,
    readOnly: false,
  }
)

const gameStore = useGameStore()

const isActive = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getCurrentNode() === props.node
})

const moveNumber = computed(() => {
  const ply = props.node.ply
  if (ply === 0) return ''
  
  const moveNum = Math.ceil(ply / 2)
  const isWhite = ply % 2 !== 0

  if (isWhite) return `${moveNum}.`
  
  // For black: show number only if it's the very first move of a variation
  // or if explicitly forced (like in Lichess when a variation starts with black)
  const isFirstInBranch = props.node.parent && props.node.parent.children[0] === props.node && props.node.parent.ply === 0
  const isStartOfVariation = props.node.parent && props.node.parent.children[0] !== props.node
  
  if (isFirstInBranch || isStartOfVariation || props.depth && props.depth > 0) {
     // Check if the previous move in this specific branch was white. 
     // If not, we need the ... notation.
     return `${moveNum}...`
  }
  
  return ''
})

const children = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return props.node.children
})

const mainlineChild = computed(() => children.value[0])
const variations = computed(() => children.value.slice(1))

const nagInfo = computed(() => {
  if (props.node.nag !== undefined) {
    const mapping = NAG_MAPPING[props.node.nag]
    if (mapping) return mapping
  }
  const meta = props.node.metadata
  if (meta && meta.nag && meta.nag !== 'OK') {
    return {
      symbol: meta.nag,
      quality: meta.quality || 'good'
    }
  }
  return null
})

const navigate = () => {
  if (props.readOnly) return
  gameStore.navigateToNode(props.node)
}
</script>

<template>
  <div :class="['pgn-node-wrapper', { 'is-variation': depth && depth > 0 }]">
    <!-- The Move itself -->
    <span v-if="node.ply > 0" class="move-item">
      <span v-if="moveNumber" class="move-number">{{ moveNumber }}</span>
      <span 
        :class="['move-san', { 'is-active': isActive, 'read-only': readOnly }, nagInfo?.quality]" 
        @click="navigate"
      >
        {{ node.san }}{{ nagInfo ? nagInfo.symbol : '' }}
      </span>
    </span>

    <!-- Branching Logic -->
    <div class="move-children">
      <!-- 1. Variations first (if any) -->
      <div v-if="variations.length > 0" class="variations-container">
        <div v-for="(vNode, idx) in variations" :key="idx" class="variation-block">
          <span class="variation-bracket">(</span>
          <PgnTreeNode :node="vNode" :depth="(depth || 0) + 1" :read-only="readOnly" />
          <span class="variation-bracket">)</span>
        </div>
      </div>

      <!-- 2. Continue Mainline -->
      <PgnTreeNode 
        v-if="mainlineChild" 
        :node="mainlineChild" 
        :depth="depth" 
        :is-mainline="true" 
        :read-only="readOnly"
      />
    </div>
  </div>
</template>

<style scoped>
.pgn-node-wrapper {
  display: inline;
}

.move-item {
  display: inline-flex;
  align-items: baseline;
  margin-right: 4px;
  padding: 2px 0;
  white-space: nowrap;
}

.move-number {
  color: var(--color-text-muted);
  font-size: 0.82em;
  margin-right: 3px;
  font-weight: 400;
  user-select: none;
}

.move-san {
  cursor: pointer;
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
  color: var(--color-text-primary);
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.move-san:not(.read-only):hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.move-san.read-only {
  cursor: default;
}

/* NAG colors */
.move-san.best,
.move-san.brilliant {
  color: #26a69a !important; /* Greenish/Teal */
}

.move-san.mistake,
.move-san.inaccuracy {
  color: #ffb300 !important; /* Yellow/Orange */
}

.move-san.blunder {
  color: #e53935 !important; /* Red */
}

.move-san.interesting {
  color: #b39ddb !important; /* Purple/Magenta */
}

.move-san.is-active {
  background: rgba(var(--color-accent-rgb), 0.2);
  color: var(--color-accent);
  font-weight: 800;
  border-color: rgba(var(--color-accent-rgb), 0.4);
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.1);
}

.move-children {
  display: inline;
}

.variations-container {
  display: block; /* Variation starts on a new line */
  margin: 6px 0 6px 12px;
  padding: 4px 0 4px 12px;
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.01);
  border-radius: 0 6px 6px 0;
}

.variation-block {
  display: block; /* Each sibling variation gets its own line if many */
  margin-bottom: 4px;
  font-size: 0.92em;
}

.variation-block:last-child {
  margin-bottom: 0;
}

.variation-bracket {
  display: none; /* We use borders and indentation instead of brackets for a cleaner tree look */
}

.is-variation {
  color: var(--color-text-muted);
}
</style>
