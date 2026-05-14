<script setup lang="ts">
import { pgnService, pgnTreeVersion, type PgnNode } from '@/shared/lib/pgn/PgnService'
import { type SessionMove } from '@/shared/types/openingSparring.types'
import {
  NDataTable,
  NTag,
  NText,
  NTooltip,
  type DataTableBaseColumn,
  type DataTableColumns,
} from 'naive-ui'
import { computed, h } from 'vue'
import { useOpeningSparringStore } from '../index'

const openingStore = useOpeningSparringStore()

interface PlayoutPair {
  number: number
  white: SessionMove | null
  black: SessionMove | null
}

const playoutPairs = computed(() => {
  const allPlayout = openingStore.sessionHistory.filter((m: SessionMove) => m.phase === 'playout')
  if (allPlayout.length === 0) return []

  const groups = new Map<number, { white: SessionMove | null; black: SessionMove | null }>()

  for (const move of allPlayout) {
    const num = move.moveNumber || 0
    if (!groups.has(num)) {
      groups.set(num, { white: null, black: null })
    }
    const pair = groups.get(num)!
    // If move.turn is 'w', it means it was White's move.
    // Wait, standard FEN "w" means "White to move".
    // In SessionMove, we derived `turn` from `fenBefore`.
    // If fenBefore had "w", then it was White's turn to move. Correct.
    if (move.turn === 'w') {
      pair.white = move
    } else {
      pair.black = move
    }
  }

  return Array.from(groups.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([num, pair]) => ({
      number: num,
      white: pair.white,
      black: pair.black,
    }))
})

const getQualityColor = (nag?: string) => {
  switch (nag) {
    case '??':
      return 'var(--color-nag-blunder)'
    case '?':
      return 'var(--color-nag-mistake)'
    case '?!':
      return 'var(--color-nag-inaccuracy)'
    case '!':
      return 'var(--color-nag-best)'
    case '!!':
      return 'var(--color-nag-brilliant)'
    default:
      // Includes 'OK' or any other
      return 'transparent'
  }
}

const renderMoveCell = (move: SessionMove | null) => {
  if (!move) return null

  const activeMainlinePly = computed(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _v = pgnTreeVersion.value
    let current: PgnNode | null = pgnService.getCurrentNode()
    while (current && current.ply > 0) {
      const histMove = openingStore.sessionHistory.find((m: SessionMove) => m.ply === current?.ply)
      if (histMove && histMove.moveUci === current.uci) {
        return current.ply
      }
      current = current.parent || null
    }
    return 0
  })

  const currentNode = pgnService.getCurrentNode()
  const isCurrentNode = move.ply === activeMainlinePly.value
  const isDeviationPoint = isCurrentNode && currentNode?.ply !== move.ply

  // Render Checkmark for OK
  const isOk = move.nag === 'OK'

  let background = 'transparent'
  let border = '1px solid transparent'
  let boxShadow = 'none'
  let textColor = 'inherit'

  if (isCurrentNode) {
    if (isDeviationPoint) {
      background = 'rgba(255, 152, 0, 0.2)'
      border = '1px solid rgba(255, 152, 0, 0.4)'
      boxShadow = '0 0 8px rgba(255, 152, 0, 0.3)'
      textColor = '#ff9800'
    } else {
      background = 'rgba(0, 163, 255, 0.3)'
      border = '1px solid rgba(0, 163, 255, 0.3)'
      boxShadow = '0 0 10px rgba(0, 163, 255, 0.4)'
      textColor = 'var(--neon-cyan)'
    }
  }

  const globalIndex = openingStore.sessionHistory.indexOf(move)

  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        cursor: openingStore.isReviewMode ? 'pointer' : 'default',
        background,
        border,
        boxShadow,
        padding: '2px 4px',
        borderRadius: '4px',
        color: textColor,
        justifyContent: 'center',
        margin: '0 2px',
        transition: 'all 0.2s ease',
      },
      onClick: openingStore.isReviewMode
        ? () => openingStore.setReviewMove(globalIndex)
        : undefined,
    },
    [
      h(
        NText,
        { strong: true, style: { color: textColor, fontSize: '13px' } },
        { default: () => move.san || move.moveUci },
      ),
      isOk
        ? h(NText, { style: { color: 'green', fontSize: '12px' } }, { default: () => '✅' })
        : move.nag && move.nag !== 'OK'
          ? h(
              NTag,
              {
                size: 'small',
                round: true,
                bordered: false,
                style: {
                  backgroundColor: getQualityColor(move.nag),
                  color: '#000',
                  fontWeight: '800',
                  fontSize: '9px',
                  height: '14px',
                  padding: '0 3px',
                  lineHeight: '14px',
                },
              },
              { default: () => move.nag },
            )
          : null,
    ],
  )
}

const renderEval = (move: SessionMove | null) => {
  if (!move?.evaluation) return null

  const cp = move.evaluation.score_cp
  const val = (cp / 100).toFixed(1)
  const displayVal = cp > 0 ? `+${val}` : val

  let color = '#aaa'
  if (cp > 150) color = '#4caf50'
  else if (cp < -150) color = '#f44336'

  const cellContent = h(
    'div',
    {
      style: {
        fontWeight: 'bold',
        color,
        fontSize: '11px',
        textAlign: 'center',
      },
    },
    displayVal,
  )

  if (move.evaluation.win_prob !== undefined) {
    const label = `Win Prob: ${move.evaluation.win_prob}%`
    return h(
      NTooltip,
      { trigger: 'hover' },
      {
        trigger: () => cellContent,
        default: () => label,
      },
    )
  }

  return cellContent
}

const createColorColumns = (side: 'white' | 'black'): DataTableBaseColumn<PlayoutPair>[] => [
  {
    title: 'Move',
    key: `${side}_move`,
    width: 65,
    align: 'center',
    render: (row: PlayoutPair) => renderMoveCell(row[side]),
  },
  {
    title: 'Eval',
    key: `${side}_eval`,
    width: 45,
    align: 'center',
    render: (row: PlayoutPair) => renderEval(row[side]),
  },
]

const columns = computed<DataTableColumns<PlayoutPair>>(() => [
  {
    title: '#',
    key: 'number',
    width: 35,
    align: 'center',
    render: (row) =>
      h(NText, { depth: 3, style: { fontSize: '11px' } }, { default: () => `${row.number}.` }),
  },
  {
    title: 'White',
    key: 'whiteGroup',
    align: 'center',
    children: createColorColumns('white'),
  },
  {
    title: 'Black',
    key: 'blackGroup',
    align: 'center',
    children: createColorColumns('black'),
  },
])
</script>

<template>
  <div class="playout-analysis-table">
    <n-data-table
      :columns="columns"
      :data="playoutPairs"
      :pagination="false"
      :bordered="false"
      size="small"
      class="analysis-table"
    />
  </div>
</template>

<style scoped lang="scss">
.playout-analysis-table {
  background: transparent;
}

:deep(.analysis-table) {
  background: transparent;

  .n-data-table-td {
    background-color: transparent;
    padding: 4px 2px !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .n-data-table-th {
    background-color: rgba(255, 255, 255, 0.03);
    font-size: 10px;
    padding: 4px 2px !important;
    font-weight: bold;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    text-align: center;
  }

  /* Разделитель между группами */
  .n-data-table-th[colspan='4'] {
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }
}
</style>
