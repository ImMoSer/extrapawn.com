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
  },
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

  const isFirstInBranch =
    props.node.parent && props.node.parent.children[0] === props.node && props.node.parent.ply === 0
  const isStartOfVariation = props.node.parent && props.node.parent.children[0] !== props.node

  if (isFirstInBranch || isStartOfVariation || (props.depth && props.depth > 0)) {
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
      quality: meta.quality || 'good',
    }
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

const emit = defineEmits<{
  (e: 'contextmenu', payload: { event: MouseEvent; node: PgnNode }): void
}>()

const navigate = () => {
  if (props.readOnly) return
  gameStore.navigateToNode(props.node)
}
</script>

<template>
  <div class="inline" :class="{ 'text-text-secondary': depth && depth > 0 }">
    <!-- The Move itself -->
    <span v-if="node.ply > 0" class="mr-1 inline-flex items-baseline py-0.5 whitespace-nowrap">
      <span
        v-if="moveNumber"
        class="mr-[3px] text-[0.82em] font-normal text-text-secondary select-none"
      >
        {{ moveNumber }}
      </span>
      <span
        class="move-san rounded-xs border px-[5px] py-px font-semibold transition-colors"
        :class="[
          isActive
            ? 'is-active border-brand/50 bg-brand/15 font-bold text-brand'
            : 'border-transparent text-text-primary',
          readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-elevated hover:text-text-primary',
          qualityColorClass,
        ]"
        @click="navigate"
        @contextmenu.prevent="emit('contextmenu', { event: $event, node: props.node })"
      >
        {{ node.san }}{{ nagInfo ? nagInfo.symbol : '' }}
      </span>
      <span
        v-if="node.comment"
        class="ml-1.5 inline-block max-w-[320px] rounded-r border-l-2 border-brand bg-elevated/60 px-1.5 py-0.5 align-middle font-display text-[0.82em] whitespace-normal text-text-secondary italic"
        :title="node.comment"
      >
        {{ node.comment }}
      </span>
    </span>

    <!-- Branching Logic -->
    <div class="inline">
      <!-- 1. Variations first (if any) -->
      <div
        v-if="variations.length > 0"
        class="my-1.5 ml-3 block rounded-r-md border-l-2 border-border-hover bg-elevated/30 py-1 pl-3"
      >
        <div
          v-for="(vNode, idx) in variations"
          :key="idx"
          class="mb-1 block text-[0.92em] last:mb-0"
        >
          <PgnTreeNode
            :node="vNode"
            :depth="(depth || 0) + 1"
            :read-only="readOnly"
            @contextmenu="emit('contextmenu', $event)"
          />
        </div>
      </div>

      <!-- 2. Continue Mainline -->
      <PgnTreeNode
        v-if="mainlineChild"
        :node="mainlineChild"
        :depth="depth"
        :is-mainline="true"
        :read-only="readOnly"
        @contextmenu="emit('contextmenu', $event)"
      />
    </div>
  </div>
</template>
