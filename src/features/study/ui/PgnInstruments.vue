<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { useStudyStore } from '@/entities/study'
import { pgnService, pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import {
  ChatboxEllipsesOutline,
  CutOutline as CutIcon,
  TrashOutline as TrashIcon,
  SaveOutline as SaveIcon,
  ChevronUpOutline as CollapseIcon,
  CopyOutline as CopyIcon,
  DownloadOutline as DownloadIcon,
  CloseOutline as CloseIcon,
  RefreshOutline as RevertIcon,
} from '@vicons/ionicons5'
import { Chess } from 'chessops/chess'
import { makeFen, parseFen } from 'chessops/fen'
import { makeSan } from 'chessops/san'
import { parseUci as parseUciMove } from 'chessops/util'
import { NButton, NButtonGroup, NIcon, NInput, useMessage, useDialog } from 'naive-ui'
import { computed, ref, watch } from 'vue'

const boardStore = useBoardStore()
const studyStore = useStudyStore()
const message = useMessage()
const dialog = useDialog()

const currentNode = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  return pgnService.getCurrentNode()
})

const canEdit = computed(() => studyStore.canEditActiveChapter)
const isDirty = computed(() => studyStore.isDirty)

const handleSaveStudy = async () => {
  if (!canEdit.value) return
  try {
    await studyStore.persistActiveChapter()
    message.success('Studie erfolgreich gespeichert.')
  } catch (error) {
    console.error(error)
    message.error('Fehler beim Speichern der Studie.')
  }
}

const handleRevertStudy = () => {
  dialog.warning({
    title: 'Änderungen verwerfen',
    content:
      'Möchtest du wirklich alle ungespeicherten Änderungen verwerfen und zum letzten Speicherstand zurückkehren?',
    positiveText: 'Ja, verwerfen',
    negativeText: 'Abbrechen',
    onPositiveClick: () => {
      studyStore.revertActiveChapter()
      boardStore.syncBoardWithPgn()
      message.info('Änderungen verworfen.')
    },
  })
}

const activeTab = ref<'nag' | 'comment' | 'pgn' | null>(null)
const commentText = ref('')

const pgnText = computed(() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const v = pgnTreeVersion.value
  const tags = studyStore.activeChapter?.tags || {}
  return pgnService.getFullPgn(tags)
})

watch(
  () => currentNode.value,
  (node) => {
    if (node && node.comment) {
      commentText.value = node.comment
    } else {
      commentText.value = ''
    }
  },
)

const toggleTab = (tab: 'nag' | 'comment' | 'pgn') => {
  if (activeTab.value === tab) {
    activeTab.value = null
  } else {
    activeTab.value = tab
    if (tab === 'comment') {
      commentText.value = currentNode.value?.comment || ''
    }
  }
}

const copyPgn = () => {
  navigator.clipboard.writeText(pgnText.value)
  message.success('PGN in Zwischenablage kopiert.')
}

const downloadPgn = () => {
  const blob = new Blob([pgnText.value], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${studyStore.activeChapter?.name || 'chapter'}.pgn`
  a.click()
  URL.revokeObjectURL(url)
}

const saveComment = () => {
  if (currentNode.value && currentNode.value.id !== '__ROOT__') {
    pgnService.updateNode(currentNode.value, { comment: commentText.value })
  }
}

const removeComment = () => {
  if (currentNode.value && currentNode.value.id !== '__ROOT__') {
    pgnService.updateNode(currentNode.value, { comment: undefined })
    commentText.value = ''
  }
}

const nagOptions = [
  { label: '!!', value: 3 },
  { label: '!', value: 1 },
  { label: '!?', value: 5 },
  { label: '?!', value: 6 },
  { label: '?', value: 2 },
  { label: '??', value: 4 },
]

const currentNag = computed(() => currentNode.value?.nag || null)

const toggleNag = (nagValue: number | null) => {
  if (!currentNode.value || currentNode.value.id === '__ROOT__') return
  const newValue = currentNag.value === nagValue || nagValue === null ? undefined : nagValue
  pgnService.updateNode(currentNode.value, { nag: newValue })
}

const handleCutAfter = () => {
  pgnService.deleteCurrentNode()
  boardStore.syncBoardWithPgn()
}

const isMainline = computed(() => {
  let temp = currentNode.value
  if (!temp || temp.id === '__ROOT__') return false
  while (temp.parent) {
    if (temp.parent.children[0] !== temp) {
      return false
    }
    temp = temp.parent
  }
  return true
})

const handleCutBefore = () => {
  const node = currentNode.value
  if (!node || node.id === '__ROOT__' || !isMainline.value) return

  const fenParts = node.fenBefore.split(' ')
  fenParts[4] = '0'
  fenParts[5] = '1'
  const newRootFen = fenParts.join(' ')

  interface OrigNode {
    uci: string
    children: OrigNode[]
    comment?: string
    nag?: number
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extractSubtree = (n: any): OrigNode => ({
    uci: n.uci,
    comment: n.comment,
    nag: n.nag,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    children: n.children.map((c: any) => extractSubtree(c)),
  })

  const extracted = extractSubtree(node)
  pgnService.reset(newRootFen)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addChildren = (parentChess: any, origNodes: OrigNode[]) => {
    for (const origNode of origNodes) {
      const move = parseUciMove(origNode.uci)
      if (!move) continue

      const clone = parentChess.clone()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const san = makeSan(parentChess as any, move)
      const fenBefore = makeFen(parentChess.toSetup())
      clone.play(move)
      const fenAfter = makeFen(clone.toSetup())

      const newNode = pgnService.addNode({
        san,
        uci: origNode.uci,
        fenBefore,
        fenAfter,
        comment: origNode.comment,
      })
      if (newNode) {
        if (origNode.nag !== undefined) newNode.nag = origNode.nag
        addChildren(clone, origNode.children)
        if (newNode.parent) pgnService.navigateToNode(newNode.parent)
      }
    }
  }

  const setup = parseFen(newRootFen).unwrap()
  const currentChess = Chess.fromSetup(setup).unwrap()
  addChildren(currentChess, [extracted])

  const newRoot = pgnService.getRootNode()
  const firstChild = newRoot.children[0]
  if (firstChild) {
    pgnService.navigateToNode(firstChild)
  } else {
    pgnService.navigateToNode(newRoot)
  }

  if (studyStore.activeChapter) {
    studyStore.activeChapter.root = newRoot
    studyStore.activeChapter.tags['FEN'] = newRootFen
    studyStore.activeChapter.tags['SetUp'] = '1'

    const isStartPos = newRootFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    studyStore.activeChapter.start_position = isStartPos
    studyStore.activeChapter.chapter_type = isStartPos ? 'repertoire' : 'speedrun'
  }

  boardStore.syncBoardWithPgn()
}
</script>

<template>
  <div class="pgn-instruments-container" v-if="currentNode">
    <!-- MAIN ROW -->
    <div class="instruments-main-row">
      <!-- Cut Before -->
      <n-button
        size="small"
        @click="handleCutBefore"
        class="cut-before-btn"
        :disabled="!canEdit || !isMainline || currentNode.id === '__ROOT__'"
        title="Davor abschneiden"
      >
        <template #icon>
          <n-icon style="transform: rotate(180deg)"><CutIcon /></n-icon>
        </template>
      </n-button>

      <!-- Cut After -->
      <n-button
        size="small"
        @click="handleCutAfter"
        class="cut-after-btn"
        :disabled="!canEdit || currentNode.id === '__ROOT__'"
        title="Ab hier schneiden"
      >
        <template #icon>
          <n-icon><CutIcon /></n-icon>
        </template>
      </n-button>

      <div class="divider"></div>

      <!-- NAG Tab Button -->
      <n-button
        size="small"
        :type="activeTab === 'nag' ? 'primary' : currentNag ? 'info' : 'default'"
        @click="toggleTab('nag')"
        :disabled="currentNode.id === '__ROOT__'"
        title="NAGs anzeigen"
        class="tab-btn nag-tab-btn"
      >
        !?
      </n-button>

      <!-- Comment Tab Button -->
      <n-button
        size="small"
        :type="activeTab === 'comment' ? 'primary' : currentNode.comment ? 'info' : 'default'"
        @click="toggleTab('comment')"
        title="Kommentare anzeigen"
        class="tab-btn"
      >
        <template #icon
          ><n-icon><ChatboxEllipsesOutline /></n-icon
        ></template>
      </n-button>

      <!-- PGN Tab Button -->
      <n-button
        size="small"
        :type="activeTab === 'pgn' ? 'primary' : 'default'"
        @click="toggleTab('pgn')"
        title="PGN anzeigen"
        class="tab-btn"
      >
        PGN
      </n-button>

      <div class="divider"></div>

      <!-- SAVE ACTION -->
      <n-button
        size="small"
        :type="isDirty && canEdit ? 'primary' : 'default'"
        @click="handleSaveStudy"
        :disabled="!canEdit || !isDirty"
        title="Alle Änderungen speichern"
        :class="{ 'save-btn': isDirty && canEdit }"
      >
        <template #icon
          ><n-icon><SaveIcon /></n-icon
        ></template>
        SAVE
      </n-button>

      <!-- REVERT ACTION -->
      <n-button
        size="small"
        @click="handleRevertStudy"
        :disabled="!isDirty"
        title="Änderungen verwerfen (Reset)"
        class="revert-btn"
      >
        <template #icon
          ><n-icon><RevertIcon /></n-icon
        ></template>
      </n-button>
    </div>

    <!-- SECONDARY ROW -->
    <div
      v-if="activeTab"
      class="instruments-sub-row"
      :class="{ 'flex-col': activeTab === 'comment' || activeTab === 'pgn' }"
    >
      <!-- NAG Content -->
      <n-button-group v-if="activeTab === 'nag'" size="small">
        <n-button
          size="small"
          @click="toggleNag(null)"
          ghost
          class="nag-btn"
          :disabled="!canEdit"
          title="NAG entfernen"
          >X</n-button
        >
        <n-button
          v-for="nag in nagOptions"
          :key="nag.value"
          :type="currentNag === nag.value ? 'primary' : 'default'"
          @click="toggleNag(nag.value)"
          :disabled="!canEdit"
          ghost
          class="nag-btn"
        >
          {{ nag.label }}
        </n-button>
      </n-button-group>

      <!-- Comment Content -->
      <template v-else-if="activeTab === 'comment'">
        <n-input
          v-model:value="commentText"
          type="textarea"
          :autosize="{ minRows: 2 }"
          size="small"
          placeholder="Kommentar..."
          class="comment-input"
          :readonly="!canEdit"
          @keydown.esc="activeTab = null"
        />
        <div class="comment-actions">
          <template v-if="canEdit">
            <n-button size="small" type="primary" @click="saveComment" title="Speichern">
              <template #icon
                ><n-icon><SaveIcon /></n-icon
              ></template>
            </n-button>
            <n-button
              v-if="currentNode.comment || commentText"
              size="small"
              quaternary
              @click="removeComment"
              title="Kommentar löschen"
            >
              <template #icon
                ><n-icon><TrashIcon /></n-icon
              ></template>
            </n-button>
          </template>
          <n-button
            size="small"
            @click="activeTab = null"
            :title="canEdit ? 'Zuklappen' : 'Schließen'"
          >
            <template #icon
              ><n-icon><CollapseIcon v-if="canEdit" /><CloseIcon v-else /></n-icon
            ></template>
          </n-button>
        </div>
      </template>

      <!-- PGN Content -->
      <template v-else-if="activeTab === 'pgn'">
        <n-input
          :value="pgnText"
          type="textarea"
          :autosize="{ minRows: 4, maxRows: 15 }"
          size="small"
          readonly
          class="comment-input"
        />
        <div class="comment-actions">
          <n-button size="small" type="primary" @click="copyPgn" title="Kopieren">
            <template #icon
              ><n-icon><CopyIcon /></n-icon
            ></template>
          </n-button>
          <n-button size="small" @click="downloadPgn" title="Herunterladen">
            <template #icon
              ><n-icon><DownloadIcon /></n-icon
            ></template>
          </n-button>
          <n-button size="small" @click="activeTab = null" title="Schließen">
            <template #icon
              ><n-icon><CloseIcon /></n-icon
            ></template>
          </n-button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pgn-instruments-container {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border, #444);
  flex-shrink: 0;
  padding: 8px 10px;
  gap: 8px;
}

.instruments-main-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  white-space: nowrap;
}

.instruments-main-row::-webkit-scrollbar {
  height: 4px;
}
.instruments-main-row::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.instruments-sub-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  overflow-x: auto;
  white-space: nowrap;
}

.instruments-sub-row.flex-col {
  flex-direction: column;
  align-items: stretch;
  white-space: normal;
}

.instruments-sub-row::-webkit-scrollbar {
  height: 4px;
}
.instruments-sub-row::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.divider {
  width: 1px;
  height: 20px;
  background: var(--color-border, #444);
  margin: 0 4px;
}

.nag-btn {
  font-weight: bold;
  font-family: 'JetBrains Mono', monospace;
  padding: 0 6px;
}

.tab-btn {
  font-weight: bold;
}
.nag-tab-btn {
  font-family: 'JetBrains Mono', monospace;
}

.comment-actions {
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  gap: 6px;
  width: 100%;
}

.comment-input {
  width: 100%;
  flex: 1;
  word-break: normal;
  white-space: pre-wrap;
}

.cut-after-btn:hover {
  color: #ef4444 !important;
  border-color: #ef4444 !important;
}

.cut-before-btn:hover:not(:disabled) {
  color: #f59e0b !important;
  border-color: #f59e0b !important;
}

.save-btn {
  background-color: var(--neon-cyan, #00f3ff) !important;
  color: #000 !important;
  font-weight: 800 !important;
  box-shadow: 0 0 10px var(--neon-cyan, #00f3ff);
  animation: pulse 2s infinite;
}

.revert-btn {
  border-color: #ef4444 !important;
  color: #ef4444 !important;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 5px var(--neon-cyan, #00f3ff);
  }
  50% {
    box-shadow: 0 0 15px var(--neon-cyan, #00f3ff);
  }
  100% {
    box-shadow: 0 0 5px var(--neon-cyan, #00f3ff);
  }
}
</style>
