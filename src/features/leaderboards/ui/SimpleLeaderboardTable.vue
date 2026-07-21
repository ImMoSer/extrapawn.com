<!-- src/components/recordsPage/SimpleLeaderboardTable.vue -->
<script setup lang="ts">
import type { FinishHimLeaderboardEntry } from '@/shared/types/api.types'
import type { DataTableColumns } from 'naive-ui'
import { h, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  entries: { type: Array as PropType<FinishHimLeaderboardEntry[]>, required: true },
  mode: { type: String as PropType<'finish-him'>, required: true },
  colorClass: { type: String, required: true },
})

const router = useRouter()
const { t } = useI18n()

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'wR.svg',
  Queen: 'wQ.svg',
  King: 'wK.svg',
}

const getSubscriptionIcon = (tier?: string) => {
  if (!tier || !tierToPieceMap[tier]) return null
  return `/piece/alpha/${tierToPieceMap[tier]}`
}

const formatTime = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

const handleChallengeClick = (puzzleId?: string) => {
  if (puzzleId) router.push({ name: props.mode, params: { puzzleId } })
}

const columns: DataTableColumns<FinishHimLeaderboardEntry> = [
  { title: t('features.leaderboards.table.rank'), key: 'rank', align: 'center', width: 60 },
  {
    title: t('features.leaderboards.table.player'),
    key: 'username',
    render(row) {
      const icon = getSubscriptionIcon(row.subscriptionTier)
      return h('div', { style: { display: 'flex', alignItems: 'center' } }, [
        icon ? h('img', { src: icon, class: 'tier-icon', style: { marginRight: '8px' } }) : null,
        h(
          'n-a',
          {
            href: `https://lichess.org/@/${row.lichess_id}`,
            target: '_blank',
            style: { fontWeight: 'bold' },
          },
          row.username,
        ),
      ])
    },
  },
  {
    title: t('features.leaderboards.table.time'),
    key: 'best_time',
    align: 'right',
    render: (row) => formatTime(row.best_time),
  },
  {
    title: t('features.leaderboards.table.daysOld'),
    key: 'days_old',
    align: 'right',
    render: (row) => `${row.days_old}d`,
  },
  {
    title: t('features.leaderboards.table.action'),
    key: 'action',
    align: 'center',
    render(row) {
      return h(
        'n-button',
        {
          size: 'small',
          type: 'success',
          onClick: () => handleChallengeClick(row.puzzle_id),
        },
        { default: () => t('features.leaderboards.table.challenge') },
      )
    },
  },
]
</script>

<template>
  <div class="bg-surface border border-border rounded-xl shadow-flat overflow-hidden flex flex-col mb-5">
    <div class="p-3.5 border-b border-border bg-elevated/40">
      <h3 class="m-0 text-center font-display font-extrabold text-lg text-neon-cyan tracking-wider uppercase flex justify-center items-center gap-2.5">
        {{ title }}
      </h3>
    </div>
    <div class="p-3 border-t border-border/20">
      <n-data-table
        :columns="columns"
        :data="entries"
        :row-key="(row: FinishHimLeaderboardEntry) => row.puzzle_id + row.lichess_id"
        size="small"
        striped
      />
    </div>
  </div>
</template>
