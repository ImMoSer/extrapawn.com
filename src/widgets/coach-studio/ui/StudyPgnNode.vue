<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import { NAG_MAPPING, type PgnNode } from '@/shared/lib/pgn/pgnTypes'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    node: PgnNode
    depth?: number
  }>(),
  {
    depth: 0,
  },
)

const studyStore = useCoachStudyStore()

const isActive = computed(() => studyStore.currentNode === props.node)
const hasShapes = computed(() => Boolean(props.node.shapes && props.node.shapes.length > 0))

const moveNumber = computed(() => {
  const ply = props.node.ply
  if (ply === 0) return ''

  const rootFenParts = studyStore.rootNode.fenAfter.split(' ')
  const whiteStarts = rootFenParts[1] !== 'b'
  const startMove = Math.max(1, Number.parseInt(rootFenParts[5] || '1', 10) || 1)

  const zeroBasedOffset = whiteStarts ? ply - 1 : ply
  const fullMove = startMove + Math.floor(zeroBasedOffset / 2)
  const isWhiteMove = zeroBasedOffset % 2 === 0

  if (isWhiteMove) return `${fullMove}.`

  const isFirstChild =
    props.node.parent?.ply === 0 && props.node.parent.children[0] === props.node
  const isStartOfVariation =
    props.node.parent && props.node.parent.children[0] !== props.node

  if (isFirstChild || isStartOfVariation || props.depth > 0) {
    return `${fullMove}...`
  }
  return ''
})

const nagInfo = computed(() => {
  if (props.node.nag !== undefined) {
    return NAG_MAPPING[props.node.nag] ?? null
  }
  return null
})

const qualityColorClass = computed(() => {
  switch (nagInfo.value?.quality) {
    case 'best':
      return 'text-success'
    case 'brilliant':
      return 'text-mint'
    case 'inaccuracy':
      return 'text-warning'
    case 'mistake':
      return 'text-orange'
    case 'blunder':
      return 'text-danger'
    case 'interesting':
      return 'text-info'
    default:
      return ''
  }
})

const mainlineChild = computed(() => props.node.children[0])
const variations = computed(() => props.node.children.slice(1))

const handleNavigate = () => {
  studyStore.navigateToNode(props.node)
}
</script>

<template>
  <div class="inline" :class="{ 'text-text-secondary': depth > 0 }">
    <span v-if="node.ply > 0" class="mr-1 inline-flex items-baseline py-0.5 whitespace-nowrap">
      <span
        v-if="moveNumber"
        class="mr-[3px] text-[0.82em] font-normal text-text-secondary select-none"
      >
        {{ moveNumber }}
      </span>
      <button
        type="button"
        class="inline-flex cursor-pointer items-center gap-1 rounded-sm border px-1.5 py-px font-condensed text-[0.95rem] font-semibold transition-colors"
        :class="[
          isActive
            ? 'border-brand/60 bg-brand/15 font-bold text-brand'
            : 'border-transparent bg-transparent text-text-primary hover:bg-elevated',
          qualityColorClass,
        ]"
        @click="handleNavigate"
      >
        <span>{{ node.san }}{{ nagInfo ? nagInfo.symbol : '' }}</span>
        <span
          v-if="hasShapes"
          class="inline-block h-1.5 w-1.5 rounded-full bg-success"
          aria-hidden="true"
        />
      </button>

      <span
        v-if="node.comment"
        class="ml-1.5 inline-block max-w-[300px] rounded-r-sm border-l-2 border-brand bg-elevated/70 px-1.5 py-0.5 align-middle font-display text-[0.78rem] whitespace-normal text-text-secondary"
      >
        {{ node.comment }}
      </span>
    </span>

    <div class="inline">
      <div
        v-if="variations.length > 0"
        class="my-1.5 ml-2.5 block rounded-r-md border-l-2 border-border-hover bg-elevated/35 py-1 pl-2.5"
      >
        <div v-for="(vNode, idx) in variations" :key="`${vNode.id}-${idx}`" class="mb-1 block last:mb-0">
          <StudyPgnNode :node="vNode" :depth="depth + 1" />
        </div>
      </div>

      <StudyPgnNode v-if="mainlineChild" :node="mainlineChild" :depth="depth" />
    </div>
  </div>
</template>
