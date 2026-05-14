<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import { useMozerBookStore } from '../index'
import { pgnTreeVersion } from '@/shared/lib/pgn/PgnService'
import { InformationCircleOutline, LeafOutline } from '@vicons/ionicons5'
import { NIcon, NText } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import MozerBookFooter from './MozerBookFooter.vue'
import MozerBookRow from './MozerBookRow.vue'
import TheoryExplorerModal from './TheoryExplorerModal.vue'
import { type TheoryItemWithChildren } from './types'

import type { DrawShape } from '@lichess-org/chessground/draw'
import type { Key } from '@lichess-org/chessground/types'

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

// Draw arrows for character styles
watch(
  () => stats.value?.styles,
  (styles) => {
    if (!styles) {
      boardStore.setAutoShapes([])
      return
    }

    const shapes: DrawShape[] = []
    const usedUcis = new Set<string>()

    // Priority: Grossmaster (Green) > Hustler (Blue) > Schuler (Red)
    if (styles.grossmaster?.uci) {
      shapes.push({
        orig: styles.grossmaster.uci.slice(0, 2) as Key,
        dest: styles.grossmaster.uci.slice(2, 4) as Key,
        brush: 'green',
      })
      usedUcis.add(styles.grossmaster.uci)
    }

    if (styles.hustler?.uci && !usedUcis.has(styles.hustler.uci)) {
      shapes.push({
        orig: styles.hustler.uci.slice(0, 2) as Key,
        dest: styles.hustler.uci.slice(2, 4) as Key,
        brush: 'blue',
      })
      usedUcis.add(styles.hustler.uci)
    }

    if (styles.schuler?.uci && !usedUcis.has(styles.schuler.uci)) {
      shapes.push({
        orig: styles.schuler.uci.slice(0, 2) as Key,
        dest: styles.schuler.uci.slice(2, 4) as Key,
        brush: 'red',
      })
      usedUcis.add(styles.schuler.uci)
    }

    boardStore.setAutoShapes(shapes)
  },
  { immediate: true },
)

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
    boardStore.setAutoShapes([]) // Clear previous styles while loading
  },
  { immediate: true },
)

onMounted(() => {
  // No need for explicit fetch here as watch(immediate) covers it,
  // and we want to avoid double fetch during mounting.
})

onUnmounted(() => {
  boardStore.setAutoShapes([])
})

const theoryWithChildren = computed<TheoryItemWithChildren[]>(() => {
  if (!stats.value?.theory) return []

  return stats.value.theory
    .map((tItem) => {
      // Find matching move in stats to get children and statistics
      const matchingMove = stats.value?.moves.find((m) => m.uci === tItem.uci)
      const count = matchingMove ? matchingMove.total : 0

      return {
        ...tItem,
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
</script>

<template>
  <div class="mozer-book" :class="{ blurred: blurred }">
    <div v-if="blurred" class="overlay">
      <n-text strong depth="1">{{ t('features.diamondHunter.stats.reviewModeOverlay') }}</n-text>
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
      <MozerBookRow
        v-for="move in stats?.moves"
        :key="move.uci"
        :move="move"
        :turn="turn"
        :full-move-number="fullMoveNumber"
        :summary-total="stats?.summary?.total || 0"
        @select="handleSelectMove"
      />

      <div v-if="!loading && (!stats || stats.moves.length === 0)" class="empty-state">No data</div>
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
  height: 100%;
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
  flex: 1;
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
</style>
