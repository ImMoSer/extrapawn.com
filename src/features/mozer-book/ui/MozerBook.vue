<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { useMozerBookStore } from '../index'
import { pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { InformationCircleOutline, LeafOutline, OpenOutline } from '@vicons/ionicons5'
import { NIcon, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WikiInfoResponse } from '@/entities/opening'
import MozerBookFooter from './MozerBookFooter.vue'
import MozerBookRow from './MozerBookRow.vue'
import TheoryExplorerModal from './TheoryExplorerModal.vue'
import { type TheoryItemWithChildren } from './types'

const props = defineProps<{
  blurred?: boolean
  isPaused?: boolean
}>()

const { t } = useI18n()
const boardStore = useBoardStore()
const mozerStore = useMozerBookStore()

const stats = computed(() => mozerStore.currentStats)
const loading = computed(() => mozerStore.isLoading)

const currentFen = computed(() => mozerStore.currentFen)



const turn = computed(() => {
  const parts = currentFen.value.split(' ')
  return parts[1] === 'w' ? 'white' : 'black'
})

const fullMoveNumber = computed(() => {
  const parts = currentFen.value.split(' ')
  const moveNumStr = parts[5]
  return moveNumStr ? parseInt(moveNumStr) || 1 : 1
})

const showTheory = ref(false)

function handleSelectMove(uci: string) {
  boardStore.applyUciMove(uci)
  showTheory.value = false
}

// Watch both version and the fen property from store
watch(
  [pgnTreeVersion, () => boardStore.fen],
  () => {
    if (props.isPaused) return
    mozerStore.fetchStats()
    showTheory.value = false // Close theory when position changes
  },
  { immediate: true },
)

const theoryWithChildren = computed<TheoryItemWithChildren[]>(() => {
  if (!stats.value?.wiki?.forward_moves) return []

  return stats.value.wiki.forward_moves
    .map((tItem) => {
      // Find matching move in stats to get children and statistics
      const matchingMove = stats.value?.moves.find((m) => m.uci === tItem.uci)
      const count = matchingMove ? matchingMove.total : 0

      return {
        san: tItem.san,
        uci: tItem.uci,
        name: tItem.name,
        eco: tItem.eco,
        nag: matchingMove?.nag || 0,
        total: count,
        win_p: matchingMove?.win_p || 0,
        draw_p: matchingMove?.draw_p || 0,
        loss_p: matchingMove?.loss_p || 0,
        children: matchingMove?.children || [],
      } as TheoryItemWithChildren
    })
    .sort((a, b) => b.total - a.total) // Sort by popularity
})

const lastKnownWiki = ref<WikiInfoResponse | null>(null)

watch(
  () => stats.value?.wiki,
  (newWiki) => {
    if (newWiki) {
      if (newWiki.node_id === 0) {
        lastKnownWiki.value = null
      } else {
        lastKnownWiki.value = newWiki
      }
    }
  },
  { immediate: true }
)

const displayedWiki = computed(() => {
  const currentWiki = stats.value?.wiki
  if (currentWiki && currentWiki.node_id !== 0) {
    return currentWiki
  }
  return lastKnownWiki.value
})

const isSticky = computed(() => !stats.value?.wiki && !!displayedWiki.value)

const formattedUciPath = computed(() => {
  const sanList = displayedWiki.value?.canonical_san_path || []
  const formatted: string[] = []
  for (let i = 0; i < sanList.length; i++) {
    const move = sanList[i]
    if (!move) continue
    if (i % 2 === 0) {
      formatted.push(`${Math.floor(i / 2) + 1}. ${move}`)
    } else {
      formatted.push(move)
    }
  }
  return formatted.join(' ')
})

const openingNameParts = computed(() => {
  const name = displayedWiki.value?.name || ''
  if (!name) return []
  if (name.includes(':')) {
    const idx = name.indexOf(':')
    return [name.substring(0, idx + 1).trim(), name.substring(idx + 1).trim()]
  }
  return [name]
})
</script>

<template>
  <div class="mozer-book" :class="{ blurred: blurred }">
    <div v-if="blurred" class="overlay">
      <n-text strong depth="1">{{ t('features.analysis.reviewModeOverlay') }}</n-text>
    </div>

    <div class="book-header">
      <div class="header-main">
        <n-icon size="18" class="tree-icon">
          <LeafOutline />
        </n-icon>
        <span class="book-title">MozerBook</span>
        <span class="header-n" v-if="stats?.summary">
          (N={{ stats.summary.total.toLocaleString() }})</span
        >
      </div>
      <div class="header-actions">
        <n-icon
          size="18"
          class="info-icon"
          :class="{ active: showTheory }"
          @click.stop="showTheory = !showTheory"
        >
          <InformationCircleOutline />
        </n-icon>
      </div>
    </div>

    <!-- Opening Info Banner & Wiki Path -->
    <div v-if="displayedWiki" class="opening-info-section">
      <div class="opening-title-row">
        <span class="opening-name">
          <span>{{ openingNameParts[0] }}</span>
          <span v-if="openingNameParts[1]" class="opening-name-sub">{{ openingNameParts[1] }}</span>
        </span>
        <div class="opening-badges">
          <span class="sticky-theory-badge" v-if="isSticky">Last Theory</span>
          <span v-if="displayedWiki.eco !== '-'" class="eco-badge">{{ displayedWiki.eco }}</span>
          <a
            v-if="displayedWiki.wikibooks_url"
            :href="displayedWiki.wikibooks_url"
            target="_blank"
            rel="noopener noreferrer"
            class="external-link"
            title="Open Wikibooks opening page"
          >
            <n-icon size="14"><OpenOutline /></n-icon>
          </a>
        </div>
      </div>
      <div class="wiki-path-box" v-if="formattedUciPath">
        <span class="path-label">Wiki Path</span>
        <span class="path-moves">{{ formattedUciPath }}</span>
      </div>
    </div>

    <!-- Full Theory Modal Component -->
    <TheoryExplorerModal
      v-model:show="showTheory"
      :theory-items="theoryWithChildren"
      :turn="turn"
      @select="handleSelectMove"
    />

    <div class="book-header-labels">
      <div class="col-move">Move</div>
      <div class="col-n">N</div>
      <div class="col-pct">WDL</div>
      <div class="col-n-pct">N%</div>
      <div class="col-perf">Perf</div>
    </div>

    <div class="book-body">
      <template v-if="stats && stats.moves && stats.moves.length > 0">
        <MozerBookRow
          v-for="move in stats.moves"
          :key="move.uci"
          :move="move"
          :turn="turn"
          :full-move-number="fullMoveNumber"
          :summary-total="stats.summary?.total || 0"
          @select="handleSelectMove"
        />
      </template>

      <div v-else-if="!loading" class="out-of-book-state">
        <div class="out-of-book-title">Middlegame / Endgame</div>
        <div class="out-of-book-subtitle">Theoretical opening stage completed</div>
      </div>
    </div>

    <MozerBookFooter v-if="stats?.summary" :summary="stats.summary" :turn="turn" />
  </div>
</template>

<style scoped>
.mozer-book {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  font-size: 13px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 100%;
  min-height: 0;
  position: relative;
}

.blurred {
  filter: blur(8px);
  pointer-events: none;
  opacity: 0.6;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 10;
}

.book-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid var(--color-border);
  font-weight: bold;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 4px;
}

.tree-icon {
  color: #2e7d32;
}

.header-n {
  font-size: 12px;
  font-weight: normal;
  opacity: 0.7;
}

.header-actions {
  display: flex;
  align-items: center;
}

.info-icon {
  cursor: pointer;
  transition: color 0.2s;
  opacity: 0.7;
}

.info-icon:hover,
.info-icon.active {
  color: #2e7d32;
  opacity: 1;
}

.book-header-labels {
  display: flex;
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--color-border);
  font-size: 11px;
  font-weight: bold;
  text-align: right;
  color: var(--color-text-secondary);
}

.book-header-labels > div {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.col-move {
  width: 80px;
  justify-content: flex-start !important;
  text-align: left;
}

.col-n {
  width: 60px;
  padding-right: 8px;
}

.col-pct {
  width: 80px;
  padding: 0 4px;
}

.col-n-pct {
  width: 50px;
  padding-right: 4px;
}

.col-perf {
  width: 50px;
  padding-right: 4px;
}

.book-body {
  max-height: 310px;
  overflow-y: auto;
  position: relative;
  background: transparent;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

.empty-state {
  padding: 20px;
  text-align: center;
  color: #888;
}
.opening-info-section {
  padding: 10px 12px;
  background: rgba(46, 125, 50, 0.04);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.opening-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.opening-name {
  font-size: 13px;
  font-weight: 700;
  color: #fafafa;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.3;
}

.opening-name-sub {
  font-size: 11px;
  color: #a1a1aa;
  font-weight: 500;
}

.opening-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.eco-badge {
  font-size: 10px;
  font-weight: 700;
  background-color: rgba(46, 125, 50, 0.15);
  color: #4caf50;
  border: 1px solid rgba(46, 125, 50, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
}

.external-link {
  color: #2e7d32;
  transition: opacity 0.2s, transform 0.2s;
  display: flex;
  align-items: center;
  opacity: 0.7;
}

.external-link:hover {
  opacity: 1;
  transform: scale(1.1);
}

.wiki-path-box {
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
  border: 1px solid rgba(255, 255, 255, 0.03);
}

.path-label {
  color: #52525b;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  margin-right: 6px;
  display: inline-block;
}

.path-moves {
  color: #a1a1aa;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.sticky-theory-badge {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background-color: rgba(217, 119, 6, 0.1);
  color: #fbbf24;
  border: 1px solid rgba(217, 119, 6, 0.3);
  padding: 1px 5px;
  border-radius: 4px;
}

.out-of-book-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 120px;
  text-align: center;
  padding: 24px;
  color: #71717a;
}

.out-of-book-title {
  font-size: 13px;
  font-weight: 600;
  color: #e4e4e7;
  margin-bottom: 4px;
}

.out-of-book-subtitle {
  font-size: 11px;
  color: #52525b;
}
</style>
