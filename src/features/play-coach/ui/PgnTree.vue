<script setup lang="ts">
import { computed } from 'vue'
import { NText } from 'naive-ui'
import { useGameStore } from '@/entities/game'
import { pgnService, type PgnNode } from '@/shared/lib/pgn/PgnService'

const gameStore = useGameStore()

const rootNode = computed(() => pgnService.getRootNode())

const handleMoveClick = (node: PgnNode) => {
  gameStore.navigateToNode(node)
}
</script>

<template>
  <div class="pgn-tree">
    <div v-if="rootNode && rootNode.children.length > 0" class="tree-content">
      <PgnTreeBranch :nodes="rootNode.children" :depth="0" @move-click="handleMoveClick" />
    </div>
    <div v-else class="empty-pgn">Keine Züge vorhanden</div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h, type PropType, type VNode } from 'vue'

const PgnTreeBranch = defineComponent({
  name: 'PgnTreeBranch',
  props: {
    nodes: {
      type: Array as PropType<PgnNode[]>,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    }
  },
  emits: ['move-click'],
  setup(props, { emit }) {
    const render = (): VNode | VNode[] | null => {
      if (!props.nodes || props.nodes.length === 0) return null

      const mainline = props.nodes[0]
      if (!mainline) return null
      
      const variations = props.nodes.slice(1)
      const elements: (VNode | string)[] = []

      // 1. Render mainline starting from this point
      const mainlineElements: VNode[] = []
      let current: PgnNode | undefined = mainline
      
      while (current) {
        const isCurrent = current === pgnService.getCurrentNode()
        const nodeToCapture = current // for closure

        // Move number
        if (current.ply % 2 !== 0) {
          mainlineElements.push(
            h(NText, { depth: 3, class: 'move-number' }, { default: () => `${Math.ceil(nodeToCapture.ply / 2)}. ` })
          )
        } else if (current === mainline && current.ply % 2 === 0) {
          // If mainline starts with black move, show ...
          mainlineElements.push(
            h(NText, { depth: 3, class: 'move-number' }, { default: () => `${Math.ceil(nodeToCapture.ply / 2)}... ` })
          )
        }

        // The move itself
        mainlineElements.push(
          h(NText, {
            strong: isCurrent,
            type: isCurrent ? 'primary' : 'default',
            class: { 'pgn-move': true, current: isCurrent },
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              emit('move-click', nodeToCapture)
            }
          }, { default: () => nodeToCapture.san })
        )
        mainlineElements.push(h('span', { class: 'spacer' }, ' '))

        // If there are variations at this point, we break the mainline horizontal flow
        if (current.children.length > 1) {
          elements.push(h('span', { class: 'mainline-segment' }, mainlineElements))
          
          const subVariations = current.children.slice(1)
          subVariations.forEach(v => {
            elements.push(
              h('div', { 
                class: 'variation-line',
                style: { paddingLeft: `${(props.depth + 1) * 12}px` }
              }, [
                h('span', { class: 'variation-content' }, [
                  h(NText, { depth: 3, class: 'variation-arrow' }, { default: () => '↳ ' }),
                  h(PgnTreeBranch, { 
                    nodes: [v], 
                    depth: props.depth + 1,
                    onMoveClick: (node: PgnNode) => emit('move-click', node)
                  })
                ])
              ])
            )
          })

          // Continue mainline in a new segment if it exists
          const nextMainline = current.children[0]
          if (nextMainline) {
            elements.push(
              h(PgnTreeBranch, { 
                nodes: [nextMainline], 
                depth: props.depth,
                onMoveClick: (node: PgnNode) => emit('move-click', node)
              })
            )
          }
          return h('span', { class: 'branch-container' }, elements as VNode[])
        }

        current = current.children[0]
      }

      elements.push(h('span', { class: 'mainline-segment' }, mainlineElements))
      
      // If variations exist at the START of this branch (siblings of the first mainline move)
      if (variations.length > 0) {
        variations.forEach(v => {
          elements.push(
            h('div', { 
              class: 'variation-line',
              style: { paddingLeft: `${(props.depth) * 12}px` }
            }, [
              h('span', { class: 'variation-content' }, [
                h(NText, { depth: 3, class: 'variation-arrow' }, { default: () => '↳ ' }),
                h(PgnTreeBranch, { 
                  nodes: [v], 
                  depth: props.depth,
                  onMoveClick: (node: PgnNode) => emit('move-click', node)
                })
              ])
            ])
          )
        })
      }

      return h('span', { class: 'branch-container' }, elements as VNode[])
    }
    return render
  }
})
</script>

<style scoped>
.pgn-tree {
  font-family: 'JetBrains Mono', monospace;
  line-height: 1.8;
  font-size: 0.9rem;
}

.tree-content {
  display: flex;
  flex-direction: column;
}

.mainline-segment {
  display: inline;
}

.variation-line {
  margin: 1px 0;
  border-left: 2px solid rgba(255, 255, 255, 0.05);
  background: rgba(255, 255, 255, 0.01);
  border-radius: 0 4px 4px 0;
}

.variation-content {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
}

.variation-arrow {
  margin-right: 6px;
  opacity: 0.3;
  font-size: 0.8rem;
  flex-shrink: 0;
  font-family: monospace;
}

.branch-container {
  display: inline;
}

.pgn-move {
  cursor: pointer;
  padding: 1px 4px;
  border-radius: 3px;
  transition: all 0.1s ease;
  font-weight: 500;
  display: inline;
  color: var(--color-text-primary);
}

.pgn-move:hover:not(.current) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.pgn-move.current {
  background: rgba(var(--color-accent-rgb), 0.2);
  color: var(--color-accent) !important;
  font-weight: 700;
  box-shadow: inset 0 0 0 1px rgba(var(--color-accent-rgb), 0.3);
}

.move-number {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  user-select: none;
  margin-right: 2px;
}

.spacer {
  display: inline;
}

.empty-pgn {
  padding: 12px;
  text-align: center;
  color: var(--color-text-muted);
  font-style: italic;
}

.branch-container {
  display: flex;
  flex-direction: column;
}
</style>
