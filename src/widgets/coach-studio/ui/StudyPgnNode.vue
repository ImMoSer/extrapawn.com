<script setup lang="ts">
import { useCoachStudyStore } from '@/features/ai-coach'
import { buildPathFromNode } from '@/shared/lib/pgn/pgnTreeOps'
import { NAG_MAPPING, type PgnNode } from '@/shared/lib/pgn/pgnTypes'
import { ChatbubbleOutline } from '@vicons/ionicons5'
import { NIcon } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    node: PgnNode
    depth?: number
  }>(),
  {
    depth: 0,
  },
)

const { t } = useI18n()
const studyStore = useCoachStudyStore()

const isActive = computed(() => studyStore.currentNode === props.node)
const hasShapes = computed(() => Boolean(props.node.shapes && props.node.shapes.length > 0))
const isLongComment = computed(() => (props.node.comment?.length ?? 0) > 28)
const nodePath = computed(() => (props.node.ply > 0 ? buildPathFromNode(props.node) : ''))
const discussedTurnId = computed<number | null>(() =>
  nodePath.value ? (studyStore.discussedPathsMap.get(nodePath.value) ?? null) : null,
)

/**
 * Standard Lichess PGN numbering:
 * - White moves always display `N.`
 * - Black moves display `N...` ONLY at branch start, root start, or immediately after
 *   a parent comment or sibling variation block (never spamming `12... 13...` inside lines).
 */
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

  const parent = props.node.parent
  if (!parent) return `${fullMove}...`

  const isFirstFromRoot = parent.ply === 0
  const isStartOfVariation = parent.children[0] !== props.node
  const parentHadComment = Boolean(parent.comment)
  const parentHadSiblingVariations = Boolean(
    parent.parent && parent.parent.children[0] === parent && parent.parent.children.length > 1,
  )

  if (isFirstFromRoot || isStartOfVariation || parentHadComment || parentHadSiblingVariations) {
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

/**
 * Ensures NAG semantic color (`text-danger`, `text-orange`, `text-warning`, etc.)
 * is never overridden by Tailwind `text-text-primary` or `text-brand`.
 */
const moveTextColorClass = computed(() => {
  if (qualityColorClass.value) return qualityColorClass.value
  return isActive.value ? 'text-brand' : 'text-text-primary'
})

const mainlineChild = computed(() => props.node.children[0])

/**
 * Standard PGN / Lichess layout: alternatives to `node` (siblings at `parent.children.slice(1)`)
 * render IMMEDIATELY BELOW `node` (after its comment) and BEFORE `node`'s own continuation.
 */
const siblingVariations = computed<PgnNode[]>(() => {
  const parent = props.node.parent
  if (!parent || parent.children[0] !== props.node || parent.children.length <= 1) {
    return []
  }
  return parent.children.slice(1)
})

const handleNavigate = () => {
  studyStore.navigateToNode(props.node)
}

const handleDiscussNode = () => {
  studyStore.requestFocusChatForNode(props.node)
}

const handleJumpToDiscussion = () => {
  studyStore.navigateToNode(props.node)
  if (discussedTurnId.value !== null) {
    studyStore.requestScrollToTurn(discussedTurnId.value, nodePath.value || undefined)
  }
}
</script>

<template>
  <!-- Root wrapper delegates directly to first mainline move -->
  <StudyPgnNode v-if="node.ply === 0 && mainlineChild" :node="mainlineChild" :depth="0" />

  <div v-else-if="node.ply > 0" class="inline" :class="{ 'text-text-secondary': depth > 0 }">
    <span class="mr-1 inline-flex items-baseline py-0.5 whitespace-nowrap">
      <span
        v-if="moveNumber"
        class="mr-[3px] text-[0.82em] font-normal text-text-secondary select-none"
      >
        {{ moveNumber }}
      </span>
      <button
        type="button"
        :data-pgn-active="isActive ? 'true' : undefined"
        :title="t('pages.study.discussMoveHint')"
        class="inline-flex cursor-pointer items-center gap-1 rounded-sm border px-1.5 py-px font-condensed text-[0.95rem] font-semibold transition-colors"
        :class="[
          isActive
            ? 'border-brand/60 bg-brand/15 font-bold'
            : 'border-transparent bg-transparent hover:bg-elevated',
          moveTextColorClass,
        ]"
        @click="handleNavigate"
        @contextmenu.prevent="handleDiscussNode"
      >
        <span>{{ node.san }}{{ nagInfo ? nagInfo.symbol : '' }}</span>
        <span
          v-if="hasShapes"
          class="inline-block h-1.5 w-1.5 rounded-full bg-success"
          aria-hidden="true"
        />
      </button>

      <button
        v-if="discussedTurnId !== null"
        type="button"
        class="ml-0.5 inline-flex cursor-pointer items-center rounded-sm border-none bg-transparent p-0.5 text-brand transition-colors hover:bg-elevated hover:text-text-primary"
        :title="t('pages.study.jumpToDiscussion')"
        @click.stop="handleJumpToDiscussion"
      >
        <NIcon :size="11"><ChatbubbleOutline /></NIcon>
      </button>

      <span
        v-if="node.comment && !isLongComment"
        class="ml-1 inline-block rounded-r-sm border-l-2 border-brand/70 bg-elevated/70 px-1.5 py-0.5 align-middle font-condensed text-[0.76rem] text-text-secondary"
      >
        {{ node.comment }}
      </span>
    </span>

    <div
      v-if="node.comment && isLongComment"
      class="my-1 block rounded-r-sm border-l-2 border-brand bg-elevated/75 px-2 py-1 font-display text-[0.78rem] leading-snug whitespace-normal text-text-secondary"
    >
      {{ node.comment }}
    </div>

    <!-- Sibling alternative variations render IMMEDIATELY BELOW this move (1:1 Lichess order) -->
    <div
      v-if="siblingVariations.length > 0"
      class="my-1.5 ml-2.5 block rounded-r-md border-l-2 border-border-hover bg-elevated/35 py-1 pl-2.5"
    >
      <div
        v-for="(vNode, idx) in siblingVariations"
        :key="`${vNode.id}-${idx}`"
        class="mb-1 block last:mb-0"
      >
        <StudyPgnNode :node="vNode" :depth="depth + 1" />
      </div>
    </div>

    <!-- Continue mainline below -->
    <StudyPgnNode v-if="mainlineChild" :node="mainlineChild" :depth="depth" />
  </div>
</template>
