<!-- src/features/leaderboards/ui/PlanStreakLeaderboardTable.vue -->
<script setup lang="ts">
import type { PlanStreakLeaderboardResponse, PlanStreakLeaderboardEntry } from '@/shared/types/api.types'
import type { DataTableColumns } from 'naive-ui'
import { computed, h, ref, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'
import { NTabs, NTabPane, NSpin, NEmpty, NDataTable } from 'naive-ui'

import { tokens } from '@/shared/theme/tokens'

const props = defineProps({
  title: { type: String, required: true },
  entries: {
    type: Object as PropType<PlanStreakLeaderboardResponse>,
    required: true,
  },
  colorClass: { type: String, required: true },
  isLoading: { type: Boolean, default: false },
})

const { t } = useI18n()

const activeTab = ref<'Novice' | 'Pro' | 'Master'>('Novice')

const currentEntries = computed(() => {
  if (!props.entries) return []
  return props.entries[activeTab.value] || []
})

const tierToPieceMap: Record<string, string> = {
  Pawn: 'wP.svg',
  pawn: 'wP.svg',
  Knight: 'wN.svg',
  Bishop: 'wB.svg',
  Rook: 'rubyDiamond.svg',
  VIP: 'rubyDiamond.svg',
  vip: 'rubyDiamond.svg',
  Queen: 'wQ.svg',
  queen: 'wQ.svg',
  King: 'wK.svg',
  king: 'wK.svg',
  Administrator: 'wK.svg',
}

const getSubscriptionIcon = (tierStr: string) => {
  const actualTier = tierStr && tierToPieceMap[tierStr] ? tierStr : 'Pawn'
  return `/piece/alpha/${tierToPieceMap[actualTier]}`
}

const formatDuration = (ms?: number): string => {
  if (ms === undefined || ms === null) return '-'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

const columns = computed<DataTableColumns<PlanStreakLeaderboardEntry>>(() => {
  return [
    {
      title: '#',
      key: 'rank',
      align: 'center',
      width: 40,
      render: (_, idx) => (idx + 1).toString(),
    },
    {
      title: t('features.leaderboards.table.player', 'Player'),
      key: 'username',
      minWidth: 120,
      ellipsis: { tooltip: true },
      render(row) {
        const tier = row.tier || 'Pawn'
        const id = row.id
        const icon = getSubscriptionIcon(tier)
        return h('div', { style: { display: 'flex', alignItems: 'center' } }, [
          icon ? h('img', { src: icon, class: 'tier-icon', style: { marginRight: '6px', width: '20px', height: '20px' } }) : null,
          h(
            'n-a',
            {
              href: `https://lichess.org/@/${id}`,
              target: '_blank',
              style: { fontWeight: 'bold' },
            },
            row.username,
          ),
        ])
      },
    },
    {
      title: t('features.leaderboards.table.streakDays', 'Streak'),
      key: 'current_streak',
      align: 'center' as const,
      width: 95,
      render: (row) => h('span', { style: { fontWeight: 'bold', color: tokens.orange } }, `${row.current_streak || 0} 🔥`),
    },
    {
      title: t('features.leaderboards.table.plans', 'Plans'),
      key: 'completed_count',
      align: 'center' as const,
      width: 90,
      render: (row) => h('span', { style: { fontWeight: 'bold', color: tokens.success } }, `${row.completed_count || 0} ✅`),
    },
    {
      title: t('features.leaderboards.table.solved', 'Solved'),
      key: 'puzzles_solved',
      align: 'center' as const,
      width: 90,
      render: (row) => h('span', { style: { fontWeight: 'bold' } }, row.puzzles_solved || 0),
    },
    {
      title: t('features.leaderboards.table.time', 'Time'),
      key: 'time_spent',
      align: 'center' as const,
      width: 100,
      render: (row) => h('span', { style: { fontFamily: 'monospace' } }, formatDuration(row.time_spent)),
    },
    {
      title: '%',
      key: 'accuracy',
      align: 'right' as const,
      width: 65,
      render(row) {
        const acc = row.accuracy
        if (acc === undefined || acc === null) return '-'
        return h(
          'span',
          {
            style: {
              color:
                acc > 70
                  ? tokens.success
                  : acc > 40
                    ? tokens.warning
                    : tokens.danger,
              fontWeight: 'bold',
            },
          },
          `${acc.toFixed(1)}%`,
        )
      },
    },
  ]
})
</script>

<template>
  <div class="bg-surface border border-border rounded-xl shadow-flat overflow-hidden flex flex-col mb-5">
    <div class="px-5 py-4 max-md:px-3.5 max-md:py-2.5 border-b border-border bg-elevated/40">
      <h3 class="m-0 text-center font-display font-extrabold text-xl max-md:text-base tracking-wider uppercase text-neon-purple flex justify-center items-center gap-3">
        {{ title }}
      </h3>
    </div>

    <div class="p-3 max-md:p-0.5">
      <div v-if="isLoading" class="flex justify-center items-center h-[200px]">
        <NSpin size="large" />
      </div>
      <template v-else>
        <NTabs v-model:value="activeTab" type="segment" animated>
          <NTabPane name="Novice" tab="Novice" />
          <NTabPane name="Pro" tab="Pro" />
          <NTabPane name="Master" tab="Master" />
        </NTabs>
        <div class="mt-3 border border-border rounded-lg overflow-hidden bg-void/40">
          <NDataTable
            v-if="currentEntries.length > 0"
            :columns="columns"
            :data="currentEntries"
            :row-key="(row: PlanStreakLeaderboardEntry) => row.id"
            size="small"
            striped
            :max-height="400"
            :scroll-x="400"
          />
          <NEmpty v-else :description="t('pages.userCabinet.stats.noData')" />
        </div>
      </template>
    </div>
  </div>
</template>
