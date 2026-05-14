<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { useStudyStore, isNodeNeedingTrim } from '@/entities/study'
import type { PgnNode } from '@/shared/lib/pgn/PgnService'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { NDropdown, NInput, NModal } from 'naive-ui'
import { computed, nextTick, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    node: PgnNode
    forceNumber?: boolean
    depth?: number
    mode?: 'all' | 'san' | 'continuation'
  }>(),
  {
    depth: 0,
    mode: 'all',
  },
)

const boardStore = useBoardStore()
const studyStore = useStudyStore()

const needsTrim = computed(() => {
  const v = pgnTreeVersion.value // react to changes
  const activeChapter = studyStore.activeChapter
  if (!activeChapter || activeChapter.chapter_type !== 'repertoire' || !activeChapter.color)
    return false
  return isNodeNeedingTrim(props.node, activeChapter.color)
})

const isActive = computed(() => {
  const v = pgnTreeVersion.value
  return pgnService.getCurrentNode() === props.node
})

const depthClass = computed(() => {
  const d = props.depth
  if (d === 0) return 'pgn-lvl-main'
  if (d === 1) return 'pgn-lvl-2'
  if (d === 2) return 'pgn-lvl-3'
  return 'pgn-lvl-4'
})

const moveNumber = computed(() => {
  const ply = props.node.ply
  const moveNum = Math.ceil(ply / 2)
  const isWhite = ply % 2 === 1

  if (isWhite) return `${moveNum}.`
  if (props.forceNumber) return `${moveNum}...`
  return ''
})

const children = computed(() => {
  const v = pgnTreeVersion.value
  return [...props.node.children]
})
const mainlineChild = computed(() => children.value[0])
const variations = computed(() => children.value.slice(1))

const activateNode = () => {
  pgnService.navigateToNode(props.node)
  boardStore.syncBoardWithPgn()
}

// --- context menu logic ---
const showDropdown = ref(false)
const x = ref(0)
const y = ref(0)

const nagMap: Record<number, string> = {
  1: '!',
  2: '?',
  3: '!!',
  4: '??',
  5: '!?',
  6: '?!',
  14: '±',
  15: '∓',
  18: '+-',
  19: '-+',
}

const dropdownOptions = computed(() => [
  {
    label: 'Promote Variation',
    key: 'promote-variant',
    disabled: !props.node.parent || props.node.parent.children[0] === props.node,
  },
  {
    label: 'Make Mainline',
    key: 'promote-mainline',
    disabled: isOnLevelZero.value,
  },
  {
    label: 'Glyphs',
    key: 'glyphs',
    children: [
      { label: 'None', key: 'nag-0' },
      { label: '! (Good Move)', key: 'nag-1' },
      { label: '? (Mistake)', key: 'nag-2' },
      { label: '!! (Brilliant)', key: 'nag-3' },
      { label: '?? (Blunder)', key: 'nag-4' },
      { label: '!? (Interesting)', key: 'nag-5' },
      { label: '?! (Dubious)', key: 'nag-6' },
      { label: '± (White is Better)', key: 'nag-14' },
      { label: '∓ (Black is Better)', key: 'nag-15' },
      { label: '+- (White is Winning)', key: 'nag-18' },
      { label: '-+ (Black is Winning)', key: 'nag-19' },
    ],
  },
  {
    label: 'Comment',
    key: 'comment',
  },
  {
    label: 'Delete',
    key: 'delete',
    disabled: props.node.id === '__ROOT__',
  },
])

const isOnLevelZero = computed(() => {
  let current: PgnNode | undefined = props.node
  while (current && current.parent) {
    if (current.parent.children[0] !== current) return false
    current = current.parent
  }
  return true
})

const handleContextMenu = (e: MouseEvent) => {
  if (props.node.id === '__ROOT__') return
  e.preventDefault()
  e.stopPropagation()
  showDropdown.value = false
  nextTick().then(() => {
    showDropdown.value = true
    x.value = e.clientX
    y.value = e.clientY
  })
}

const handleSelect = (key: string) => {
  showDropdown.value = false
  if (key === 'promote-variant') {
    pgnService.promoteToVariantMainline(props.node)
  } else if (key === 'promote-mainline') {
    pgnService.promoteToMainline(props.node)
  } else if (key === 'delete') {
    pgnService.deleteNode(props.node)
    boardStore.syncBoardWithPgn()
  } else if (key === 'comment') {
    openCommentModal()
  } else if (key.startsWith('nag-')) {
    const nag = parseInt(key.replace('nag-', ''))
    pgnService.updateNode(props.node, { nag: nag || undefined })
  }
}

const toggleCollapse = () => {
  pgnService.toggleNodeCollapse(props.node)
}

const showToggleDropdown = ref(false)
const tx = ref(0)
const ty = ref(0)

const handleToggleContextMenu = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  showToggleDropdown.value = false
  nextTick().then(() => {
    showToggleDropdown.value = true
    tx.value = e.clientX
    ty.value = e.clientY
  })
}

const toggleOptions = [
  { label: 'Collapse ALL variants', key: 'collapse-global' },
  { label: 'Expand ALL variants', key: 'expand-global' },
  { label: 'Collapse this branch', key: 'collapse-all' },
  { label: 'Expand this branch', key: 'expand-all' },
]

const handleToggleSelect = (key: string) => {
  showToggleDropdown.value = false
  if (key === 'collapse-global') {
    pgnService.setCollapseGlobal(true)
  } else if (key === 'expand-global') {
    pgnService.setCollapseGlobal(false)
  } else if (key === 'collapse-all') {
    pgnService.setCollapseRecursive(props.node, true)
  } else if (key === 'expand-all') {
    pgnService.setCollapseRecursive(props.node, false)
  }
}

const isCollapsed = computed(() => {
  const v = pgnTreeVersion.value
  return props.node.isCollapsed
})

// --- comment modal logic ---
const showCommentModal = ref(false)
const commentText = ref('')

const openCommentModal = () => {
  // Show only text to the user
  commentText.value = pgnService.getCleanComment(props.node.comment || '')
  showCommentModal.value = true
}

const saveComment = () => {
  // Take current user text and re-append existing tags from the raw node comment
  const currentComment = props.node.comment || ''
  const tagMatch = currentComment.match(/\[%(cal|csl)\s+[^\]]*\]/gi)
  const tags = tagMatch ? tagMatch.join(' ') : ''

  const finalComment = tags
    ? commentText.value
      ? `${commentText.value} ${tags}`
      : tags
    : commentText.value

  pgnService.updateNode(props.node, { comment: finalComment })
}

// --- comment parsing ---
const hasShapes = computed(() => {
  return props.node.comment?.includes('[%cal') || props.node.comment?.includes('[%csl')
})

const parsedComment = computed(() => {
  if (!props.node.comment) return null
  const comment = props.node.comment

  // Look for N:..., W:..., D:... (Hero moves)
  const statsMatch = comment.match(/N:(\d+),\s*W:(\d+)%,\s*D:(\d+)%/)
  // Look for P:... (Opponent moves)
  const probMatch = comment.match(/P:(\d+)%/)

  let cleanComment = pgnService.getCleanComment(comment)
  if (statsMatch) cleanComment = cleanComment.replace(statsMatch[0], '').trim()
  if (probMatch) cleanComment = cleanComment.replace(probMatch[0], '').trim()

  return {
    n: statsMatch ? statsMatch[1] : null,
    w: statsMatch ? statsMatch[2] : null,
    d: statsMatch ? statsMatch[3] : null,
    p: probMatch ? probMatch[1] : null,
    text: cleanComment,
  }
})

// --- eval formatting ---
const formatEval = (val: number) => {
  if (Math.abs(val) > 10000) {
    // Mate
    const moves = Math.abs(val) - 100000
    return (val > 0 ? '#' : '-#') + moves
  }
  const cp = val / 100
  return (cp > 0 ? '+' : '') + cp.toFixed(1)
}

const getEvalClass = (val: number) => {
  if (val > 0.5) return 'pos-white'
  if (val < -0.5) return 'pos-black'
  return ''
}
</script>

<script lang="ts">
export default {
  name: 'StudyTreeNode',
}
</script>

<template>
  <div class="study-node">
    <n-dropdown
      trigger="manual"
      :show="showDropdown"
      :options="dropdownOptions"
      :x="x"
      :y="y"
      @clickoutside="showDropdown = false"
      @select="handleSelect"
    />

    <!-- 1. The move itself (SAN) -->
    <template v-if="node.id !== '__ROOT__' && mode !== 'continuation'">
      <span
        class="move-san"
        :class="[
          depthClass,
          {
            active: isActive,
            'has-comment': !!node.comment,
            'speedrun-node': node.metadata?.isSpeedrun,
            'needs-trim': needsTrim,
          },
        ]"
        @click.stop="activateNode"
        @contextmenu="handleContextMenu"
      >
        <span v-if="moveNumber" class="move-index">{{ moveNumber }}</span>
        <span class="san-text">{{ node.san }}</span>
        <span v-if="node.nag" class="nag-text">{{ nagMap[node.nag] }}</span>

        <!-- Repertoire Stats -->
        <template v-if="parsedComment">
          <span v-if="parsedComment.p" class="stat-badge prob" title="Opponent Probability">
            {{ parsedComment.p }}%
          </span>
          <span
            v-if="parsedComment.w"
            class="stat-badge win"
            :title="`Games in DB. Draw: ${parsedComment.d}%`"
          >
            {{ parsedComment.w }}%
          </span>
        </template>

        <span v-if="parsedComment?.text" class="comment-indicator" :title="parsedComment.text"
          >💬</span
        >
        <span
          v-else-if="node.comment && !parsedComment"
          class="comment-indicator"
          :title="node.comment"
          >💬</span
        >

        <span v-if="hasShapes" class="shape-indicator" title="Markers (Arrows/Circles)">🎨</span>

        <span v-if="node.eval !== undefined" class="eval-tag" :class="getEvalClass(node.eval)">
          {{ formatEval(node.eval) }}
        </span>
      </span>
    </template>

    <!-- 2. Children section (Next moves) -->
    <template v-if="mode !== 'san' && mainlineChild">
      <!-- A. Render the next move's SAN -->
      <StudyTreeNode :node="mainlineChild" mode="san" :depth="depth" />

      <!-- B. Render alternatives to that next move -->
      <div v-if="variations.length > 0" class="variations-container">
        <n-dropdown
          trigger="manual"
          :show="showToggleDropdown"
          :options="toggleOptions"
          :x="tx"
          :y="ty"
          @clickoutside="showToggleDropdown = false"
          @select="handleToggleSelect"
        />
        <button
          class="collapse-toggle"
          @click.stop="toggleCollapse"
          @contextmenu="handleToggleContextMenu"
        >
          {{ isCollapsed ? '+' : '-' }}
        </button>
        <div v-show="!isCollapsed" class="variations-list">
          <div v-for="variant in variations" :key="variant.id" class="variation-line">
            <span class="variation-brace">(</span>
            <StudyTreeNode :node="variant" mode="all" :depth="depth + 1" :force-number="true" />
            <span class="variation-brace">)</span>
          </div>
        </div>
      </div>

      <!-- C. Render the continuation of the next move -->
      <StudyTreeNode
        :node="mainlineChild"
        mode="continuation"
        :depth="depth"
        :force-number="variations.length > 0 || !!mainlineChild.comment"
      />
    </template>

    <n-modal
      v-model:show="showCommentModal"
      preset="dialog"
      title="Edit Comment"
      positive-text="Save"
      negative-text="Cancel"
      @positive-click="saveComment"
    >
      <n-input v-model:value="commentText" type="textarea" placeholder="Enter comment..." />
    </n-modal>
  </div>
</template>

<style scoped>
.study-node {
  display: inline;
}

.move-san {
  cursor: pointer;
  padding: 1px 1px;
  /* Отступы вокруг каждого хода (внутренние) */
  border-radius: 3px;
  margin-right: 2px;
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  color: var(--color-text-primary, #e0e0e0);

  /* --- ТОЧЕЧНАЯ НАСТРОЙКА ХОДА --- */
  letter-spacing: -0.015em;
  /* Межбуквенный интервал конкретно для хода */
  word-spacing: 0.5px;
  /* Расстояние между номером хода и SAN (например 1. e4) */
}

.pgn-lvl-main {
  font-size: var(--font-size-pgn_mainline);
  color: var(--color-pgn_mainline);
}

.pgn-lvl-2 {
  font-size: var(--font-size-pgn_secondline);
  color: var(--color-pgn_secondline);
}

.pgn-lvl-3 {
  font-size: var(--font-size-pgn_thirdline);
  color: var(--color-pgn_thirdline);
}

.pgn-lvl-4 {
  font-size: var(--font-size-pgn_fourthline);
  color: var(--color-pgn_fourthline);
}

.move-san:hover {
  background-color: var(--color-bg-tertiary, #3a3a3a);
}

.move-san.active {
  background-color: var(--color-accent-primary, #369a3c);
  color: white;
  font-weight: bold;
}

.move-san.speedrun-node {
  color: var(--neon-orange, #ff5500);
  border: 1px solid rgba(255, 85, 0, 0.3);
}

.move-san.speedrun-node.active {
  background-color: var(--neon-orange, #ff5500);
  color: white;
}

.move-san.needs-trim {
  color: var(--neon-pink, #ff5555);
  text-decoration: underline dotted var(--neon-pink, #ff5555);
  text-underline-offset: 2px;
}

.move-san.needs-trim.active {
  background-color: var(--neon-pink, #ff5555);
  color: white;
  text-decoration: none;
}

.move-index {
  color: var(--color-text-secondary, #888);
  font-size: 0.9em;
  margin-right: 2px;
}

.move-san.active .move-index {
  color: rgba(255, 255, 255, 0.8);
}

.variations-container {
  display: inline-flex;
  align-items: flex-start;
  margin: 0 4px;
  vertical-align: middle;
}

.collapse-toggle {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  border-radius: 3px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  cursor: pointer;
  margin-right: 4px;
  margin-top: 2px;
  transition: all 0.2s;
}

.collapse-toggle:hover {
  background: var(--color-accent-primary);
  color: white;
}

.variations-list {
  display: flex;
  flex-direction: column;
  padding-left: 4px;
  border-left: 2px solid var(--color-border-hover, #444);
}

.variation-line {
  margin-bottom: 2px;
  /* Вертикальный отступ между вариациями в списке */
}

.variation-brace {
  opacity: 0.5;
  margin: 0 2px;
  font-weight: normal;
}

.comment-indicator {
  font-size: 0.8em;
  opacity: 0.7;
}

.shape-indicator {
  font-size: 0.8em;
  opacity: 0.9;
}

.nag-text {
  font-weight: bold;
  color: var(--color-accent-primary);
}

.eval-tag {
  font-size: 0.7em;
  background: #444;
  padding: 1px 3px;
  border-radius: 2px;
}

.pos-white {
  color: #4cd137;
}

.pos-black {
  color: #ff4757;
}

.stat-badge {
  font-size: 0.65em;
  font-weight: bold;
  padding: 0px 3px;
  border-radius: 3px;
  margin: 0 1px;
  display: inline-block;
  line-height: normal;
  vertical-align: middle;
}

.stat-badge.win {
  background: rgba(76, 209, 55, 0.2);
  color: #4cd137;
  border: 1px solid rgba(76, 209, 55, 0.3);
}

.stat-badge.prob {
  background: rgba(0, 168, 255, 0.1);
  color: #00a8ff;
  border: 1px solid rgba(0, 168, 255, 0.3);
}
</style>
