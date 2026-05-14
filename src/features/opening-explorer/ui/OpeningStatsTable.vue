<script setup lang="ts">
import { useBoardStore } from '@/entities/game'
import type { LichessMove } from '@/entities/opening'
import type { DataTableColumns } from 'naive-ui'
import { NDataTable, NText } from 'naive-ui'
import { computed, h } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  moves: LichessMove[]
  isReviewMode: boolean
  // Current position stats
  total?: number
  win_p?: number
  draw_p?: number
  loss_p?: number
  avgElo?: number
}>()

const emit = defineEmits<{
  (e: 'select-move', uci: string): void
}>()

const { t } = useI18n()
const boardStore = useBoardStore()

const formatTotal = (total: number) => {
  if (total >= 1000000) return (total / 1000000).toFixed(1) + 'M'
  if (total >= 1000) return (total / 1000).toFixed(1) + 'K'
  return total.toString()
}

const formatMove = (san: string) => {
  const parts = boardStore.fen.split(' ')
  const moveNumber = parts[5]
  const turn = parts[1]
  if (turn === 'w') {
    return `${moveNumber}. ${san}`
  } else {
    return `${moveNumber}... ${san}`
  }
}

const summaryScore = computed(() => {
  if (props.win_p === undefined || props.draw_p === undefined) return 0
  return props.win_p + 0.5 * props.draw_p
})

const summaryDrawPct = computed(() => props.draw_p || 0)
const summaryAvgElo = computed(() => props.avgElo || 0)

const totalGamesCount = computed(() => props.total || 0)

interface StatsTableRow {
  key: string
  uci: string
  san: string
  n: number
  score: number
  drawPct: number
  avgElo: number
  isSummary: boolean
  win_p: number
  draw_p: number
  loss_p: number
}

const tableData = computed<StatsTableRow[]>(() => {
  const summaryRow: StatsTableRow = {
    key: 'summary',
    uci: '',
    san: '',
    n: totalGamesCount.value,
    score: summaryScore.value,
    drawPct: summaryDrawPct.value,
    avgElo: summaryAvgElo.value,
    isSummary: true,
    win_p: props.win_p || 0,
    draw_p: props.draw_p || 0,
    loss_p: props.loss_p || 0,
  }

  const moveRows: StatsTableRow[] = props.moves.map((m) => {
    const score = boardStore.turn === 'white' ? m.win_p + m.draw_p * 0.5 : m.loss_p + m.draw_p * 0.5

    return {
      key: m.uci,
      uci: m.uci,
      san: formatMove(m.san),
      n: m.total,
      score,
      drawPct: m.draw_p,
      avgElo: m.averageRating,
      isSummary: false,
      win_p: m.win_p,
      draw_p: m.draw_p,
      loss_p: m.loss_p,
    }
  })

  return [summaryRow, ...moveRows]
})

const rowProps = (row: StatsTableRow) => {
  if (row.isSummary) {
    return {
      class: 'summary-row',
    }
  }
  return {
    style: 'cursor: pointer;',
    onClick: () => {
      emit('select-move', row.uci)
    },
  }
}

const renderWinrateBar = (win_p: number, draw_p: number, loss_p: number) => {
  return h('div', { class: 'mini-winrate-bar' }, [
    h('div', { class: 'segment white', style: { width: `${win_p}%` } }),
    h('div', { class: 'segment draw', style: { width: `${draw_p}%` } }),
    h('div', { class: 'segment black', style: { width: `${loss_p}%` } }),
  ])
}

const columns = computed<DataTableColumns<StatsTableRow>>(() => [
  {
    title: t('features.diamondHunter.stats.move'),
    key: 'san',
    width: 90,
    render(row) {
      if (row.isSummary) return null
      return h(NText, { strong: true, style: { fontSize: '0.8rem' } }, { default: () => row.san })
    },
  },
  {
    title: 'N',
    key: 'n',
    width: 60,
    align: 'right',
    render(row) {
      return h('span', { style: { fontSize: '0.8rem' } }, formatTotal(row.n))
    },
  },
  {
    title: '%',
    key: 'score',
    width: 80,
    align: 'right',
    render(row) {
      return h('div', { class: 'score-cell' }, [
        h('span', { style: { fontSize: '0.8rem', fontWeight: 'bold' } }, row.score.toFixed(1)),
        renderWinrateBar(row.win_p, row.draw_p, row.loss_p),
      ])
    },
  },
  {
    title: '=%',
    key: 'drawPct',
    width: 50,
    align: 'right',
    render(row) {
      return h('span', { style: { fontSize: '0.8rem', opacity: 0.8 } }, row.drawPct.toFixed(1))
    },
  },
  {
    title: 'Av',
    key: 'avgElo',
    width: 60,
    align: 'right',
    render(row) {
      return h(
        NText,
        { depth: 3, style: { fontSize: '0.8rem' } },
        { default: () => row.avgElo || '-' },
      )
    },
  },
])
</script>

<template>
  <div class="stats-container" :class="{ blurred: !isReviewMode }">
    <div v-if="!isReviewMode" class="overlay">
      <n-text strong depth="1">{{ t('features.diamondHunter.stats.reviewModeOverlay') }}</n-text>
    </div>

    <!-- Global Winrate Bar -->
    <div v-if="total !== undefined" class="global-winrate">
      <div class="winrate-labels">
        <span class="label-white">{{ Math.round(win_p || 0) }}%</span>
        <span class="label-draw">{{ Math.round(draw_p || 0) }}%</span>
        <span class="label-black">{{ Math.round(loss_p || 0) }}%</span>
      </div>
      <div class="winrate-bar-wrapper">
        <div class="segment white" :style="{ width: (win_p || 0) + '%' }"></div>
        <div class="segment draw" :style="{ width: (draw_p || 0) + '%' }"></div>
        <div class="segment black" :style="{ width: (loss_p || 0) + '%' }"></div>
      </div>
    </div>

    <n-data-table
      :columns="columns"
      :data="tableData"
      :pagination="false"
      :bordered="false"
      size="small"
      class="stats-table"
      :row-props="rowProps"
    />
  </div>
</template>

<style scoped lang="scss">
.stats-container {
  position: relative;
  background: var(--color-bg-secondary);
  border-radius: 8px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  transition: all 0.3s ease;
}

.blurred {
  .stats-table,
  .global-winrate {
    filter: blur(12px);
    opacity: 0.4;
    pointer-events: none;
  }
}

.overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(4px);
}

.global-winrate {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid var(--color-border);

  .winrate-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.7rem;
    font-weight: 800;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;

    .label-white {
      color: #fff;
    }

    .label-draw {
      color: #888;
    }

    .label-black {
      color: #444;
    }
  }

  .winrate-bar-wrapper {
    display: flex;
    height: 8px;
    border-radius: 2px;
    overflow: hidden;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
  }
}

.score-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.score-text-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.draw-pct-label {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-left: 4px;
}

.mini-winrate-bar {
  display: flex;
  height: 4px;
  width: 100%;
  border-radius: 1px;
  overflow: hidden;
}

.segment {
  height: 100%;
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);

  &.white {
    background: #f0f0f0;
  }

  &.draw {
    background: #888888;
  }

  &.black {
    background: #262421;
  }
}

:deep(.stats-table) {
  .n-data-table-td {
    background-color: transparent;
    padding: 4px 6px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .n-data-table-th {
    font-size: 0.75rem;
    padding: 6px 6px !important;
    font-weight: bold;
    color: var(--color-text-secondary);
    background-color: rgba(255, 255, 255, 0.03);
    border-bottom: 2px solid var(--color-border);
  }

  .summary-row {
    .n-data-table-td {
      background-color: rgba(255, 255, 255, 0.05) !important;
      font-weight: bold;
      border-bottom: 2px solid var(--color-border);
      padding: 8px 6px !important;
    }
  }

  .n-data-table-tr:hover:not(.summary-row) {
    .n-data-table-td {
      background-color: rgba(255, 255, 255, 0.08) !important;
    }
  }
}
</style>
